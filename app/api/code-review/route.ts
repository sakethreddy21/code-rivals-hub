import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function POST(req: Request) {
  try {
    const { code, problemName, topic, language } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const prompt = `
      You are an expert competitive programmer and technical interviewer. 
      Analyze the following code for the problem: "${problemName || "Unknown"}" (Topic: ${topic || "DSA"}).
      Language: ${language || "Unknown"}

      Code:
      ${code}

      Provide a concise review in strict JSON format:
      {
        "timeComplexity": "O(?)",
        "spaceComplexity": "O(?)",
        "isOptimal": boolean,
        "optimizations": "Brief suggestion for better performance if any",
        "feedback": "1-2 sentences on code quality or logic",
        "rating": "A" | "B" | "C" | "D" (Overall grade)
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) throw new Error("Invalid AI response");
    
    return NextResponse.json(JSON.parse(jsonStr));
  } catch (error: any) {
    console.error("Code Review Error:", error);
    return NextResponse.json({ 
      error: "Failed to review code",
      details: error.message
    }, { status: 500 });
  }
}
