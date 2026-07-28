import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:4173",
  "https://meteor-lighting.github.io",
]);

const startHandler = withSupabase(
  { auth: "none" },
  async (req, ctx) => {
    if (req.method !== "POST") return json({ status: "error", message: "Method not allowed" }, 405, req);

    const accessToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return json({ status: "error", message: "You must be signed in" }, 401, req);

    const { data: authData, error: authError } = await ctx.supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return json({ status: "error", message: "Your session is no longer valid. Please sign in again." }, 401, req);
    }

    const appKey = Deno.env.get("DROPBOX_APP_KEY") || "";
    const appSecret = Deno.env.get("DROPBOX_APP_SECRET") || "";
    const redirectUri = getRedirectUri();
    if (!appKey || !appSecret) {
      return json({ status: "error", message: "Dropbox OAuth is not configured" }, 503, req);
    }

    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (profileError) return json({ status: "error", message: profileError.message }, 500, req);
    if (profile?.role !== "admin") {
      return json({ status: "error", message: "Only administrators can connect company Dropbox" }, 403, req);
    }

    const statePayload = base64UrlEncode(JSON.stringify({
      userId: authData.user.id,
      expiresAt: Date.now() + 10 * 60 * 1000,
      nonce: crypto.randomUUID(),
    }));
    const state = `${statePayload}.${await sign(statePayload, appSecret)}`;

    const authorizationUrl = new URL("https://www.dropbox.com/oauth2/authorize");
    authorizationUrl.searchParams.set("client_id", appKey);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("token_access_type", "offline");
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("scope", "files.content.read files.content.write account_info.read");

    return json({ status: "success", authorizationUrl: authorizationUrl.toString() }, 200, req);
  },
);

export default {
  fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
    return startHandler(req);
  },
};

function getRedirectUri() {
  return Deno.env.get("DROPBOX_REDIRECT_URI")
    || `${Deno.env.get("SUPABASE_URL") || ""}/functions/v1/dropbox-oauth-callback`;
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "null",
  };
}

function json(value: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...getCorsHeaders(req || new Request("https://localhost")), "Content-Type": "application/json" },
  });
}
