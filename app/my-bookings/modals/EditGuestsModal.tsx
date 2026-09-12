import { paidPortions } from "../../lib/pricing";
import Modal from "../Modal";
import Button from "../../components/ui/Button";
import type { Booking } from "../../lib/types";

interface EditGuestsModalProps {
  booking: Booking | null;
  guestQty: number;
  setGuestQty: (v: number) => void;
  guestExcessAction: string;
  setGuestExcessAction: (v: string) => void;
  actionLoading: string | null;
  onClose: () => void;
  onSubmit: () => void;
  refundPercent?: number;
  paymentUrl?: string;
  paymentAmount?: number;

}

export default function EditGuestsModal({
  booking, guestQty, setGuestQty, guestExcessAction, setGuestExcessAction,
  actionLoading, onClose, onSubmit, refundPercent, paymentUrl, paymentAmount,
}: EditGuestsModalProps) {
  if (!booking) return <Modal open={false} onClose={onClose} title="Edit Guests"><div /></Modal>;

  const b = booking;
  const unitPrice = Number(b.unit_price || 0);
  const guestDiff = guestQty - b.qty;
  // Guests can be removed at any time now; the card refund follows the operator's
  // cancellation policy (voucher stays full value). Backend enforces the same.
  const canRemove = true;
  const refundPct = refundPercent ?? 95;
  const refundFraction = refundPct / 100;
  const maxQty = (b.slots?.capacity_total || 999) - (b.slots?.booked || 0) - (b.slots?.held || 0) + b.qty;
  const addCost = guestDiff > 0 ? guestDiff * unitPrice : 0;

  const finalCost = addCost;
  const paid = paidPortions(b);
  const removalCredit = Math.abs(guestDiff) * paid.total / b.qty;
  const voucherReturn = Math.min(removalCredit, paid.voucher);
  const cashReturn = (removalCredit - voucherReturn) * refundFraction;

  return (
    <Modal open={true} onClose={onClose} title="Edit Guests">
      <div>
        <p className="text-sm text-[color:var(--textMuted)] mb-5">{b.tours?.name} &middot; R{unitPrice}/pp</p>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <button onClick={() => setGuestQty(Math.max(canRemove ? 1 : b.qty, guestQty - 1))}
            disabled={!!paymentUrl || guestQty <= (canRemove ? 1 : b.qty)}
            title={!canRemove ? "Cannot remove guests within 24 hours of trip" : undefined}
            className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl font-bold text-[color:var(--text)] hover:border-[color:var(--accent)] disabled:opacity-20 transition-colors select-none" style={{ background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)", borderColor: "var(--glass-border)" }}>
            &minus;
          </button>
          <div className="text-center min-w-[60px]">
            <span className="text-3xl font-bold text-[color:var(--text)] tabular-nums">{guestQty}</span>
            <p className="text-[12px] text-[color:var(--textMuted)] uppercase tracking-wider mt-0.5">{guestQty === 1 ? "guest" : "guests"}</p>
          </div>
          <button onClick={() => setGuestQty(Math.min(maxQty, guestQty + 1))}
            disabled={!!paymentUrl || guestQty >= maxQty}
            className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl font-bold text-[color:var(--text)] hover:border-[color:var(--accent)] disabled:opacity-20 transition-colors select-none" style={{ background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)", borderColor: "var(--glass-border)" }}>
            +
          </button>
        </div>

        {/* Price change summary */}
        {guestDiff > 0 && (
          <div className="surface-muted !rounded-xl p-3 mb-4 text-sm">
            <div className="flex justify-between"><span className="text-[color:var(--textMuted)]">Additional ({guestDiff} guest{guestDiff > 1 ? "s" : ""})</span><span>R{addCost}</span></div>
            <div className="flex justify-between font-semibold mt-1 pt-1 border-t border-[color:var(--glass-border)]"><span>To pay</span><span>R{finalCost}</span></div>
          </div>
        )}

        {/* Remove guests: refund/voucher choice */}
        {guestDiff < 0 && (
          <div className="mb-5 space-y-2">
            <p className="text-sm font-medium text-[color:var(--text)]">Credit for {Math.abs(guestDiff)} removed guest{Math.abs(guestDiff) === 1 ? "" : "s"}:</p>
            <label className="surface-muted !rounded-xl flex items-center gap-3 p-3 cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)] text-sm">
              <input type="radio" value="VOUCHER" checked={guestExcessAction === "VOUCHER"} onChange={() => setGuestExcessAction("VOUCHER")} className="accent-[color:var(--accent)]" />
              <span><strong>Voucher</strong> &middot; R{removalCredit.toFixed(2)} &middot; full value</span>
            </label>
            <label className="surface-muted !rounded-xl flex items-center gap-3 p-3 cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)] text-sm">
              <input type="radio" value="REFUND" checked={guestExcessAction === "REFUND"} onChange={() => setGuestExcessAction("REFUND")} className="accent-[color:var(--accent)]" />
              <span><strong>Refund</strong> &middot; R{cashReturn.toFixed(2)} ({refundPct}% per policy){voucherReturn > 0 ? " + R" + voucherReturn.toFixed(2) + " voucher credit" : ""}</span>
            </label>
          </div>
        )}

        {paymentUrl ? (
          <div className="space-y-2">
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent, #14b8a6)" }}>
              Pay R{paymentAmount ?? finalCost} now
            </a>
            <p className="text-xs text-center text-[color:var(--textMuted)]">Your extra guest{guestDiff > 1 ? "s are" : " is"} held for 15 minutes. The booking updates automatically once payment completes. You can close this after paying.</p>
          </div>
        ) : (
          <Button onClick={onSubmit} disabled={guestQty === b.qty || actionLoading === "guests"} fullWidth className="py-3">
            {actionLoading === "guests" ? "Processing..." : guestDiff === 0 ? "No changes" : guestDiff > 0 ? (finalCost > 0 ? "Add & Pay R" + finalCost : "Add Guests (Covered)") : "Confirm Removal"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
