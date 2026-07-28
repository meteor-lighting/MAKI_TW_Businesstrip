const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:4173",
  "https://meteor-lighting.github.io",
]);

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "null",
  };
}

export function json(req: Request, value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

export async function getAuthenticatedUser(req: Request, supabaseAdmin: { auth: { getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }> } }) {
  const accessToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  return error || !data.user ? null : data.user;
}
