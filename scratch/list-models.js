import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.models) {
      const geminiModels = data.models
        .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name);
      console.log("Supported Gemini models for generateContent:", geminiModels);
    } else {
      console.log("No models returned. Error:", data);
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

listModels();
