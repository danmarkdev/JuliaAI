const ALLOWED_ORIGIN = "*"; // e.g. "https://danmarkdev.github.io" for production
const GEMINI_MODEL = "gemini-3.5-flash-lite"; // free tier: ~1,500 requests/day
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
    const systemText = typeof payload.system === "string" ? payload.system.slice(0, 4000) : "";
    const incoming = Array.isArray(payload.messages) ? payload.messages.slice(-40) : [];

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
