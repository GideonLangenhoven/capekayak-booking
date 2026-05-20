import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// AN4: per-endpoint, per-IP rate limit backed by the public.api_rate_limits
// table + public.check_rate_limit RPC. The booking-site middleware already
// imposes a coarse 100/min/IP across all /api/*, but it runs on the
// in-memory fallback (Upstash isn't provisioned), so sensitive write
// endpoints get this stricter, durable bucket on top.

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function enforceRateLimit(opts: {
  req: NextRequest;
  endpoint: string;
  maxPerMinute: number;
}): Promise<NextResponse | null> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return null;

  const ip = getClientIp(opts.req);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Retry once on transient RPC failure. Without this, a single hiccup
  // (cold pool, momentary saturation under a 100+ burst) caused the prior
  // fail-open path to let everything through — the 120-request QA burst
  // exercise found this gap.
  async function call() {
    return db.rpc("check_rate_limit", {
      p_ip: ip,
      p_endpoint: opts.endpoint,
      p_max: opts.maxPerMinute,
    });
  }
  let { data, error } = await call();
  if (error) {
    await new Promise((r) => setTimeout(r, 50));
    ({ data, error } = await call());
  }

  if (error) {
    // After one retry the RPC is still erroring — fail-closed with 503 so
    // we don't silently bypass the limit. The caller sees a clearly server-
    // side response and can retry. The coarse middleware fence keeps total
    // throughput bounded in the meantime.
    console.warn("RATE_LIMIT_RPC_ERR:", error.message, opts.endpoint, ip);
    return NextResponse.json(
      { error: "Rate limiter unavailable, please retry shortly." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
  if (data === false) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Limit": String(opts.maxPerMinute),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  return null;
}
