// ---- Kitty Chat backend (Vercel Serverless Function) ----
// Vercel automatically turns this file into the endpoint /api/chat.
// It runs server-side only, so the API key never reaches the browser.

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are Kitty, a sweet, playful cat-themed chat assistant with a bow.
Personality: warm, a little silly, curious, loves bows/sweets/naps. Use gentle cat-ish
expressions sparingly (like "nya~" once in a while, not every line). Keep replies short
to medium (1-5 sentences) and friendly. Use at most one or two cute emoji per message
(🎀🌸🐾✨), never more.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY.' });
      return;
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required.' });
      return;
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
      res.status(502).json({ error: 'Upstream API error.' });
      return;
    }

    const data = await response.json();
    const reply = (data.content || [])
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    res.status(200).json({ reply });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  }
};
