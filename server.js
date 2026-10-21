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

const rawApiKey = (process.env.OPENAI_API_KEY || '').trim();
const hasRealKey = Boolean(rawApiKey && !rawApiKey.includes('your_openai_api_key') && rawApiKey.startsWith('sk-'));
const client = hasRealKey ? new OpenAI({ apiKey: rawApiKey }) : null;

app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(express.static(__dirname));

let nylarionData = null;
async function loadNylarionData() {
  const content = await fs.readFile(path.join(__dirname, 'nylarion-data.json'), 'utf8');
  nylarionData = JSON.parse(content);
}

const SYSTEM_PROMPT_BASE = `You are NYLARION AI, the official AI voice assistant for Nylarion Studios.
Answer the user's actual question helpfully and naturally. When the user asks about Nylarion Studios, its identity, mission, vision, values, games, projects, roadmap, website, contact details, or plans, use ONLY the supplied Nylarion Knowledge Base as the source of truth.
Never invent Nylarion facts, unreleased game names, prices, release dates, team members, locations, social accounts, partnerships, or features. If a Nylarion fact is not in the knowledge base, say the studio has not published that information yet.
For general questions, answer normally. Understand typos and follow-up questions. Keep spoken answers concise, normally 1 to 5 short sentences. Do not use markdown, bullets, emojis, tables, or special formatting. If asked for the contact email, give nylarionstudios@gmail.com exactly.`;

function buildInstructions() {
  return `${SYSTEM_PROMPT_BASE}\n\nNYLARION STUDIO KNOWLEDGE BASE:\n${JSON.stringify(nylarionData, null, 2)}`;
}

/**
 * Intelligent Grounded Knowledge Base Engine
 * Provides authentic, instant answers about Nylarion Studios strictly from nylarion-data.json
 * when an OpenAI API key is unavailable, invalid, or experiencing rate limits/network issues.
 */
function answerFromKnowledgeBase(query) {
  if (!nylarionData) {
    return "Nylarion Studios is an independent game development studio dedicated to building immersive games and creative digital experiences.";
  }

  const q = query.toLowerCase();

  // Contact / email inquiries
  if (q.includes('contact') || q.includes('email') || q.includes('reach') || q.includes('touch') || q.includes('hire') || q.includes('collaborate')) {
    return `You can contact Nylarion Studios directly by email at ${nylarionData.contact?.email || 'nylarionstudios@gmail.com'}. We welcome inquiries regarding partnerships, game development, and collaborations.`;
  }

  // Games / portfolio / projects
  if (q.includes('game') || q.includes('project') || q.includes('portfolio') || q.includes('title') || q.includes('play')) {
    const portfolio = nylarionData.portfolio || [];
    const titles = portfolio.map(p => `${p.title} (${p.category} - ${p.status})`).join(', ');
    return `Nylarion Studios currently has three primary development tracks: ${titles}. Our debut titles focus on original worlds and engaging gameplay across Mobile and PC platforms.`;
  }

  // Technology / engines / platforms
  if (q.includes('tech') || q.includes('engine') || q.includes('platform') || q.includes('code') || q.includes('tool') || q.includes('three')) {
    const platforms = (nylarionData.studio?.platforms || ['Mobile', 'PC']).join(' and ');
    return `Nylarion Studios develops for ${platforms}, leveraging modern game engines, WebGL and Three.js for interactive 3D web experiences, and clean design architectures focused on technical precision.`;
  }

  // Mission / vision / philosophy / purpose
  if (q.includes('mission') || q.includes('purpose') || q.includes('why') || q.includes('goal')) {
    return `${nylarionData.studio?.mission || 'To create engaging and memorable games that combine creativity, technology, and meaningful player experiences.'} Our purpose is creating immersive games guided by creativity, quality, and innovation.`;
  }

  if (q.includes('vision') || q.includes('future') || q.includes('ambition')) {
    return `${nylarionData.studio?.vision || 'To grow into a globally recognized independent game development studio known for quality, innovation, and unforgettable experiences.'}`;
  }

  if (q.includes('philosophy') || q.includes('quality') || q.includes('design')) {
    return `${nylarionData.studio?.development_philosophy || 'Quality over quantity. Games are built with clean design, technical precision, and authentic player feedback.'}`;
  }

  // Studio values / pillars
  if (q.includes('value') || q.includes('pillar') || q.includes('principle') || q.includes('creativity') || q.includes('innovation') || q.includes('community')) {
    const vals = (nylarionData.values || []).map(v => `${v.name} (${v.description})`).join(' ');
    return `Our core studio values are: ${vals}`;
  }

  // Status / updates / journey / roadmap
  if (q.includes('status') || q.includes('update') || q.includes('journey') || q.includes('roadmap') || q.includes('when') || q.includes('release')) {
    return `${nylarionData.journey?.current_update || 'Nylarion Studios is currently focusing its energy on game development.'} ${nylarionData.journey?.announcements || 'Upcoming games and interactive experiences will be announced on this website.'}`;
  }

  // Studio identity / about / greeting
  if (q.includes('who') || q.includes('about') || q.includes('what is') || q.includes('nylarion') || q.includes('studio') || q.includes('hi') || q.includes('hello')) {
    return `${nylarionData.studio?.name} is an ${nylarionData.studio?.type?.toLowerCase() || 'independent game development studio'} established in ${nylarionData.studio?.established || 2026}. Our tagline is "${nylarionData.studio?.tagline || 'Play Beyond Reality.'}" and our primary focus is creating memorable games with clean design and technical precision.`;
  }

  // Default fallback grounded in studio description
  return `${nylarionData.studio?.description || 'Nylarion Studios is an independent game development studio dedicated to building immersive games and creative digital experiences.'} How may I assist you with information about our games, philosophy, or studio?`;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    backend: true,
    aiConfigured: hasRealKey,
    provider: hasRealKey ? 'openai' : 'grounded-kb',
    model: hasRealKey ? model : 'nylarion-kb-engine',
    knowledgeBaseLoaded: Boolean(nylarionData)
  });
});

