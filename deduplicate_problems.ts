import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://metqzcvrunllgbfrnxyy.supabase.co";
const SUPABASE_KEY = "sb_publishable_fcdNohmbppdl8S4UDZd2Vg_ODd9szFP";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeUrl(url: string | undefined | null): string {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = "https://" + clean;
  }
  
  try {
    const parsed = new URL(clean);
    let host = parsed.hostname;
    if (host.startsWith("www.")) {
      host = host.substring(4);
    }
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

async function run() {
  console.log("🚀 Fetching all logged problems from database...");
  const { data: problems, error } = await supabase
    .from("problems")
    .select("id, account_id, name, link, topic, solved_at");

  if (error) {
    console.error("❌ Error fetching problems:", error);
    return;
  }

  if (!problems || problems.length === 0) {
    console.log("ℹ️ No problems found in the database.");
    return;
  }

  console.log(`📊 Found ${problems.length} total problem records in the database.`);

  // Group problems by account_id and normalized link
  const groups: Record<string, typeof problems> = {};
  for (const p of problems) {
    const normUrl = normalizeUrl(p.link);
    if (!normUrl) continue; // Skip entries without links

    const groupKey = `${p.account_id}_${normUrl}`;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(p);
  }

  const idsToDelete: string[] = [];
  let duplicatesGroupCount = 0;

  for (const [key, records] of Object.entries(groups)) {
    if (records.length <= 1) continue;

    duplicatesGroupCount++;
    console.log(`\n🔍 Found duplicate group: "${key}" containing ${records.length} records:`);
    records.forEach(r => console.log(`  - [ID: ${r.id}] Name: "${r.name}", Topic: "${r.topic}", SolvedAt: ${r.solved_at}`));

    // Sort records to keep the best one:
    // 1. Keep a record with a real DS topic (i.e. not "Target Problem") first.
    // 2. Earliest solved_at date next.
    const sorted = [...records].sort((a, b) => {
      const aHasRealTopic = a.topic && a.topic !== "Target Problem";
      const bHasRealTopic = b.topic && b.topic !== "Target Problem";

      if (aHasRealTopic && !bHasRealTopic) return -1;
      if (!aHasRealTopic && bHasRealTopic) return 1;

      const aTime = a.solved_at ? new Date(a.solved_at).getTime() : Infinity;
      const bTime = b.solved_at ? new Date(b.solved_at).getTime() : Infinity;
      return aTime - bTime;
    });

    const keep = sorted[0];
    console.log(`  👉 Keeping: [ID: ${keep.id}] Name: "${keep.name}", Topic: "${keep.topic}"`);

    // The rest are duplicates to delete
    for (let i = 1; i < sorted.length; i++) {
      idsToDelete.push(sorted[i].id);
    }
  }

  if (idsToDelete.length === 0) {
    console.log("\n✅ No duplicate records detected!");
    return;
  }

  console.log(`\n🧹 Found ${idsToDelete.length} duplicate records across ${duplicatesGroupCount} problem groups to delete.`);

  // Delete in batches of 100 to avoid query size limits
  const batchSize = 100;
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    console.log(`🗑️ Deleting batch of ${batch.length} duplicates...`);
    const { error: deleteError } = await supabase
      .from("problems")
      .delete()
      .in("id", batch);

    if (deleteError) {
      console.error("❌ Failed to delete batch:", deleteError);
    }
  }

  console.log("\n🎉 Clean-up completed successfully!");
}

run().catch(console.error);
