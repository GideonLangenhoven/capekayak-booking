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
  voucherCode: string;
  setVoucherCode: (v: string) => void;
  voucherApplied: { code: string; balance: number } | null;
  voucherError: string;
  onApplyVoucher: () => void;
  onRemoveVoucher: () => void;
  promoCode: string;
  setPromoCode: (v: string) => void;
  promoApplied: { id: string; code: string; discount_type: string; discount_value: number } | null;
  promoError: string;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
}

export default function EditGuestsModal({
  booking, guestQty, setGuestQty, guestExcessAction, setGuestExcessAction,
  actionLoading, onClose, onSubmit,
  voucherCode, setVoucherCode, voucherApplied, voucherError, onApplyVoucher, onRemoveVoucher,
  promoCode, setPromoCode, promoApplied, promoError, onApplyPromo, onRemovePromo,
}: EditGuestsModalProps) {
  if (!booking) return <Modal open={false} onClose={onClose} title="Edit Guests"><div /></Modal>;

  var b = booking;
  var tier = getTimeTier(b);
  var unitPrice = Number(b.unit_price || 0);
  var guestDiff = guestQty - b.qty;
  var canRemove = tier === "FULL";
  var maxQty = (b.slots?.capacity_total || 999) - (b.slots?.booked || 0) - (b.slots?.held || 0) + b.qty;
  var addCost = guestDiff > 0 ? guestDiff * unitPrice : 0;

  // Calculate discounts
  var promoDiscount = 0;
  if (promoApplied && addCost > 0) {
    if (promoApplied.discount_type === "PERCENT") {
      promoDiscount = Math.round(addCost * promoApplied.discount_value / 100 * 100) / 100;
    } else {
      promoDiscount = Math.min(promoApplied.discount_value, addCost);
    }
  }
  var afterPromo = Math.max(0, addCost - promoDiscount);
  var voucherCredit = voucherApplied ? Math.min(voucherApplied.balance, afterPromo) : 0;
  var finalCost = Math.max(0, afterPromo - voucherCredit);

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
        {guestDiff > 0 && (
          <div className="bg-[color:var(--surface2)] rounded-xl p-3 mb-4 text-sm">
            <div className="flex justify-between"><span className="text-[color:var(--textMuted)]">Additional ({guestDiff} guest{guestDiff > 1 ? "s" : ""})</span><span>R{addCost}</span></div>
            {promoDiscount > 0 && <div className="flex justify-between text-green-600 mt-1"><span>Promo ({promoApplied!.code})</span><span>-R{promoDiscount}</span></div>}
            {voucherCredit > 0 && <div className="flex justify-between text-green-600 mt-1"><span>Voucher ({voucherApplied!.code})</span><span>-R{voucherCredit}</span></div>}
            <div className="flex justify-between font-semibold mt-1 pt-1 border-t border-[color:var(--border)]"><span>To pay</span><span>R{finalCost}</span></div>
          </div>
        )}

        {/* Voucher & Promo — only when adding guests */}
        {guestDiff > 0 && (
          <div className="space-y-3 mb-5">
            {/* Voucher */}
            <div>
              <p className="text-xs font-semibold text-[color:var(--text)] mb-1">Have a voucher code?</p>
              {!voucherApplied ? (
                <>
                  <div className="flex gap-2">
                    <input type="text" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())}
                      placeholder="e.g. ABCD1234" maxLength={8}
                      className="flex-1 px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm font-mono uppercase tracking-wider bg-[color:var(--card)] outline-none focus:border-[color:var(--accent)]"
                      onKeyDown={e => e.key === "Enter" && onApplyVoucher()} />
                    <button onClick={onApplyVoucher} className="px-4 py-2 bg-[color:var(--surface2)] text-sm font-semibold rounded-lg hover:bg-[color:var(--border)] transition-colors">Apply</button>
                  </div>
                  {voucherError && <p className="text-red-500 text-xs mt-1">{voucherError}</p>}
                </>
              ) : (
                <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                  <span className="font-mono font-semibold text-green-700">{voucherApplied.code} &middot; R{voucherApplied.balance}</span>
                  <button onClick={onRemoveVoucher} className="text-red-400 text-xs hover:text-red-600">Remove</button>
                </div>
              )}
            </div>

            {/* Promo */}
            <div>
              <p className="text-xs font-semibold text-[color:var(--text)] mb-1">Have a promo code?</p>
              {!promoApplied ? (
                <>
                  <div className="flex gap-2">
                    <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SUMMER20"
                      className="flex-1 px-3 py-2 border border-[color:var(--border)] rounded-lg text-sm font-mono uppercase tracking-wider bg-[color:var(--card)] outline-none focus:border-[color:var(--accent)]"
                      onKeyDown={e => e.key === "Enter" && onApplyPromo()} />
                    <button onClick={onApplyPromo} className="px-4 py-2 bg-[color:var(--surface2)] text-sm font-semibold rounded-lg hover:bg-[color:var(--border)] transition-colors">Apply</button>
                  </div>
                  {promoError && <p className="text-red-500 text-xs mt-1">{promoError}</p>}
                </>
              ) : (
                <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                  <span className="font-semibold text-green-700">{promoApplied.code} &mdash; {promoApplied.discount_type === "PERCENT" ? promoApplied.discount_value + "% off" : "R" + promoApplied.discount_value + " off"}</span>
                  <button onClick={onRemovePromo} className="text-red-400 text-xs hover:text-red-600">Remove</button>
                </div>
              )}
            </div>
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
          {actionLoading === "guests" ? "Processing..." : guestDiff === 0 ? "No changes" : guestDiff > 0 ? (finalCost > 0 ? "Add & Pay R" + finalCost : "Add Guests (Covered)") : "Confirm Removal"}
        </Button>
      </div>
    </Modal>
  );
}
