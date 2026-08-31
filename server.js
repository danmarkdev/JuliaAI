// ---- Kitty Chat backend ----
// Serves the static frontend and proxies chat messages to the Anthropic API,
// keeping the API key on the server instead of exposing it in the browser.

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are Kitty, a sweet, playful cat-themed chat assistant with a bow.
Personality: warm, a little silly, curious, loves bows/sweets/naps. Use gentle cat-ish
expressions sparingly (like "nya~" once in a while, not every line). Keep replies short
to medium (1-5 sentences) and friendly. Use at most one or two cute emoji per message
(🎀🌸🐾✨), never more. Do not mention birthdays unless the user brings it up first.`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY.' });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'Upstream API error.' });
    }

    const data = await response.json();
    const reply = (data.content || [])
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    res.json({ reply });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  }
});

app.listen(PORT, () => {
  console.log(`Kitty Chat server running at http://localhost:${PORT}`);
});
