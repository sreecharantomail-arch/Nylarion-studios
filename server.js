import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || 'gpt-6-luna';
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(express.static(__dirname));

let nylarionData = null;
async function loadNylarionData() {
  nylarionData = JSON.parse(await fs.readFile(path.join(__dirname, 'nylarion-data.json'), 'utf8'));
}

const SYSTEM_PROMPT_BASE = `You are NYLARION AI, the official AI voice assistant for Nylarion Studios.
Answer the user's actual question helpfully and naturally. When the user asks about Nylarion Studios, its identity, mission, vision, values, games, projects, roadmap, website, contact details, or plans, use ONLY the supplied Nylarion Knowledge Base as the source of truth.
Never invent Nylarion facts, unreleased game names, prices, release dates, team members, locations, social accounts, partnerships, or features. If a Nylarion fact is not in the knowledge base, say the studio has not published that information yet.
For general questions, answer normally. Understand typos and follow-up questions. Keep spoken answers concise, normally 1 to 5 short sentences. Do not use markdown, bullets, emojis, tables, or special formatting. If asked for the contact email, give nylarionstudios@gmail.com exactly.`;

function buildInstructions() {
  return `${SYSTEM_PROMPT_BASE}\n\nNYLARION STUDIO KNOWLEDGE BASE:\n${JSON.stringify(nylarionData, null, 2)}`;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    backend: true,
    aiConfigured: Boolean(client),
    provider: 'openai',
    model,
    knowledgeBaseLoaded: Boolean(nylarionData)
  });
});

app.get('/api/nylarion', (_req, res) => res.json(nylarionData || {}));

app.post('/api/chat', async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({ error: 'OpenAI API key is not configured. Add OPENAI_API_KEY to your .env file and restart the server.' });
    }

    const { message, history = [] } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
          .slice(-12)
          .map(x => ({ role: x.role, content: x.content.slice(0, 2000) }))
      : [];

    const input = [
      ...safeHistory,
      { role: 'user', content: message.trim().slice(0, 4000) }
    ];

    const response = await client.responses.create({
      model,
      instructions: buildInstructions(),
      input
    });

    const reply = response.output_text?.trim();
    if (!reply) return res.status(502).json({ error: 'OpenAI returned an empty response.' });
    res.json({ reply });
  } catch (error) {
    console.error('OpenAI backend error:', error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: error?.error?.message || error?.message || 'OpenAI backend request failed.'
    });
  }
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) return res.sendFile(path.join(__dirname, 'index.html'));
  next();
});

loadNylarionData()
  .then(() => app.listen(port, '0.0.0.0', () => console.log(`Nylarion Studios + OpenAI running on port ${port}`)))
  .catch(error => {
    console.error('Failed to load Nylarion knowledge base:', error);
    process.exit(1);
  });
