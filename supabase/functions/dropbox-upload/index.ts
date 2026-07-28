import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getDropboxAccessToken, getDropboxRootPath } from "../_shared/dropbox.ts";
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

      const formData = await req.formData();
      const reportId = String(formData.get("reportId") || "").trim();
      const file = formData.get("file");
      if (!reportId || !(file instanceof File)) {
        return json(req, { status: "error", message: "A report ID and receipt file are required" }, 400);
      }
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        return json(req, { status: "error", message: "Only image and PDF receipts are supported" }, 400);
      }
      if (file.size > 15 * 1024 * 1024) {
        return json(req, { status: "error", message: "Receipt files must be 15 MB or smaller" }, 413);
      }

      const safeReportId = reportId.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "report";
      const safeName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "receipt";
      const extension = getExtension(file);
      const dropboxPath = `${getDropboxRootPath()}/${safeReportId}/${user.id}/${crypto.randomUUID()}-${safeName}.${extension}`;
      const accessToken = await getDropboxAccessToken();

      const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path: dropboxPath,
            mode: "add",
            autorename: true,
            mute: true,
          }),
        },
        body: await file.arrayBuffer(),
      });
      const result = await response.json() as { path_display?: string; name?: string; id?: string; error_summary?: string };
      if (!response.ok || !result.path_display) {
        throw new Error(`Dropbox upload failed: ${result.error_summary || response.status}`);
      }

      return json(req, {
        status: "success",
        path: `dropbox:${result.path_display}`,
        name: result.name || file.name,
        dropboxId: result.id,
      });
    } catch (error) {
      console.error("Dropbox receipt upload failed", error);
      return json(req, { status: "error", message: error instanceof Error ? error.message : "Dropbox upload failed" }, 500);
    }
  });

function getExtension(file: File) {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
  };
  return byMime[file.type] || file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
}
