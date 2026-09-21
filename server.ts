import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API Route to analyze screenshot with basic retry logic
app.post('/api/analyze-result', async (req, res) => {
  const maxRetries = 4; // Increased to 4 retries
  let attempt = 0;

  const performAnalysis = async () => {
    const { imageBase64, homePlayerName, awayPlayerName } = req.body;
    if (!imageBase64) {
      throw new Error('Image data is required');
    }

    // Cycle through models on failure
    let modelName = "gemini-flash-latest";
    if (attempt === 1) modelName = "gemini-3.8-flash";
    if (attempt >= 2) modelName = "gemini-3.1-flash-lite";
    
    if (attempt > 0) {
      console.log(`Retrying with model: ${modelName} (Attempt ${attempt})`);
    }

    const prompt = `Analyze this image for FC Mobile match result:
    - Is it a game result screen?
    - Scores for "${homePlayerName}" and "${awayPlayerName}"?
    - Names match?
    - Statistics for both players:
        * Shots (On Goal)
        * Possession %
        * Pass Accuracy %
        * Fouls
        * Offsides
    Return JSON ONLY: 
    {
      "isResultScreenshot": bool, 
      "homeScore": num, 
      "awayScore": num, 
      "homeNameFound": str, 
      "awayNameFound": str, 
      "isNameMatch": bool, 
      "confidence": num,
      "stats": {
        "home": { "shots": str, "possession": num, "passAccuracy": num, "fouls": num, "offsides": num },
        "away": { "shots": str, "possession": num, "passAccuracy": num, "fouls": num, "offsides": num }
      }
    }`;

    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64.split(',')[1] || imageBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || '{}');
  };

  while (attempt <= maxRetries) {
    try {
      const result = await performAnalysis();
      return res.json(result);
    } catch (error: any) {
      const isServiceUnavailable = error?.message?.includes('503') || error?.status === 503 || error?.message?.includes('high demand') || error?.message?.includes('overloaded');
      
      if (isServiceUnavailable && attempt < maxRetries) {
        attempt++;
        const delay = (1500 * attempt) + (Math.random() * 1000); // Backoff with jitter
        console.log(`Gemini busy (503), retrying in ${Math.round(delay)}ms... Attempt ${attempt}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Gemini Analysis Error:', error);
      return res.status(error?.status || 500).json({ 
        error: isServiceUnavailable ? 'AI service is temporarily busy. Please wait a moment and try again.' : 'Failed to analyze image' 
      });
    }
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
