import fs from 'fs';
import path from 'path';

async function listModels() {
  const envPath = '/Users/saketh/Documents/algobuilding/code-rivals-hub/.env';
  const envContent = fs.readFileSync(envPath, 'utf8');
  const keyMatch = envContent.match(/GEMINI_API_KEY=(.*)/);
  const key = keyMatch ? keyMatch[1].trim() : '';

  if (!key) {
    console.error("No API key found in .env");
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models?key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Available Models:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
