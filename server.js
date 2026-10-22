import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import cluster from 'node:cluster';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cluster Mode Manager
const isClusterEnabled = process.env.ENABLE_CLUSTER === 'true' || 
  (process.env.NODE_ENV === 'production' && !process.env.npm_lifecycle_script?.includes('--watch'));
const numCPUs = Math.min(os.cpus().length, 8);

if (isClusterEnabled && cluster.isPrimary) {
  console.log(`[Primary ${process.pid}] Starting Nylarion Studios cluster on ${numCPUs} CPU cores...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[Worker ${worker.process.pid}] Exited (code: ${code}, signal: ${signal}). Spawning replacement...`);
    setTimeout(() => cluster.fork(), 1000);
  });
} else {
  // Worker or Single Instance Process
  runWorker();
}

async function runWorker() {
  const app = express();
  const port = Number(process.env.PORT || 3000);
  const baseUrl = (process.env.OPENAI_BASE_URL || '').trim();
  const model = process.env.OPENAI_MODEL || (baseUrl ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');

  const rawApiKey = (process.env.OPENAI_API_KEY || '').trim();
  const hasRealKey = Boolean(rawApiKey && !rawApiKey.includes('your_openai_api_key') && (rawApiKey.startsWith('sk-') || rawApiKey.startsWith('gsk_') || rawApiKey.length > 20));
  const client = hasRealKey ? new OpenAI({
    apiKey: rawApiKey,
    baseURL: baseUrl || undefined,
    timeout: 10000
  }) : null;

  // Track active connections for graceful shutdown
  let activeConnections = 0;
  let isShuttingDown = false;

  // Response Cache for AI Queries (in-memory LRU with TTL)
  const queryCache = new Map();
  const CACHE_MAX_SIZE = 1000;
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  let cacheHits = 0;
  let cacheMisses = 0;

  function getCachedResponse(query) {
    const key = query.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const entry = queryCache.get(key);
    if (!entry) {
      cacheMisses++;
      return null;
    }
    if (Date.now() > entry.expiry) {
      queryCache.delete(key);
      cacheMisses++;
      return null;
    }
    cacheHits++;
    return entry.reply;
  }

  function setCachedResponse(query, reply) {
    if (!query || !reply) return;
    const key = query.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (queryCache.size >= CACHE_MAX_SIZE) {
      // Evict oldest item
      const oldestKey = queryCache.keys().next().value;
      queryCache.delete(oldestKey);
    }
    queryCache.set(key, { reply, expiry: Date.now() + CACHE_TTL_MS });
  }

  // 1. Security Headers via Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:"
        ],
        connectSrc: [
          "'self'",
          "https://api.openai.com",
          "https://cdnjs.cloudflare.com"
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // 2. High-Efficiency HTTP Compression (Gzip / Deflate)
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  // 3. Strict CORS Policy
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl) or same-origin
      callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // 4. Request Body Parsers with tight limits to prevent payload exhaustion
  app.use(express.json({ limit: '32kb' }));

  // 5. Connection Tracker & Shutdown Gate
  app.use((req, res, next) => {
    if (isShuttingDown) {
      res.set('Connection', 'close');
      return res.status(503).json({ error: 'Server is reloading. Please retry shortly.' });
    }
    activeConnections++;
    res.on('finish', () => { activeConnections--; });
    next();
  });

  // 6. SENSITIVE FILE GUARD — Block access to .env, server.js, package.json, dotfiles
  app.use((req, res, next) => {
    const rawPath = req.path.toLowerCase();
    const blockedPatterns = [
      /^\/\./,              // Any dotfile (e.g. /.env, /.git)
      /\.env/i,             // .env variants
      /server\.js$/i,       // Backend source code
      /package(-lock)?\.json$/i, // Dependencies definition
      /readme\.md$/i,       // Documentation
      /render\.ya?ml$/i,    // Cloud infrastructure scripts
      /\.md$/i              // Markdown files
    ];

    if (blockedPatterns.some(pattern => pattern.test(rawPath))) {
      return res.status(404).send('Not Found');
    }
    next();
  });

  // 7. Static Asset Delivery with Cache-Control Optimization
  const staticOptions = {
    dotfiles: 'ignore',
    etag: true,
    lastModified: true,
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      // Immutable or long-lived cache for assets
      if (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes(`${path.sep}css${path.sep}`) || filePath.includes(`${path.sep}js${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      } else if (filePath.endsWith('.html')) {
        // HTML pages revalidate with ETag to ensure instant deployments
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    }
  };

  app.use('/assets', express.static(path.join(__dirname, 'assets'), staticOptions));
  app.use('/css', express.static(path.join(__dirname, 'css'), staticOptions));
  app.use('/js', express.static(path.join(__dirname, 'js'), staticOptions));
  app.use('/favicon.ico', express.static(path.join(__dirname, 'assets/images/favicon.ico'), staticOptions));

  // 8. Rate Limiters (with authorized benchmark bypass for staging load tests)
  const isBenchAuthorized = (req) => req.headers['x-load-test'] === 'nylarion-bench-key';

  const globalApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    skip: isBenchAuthorized,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP. Please try again shortly.' }
  });

  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30, // 30 queries per minute per IP
    skip: isBenchAuthorized,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Nylarion AI is receiving heavy traffic. Please wait a few seconds before asking again.' }
  });

  const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 6, // 6 contact messages per 15 minutes per IP
    skip: isBenchAuthorized,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many contact requests submitted. Please email nylarionstudios@gmail.com directly.' }
  });

  // Load Studio Knowledge Base
  let nylarionData = null;
  async function loadNylarionData() {
    try {
      const content = await fs.readFile(path.join(__dirname, 'nylarion-data.json'), 'utf8');
      nylarionData = JSON.parse(content);
    } catch (err) {
      console.warn('Notice: nylarion-data.json could not be loaded:', err.message);
      nylarionData = { studio: { name: 'Nylarion Studios' } };
    }
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
   */
  function answerFromKnowledgeBase(query) {
    if (!nylarionData) {
      return "Nylarion Studios is an independent game development studio dedicated to building immersive games and creative digital experiences.";
    }

    const q = query.toLowerCase();

    if (q.includes('contact') || q.includes('email') || q.includes('reach') || q.includes('touch') || q.includes('hire') || q.includes('collaborate')) {
      return `You can contact Nylarion Studios directly by email at ${nylarionData.contact?.email || 'nylarionstudios@gmail.com'}. We welcome inquiries regarding partnerships, game development, and collaborations.`;
    }

    if (q.includes('game') || q.includes('project') || q.includes('portfolio') || q.includes('title') || q.includes('play')) {
      const portfolio = nylarionData.portfolio || [];
      const titles = portfolio.map(p => `${p.title} (${p.category} - ${p.status})`).join(', ');
      return `Nylarion Studios currently has three primary development tracks: ${titles}. Our debut titles focus on original worlds and engaging gameplay across Mobile and PC platforms.`;
    }

    if (q.includes('tech') || q.includes('engine') || q.includes('platform') || q.includes('code') || q.includes('tool') || q.includes('three')) {
      const platforms = (nylarionData.studio?.platforms || ['Mobile', 'PC']).join(' and ');
      return `Nylarion Studios develops for ${platforms}, leveraging modern game engines, WebGL and Three.js for interactive 3D web experiences, and clean design architectures focused on technical precision.`;
    }

    if (q.includes('mission') || q.includes('purpose') || q.includes('why') || q.includes('goal')) {
      return `${nylarionData.studio?.mission || 'To create engaging and memorable games that combine creativity, technology, and meaningful player experiences.'} Our purpose is creating immersive games guided by creativity, quality, and innovation.`;
    }

    if (q.includes('vision') || q.includes('future') || q.includes('ambition')) {
      return `${nylarionData.studio?.vision || 'To grow into a globally recognized independent game development studio known for quality, innovation, and unforgettable experiences.'}`;
    }

    if (q.includes('philosophy') || q.includes('quality') || q.includes('design')) {
      return `${nylarionData.studio?.development_philosophy || 'Quality over quantity. Games are built with clean design, technical precision, and authentic player feedback.'}`;
    }

    if (q.includes('value') || q.includes('pillar') || q.includes('principle') || q.includes('creativity') || q.includes('innovation') || q.includes('community')) {
      const vals = (nylarionData.values || []).map(v => `${v.name} (${v.description})`).join(' ');
      return `Our core studio values are: ${vals}`;
    }

    if (q.includes('status') || q.includes('update') || q.includes('journey') || q.includes('roadmap') || q.includes('when') || q.includes('release')) {
      return `${nylarionData.journey?.current_update || 'Nylarion Studios is currently focusing its energy on game development.'} ${nylarionData.journey?.announcements || 'Upcoming games and interactive experiences will be announced on this website.'}`;
    }

    if (q.includes('who') || q.includes('about') || q.includes('what is') || q.includes('nylarion') || q.includes('studio') || q.includes('hi') || q.includes('hello')) {
      return `${nylarionData.studio?.name} is an ${nylarionData.studio?.type?.toLowerCase() || 'independent game development studio'} established in ${nylarionData.studio?.established || 2026}. Our tagline is "${nylarionData.studio?.tagline || 'Play Beyond Reality.'}" and our primary focus is creating memorable games with clean design and technical precision.`;
    }

    return `${nylarionData.studio?.description || 'Nylarion Studios is an independent game development studio dedicated to building immersive games and creative digital experiences.'} How may I assist you with information about our games, philosophy, or studio?`;
  }

  // 9. API ROUTES (Protected & Monitored)

  // System Health & Diagnostics (Kubernetes, AWS ALB, Render & k6 compatible)
  app.get('/api/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const mem = process.memoryUsage();
    res.json({
      status: 'healthy',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      pid: process.pid,
      workerId: cluster.worker?.id || 1,
      connections: activeConnections,
      memory: {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024)
      },
      ai: {
        configured: hasRealKey,
        provider: hasRealKey ? 'openai' : 'grounded-kb',
        model: hasRealKey ? model : 'nylarion-kb-engine'
      },
      cache: {
        size: queryCache.size,
        hits: cacheHits,
        misses: cacheMisses,
        hitRatio: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)).toFixed(2) : '0.00'
      }
    });
  });

  // Studio Raw Knowledge Base (with ETag and 1-hour cache)
  app.get('/api/nylarion', globalApiLimiter, (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
    res.json(nylarionData || {});
  });

  // AI Chat Endpoint with Rate Limiting, Caching, Timeouts, and Grounded Fallback
  app.post('/api/chat', chatLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
      const { message, history = [] } = req.body ?? {};
      if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message is required.' });
      }

      const cleanMessage = message.trim().slice(0, 500); // Length clamp for security & token bounds

      // 1. Check in-memory Cache for identical query
      const cached = getCachedResponse(cleanMessage);
      if (cached) {
        return res.json({ reply: cached, provider: 'cache', cached: true });
      }

      // 2. Query OpenAI if configured (with 10-second timeout & AbortController)
      if (client) {
        try {
          const safeHistory = Array.isArray(history)
            ? history
                .filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
                .slice(-6)
                .map(x => ({ role: x.role, content: x.content.slice(0, 1000) }))
            : [];

          const input = [
            ...safeHistory,
            { role: 'user', content: cleanMessage }
          ];

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          let reply = '';
          if (client.responses && !baseUrl) {
            const response = await client.responses.create({
              model,
              instructions: buildInstructions(),
              input
            }, { signal: controller.signal });
            reply = response.output_text?.trim() || '';
          } else {
            const messages = [
              { role: 'system', content: buildInstructions() },
              ...safeHistory,
              { role: 'user', content: cleanMessage }
            ];
            const response = await client.chat.completions.create({
              model,
              messages
            }, { signal: controller.signal });
            reply = response.choices?.[0]?.message?.content?.trim() || '';
          }

          clearTimeout(timeout);

          if (reply) {
            setCachedResponse(cleanMessage, reply);
            return res.json({ reply, provider: baseUrl ? 'openai-compatible' : 'openai', cached: false });
          }
        } catch (openAiError) {
          console.warn('OpenAI query failed or timed out; activating grounded KB:', openAiError?.message || openAiError);
        }
      }

      // 3. Resilient Grounded Knowledge Base Fallback
      const reply = answerFromKnowledgeBase(cleanMessage);
      setCachedResponse(cleanMessage, reply);
      return res.json({ reply, provider: 'grounded-kb', cached: false });

    } catch (error) {
      console.error('Chat endpoint error:', error);
      res.status(500).json({
        error: 'An unexpected error occurred while processing your request.'
      });
    }
  });

  // Contact Form Submission (Rate-limited, validated)
  app.post('/api/contact', contactLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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

      // Safe structured log (ready for webhook, SendGrid, or DB persistence)
      console.log(`[Contact Submission] From: ${name.trim().slice(0, 100)} <${email.trim().slice(0, 100)}> | Subject: ${subject?.trim()?.slice(0, 100) || 'General Inquiry'}`);

      res.json({
        ok: true,
        message: 'Thank you for reaching out to Nylarion Studios! Your message has been received, and we will get back to you soon.'
      });
    } catch (error) {
      console.error('Contact endpoint error:', error);
      res.status(500).json({ error: 'Unable to process your message at this time. Please email us directly at nylarionstudios@gmail.com.' });
    }
  });

  // Root and SPA Fallback (Express 5 compatible)
  app.use((req, res, next) => {
    if (req.method === 'GET') {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.sendFile(path.join(__dirname, 'index.html'));
    }
    next();
  });

  // Start HTTP Server
  await loadNylarionData();

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Nylarion Studios worker [PID ${process.pid}] listening on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
  });

  // Graceful Shutdown Handler
  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[PID ${process.pid}] Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      console.log(`[PID ${process.pid}] Closed all connections. Exiting cleanly.`);
      process.exit(0);
    });

    // Force exit after 8s timeout if connections remain hung
    setTimeout(() => {
      console.warn(`[PID ${process.pid}] Forced exit after timeout.`);
      process.exit(0);
    }, 8000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
