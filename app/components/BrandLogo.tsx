/* BookingTours brand mark — the "B" monogram, solid pine with a wave-textured
   mint counter. Platform provenance only: tenant branding always wins where a
   tenant logo exists. No ivory variant here (unlike the admin copy): this only
   renders in the footer's small "Powered by" chip, on a per-tenant themed
   surface that may be light or dark, so it stays the platform's own pine. */

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
