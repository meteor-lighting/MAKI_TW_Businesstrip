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

    const payload = await req.json() as { path?: string; reportId?: string };
    const dropboxPath = String(payload.path || "").replace(/^dropbox:/, "").trim();
    if (!dropboxPath || !isAllowedDropboxPath(dropboxPath) || dropboxPath.includes("/../")) {
      return json(req, { status: "error", message: "Invalid receipt path" }, 400);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const isAdmin = profile?.role === "admin";
    if (payload.reportId) {
      const { data: report, error: reportError } = await supabaseAdmin
        .from("reports")
        .select("owner_id,status")
        .eq("id", String(payload.reportId))
        .maybeSingle();
      if (reportError) throw reportError;
      const canEditReport = Boolean(
        report
        && !String(report.status || "")
        && (isAdmin || report.owner_id === user.id),
      );
      if (!canEditReport) {
        return json(req, { status: "error", message: "You cannot delete this receipt" }, 403);
      }
    } else {
      const belongsToUser = dropboxPath.split("/").includes(user.id);
      if (!isAdmin && !belongsToUser) {
        return json(req, { status: "error", message: "You cannot delete this receipt" }, 403);
      }
    }

    const accessToken = await getDropboxAccessToken();
    const response = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: dropboxPath }),
    });
    const result = await response.json() as { metadata?: unknown; error_summary?: string };
    const missingFile = result.error_summary?.includes("path_lookup/not_found");
    if (!response.ok && !missingFile) {
      throw new Error(`Dropbox delete failed: ${result.error_summary || response.status}`);
    }

    return json(req, { status: "success" });
  } catch (error) {
    console.error("Dropbox receipt delete failed", error);
    return json(req, {
      status: "error",
      message: error instanceof Error ? error.message : "Dropbox delete failed",
    }, 500);
  }
});
