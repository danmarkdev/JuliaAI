# 🎀 Julia AI 🎀

A cute, cat-themed AI chat companion — built as a static site (GitHub Pages) with a small serverless backend (Cloudflare Workers) so no server hosting or API keys are ever exposed to visitors.


## Features

- 💬 **Chat** in English, Filipino, 日本語, Español, or 한국어 — powered by Google's Gemini API (free tier)
- 🎨 **Image generation** — just ask in plain language ("draw me a cat", "gumuhit ka ng bulaklak"), no button needed. Julia decides on her own when a request is actually for a picture and generates it using Cloudflare Workers AI (free, no billing required)
- 🖼️ **Image understanding** — attach a photo or screenshot and ask about it
- 🗂️ **Multiple conversations** with rename/delete, saved per language, kept in your browser's local storage
- ✏️ **Edit & resend** your own messages
- 📋 **Copy** any reply — text or generated image — straight to your clipboard
- 📱 Mobile-friendly layout

## How it's built

| Part | What it does | Where it lives |
|---|---|---|
| `index.html`, `script.js`, `style.css` | The chat UI | This repo → GitHub Pages |
| Cloudflare Worker (`worker.js`) | Proxies chat requests to Gemini and image requests to Workers AI, keeping the API key server-side | Cloudflare dashboard (not tracked in this repo — see `.gitignore`) |

The front-end never talks to Google or Cloudflare's AI directly. It only calls a single Worker URL (set in `script.js` as `API_ENDPOINT`), which holds the real Gemini API key as a Cloudflare **secret** and forwards requests on.

## Backend setup (Cloudflare Worker)

If you're setting this up fresh:

1. Create a Worker on Cloudflare and deploy `worker.js` to it.
2. Add a secret named `GEMINI_API_KEY` (Settings → Variables and Secrets) with your [Google AI Studio](https://aistudio.google.com/api-keys) API key.
3. Add a binding named `AI` (Settings → Bindings → Add → **Workers AI**) — this powers image generation for free, with no billing setup needed.
4. Update `API_ENDPOINT` at the top of `script.js` to your Worker's URL.

## Notes

- Chat runs on Gemini's free tier.
- Image generation runs entirely on Cloudflare Workers AI's free daily allocation (10,000 Neurons/day, resets daily, no card required) — not Google's image models, which require billing.
- Conversation history is stored only in the visitor's own browser (`localStorage`), never on a server.

---
Made with 🎀 for a birthday gift.
