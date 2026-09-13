import Link from "next/link";
import { Input } from "../../components/ui/Input";

interface VoucherCheckerProps {
  voucherCode: string;
  setVoucherCode: (v: string) => void;
  voucherResult: { code: string; status: string; current_balance: number; expires_at?: string | null } | null;
  voucherLoading: boolean;
  voucherError: string;
  setVoucherError: (v: string) => void;
  checkVoucherBalance: () => void;
}

export default function VoucherCheckerModal({
  voucherCode, setVoucherCode, voucherResult, voucherLoading, voucherError, setVoucherError, checkVoucherBalance,
}: VoucherCheckerProps) {
  return (
    <div>
      <div className="glass p-5 mb-5">
        <p className="text-sm font-semibold text-[color:var(--text)] mb-1">Check Voucher Balance</p>
        <p className="text-xs text-[color:var(--textMuted)] mb-3">Enter your voucher code to see your remaining balance.</p>
        <div className="flex gap-2">
          <Input value={voucherCode} onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(""); }}
            onKeyDown={e => e.key === "Enter" && checkVoucherBalance()}
            placeholder="Enter voucher code" className="flex-1 py-2.5 text-sm font-mono tracking-wider" />
          <button onClick={checkVoucherBalance} disabled={voucherLoading || !voucherCode.trim()}
            className="min-h-11 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[color:var(--accent)] text-[color:var(--ink-on-main)] hover:opacity-90 disabled:opacity-40 transition-opacity sm:min-h-0">
            {voucherLoading ? "..." : "Check"}
          </button>
        </div>
        {voucherError && <p className="mt-3 text-xs" style={{ color: "var(--danger)" }}>{voucherError}</p>}
        {voucherResult && (
          <div className="mt-4 rounded-xl overflow-hidden border border-[color:var(--glass-border)]">
            <div className="px-5 py-4" style={{ background: `color-mix(in srgb, ${voucherResult.status === "ACTIVE" ? "var(--success)" : "var(--danger)"} 10%, transparent)` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--textMuted)]">Voucher {voucherResult.code}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={voucherResult.status === "ACTIVE"
                  ? { color: "var(--success)", background: "color-mix(in srgb, var(--success) 14%, transparent)" }
                  : { color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 14%, transparent)" }}>
                  {voucherResult.status === "ACTIVE" ? "Active" : voucherResult.status === "REDEEMED" ? "Fully Used" : voucherResult.status}
                </span>
              </div>
              <p className="text-3xl font-bold text-[color:var(--text)]">R{voucherResult.current_balance}</p>
              <p className="text-xs text-[color:var(--textMuted)] mt-1">Remaining balance</p>
            </div>
            {voucherResult.expires_at && (
              <div className="surface-muted !rounded-none !border-0 px-5 py-3 flex justify-between items-center">
                <span className="text-xs text-[color:var(--textMuted)]">Valid until</span>
                <span className="text-sm font-medium text-[color:var(--text)]">{new Date(voucherResult.expires_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="text-center py-6">
        <p className="text-sm text-[color:var(--textMuted)] mb-3">Use your voucher code during checkout to apply your credit.</p>
        <Link href="/" className="btn btn-primary">Browse Tours</Link>
      </div>
    </div>
  );
}
