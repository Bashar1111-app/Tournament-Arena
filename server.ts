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
  const maxRetries = 5; // Increased back to 5 for high demand scenarios
  let attempt = 0;

  const performAnalysis = async () => {
    const { imageBase64, homePlayerName, awayPlayerName } = req.body;
    if (!imageBase64) {
      throw new Error('Image data is required');
    }

    // Use gemini-3.8-flash for the latest high-performance cloud processing
    const modelName = "gemini-3.8-flash";
    
    console.log(`Analyzing match result via Cloud Interactions with: ${modelName} (Attempt ${attempt + 1})`);

    const prompt = `Match Referee AI: High-speed extraction for FC Mobile.
    Inputs: Home Player: "${homePlayerName}", Away Player: "${awayPlayerName}".
    
    Instructions:
    1. Identify Home/Away players from the image names.
    2. Extract scores and match statistics.
    3. Return ONLY the JSON object. Do not include any other text.
    
    Required JSON Structure:
    {
      "isResultScreenshot": boolean,
      "homeScore": number,
      "awayScore": number,
      "homeNameFound": string,
      "awayNameFound": string,
      "isNameMatch": boolean,
      "stats": {
        "home": { "shots": string, "possession": number, "passAccuracy": number, "fouls": number, "offsides": number },
        "away": { "shots": string, "possession": number, "passAccuracy": number, "fouls": number, "offsides": number }
      }
    }`;

    const interaction = await ai.interactions.create({
      model: modelName,
      input: [
        {
          type: "image",
          mime_type: "image/jpeg",
          data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
        },
        {
          type: "text",
          text: prompt
        }
      ],
    });

    let fullOutput = "";
    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        const textContent = step.content?.find(c => c.type === 'text');
        if (textContent && textContent.text) {
          fullOutput += textContent.text;
        }
      }
    }

    if (!fullOutput) throw new Error('Empty AI response from Interactions API');
    
    // Safe JSON extraction to handle potential markdown or extra text
    let parsedData = null;
    const jsonMatch = fullOutput.match(/```json\s*([\s\S]*?)\s*```/) || fullOutput.match(/([\{\[][\s\S]*[\}\]])/);
    
    if (jsonMatch) {
      try {
        parsedData = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error("Partial JSON parse error:", e);
        throw new Error('AI returned invalid JSON format');
      }
    } else {
      try {
        parsedData = JSON.parse(fullOutput.trim());
      } catch (e) {
        throw new Error('Could not extract JSON from AI response');
      }
    }

    return parsedData;
  };

  while (attempt <= maxRetries) {
    try {
      const result = await performAnalysis();
      return res.json(result);
    } catch (error: any) {
      const errorMsg = error?.message || '';
      const isServiceUnavailable = errorMsg.includes('503') || error?.status === 503 || errorMsg.includes('high demand') || errorMsg.includes('overloaded') || errorMsg.includes('UNAVAILABLE');
      
      if (isServiceUnavailable && attempt < maxRetries) {
        attempt++;
        // Longer exponential backoff for 503 errors
        const delay = (2000 * Math.pow(1.5, attempt)) + (Math.random() * 1000); 
        console.log(`Gemini busy (503/High Demand), retrying in ${Math.round(delay)}ms... Attempt ${attempt}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Gemini Analysis Error:', error);
      return res.status(error?.status || 500).json({ 
        error: isServiceUnavailable ? 'AI servers are currently under high load. Please try again in a few seconds.' : 'Failed to analyze match result' 
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
