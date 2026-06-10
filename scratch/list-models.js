import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_FALLBACK;

if (!apiKey) {
  console.error("No GEMINI_API_KEY found in env!");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: { "User-Agent": "aistudio-build" }
  }
});

async function run() {
  try {
    console.log("Listing models...");
    const response = await ai.models.list();
    console.log("Testing generateContent with gemini-flash-latest...");
    const genResponse = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: "Hello, tell me a 1-sentence joke."
    });
    console.log("Response text:", genResponse.text);
  } catch (err) {
    console.error("Failed to list models:", err);
  }
}

run();
