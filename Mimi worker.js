const ALLOWED_ORIGIN = "*"; // e.g. "https://danmarkdev.github.io" for production
const GEMINI_MODEL = "gemini-3.5-flash-lite"; // free tier: chat model (Google Gemini)
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell"; // free image model (Cloudflare Workers AI, not Google) — requires an "AI" binding on this Worker, see Settings > Bindings
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
// Image generation handler — runs on Cloudflare Workers AI, which is
// genuinely free (10,000 Neurons/day, resets daily, no card needed) as
// long as this Worker has an "AI" binding (Settings > Bindings > Add >
// Workers AI > name it "AI"). This does NOT use GEMINI_API_KEY at all.
// ---------------------------------------------------------------
async function handleImageGeneration(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  if (!env.AI) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: this Worker has no 'AI' binding. Add one in Settings > Bindings > Workers AI, named AI." }),
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

  try {
    // flux-1-schnell: prompt capped at 2048 chars, steps default 4 (max 8 — it's
    // a distilled few-step model, more steps just burns neurons for no gain).
    const result = await env.AI.run(IMAGE_MODEL, {
      prompt: prompt.slice(0, 2048),
      steps: 4,
      seed: Math.floor(Math.random() * 1000000),
    });

    // Cloudflare's image models return { image: "<base64 jpeg>" }.
    if (!result || !result.image) {
      console.log("Workers AI returned no image data:", JSON.stringify(result));
      return new Response(
        JSON.stringify({ error: "The model didn't return an image for that prompt." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ text: "", imageBase64: result.image, mimeType: "image/jpeg" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Common causes here: no "AI" binding configured, or the free daily
    // Neuron allocation (10,000/day) has been used up for the account.
    console.log("Workers AI error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Image generation failed" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
