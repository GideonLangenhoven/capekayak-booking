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

  if (!ALLOWED_HOSTS.some(h => parsed.hostname.endsWith(h))) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(url, { next: { revalidate: 86400 } });
    if (!upstream.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
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
        },
      });
    } catch {
      // sharp not available — proxy original with cache
      body = upstream.body;
      return new NextResponse(body, {
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Vary": "Accept",
        },
      });
    }
  } catch (err) {
    return NextResponse.json({ error: "Image processing failed" }, { status: 500 });
  }
}
