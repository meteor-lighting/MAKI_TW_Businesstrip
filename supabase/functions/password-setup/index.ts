import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const authAdminKey = Deno.env.get("AUTH_ADMIN_KEY") || "";
const authAdmin = createClient(Deno.env.get("SUPABASE_URL") || "", authAdminKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const passwordHandler = withSupabase(
  { auth: "none" },
  async (req, ctx) => {
    if (req.method !== "POST") return json({ status: "error", message: "Method not allowed" }, 405);
    if (!authAdminKey) return json({ status: "error", message: "Password reset is not configured" }, 503);

    try {
      const body = await req.json();
      const identifier = String(body.identifier || "").trim();
      const password = String(body.password || "");
      if (!identifier) throw new Error("Login is required");
      if (password.length < 8) throw new Error("Password must be at least 8 characters");
      if (password.length > 72) throw new Error("Password must be no more than 72 characters");

      const { data: resolved, error: resolveError } = await ctx.supabaseAdmin.rpc(
        "resolve_login",
        { identifier },
      );
      if (resolveError) throw resolveError;
      const email = resolved?.[0]?.email;
      if (!email) throw new Error("Account not found");

      const { data: profile, error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      if (profileError || !profile) throw new Error("Account not found");

      const { error: passwordError } = await authAdmin.auth.admin.updateUserById(
        profile.id,
        { password },
      );
      if (passwordError) throw passwordError;

      const { error: resetError } = await ctx.supabaseAdmin
        .from("profiles")
        .update({ must_reset_password: false })
        .eq("id", profile.id);
      if (resetError) throw resetError;

      return json({ status: "success", message: "Password updated. Sign in with your new password." });
    } catch (error) {
      console.error("Password reset failed", error);
      return json(
        { status: "error", message: error instanceof Error ? error.message : "Password reset failed" },
        400,
      );
    }
  },
);

export default {
  fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    return passwordHandler(req);
  },
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
