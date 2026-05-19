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

  const { data, error } = await db.rpc("check_rate_limit", {
    p_ip: ip,
    p_endpoint: opts.endpoint,
    p_max: opts.maxPerMinute,
  });

  if (error) {
    // Fail-open: if the rate-limit RPC errors, log and let the request
    // through rather than locking everyone out. The coarse middleware
    // limit is still in effect.
    console.warn("RATE_LIMIT_RPC_ERR:", error.message, opts.endpoint, ip);
    return null;
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
