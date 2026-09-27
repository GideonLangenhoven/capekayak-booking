import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = ["supabase.co", "supabase.in", "images.unsplash.com"];
const ALLOWED_TYPES = /^image\/(?:jpeg|png|webp|avif|gif)(?:;|$)/i;
const MAX_WIDTH = 1920;
const DEFAULT_QUALITY = 80;
const MAX_BYTES = 10_000_000;
const MAX_PIXELS = 40_000_000;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const requestedWidth = Number(req.nextUrl.searchParams.get("w"));
  const requestedQuality = Number(req.nextUrl.searchParams.get("q"));
  const w = Number.isFinite(requestedWidth) && requestedWidth > 0 ? Math.max(1, Math.min(Math.trunc(requestedWidth), MAX_WIDTH)) : MAX_WIDTH;
  const q = Number.isFinite(requestedQuality) && requestedQuality > 0 ? Math.max(1, Math.min(Math.trunc(requestedQuality), 100)) : DEFAULT_QUALITY;
  const format = req.nextUrl.searchParams.get("fmt") === "avif" ? "avif" : "webp";

  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
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
    const upstream = await fetch(parsed.href, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
    }

    if (!ALLOWED_TYPES.test(upstream.headers.get("content-type") || "")) {
      return NextResponse.json({ error: "Upstream is not an image" }, { status: 415 });
    }
    if (Number(upstream.headers.get("content-length")) > MAX_BYTES || !upstream.body) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const chunks: Uint8Array[] = [];
    const reader = upstream.body.getReader();
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Image too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    const sharp = (await import("sharp")).default;
    const transformed = await sharp(Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), size), { limitInputPixels: MAX_PIXELS })
      .resize(w, undefined, { withoutEnlargement: true })
      [format]({ quality: q })
      .toBuffer();

    return new NextResponse(new Uint8Array(transformed), {
      headers: {
        "Content-Type": `image/${format}`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Vary": "Accept",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image processing failed" }, { status: 502 });
  }
}
