import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

export function middleware(request: NextRequest) {
  // Only rate-limit API and function calls, not static assets or pages
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
