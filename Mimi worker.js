const ALLOWED_ORIGIN = "*"; // e.g. "https://danmarkdev.github.io" for production
const GEMINI_MODEL = "gemini-3.5-flash-lite"; // free tier: chat model, 1,500 chat a day
const IMAGE_MODEL = "gemini-3.1-flash-image"; // "Nano Banana 2" — gemini-2.5-flash-image is being retired Oct 2026, swap this line again if this one is retired
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

    const url = new URL(request.url);

    // ---------------------------------------------------------------
    // Image generation endpoint
    // ---------------------------------------------------------------
    if (url.pathname === "/image") {
      return handleImageGeneration(request, env, corsHeaders);
    }

    // ---------------------------------------------------------------
    // Existing chat proxy (unchanged)
    // ---------------------------------------------------------------
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
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
    try {
      const geminiResponse = await fetch(geminiUrl, {
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

// ---------------------------------------------------------------
// Image generation handler
// ---------------------------------------------------------------
async function handleImageGeneration(request, env, corsHeaders) {
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
  const prompt = typeof payload.prompt === "string" ? payload.prompt.slice(0, 2000) : "";
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Surface Google's real error (e.g. "billing required", "model not found",
      // "quota exceeded") instead of a generic failure — makes this much easier
      // to debug from the browser console / Cloudflare logs.
      const upstreamMessage = (data && data.error && data.error.message) || `Image generation failed (HTTP ${res.status})`;
      console.log("Nano Banana error:", res.status, JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: upstreamMessage, status: res.status }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    let text = "";
    let imageBase64 = null;
    let mimeType = "image/png";

    for (const part of parts) {
      if (part.text) text += part.text;
      const inline = part.inlineData || part.inline_data;
      if (inline && inline.data) {
        imageBase64 = inline.data;
        mimeType = inline.mimeType || inline.mime_type || mimeType;
      }
    }

    if (!imageBase64) {
      // The model responded successfully but didn't actually return image bytes
      // (can happen on safety blocks) — treat this as an error too instead of
      // silently showing nothing.
      console.log("Nano Banana returned no image data:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: text || "The model didn't return an image for that prompt." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ text, imageBase64, mimeType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Upstream request failed", detail: err.message }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
