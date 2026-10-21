# Nylarion Studios — API AI Backend

This version uses the OpenAI Responses API instead of local Ollama. Nylarion-specific facts are grounded in `nylarion-data.json`, and the browser speaks the AI reply while the assistant answer stays voice-only in the UI.

## Requirements
- Node.js 18+
- An OpenAI API key

## Setup

```powershell
npm install
copy .env.example .env
```

Open `.env` and set:

```env
OPENAI_API_KEY=your_real_openai_api_key
OPENAI_MODEL=gpt-6-luna
PORT=3000
```

Keep the API key in `.env`. Never put it in `js/main.js`, `index.html`, or any public frontend file.

Start:

```powershell
npm start
```

Open:

`http://localhost:3000`

Health check:

`http://localhost:3000/api/health`

The health response should show `provider: "openai"` and `aiConfigured: true`.

## How the chatbot works

User question → Node.js backend → OpenAI Responses API + Nylarion knowledge base → answer → browser speech synthesis.

The backend keeps the OpenAI key server-side. The frontend never receives the key.

## Render deployment

This is deployment-ready as a single Render Web Service. Use `npm install` as the Build Command and `npm start` as the Start Command, then set `OPENAI_API_KEY` and `OPENAI_MODEL` in Render Environment Variables. See `RENDER-DEPLOY.md`.


### Welcome Voice Behavior
- The robot attempts a welcome voice automatically shortly after the webpage opens.
- If the browser blocks autoplay speech, the first click/touch anywhere on the page automatically unlocks and plays the welcome.
- The welcome is spoken only once per page load.
- Clicking the flying robot then opens the AI chat without repeating the welcome.
