import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const model = apiKey
  ? new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: "gemini-2.5-flash" })
  : null;

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

function extractBasicInfo(url: URL): ProblemMetadata {
  const host = url.hostname.replace("www.", "");
  const platform = host.charAt(0).toUpperCase() + host.slice(1).split(".")[0];
  const slug = url.pathname.split("/").filter(Boolean).pop() || "Problem";
  const name = titleCase(slug.replace(/-/g, " "));

  return { 
    name, 
    platform: platform === "GeeksforGeeks" ? "GeeksforGeeks" : platform === "Leetcode" ? "LeetCode" : platform, 
    difficulty: "Medium", 
    topic: "General" 
  };
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

  const base = extractBasicInfo(url);

  if (!model) {
    return NextResponse.json(base);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

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
    // Strip scripts and styles to reduce token count
    const cleanedHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                           .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                           .substring(0, 50000); // Limit context size

    const prompt = `
      Analyze the following HTML content of a competitive programming problem from ${base.platform}.
      Extract the following information and return it in strict JSON format:
      {
        "name": "The exact problem name",
        "difficulty": "Easy" | "Medium" | "Hard",
        "topic": "The primary DSA topic (e.g., Dynamic Programming, Arrays, Graphs, Sliding Window, Two Pointers, Greedy, Math, Tree, String, Stack, Queue, Linked List)"
      }

      URL: ${url.toString()}
      HTML Content Snippet:
      ${cleanedHtml}
    `;

    const result = await model!.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON from Gemini response (handle potential markdown formatting)
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (jsonStr) {
      const aiMeta = JSON.parse(jsonStr);
      if (aiMeta.name) base.name = aiMeta.name;
      if (aiMeta.difficulty) base.difficulty = aiMeta.difficulty;
      if (aiMeta.topic) base.topic = aiMeta.topic;
    }

    return NextResponse.json(base);
  } catch (e) {
    console.error("Gemini Extraction Error:", e);
    // Fallback to URL-derived data if scraping or AI fails.
    return NextResponse.json(base);
  }
}

