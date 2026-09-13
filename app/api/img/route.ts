import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = ["supabase.co", "supabase.in", "images.unsplash.com"];
const MAX_WIDTH = 1920;
const DEFAULT_QUALITY = 80;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const w = Math.min(Number(req.nextUrl.searchParams.get("w")) || MAX_WIDTH, MAX_WIDTH);
  const q = Math.min(Number(req.nextUrl.searchParams.get("q")) || DEFAULT_QUALITY, 100);
  const fmt = req.nextUrl.searchParams.get("fmt") === "avif" ? "avif" : "webp";

  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Only real web protocols. Without this, ftp://supabase.co/x passes the
  // host check below (URL.hostname is set for any scheme) and reaches fetch.
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "Protocol not allowed" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    // redirect:"manual" is the actual SSRF guard. The allowlist only vets the
    // URL we are handed; anyone can register their own <ref>.supabase.co
    // project — an allowlisted host — and serve a 302 to 169.254.169.254 or
    // any internal address, which a following fetch would happily retrieve and
    // proxy back. A 3xx is not `ok`, so it falls out as a 502 below.
    const upstream = await fetch(url, { redirect: "manual", next: { revalidate: 86400 } });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
    }

    // This route echoes bytes from our own origin. Without a type check an
    // allowlisted host serving text/html turns the proxy into stored XSS on
    // the booking domain.
    const upstreamType = upstream.headers.get("content-type") || "";
    if (!upstreamType.startsWith("image/")) {
      return NextResponse.json({ error: "Upstream is not an image" }, { status: 415 });
    }

    const contentType = fmt === "avif" ? "image/avif" : "image/webp";

    // Use Next.js Image Optimization API internally via sharp if available,
    // otherwise proxy the original with correct cache headers
    let body: ArrayBuffer | ReadableStream | null = null;
    try {
      const sharp = (await import("sharp")).default;
      const buffer = Buffer.from(await upstream.arrayBuffer());
      const transformed = await sharp(buffer)
        .resize(w, undefined, { withoutEnlargement: true })
        [fmt === "avif" ? "avif" : "webp"]({ quality: q })
        .toBuffer();

      return new NextResponse(new Uint8Array(transformed), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Vary": "Accept",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // sharp not available — proxy original with cache. upstreamType was
      // checked to be image/* above, so this can't echo markup.
      body = upstream.body;
      return new NextResponse(body, {
        headers: {
          "Content-Type": upstreamType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Vary": "Accept",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  } catch {
    return NextResponse.json({ error: "Image processing failed" }, { status: 500 });
  }
}
