import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

type RateResult = { allowed: boolean; remaining: number; retryAfterMs: number };

async function distributedRateLimit(key: string): Promise<RateResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redisKey = `ck:rl:booking-api:${key}`;
  const res = await fetch(`${url}/multi-exec`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["SET", redisKey, "0", "NX", "PX", WINDOW_MS],
      ["INCR", redisKey],
      ["PTTL", redisKey],
    ]),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Redis rate limit failed: ${res.status}`);
  const results = await res.json();
  const count = Number(results?.[1]?.result || 0);
  const ttl = Number(results?.[2]?.result || WINDOW_MS);
  if (!Number.isFinite(count) || count <= 0) throw new Error("Redis rate limit returned invalid count");

  return {
    allowed: count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - count),
    retryAfterMs: count > MAX_REQUESTS ? Math.max(0, ttl) : 0,
  };
}

function localRateLimit(ip: string): RateResult {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterMs: 0 };
  }

  entry.count++;
  return {
    allowed: entry.count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - entry.count),
    retryAfterMs: entry.count > MAX_REQUESTS ? Math.max(0, entry.resetAt - now) : 0,
  };
}

export async function middleware(request: NextRequest) {
  // Only rate-limit API and function calls, not static assets or pages
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  let result: RateResult;
  try {
    result = (await distributedRateLimit(ip)) || localRateLimit(ip);
  } catch (error) {
    console.error("BOOKING_RATE_LIMIT_DISTRIBUTED_FALLBACK:", error);
    result = localRateLimit(ip);
  }

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
