const ALLOWED_ORIGIN = "*"; // e.g. "https://danmarkdev.github.io" for production
const GEMINI_MODEL = "gemini-3.5-flash-lite"; // free tier: ~1,500 requests/day
const MAX_ATTACHMENTS_PER_MESSAGE = 4;

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ---- Cross-device sync endpoints ----
    if (url.pathname === "/sync/save" && request.method === "POST") {
      return handleSyncSave(request, env, corsHeaders);
    }
    if (url.pathname === "/sync/load" && request.method === "GET") {
      return handleSyncLoad(url, env, corsHeaders);
    }

    // ---- Existing chat proxy ----
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

// ---- Sync handlers (Cloudflare KV) ----
// Requires a KV namespace bound to this worker with variable name CHAT_KV.
// Dashboard: Worker -> Settings -> Bindings -> Add binding -> KV Namespace.

async function handleSyncSave(request, env, corsHeaders) {
  if (!env.CHAT_KV) return json({ error: "KV not configured" }, 500, corsHeaders);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, corsHeaders);
  }
  const code = normalizeCode(body.code);
  if (!code) return json({ error: "Missing/invalid code" }, 400, corsHeaders);
  if (!Array.isArray(body.conversations)) return json({ error: "Missing conversations" }, 400, corsHeaders);

  const record = {
    conversations: body.conversations,
    currentLang: body.currentLang || "en",
    updatedAt: Date.now(),
  };
  await env.CHAT_KV.put(`sync:${code}`, JSON.stringify(record));
  return json({ ok: true, updatedAt: record.updatedAt }, 200, corsHeaders);
}

async function handleSyncLoad(url, env, corsHeaders) {
  if (!env.CHAT_KV) return json({ error: "KV not configured" }, 500, corsHeaders);
  const code = normalizeCode(url.searchParams.get("code"));
  if (!code) return json({ error: "Missing/invalid code" }, 400, corsHeaders);
  const raw = await env.CHAT_KV.get(`sync:${code}`);
  if (!raw) return json({ found: false }, 200, corsHeaders);
  return json({ found: true, ...JSON.parse(raw) }, 200, corsHeaders);
}

function normalizeCode(code) {
  if (typeof code !== "string") return null;
  const c = code.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

function json(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
