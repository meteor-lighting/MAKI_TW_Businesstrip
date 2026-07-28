import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const appKey = Deno.env.get("DROPBOX_APP_KEY") || "";
const appSecret = Deno.env.get("DROPBOX_APP_SECRET") || "";
const redirectUri = Deno.env.get("DROPBOX_REDIRECT_URI")
  || `${Deno.env.get("SUPABASE_URL") || ""}/functions/v1/dropbox-oauth-callback`;

export default {
  async fetch(req: Request) {
    if (req.method !== "GET") return htmlPage("Dropbox connection failed", "This callback only accepts GET requests.", 405);

    try {
      const url = new URL(req.url);
      const error = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (error) return htmlPage("Dropbox connection was cancelled", error, 400);

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) return htmlPage("Dropbox connection failed", "Dropbox did not return the required authorization details.", 400);
      if (!appKey || !appSecret) return htmlPage("Dropbox connection failed", "Dropbox OAuth is not configured on the server.", 503);

      const stateData = await verifyState(state, appSecret);
      if (!stateData || stateData.expiresAt < Date.now()) {
        return htmlPage("Dropbox connection expired", "Please start the Dropbox connection again from MAKI Travel.", 400);
      }

      const tokenResponse = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: appKey,
          client_secret: appSecret,
          redirect_uri: redirectUri,
        }),
      });
      const tokenResult = await tokenResponse.json() as Record<string, unknown>;
      if (!tokenResponse.ok || !tokenResult.refresh_token) {
        return htmlPage("Dropbox connection failed", String(tokenResult.error_description || tokenResult.error || "Dropbox did not return a refresh token."), 400);
      }

      return htmlPage(
        "Dropbox authorization complete",
        "Copy the refresh token below into Supabase Edge Function secret DROPBOX_REFRESH_TOKEN, then return to MAKI Travel.",
        200,
        String(tokenResult.refresh_token),
      );
    } catch (error) {
      console.error("Dropbox OAuth callback failed", error);
      return htmlPage("Dropbox connection failed", "The authorization response could not be completed. Please try again.", 400);
    }
  },
};

async function verifyState(state: string, secret: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = await sign(payload, secret);
  if (expected !== signature) return null;
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { userId: string; expiresAt: number };
  } catch {
    return null;
  }
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

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function htmlPage(title: string, message: string, status: number, refreshToken = "") {
  const tokenBlock = refreshToken
    ? `<label for="token">DROPBOX_REFRESH_TOKEN</label><textarea id="token" readonly>${escapeHtml(refreshToken)}</textarea><p>After saving the secret, close this tab and return to MAKI Travel.</p>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;padding:32px;background:#f1f5f9;color:#0f172a;font:16px system-ui,sans-serif}.card{max-width:680px;margin:auto;padding:28px;border-radius:18px;background:#fff;box-shadow:0 16px 40px #0f172a14}h1{margin:0 0 12px;font-size:24px}p{line-height:1.6;color:#475569}label{display:block;margin-top:20px;margin-bottom:8px;font-weight:700;font-size:13px}textarea{box-sizing:border-box;width:100%;min-height:120px;padding:12px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;font:13px ui-monospace,monospace;word-break:break-all}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${tokenBlock}</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}
