import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getDropboxAccessToken, isAllowedDropboxPath } from "../_shared/dropbox.ts";
import { getAuthenticatedUser, getCorsHeaders, json } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

Deno.serve(async (req) => {
    try {
      if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
      if (req.method !== "POST") return json(req, { status: "error", message: "Method not allowed" }, 405);
      const user = await getAuthenticatedUser(req, supabaseAdmin);
      if (!user) return json(req, { status: "error", message: "You must be signed in" }, 401);

      const body = await req.json() as { path?: string };
      const path = String(body.path || "").replace(/^dropbox:/, "");
      if (!isAllowedDropboxPath(path)) {
        return json(req, { status: "error", message: "Receipt path is not allowed" }, 403);
      }

      const response = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getDropboxAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      });
      const result = await response.json() as { link?: string; metadata?: { name?: string }; error_summary?: string };
      if (!response.ok || !result.link) {
        throw new Error(`Dropbox link failed: ${result.error_summary || response.status}`);
      }
      return json(req, { status: "success", url: result.link, name: result.metadata?.name });
    } catch (error) {
      console.error("Dropbox receipt link failed", error);
      return json(req, { status: "error", message: error instanceof Error ? error.message : "Dropbox link failed" }, 500);
    }
  });
