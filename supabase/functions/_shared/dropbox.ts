export async function getDropboxAccessToken() {
  const appKey = Deno.env.get("DROPBOX_APP_KEY")?.trim() || "";
  const appSecret = Deno.env.get("DROPBOX_APP_SECRET")?.trim() || "";
  const refreshToken = Deno.env.get("DROPBOX_REFRESH_TOKEN")?.trim() || "";
  if (!appKey || !appSecret || !refreshToken) {
    throw new Error("Dropbox storage is not configured");
  }

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });
  const result = await response.json() as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(`Dropbox token refresh failed: ${result.error_description || result.error || "unknown error"}`);
  }
  return result.access_token;
}

export function getDropboxRootPath() {
  const configured = Deno.env.get("DROPBOX_ROOT_PATH") || "/MAKI Travel Receipts";
  const trimmed = configured.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function isAllowedDropboxPath(path: string) {
  const root = getDropboxRootPath();
  return path === root || path.startsWith(`${root}/`);
}
