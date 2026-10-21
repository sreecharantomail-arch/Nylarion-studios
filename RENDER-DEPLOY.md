# Nylarion Studios — Render Deployment

This project is configured as a single Render Node.js Web Service. The same service serves the website and the `/api/chat` backend, so the public URL can be shared with other people.

## Render settings

- Service type: Web Service
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

A `render.yaml` file is included with these settings.

## Environment variables

In Render, add:

- `OPENAI_API_KEY` = your new OpenAI API key
- `OPENAI_MODEL` = `gpt-6-luna`

Do NOT put the API key into `index.html`, `js/main.js`, GitHub, or this ZIP. Render environment variables are available to the service at runtime.

## Deploy from GitHub

1. Create a GitHub repository and upload the contents of this project.
2. In Render, choose New → Web Service and connect the repository.
3. Render can use the included `render.yaml`, or enter the settings above manually.
4. Add `OPENAI_API_KEY` in the Render Environment settings.
5. Deploy.
6. Open the generated `onrender.com` URL and test the chatbot.

## Health check

Open `<your-render-url>/api/health` after deployment. It should report `backend: true`, `provider: openai`, and `aiConfigured: true` when the key is configured.
