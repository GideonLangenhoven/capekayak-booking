import Modal from "../Modal";
import Button from "../../components/ui/Button";
import { getTimeTier } from "../constants";
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
}

export default function EditGuestsModal({
  booking, guestQty, setGuestQty, guestExcessAction, setGuestExcessAction,
  actionLoading, onClose, onSubmit,
}: EditGuestsModalProps) {
  if (!booking) return <Modal open={false} onClose={onClose} title="Edit Guests"><div /></Modal>;

  var b = booking;
  var tier = getTimeTier(b);
  var unitPrice = Number(b.unit_price || 0);
  var guestDiff = guestQty - b.qty;
  var canRemove = tier === "FULL";
  var maxQty = (b.slots?.capacity_total || 999) - (b.slots?.booked || 0) - (b.slots?.held || 0) + b.qty;

  return (
    <Modal open={true} onClose={onClose} title="Edit Guests">
      <div>
        <p className="text-sm text-[color:var(--textMuted)] mb-5">{b.tours?.name} &middot; R{unitPrice}/pp</p>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <button onClick={() => setGuestQty(Math.max(canRemove ? 1 : b.qty, guestQty - 1))}
            disabled={guestQty <= (canRemove ? 1 : b.qty)}
            title={!canRemove ? "Cannot remove guests within 24 hours of trip" : undefined}
            className="w-11 h-11 rounded-full border-2 border-[color:var(--border)] flex items-center justify-center text-xl font-bold hover:border-[color:var(--accent)] disabled:opacity-20 transition-colors select-none">
            &minus;
          </button>
          <div className="text-center min-w-[60px]">
            <span className="text-3xl font-bold text-[color:var(--text)] tabular-nums">{guestQty}</span>
            <p className="text-[10px] text-[color:var(--textMuted)] uppercase tracking-wider mt-0.5">{guestQty === 1 ? "guest" : "guests"}</p>
          </div>
          <button onClick={() => setGuestQty(Math.min(maxQty, guestQty + 1))}
            disabled={guestQty >= maxQty}
            className="w-11 h-11 rounded-full border-2 border-[color:var(--border)] flex items-center justify-center text-xl font-bold hover:border-[color:var(--accent)] disabled:opacity-20 transition-colors select-none">
            +
          </button>
        </div>

        {/* Price change summary */}
        {guestDiff !== 0 && (
          <div className="bg-[color:var(--surface2)] rounded-xl p-3 mb-5 text-sm">
            <div className="flex justify-between"><span className="text-[color:var(--textMuted)]">Current ({b.qty})</span><span>R{b.total_amount}</span></div>
            <div className="flex justify-between font-semibold mt-1"><span>New ({guestQty})</span><span>R{guestQty * unitPrice}</span></div>
            {guestDiff > 0 && <p className="text-xs text-amber-600 mt-2">Payment link for R{guestDiff * unitPrice} will be sent.</p>}
          </div>
        )}

        {/* Remove guests: refund/voucher choice */}
        {guestDiff < 0 && (
          <div className="mb-5 space-y-2">
            <p className="text-sm font-medium text-[color:var(--text)]">R{Math.abs(guestDiff) * unitPrice} credit:</p>
            <label className="flex items-center gap-3 p-3 border border-[color:var(--border)] rounded-xl cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)] text-sm">
              <input type="radio" value="VOUCHER" checked={guestExcessAction === "VOUCHER"} onChange={() => setGuestExcessAction("VOUCHER")} className="accent-[color:var(--accent)]" />
              <span><strong>Voucher</strong> &middot; R{Math.abs(guestDiff) * unitPrice}</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-[color:var(--border)] rounded-xl cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)] text-sm">
              <input type="radio" value="REFUND" checked={guestExcessAction === "REFUND"} onChange={() => setGuestExcessAction("REFUND")} className="accent-[color:var(--accent)]" />
              <span><strong>Refund</strong> &middot; R{(Math.abs(guestDiff) * unitPrice * 0.95).toFixed(2)} (less 5%)</span>
            </label>
          </div>
        )}

        {!canRemove && guestQty <= b.qty && <p className="text-xs text-amber-600 mb-4">Cannot remove guests within 24 hours of trip.</p>}

        <Button onClick={onSubmit} disabled={guestQty === b.qty || actionLoading === "guests"} fullWidth className="py-3">
          {actionLoading === "guests" ? "Processing..." : guestDiff === 0 ? "No changes" : guestDiff > 0 ? "Add & Pay R" + (guestDiff * unitPrice) : "Confirm Removal"}
        </Button>
      </div>
    </Modal>
  );
}
