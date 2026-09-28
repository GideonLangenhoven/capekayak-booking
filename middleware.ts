import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validIp } from "@/app/lib/client-ip";

const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;
const LIMITER_DEADLINE_MS = 1_500;
const RESPONSE_BYTES = 4 * 1024;

type RateResult = { allowed: boolean; remaining: number; retryAfterMs: number };

function unavailable(): Response {
  return Response.json({ error: "Rate limiting temporarily unavailable" }, {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "2" },
  });
}

async function beforeDeadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void work.catch(() => {}); throw new Error("deadline"); }
  let onAbort = () => {};
  const timedOut = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error("deadline"));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try { return await Promise.race([work, timedOut]); }
  finally { signal.removeEventListener("abort", onAbort); }
}

async function readBounded(body: ReadableStream<Uint8Array> | null, signal: AbortSignal): Promise<string> {
  if (!body) throw new Error("empty limiter response");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await beforeDeadline(reader.read(), signal);
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > RESPONSE_BYTES) throw new Error("limiter response too large");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    if (bytes > RESPONSE_BYTES || signal.aborted) void reader.cancel().catch(() => {});
  }
}

async function keyHash(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function distributedRateLimit(key: string, url: string, token: string): Promise<RateResult> {

  const redisKey = `ck:rl:booking-api:${key}`;
  const signal = AbortSignal.timeout(LIMITER_DEADLINE_MS);
  const res = await beforeDeadline(fetch(`${url}/multi-exec`, {
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
    signal,
  }), signal);

  if (!res.ok) throw new Error(`Redis rate limit failed: ${res.status}`);
  const results = JSON.parse(await readBounded(res.body, signal));
  const count = Number(results?.[1]?.result);
  const ttl = Number(results?.[2]?.result);
  if (!Array.isArray(results) || results.length !== 3 || !Number.isSafeInteger(count) || count <= 0 ||
    results?.[2]?.result == null || !Number.isSafeInteger(ttl) || ttl < 0 || ttl > WINDOW_MS) throw new Error("Invalid Redis limiter result");

  return {
    allowed: count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - count),
    retryAfterMs: count > MAX_REQUESTS ? Math.max(0, ttl) : 0,
  };
}

async function databaseRateLimit(key: string, url: string, serviceKey: string): Promise<RateResult> {
  const signal = AbortSignal.timeout(LIMITER_DEADLINE_MS);
  const res = await beforeDeadline(fetch(`${url}/rest/v1/rpc/check_ingress_rate_limit`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_bucket: "booking-api", p_key_hash: key, p_limit: MAX_REQUESTS, p_window_ms: WINDOW_MS }),
    cache: "no-store",
    signal,
  }), signal);
  if (!res.ok) throw new Error(`Database rate limit failed: ${res.status}`);
  const result = JSON.parse(await readBounded(res.body, signal));
  if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.allowed !== "boolean" ||
    result.limit !== MAX_REQUESTS || !Number.isSafeInteger(result.remaining) || result.remaining < 0 || result.remaining > MAX_REQUESTS ||
    !Number.isSafeInteger(result.retry_after_ms) || result.retry_after_ms < 0 || result.retry_after_ms > WINDOW_MS ||
    (result.allowed && result.retry_after_ms !== 0) || (!result.allowed && (result.retry_after_ms < 1 || result.remaining !== 0))) {
    throw new Error("Invalid database limiter result");
  }
  return { allowed: result.allowed, remaining: result.remaining, retryAfterMs: result.retry_after_ms };
}

function localRateLimit(ip: string): RateResult {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now >= entry.resetAt) {
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
  const path = request.nextUrl.pathname;
  if (path !== "/api" && !path.startsWith("/api/")) return NextResponse.next();

  const netlify = (globalThis as typeof globalThis & { Netlify?: { context?: { ip?: string } | null } }).Netlify?.context;
  const deployed = Boolean(netlify) || process.env.VERCEL === "1" || process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
  if ((netlify && process.env.VERCEL === "1") || (deployed && process.env.VERCEL !== "1" && !netlify)) return unavailable();
  // Netlify Edge provides the client IP in runtime context, not request headers.
  const candidateIp = netlify ? netlify.ip : process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for") : null;
  const ip = validIp(candidateIp) ? candidateIp : deployed ? null : "local";
  if (!ip) return unavailable();

  const redisConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_TOKEN);
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  let redisUrl = "";
  let databaseUrl = "";
  try {
    const url = new URL(process.env.UPSTASH_REDIS_REST_URL || "");
    if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) redisUrl = url.origin;
  } catch { /* checked below */ }
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    if (url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) databaseUrl = url.origin;
  } catch { /* checked below */ }
  if (deployed && redisConfigured && (!redisUrl || !token)) return unavailable();
  if (deployed && !redisConfigured && (!databaseUrl || !serviceKey)) return unavailable();

  let result: RateResult;
  try {
    if (redisConfigured && redisUrl && token) result = await distributedRateLimit(await keyHash(ip, token), redisUrl, token);
    else if (databaseUrl && serviceKey) result = await databaseRateLimit(await keyHash(ip, serviceKey), databaseUrl, serviceKey);
    else result = localRateLimit(ip);
  } catch {
    if (deployed) return unavailable();
    result = localRateLimit(ip);
  }

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))),
          "Cache-Control": "no-store",
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
