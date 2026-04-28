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

  // Defaults; we try to override by scraping below.
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const link = searchParams.get("url");
  if (!link) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const base = extractGfg(url);
  if (!base) {
    return NextResponse.json({ error: "Unsupported url" }, { status: 400 });
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "user-agent": "code-rivals-hub/1.0 (+metadata fetch)",
      },
      cache: "no-store",
    });
    const html = await res.text();
    const plain = stripHtml(html);

    // Try <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      const cleaned = titleMatch[1].replace(/\s*\|\s*GeeksforGeeks\s*$/i, "").trim();
      if (cleaned.length >= 3) base.name = cleaned;
    }

    const diff =
      parseDifficulty(html) ??
      parseDifficulty(plain) ??
      (html.match(/Difficulty\s*[:\-]\s*(Easy|Medium|Hard)/i)?.[1] as any) ??
      null;
    if (diff) base.difficulty = diff;

    return NextResponse.json(base);
  } catch {
    // Fallback to URL-derived data if scraping fails.
    return NextResponse.json(base);
  }
}

