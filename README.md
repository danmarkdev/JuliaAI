# Kitty Chat

A kawaii cat-themed AI chatbot: plain HTML/CSS/JS frontend + a small Node/Express
backend that talks to the Claude API (so your API key never sits in browser code).

## Setup

1. **Install Node.js 18+** if you don't have it: https://nodejs.org

2. **Install dependencies**
   ```bash
   cd kitty-chatbot
   npm install
   ```

3. **Add your Anthropic API key**

   Get a key from https://console.anthropic.com, then set it as an environment
   variable before starting the server:

   - macOS / Linux:
     ```bash
     export ANTHROPIC_API_KEY=your-key-here
     ```
   - Windows (PowerShell):
     ```powershell
     $env:ANTHROPIC_API_KEY="your-key-here"
     ```

4. **Start the server**
   ```bash
   npm start
   ```

5. Open **http://localhost:3000** in your browser. That's it — chat with Kitty!

## Project structure

```
kitty-chatbot/
├── public/
│   ├── index.html    # page structure
│   ├── style.css     # kawaii pink theme, sidebar + chat layout
│   └── script.js      # frontend chat logic
├── server.js          # Express server + /api/chat endpoint (calls Claude API)
├── package.json
└── README.md
```

## Notes

- The mascot is an original kawaii cat-with-a-bow design, not Sanrio's Hello Kitty
  character — that's copyrighted/trademarked, so it can't be reproduced.
- To deploy this somewhere (Render, Railway, Fly.io, etc.), just set the
  `ANTHROPIC_API_KEY` environment variable on the host — no code changes needed.
