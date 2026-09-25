# Julia AI 🎀

A Hello Kitty-themed AI companion that chats naturally, generates images from your ideas, and reads photos, PDFs and shared links.

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Made with](https://img.shields.io/badge/made%20with-HTML%20%7C%20CSS%20%7C%20JS-ff69b4)

## ✨ Features

- **Natural conversation** — friendly, warm replies with no character gimmicks
- **Image generation** — describe a picture and Julia draws it for you
- **File & link understanding** — attach images, PDFs, or plain text files, or paste a link, and Julia reads it
- **Smart formatting** — replies render as step-by-step lists, tables, bold text, links, and copy-ready code blocks depending on what you asked
- **Read aloud** — replies can be read back out loud
- **Chat history** — rename, delete, edit, and retry any message
- **Light/dark friendly, mobile-responsive UI** with a sliding sidebar on small screens
- **Drag-and-drop / paste attachments** — drop a file anywhere on the page or paste a screenshot directly into the message box

## 🖥️ Tech stack

| Layer | Tech |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript |
| Fonts | Baloo 2, Nunito (Google Fonts) |
| Backend proxy | Serverless function (keeps API keys off the client) |
| Chat AI | Google Gemini |
| Image generation | Cloudflare Workers AI (FLUX.1-schnell) |
| Storage | Browser `localStorage` for chat history |

## 📁 Project structure

```
├── index.html      # App shell and layout
├── style.css        # Hello Kitty theme, layout, responsive rules
├── script.js         # Core chat logic, attachments, history, speech
├── extras.js         # Markdown-style reply formatting
├── hello_kitty.png    # App icon / avatar
└── worker.js          # Serverless proxy (chat + image endpoints)
```

## 🚀 Getting started

1. Clone the repo:
   ```bash
   git clone https://github.com/<your-username>/julia-ai.git
   cd julia-ai
   ```
2. Deploy `worker.js` to a serverless platform of your choice. It expects:
   - An AI chat API key, stored as a server-side secret (never in client code)
   - An image-generation binding/service
3. In `script.js`, set `API_ENDPOINT` to your deployed proxy's URL.
4. Host `index.html`, `style.css`, `script.js`, `extras.js`, and `hello_kitty.png` on any static web host.
5. Open the page in a browser — no build step required.

## 🔒 Security notes

- API keys are never stored or exposed in the frontend code; all AI requests go through the serverless proxy.
- The proxy validates and restricts outbound link-fetching to public, safe URLs.
- Uploaded files stay in the browser session and are sent only to the proxy for the current request.

## 📌 Roadmap ideas

- [ ] Voice input
- [ ] Theming presets beyond the Hello Kitty look
- [ ] Export chat history

## 📄 License

This project is for personal/portfolio use. Feel free to explore the code, but please don't redistribute it as your own without credit.

---

Made with 🎀 by Danmark
