import { NextResponse } from "next/server";

type ProblemMetadata = {
  name: string;
  platform: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
};

function titleCase(input: string) {
  return input
    .trim()
    .split(/\s+/g)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function extractGfg(url: URL): ProblemMetadata | null {
  if (url.hostname !== "www.geeksforgeeks.org") return null;
  const m = url.pathname.match(/\/problems\/([^/]+)\/?/i);
  if (!m) return null;

  const slug = decodeURIComponent(m[1] ?? "").replace(/-/g, " ");
  const name = titleCase(slug);

  return { name, platform: "GeeksforGeeks", difficulty: "Medium", topic: "General" };
}

function parseDifficulty(text: string): "Easy" | "Medium" | "Hard" | null {
  const t = text.toLowerCase();
  if (t.includes("difficulty") && t.includes("easy")) return "Easy";
  if (t.includes("difficulty") && t.includes("medium")) return "Medium";
  if (t.includes("difficulty") && t.includes("hard")) return "Hard";
  return null;
}

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractLeetCode(url: URL): ProblemMetadata | null {
  if (!url.hostname.includes("leetcode.com")) return null;
  const m = url.pathname.match(/\/problems\/([^/]+)\/?/i);
  if (!m) return null;

  const slug = decodeURIComponent(m[1] ?? "").replace(/-/g, " ");
  const name = titleCase(slug);

  return { name, platform: "LeetCode", difficulty: "Medium", topic: "General" };
}

function extractCodeforces(url: URL): ProblemMetadata | null {
  if (!url.hostname.includes("codeforces.com")) return null;
  // Patterns: /contest/123/problem/A or /problemset/problem/123/A
  const m = url.pathname.match(/\/problem(?:\/(\d+))?\/([A-Z]\d?)/i) || url.pathname.match(/\/contest\/(\d+)\/problem\/([A-Z]\d?)/i);
  
  const name = m ? `CF ${m[1]}-${m[2]}` : "Codeforces Problem";
  return { name, platform: "Codeforces", difficulty: "Medium", topic: "General" };
}

function extractGeneric(url: URL): ProblemMetadata {
  const host = url.hostname.replace("www.", "");
  const platform = host.charAt(0).toUpperCase() + host.slice(1).split(".")[0];
  const slug = url.pathname.split("/").filter(Boolean).pop() || "Problem";
  const name = titleCase(slug.replace(/-/g, " "));

  return { name, platform, difficulty: "Medium", topic: "General" };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const link = searchParams.get("url");
  if (!link) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let url: URL;
  try {
    const target = link.trim().startsWith("http") ? link.trim() : `https://${link.trim()}`;
    url = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const base = extractGfg(url) || extractLeetCode(url) || extractCodeforces(url) || extractGeneric(url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error("Fetch failed");
    
    const html = await res.text();
    const plain = stripHtml(html);

    // Try <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      let cleaned = titleMatch[1].trim();
      // Remove platform suffixes
      cleaned = cleaned.replace(/\s*\|\s*GeeksforGeeks\s*$/i, "");
      cleaned = cleaned.replace(/\s*-\s*LeetCode\s*$/i, "");
      cleaned = cleaned.replace(/\s*-\s*Codeforces\s*$/i, "");
      cleaned = cleaned.replace(/\s*-\s*AtCoder\s*$/i, "");
      
      if (cleaned.length >= 3 && !cleaned.toLowerCase().includes("access denied")) {
        base.name = cleaned;
      }
    }

    const diff =
      parseDifficulty(html) ??
      parseDifficulty(plain) ??
      (html.match(/Difficulty\s*[:\-]\s*(Easy|Medium|Hard)/i)?.[1] as any) ??
      null;
    if (diff) base.difficulty = diff;

    return NextResponse.json(base);
  } catch (e) {
    // Fallback to URL-derived data if scraping fails.
    return NextResponse.json(base);
  }
}

