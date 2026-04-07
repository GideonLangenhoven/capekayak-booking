export default function ActionBtn({ label, onClick, disabled, variant = "default" }: { label: string; onClick: () => void; disabled?: boolean; variant?: "default" | "primary" | "danger" | "muted" }) {
  var cls = "px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ";
  if (variant === "primary") cls += "bg-[color:var(--accent)] text-white hover:opacity-90";
  else if (variant === "danger") cls += "text-red-600 border border-red-200 hover:bg-red-50";
  else if (variant === "muted") cls += "text-[color:var(--textMuted)] border border-[color:var(--border)] hover:bg-[color:var(--surface2)]";
  else cls += "text-[color:var(--text)] border border-[color:var(--border)] hover:bg-[color:var(--surface2)] hover:border-[color:var(--accent)]";
  return <button onClick={onClick} disabled={disabled} className={cls}>{label}</button>;
}
