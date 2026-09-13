/* BookingTours brand mark — the "B" monogram, solid pine with a wave-textured
   mint counter. Platform provenance only: tenant branding always wins where a
   tenant logo exists.

   variant defaults to "pine". Pass "ivory" on dark surfaces (the operator
   directory's dark footer): the pine body is 61% of the art and nearly
   disappears on dark, leaving only the mint counter. The storefront Footer
   chip stays pine — it renders on a per-tenant theme that may be either. */

export function BrandMark({
  size = 28,
  className = "",
  variant = "pine",
}: {
  size?: number;
  className?: string;
  variant?: "pine" | "ivory";
}) {
  const scaledSize = Math.round(size * 1.8);
  return (
    <img
      src={variant === "ivory" ? "/brand/bt-mark-ivory.png" : "/brand/bt-mark.png"}
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
