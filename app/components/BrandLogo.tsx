/* BookingTours brand mark — dotted trail from an amber start-point to a destination ring.
   Platform provenance only: tenant branding always wins where a tenant logo exists. */

export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const scaledSize = Math.round(size * 1.8);
  return (
    <img
      src="/brand/bt-mark.png"
      alt="BookingTours logo"
      width={scaledSize}
      height={scaledSize}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-tight ${className}`}>
      BookingTours
    </span>
  );
}
