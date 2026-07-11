import type { CSSProperties } from "react";

type Variant = "default" | "primary" | "danger" | "muted";

const VARIANTS: Record<Variant, { cls: string; style?: CSSProperties }> = {
  default: {
    cls: "border bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]",
    style: { borderColor: "var(--border)" },
  },
  primary: {
    cls: "text-white bg-[color:var(--cta)] hover:bg-[color:var(--ctaHover)]",
  },
  danger: {
    cls: "border text-[color:var(--danger)] hover:bg-[color:var(--surface2)]",
    style: { borderColor: "color-mix(in srgb, var(--danger) 32%, transparent)" },
  },
  muted: {
    cls: "border border-transparent text-[color:var(--textMuted)] hover:bg-[color:var(--surface2)] hover:text-[color:var(--text)]",
  },
};

export default function ActionBtn({ label, onClick, disabled, variant = "default", className }: { label: string; onClick: () => void; disabled?: boolean; variant?: Variant; className?: string }) {
  const v = VARIANTS[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={"inline-flex h-11 items-center justify-center rounded-[10px] px-3.5 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 sm:h-9 " + v.cls + (className ? " " + className : "")}
      style={v.style}
    >
      {label}
    </button>
  );
}
