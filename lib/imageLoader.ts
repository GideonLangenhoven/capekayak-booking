// Hosts /api/img will proxy — must mirror ALLOWED_HOSTS in app/api/img/route.ts.
// Anything else is served to the browser directly: the client fetching an https
// image has no SSRF surface, and proxying it would just 403 and render broken.
const PROXY_HOSTS = ["supabase.co", "supabase.in", "images.unsplash.com"];

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("/")) return src;
  try {
    const host = new URL(src).hostname;
    if (!PROXY_HOSTS.some((h) => host === h || host.endsWith("." + h))) return src;
  } catch {
    return src;
  }
  const q = quality || 75;
  return `/api/img?url=${encodeURIComponent(src)}&w=${width}&q=${q}&fmt=webp`;
}