// Studio Knowledge Base raw data endpoint
app.get('/api/nylarion', (_req, res) => res.json(nylarionData || {}));

// AI Chatbot endpoint with OpenAI integration + Grounded Fallback
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const cleanMessage = message.trim();

    // If a live OpenAI client is available, attempt the OpenAI API request first
    if (client) {
      try {
        const safeHistory = Array.isArray(history)
          ? history
              .filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
              .slice(-10)
              .map(x => ({ role: x.role, content: x.content.slice(0, 2000) }))
          : [];

        const input = [
          ...safeHistory,
          { role: 'user', content: cleanMessage.slice(0, 4000) }
        ];

        const response = await client.responses.create({
          model,
          instructions: buildInstructions(),
          input
        });

        const reply = response.output_text?.trim();
        if (reply) {
          return res.json({ reply, provider: 'openai' });
        }
      } catch (openAiError) {
        console.warn('OpenAI API request failed, falling back to grounded knowledge base:', openAiError?.message || openAiError);
      }
    }

    // Grounded knowledge base answer (active fallback when OpenAI is not configured or errors out)
    const reply = answerFromKnowledgeBase(cleanMessage);
    res.json({ reply, provider: 'grounded-kb' });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred while processing your request.'
    });
  }
});

// Contact and collaboration form endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body ?? {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Please provide your name.' });
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a message with at least 5 characters.' });
    }

    // In production, integrate with SendGrid, Resend, or SMTP. For now, log safely on server.
    console.log(`[Contact Submission] From: ${name.trim()} <${email.trim()}> | Subject: ${subject?.trim() || 'General Inquiry'}`);
    console.log(`[Contact Message] ${message.trim().slice(0, 500)}`);

    res.json({
      ok: true,
      message: 'Thank you for reaching out to Nylarion Studios! Your message has been received, and we will get back to you soon.'
    });
  } catch (error) {
    console.error('Contact endpoint error:', error);
    res.status(500).json({ error: 'Unable to process your message at this time. Please email us directly at nylarionstudios@gmail.com.' });
  }
});

// Single-page application route fallback
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  next();
});

// Start server
loadNylarionData()
  .then(() => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Nylarion Studios server running on http://localhost:${port}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use.`);
      } else {
        console.error('Server error:', err);
      }
    });
  })
  .catch((error) => {
    console.error('Failed to load Nylarion knowledge base:', error);
    process.exit(1);
  });
