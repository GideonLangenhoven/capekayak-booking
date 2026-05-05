export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("/")) return src;
  const q = quality || 75;
  return `/api/img?url=${encodeURIComponent(src)}&w=${width}&q=${q}&fmt=webp`;
}
