import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function POST(req: Request) {
  try {
    const { url, name, topic, difficulty } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const prompt = `
      You are a friendly DSA coach. A student is struggling with a competitive programming problem.
      Problem Name: ${name || "Unknown"}
      Topic: ${topic || "Unknown"}
      Difficulty: ${difficulty || "Medium"}
      URL: ${url}

      Provide a subtle, progressive hint that helps them think about the approach without giving away the full logic or code. 
      Focus on the core algorithmic idea or a key observation.
      Keep it brief (max 3 sentences).
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return NextResponse.json({ hint: text });
  } catch (error: any) {
    console.error("Hint API Error:", error);
    return NextResponse.json({ 
      error: "Failed to generate hint",
      details: error.message 
    }, { status: 500 });
  }
}
