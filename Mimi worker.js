/**
 * Mimi Chat — Cloudflare Worker proxy
 * ------------------------------------
 * This keeps your Anthropic API key secret on the server side, so it's
 * never exposed in the browser. Your GitHub Pages site calls THIS worker,
 * and the worker calls Anthropic on its behalf.
 *
 * SETUP (one-time):
 * 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create -> Worker.
 * 2. Give it a name, e.g. "mimi-chat-proxy". Deploy the default template first.
 * 3. Click "Edit code" and replace everything with this file's contents. Save & Deploy.
 * 4. Go to Settings -> Variables and Secrets on the worker -> Add secret:
 *      Name:  ANTHROPIC_API_KEY
 *      Value: (your key from https://console.anthropic.com/settings/keys)
 * 5. Copy your worker's URL (looks like https://mimi-chat-proxy.YOUR-SUBDOMAIN.workers.dev)
 * 6. Paste that URL into API_ENDPOINT near the top of the <script> in kitty-chat.html.
 *
 * Optional but recommended: in ALLOWED_ORIGIN below, replace "*" with your
 * actual site URL (e.g. "https://danmarkdev.github.io") so only your site
 * can use this worker.
 */

const ALLOWED_ORIGIN = "*"; // e.g. "https://danmarkdev.github.io" for production

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

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured: ANTHROPIC_API_KEY secret is not set." }),
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

    // Basic guardrails so the worker can't be abused as an open proxy
    const safeBody = {
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: typeof payload.system === "string" ? payload.system.slice(0, 4000) : undefined,
      messages: Array.isArray(payload.messages) ? payload.messages.slice(-40) : [],
      stream: true,
    };

    try {
      const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(safeBody),
      });

      return new Response(anthropicResponse.body, {
        status: anthropicResponse.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Upstream request failed", detail: err.message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
