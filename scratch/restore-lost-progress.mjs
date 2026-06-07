/**
 * restore-lost-progress.mjs
 *
 * Restores Target Problem entries that were wiped from the `problems` table
 * by the buggy "Save Progress" deletion logic (which used a 2-day window
 * instead of today-only).
 *
 * Strategy:
 *  1. Read all today_target_solutions rows where solved = true
 *  2. Cross-reference with today_targets to get the actual problem URLs per day/slot
 *  3. For each solved problem, check if an entry already exists in `problems`
 *  4. Re-insert any missing ones using the solved_at date from today_target_solutions
 *
 * Run with:
 *   node scratch/restore-lost-progress.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://metqzcvrunllgbfrnxyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_fcdNohmbppdl8S4UDZd2Vg_ODd9szFP";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers (mirrors app logic) ──────────────────────────────────────────────

function extractSlug(url) {
  try {
    const pathname = new URL(url.startsWith("http") ? url : `https://${url}`).pathname;
    const parts = pathname.split("/").filter(Boolean);
    const probIdx = parts.indexOf("problems");
    if (probIdx !== -1 && parts[probIdx + 1]) return parts[probIdx + 1];
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

function deriveName(url, idx) {
  try {
    const slug = extractSlug(url);
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || `Target ${idx + 1}`;
  } catch {
    return `Target ${idx + 1}`;
  }
}

function derivePlatform(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("leetcode")) return "LeetCode";
    if (host.includes("geeksforgeeks") || host.includes("gfg")) return "GeeksforGeeks";
    if (host.includes("codeforces")) return "Codeforces";
    if (host.includes("codechef")) return "CodeChef";
    if (host.includes("hackerrank")) return "HackerRank";
    if (host.includes("hackerearth")) return "HackerEarth";
    if (host.includes("atcoder")) return "AtCoder";
    return "Other";
  } catch {
    return "Other";
  }
}

function normalizeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.substring(4);
    let path = parsed.pathname;
    path = path.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    let fallback = url.trim().toLowerCase();
    fallback = fallback.replace(/^(https?:\/\/)?(www\.)?/, "");
    fallback = fallback.replace(/\/+$/, "");
    fallback = fallback.split("?")[0] || "";
    return fallback;
  }
}

// ── Main Restore Logic ───────────────────────────────────────────────────────

async function restore() {
  console.log("🔍 Fetching all solved target solutions...");

  // 1. Get all solved solutions
  const { data: solutions, error: sErr } = await supabase
    .from("today_target_solutions")
    .select("day, slot, account_id, solved, solved_at")
    .eq("solved", true)
    .order("day", { ascending: true });

  if (sErr) { console.error("❌ Error fetching solutions:", sErr.message); process.exit(1); }
  console.log(`   Found ${solutions.length} solved solution records.`);

  // 2. Get all today_targets (links per day)
  const { data: targets, error: tErr } = await supabase
    .from("today_targets")
    .select("day, links");

  if (tErr) { console.error("❌ Error fetching targets:", tErr.message); process.exit(1); }
  console.log(`   Found ${targets.length} day-target records.`);

  // Build a map: day -> links[]
  const dayLinksMap = {};
  for (const t of targets) {
    dayLinksMap[t.day] = Array.isArray(t.links) ? t.links : [];
  }

  // 3. Get all existing problems (to avoid duplicates)
  const { data: existingProblems, error: pErr } = await supabase
    .from("problems")
    .select("id, link, account_id, topic, solved_at");

  if (pErr) { console.error("❌ Error fetching problems:", pErr.message); process.exit(1); }
  console.log(`   Found ${existingProblems.length} existing problem records.`);

  // Build a set of normalized links per account already in DB
  const existingByAccount = {};
  for (const p of existingProblems) {
    if (!existingByAccount[p.account_id]) existingByAccount[p.account_id] = new Set();
    existingByAccount[p.account_id].add(normalizeUrl(p.link));
  }

  // 4. For each solved solution, check if the problem needs to be restored
  const toInsert = [];
  let skipped = 0;

  for (const sol of solutions) {
    const links = dayLinksMap[sol.day];
    if (!links || !links[sol.slot]) {
      console.warn(`   ⚠️  No link found for day=${sol.day} slot=${sol.slot}, skipping.`);
      skipped++;
      continue;
    }

    const link = links[sol.slot]?.trim();
    if (!link) { skipped++; continue; }

    const normLink = normalizeUrl(link);
    const accountExisting = existingByAccount[sol.account_id] ?? new Set();

    if (accountExisting.has(normLink)) {
      // Already exists in problems table — no need to restore
      skipped++;
      continue;
    }

    // Need to restore this one
    const solvedAt = sol.solved_at ?? `${sol.day}T12:00:00.000Z`;
    toInsert.push({
      account_id: sol.account_id,
      name: deriveName(link, sol.slot),
      link,
      platform: derivePlatform(link),
      difficulty: "Medium",
      topic: "Target Problem",
      time_taken: 0,
      notes: `Restored from today_target_solutions (day=${sol.day}, slot=${sol.slot})`,
      solved_at: solvedAt,
    });

    // Eagerly mark as existing so we don't insert duplicates for the same account/link
    accountExisting.add(normLink);
    existingByAccount[sol.account_id] = accountExisting;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Already in DB (skipped): ${skipped}`);
  console.log(`   To restore: ${toInsert.length}`);

  if (toInsert.length === 0) {
    console.log("\n✅ Nothing to restore — all solved problems are already in the database.");
    return;
  }

  console.log("\n🔧 Problems to restore:");
  for (const p of toInsert) {
    console.log(`   [${p.account_id.slice(0,8)}...] ${p.name} (${p.platform}) — solved_at: ${p.solved_at}`);
    console.log(`      Link: ${p.link}`);
  }

  console.log("\n⬆️  Inserting restored records...");

  // Insert in batches of 20
  const BATCH = 20;
  let totalInserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error: iErr } = await supabase.from("problems").insert(batch);
    if (iErr) {
      console.error(`❌ Insert error for batch starting at ${i}:`, iErr.message);
    } else {
      totalInserted += batch.length;
      console.log(`   ✅ Inserted batch ${Math.floor(i / BATCH) + 1} (${batch.length} records)`);
    }
  }

  console.log(`\n🎉 Done! Restored ${totalInserted} problem(s) to the database.`);
}

restore().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
