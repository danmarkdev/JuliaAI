/**
 * Julia AI Chat — Cloudflare Worker proxy (Gemini edition)
 * ------------------------------------------------------
 * Keeps your Google Gemini API key secret on the server side, so it's
 * never exposed in the browser. Your GitHub Pages site calls THIS worker,
 * and the worker calls Gemini on its behalf.
 *
 * SETUP (one-time):
 * 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create -> Worker.
 * 2. Give it a name, e.g. "julia-ai-chat-proxy". Deploy the default template first.
 * 3. Click "Edit code" and replace everything with this file's contents. Save & Deploy.
 * 4. Get a Gemini API key from https://aistudio.google.com/apikey
 * 5. Go to Settings -> Variables and Secrets on the worker -> Add secret:
 *      Name:  GEMINI_API_KEY
 *      Value: (the key you just created)
 * 6. Copy your worker's URL (looks like https://julia-ai-chat-proxy.YOUR-SUBDOMAIN.workers.dev)
 * 7. Paste that URL into API_ENDPOINT near the top of script.js.
 *
 * Optional but recommended: in ALLOWED_ORIGIN below, replace "*" with your
 * actual site URL (e.g. "https://danmarkdev.github.io") so only your site
 * can use this worker.
 *
 * This version also forwards image attachments (screenshots, photos, etc)
 * to Gemini as inline image data, so Julia AI can "see" what's attached.
 */
const ALLOWED_ORIGIN = "*"; // e.g. "https://danmarkdev.github.io" for production
const GEMINI_MODEL = "gemini-2.5-flash"; // swap for "gemini-2.5-pro" etc. if you want
const MAX_ATTACHMENTS_PER_MESSAGE = 4;

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }
    if (!env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: GEMINI_API_KEY secret is not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // payload.system: string
    // payload.messages: [{ role: 'user'|'assistant', content: string, attachments?: [{mimeType, data}] }]
    const systemText = typeof payload.system === "string" ? payload.system.slice(0, 4000) : "";
    const incoming = Array.isArray(payload.messages) ? payload.messages.slice(-40) : [];

    // Convert to Gemini's "contents" shape: role must be "user" or "model".
    // Each turn can include text plus inline image data (base64, no data: prefix).
    const contents = incoming.map((m) => {
      const parts = [];
      const text = String(m.content ?? "").slice(0, 8000);
      if (text) parts.push({ text });

      if (Array.isArray(m.attachments)) {
        for (const att of m.attachments.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
          if (att && att.data && att.mimeType && String(att.mimeType).startsWith("image/")) {
            parts.push({
              inlineData: {
                mimeType: String(att.mimeType),
                data: String(att.data),
              },
            });
          }
        }
      }

      if (parts.length === 0) parts.push({ text: "" });

      return {
        role: m.role === "assistant" || m.role === "ai" || m.role === "model" ? "model" : "user",
        parts,
      };
    });

    const geminiBody = {
      contents,
      systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.9,
      },
    };
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
    try {
      const geminiResponse = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify(geminiBody),
      });
      return new Response(geminiResponse.body, {
        status: geminiResponse.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Upstream request failed", detail: err.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },
};
