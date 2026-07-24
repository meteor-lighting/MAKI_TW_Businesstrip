import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fallbackRates: Record<string, number> = {
  TWD: 1,
  USD: 32.5,
  EUR: 35.3,
  CNY: 4.5,
  JPY: 0.22,
  HKD: 4.16,
  THB: 0.91,
  CAD: 23.8,
  GBP: 41.5,
  SGD: 24.2,
};

const authenticatedHandler = withSupabase(
  { auth: "user" },
  async (req, ctx) => {
    try {
      const body = await req.json();
      const currency = String(body.currency || "TWD").toUpperCase();
      const requested = String(body.date || new Date().toISOString().slice(0, 10));

      if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid currency code");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) throw new Error("Invalid rate date");
      if (currency === "TWD") {
        return json({ status: "success", rate: 1, date: requested, source: "fixed" });
      }

      const { data: cached } = await ctx.supabaseAdmin
        .from("exchange_rates")
        .select("rate,rate_date,source")
        .eq("currency", currency)
        .lte("rate_date", requested)
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached) {
        return json({
          status: "success",
          rate: Number(cached.rate),
          date: cached.rate_date,
          source: cached.source,
        });
      }

      const start = new Date(`${requested}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 14);
      const endpoint = new URL("https://api.finmindtrade.com/api/v4/data");
      endpoint.searchParams.set("dataset", "TaiwanExchangeRate");
      endpoint.searchParams.set("data_id", currency);
      endpoint.searchParams.set("start_date", start.toISOString().slice(0, 10));
      endpoint.searchParams.set("end_date", requested);

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`FinMind returned ${response.status}`);
      const result = await response.json();
      const rows = (result.data || [])
        .filter((row: Record<string, unknown>) =>
          Number(row.spot_sell) > 0 && String(row.date) <= requested
        )
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          String(b.date).localeCompare(String(a.date))
        );
      const latest = rows[0];
      const rate = latest ? Number(latest.spot_sell) : fallbackRates[currency];
      if (!rate) throw new Error(`No exchange rate is available for ${currency}`);

      const rateDate = latest?.date || requested;
      await ctx.supabaseAdmin.from("exchange_rates").upsert({
        currency,
        rate_date: rateDate,
        rate,
        source: latest ? "FinMind" : "fallback",
      });
      return json({
        status: "success",
        rate,
        date: rateDate,
        source: latest ? "FinMind" : "fallback",
      });
    } catch (error) {
      return json(
        { status: "error", message: error instanceof Error ? error.message : String(error) },
        400,
      );
    }
  },
);

export default {
  fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    return authenticatedHandler(req);
  },
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
