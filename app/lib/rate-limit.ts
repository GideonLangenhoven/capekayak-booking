import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getContext } from "@netlify/functions";
import { validIp } from "@/app/lib/client-ip";

// AN4: per-endpoint, per-IP rate limit backed by the public.api_rate_limits
// table + public.check_rate_limit RPC. Storefront middleware imposes a shared
// coarse 100/min/IP API bucket; sensitive writes keep this stricter bucket.

export function getClientIp(req: NextRequest): string | null {
  try {
    const ip = getContext().ip;
    return validIp(ip) ? ip : null;
  } catch { /* No Netlify request context outside Netlify Functions. */ }
  if (process.env.VERCEL === "1") {
    const ip = req.headers.get("x-vercel-forwarded-for");
    return validIp(ip) ? ip : null;
  }
  return process.env.NODE_ENV === "production" ? null : "local";
}

function unavailable() {
  return NextResponse.json(
    { error: "Rate limiter unavailable, please retry shortly." },
    { status: 503, headers: { "Retry-After": "5" } },
  );
}

export async function enforceRateLimit(opts: {
  req: NextRequest;
  endpoint: string;
  maxPerMinute: number;
}): Promise<NextResponse | null> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceKey) return process.env.NODE_ENV === "production" ? unavailable() : null;

  const ip = getClientIp(opts.req);
  if (!ip) return unavailable();
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
