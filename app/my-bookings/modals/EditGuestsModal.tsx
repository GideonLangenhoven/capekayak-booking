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
  actionLoading, onClose, onSubmit, refundPercent, paymentUrl, paymentAmount,
  voucherCode, setVoucherCode, voucherApplied, voucherError, onApplyVoucher, onRemoveVoucher,
  promoCode, setPromoCode, promoApplied, promoError, onApplyPromo, onRemovePromo,
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

  // Calculate discounts
  let promoDiscount = 0;
  if (promoApplied && addCost > 0) {
    if (promoApplied.discount_type === "PERCENT") {
      promoDiscount = Math.round(addCost * promoApplied.discount_value / 100 * 100) / 100;
    } else {
      promoDiscount = Math.min(promoApplied.discount_value, addCost);
    }
  }
  const afterPromo = Math.max(0, addCost - promoDiscount);
  const voucherCredit = voucherApplied ? Math.min(voucherApplied.balance, afterPromo) : 0;
  const finalCost = Math.max(0, afterPromo - voucherCredit);

  return (
    <Modal open={true} onClose={onClose} title="Edit Guests">
      <div>
        <p className="text-sm text-[color:var(--textMuted)] mb-5">{b.tours?.name} &middot; R{unitPrice}/pp</p>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <button onClick={() => setGuestQty(Math.max(canRemove ? 1 : b.qty, guestQty - 1))}
            disabled={guestQty <= (canRemove ? 1 : b.qty)}
            title={!canRemove ? "Cannot remove guests within 24 hours of trip" : undefined}
            className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl font-bold text-[color:var(--text)] hover:border-[color:var(--accent)] disabled:opacity-20 transition-colors select-none" style={{ background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)", borderColor: "var(--glass-border)" }}>
            &minus;
          </button>
          <div className="text-center min-w-[60px]">
            <span className="text-3xl font-bold text-[color:var(--text)] tabular-nums">{guestQty}</span>
            <p className="text-[12px] text-[color:var(--textMuted)] uppercase tracking-wider mt-0.5">{guestQty === 1 ? "guest" : "guests"}</p>
          </div>
          <button onClick={() => setGuestQty(Math.min(maxQty, guestQty + 1))}
            disabled={guestQty >= maxQty}
            className="w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl font-bold text-[color:var(--text)] hover:border-[color:var(--accent)] disabled:opacity-20 transition-colors select-none" style={{ background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)", borderColor: "var(--glass-border)" }}>
            +
          </button>
        </div>

        {/* Price change summary */}
        {guestDiff > 0 && (
          <div className="surface-muted !rounded-xl p-3 mb-4 text-sm">
            <div className="flex justify-between"><span className="text-[color:var(--textMuted)]">Additional ({guestDiff} guest{guestDiff > 1 ? "s" : ""})</span><span>R{addCost}</span></div>
            {promoDiscount > 0 && <div className="flex justify-between mt-1" style={{ color: "var(--success)" }}><span>Promo ({promoApplied!.code})</span><span>-R{promoDiscount}</span></div>}
            {voucherCredit > 0 && <div className="flex justify-between mt-1" style={{ color: "var(--success)" }}><span>Voucher ({voucherApplied!.code})</span><span>-R{voucherCredit}</span></div>}
            <div className="flex justify-between font-semibold mt-1 pt-1 border-t border-[color:var(--glass-border)]"><span>To pay</span><span>R{finalCost}</span></div>
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
                      className="field min-w-0 flex-1 !px-3 !py-2.5 sm:!py-2 !rounded-lg font-mono uppercase tracking-wider"
                      onKeyDown={e => e.key === "Enter" && onApplyVoucher()} />
                    <button onClick={onApplyVoucher} className="min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] sm:min-h-0" style={{ background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)", borderColor: "var(--glass-border)" }}>Apply</button>
                  </div>
                  {voucherError && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{voucherError}</p>}
                </>
              ) : (
                <div className="flex items-center justify-between p-2 border rounded-lg text-sm" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", borderColor: "color-mix(in srgb, var(--success) 30%, transparent)" }}>
                  <span className="font-mono font-semibold" style={{ color: "var(--success)" }}>{voucherApplied.code} &middot; R{voucherApplied.balance}</span>
                  <button onClick={onRemoveVoucher} className="min-h-11 px-2 text-xs sm:min-h-0" style={{ color: "var(--danger)" }}>Remove</button>
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
                      className="field min-w-0 flex-1 !px-3 !py-2.5 sm:!py-2 !rounded-lg font-mono uppercase tracking-wider"
                      onKeyDown={e => e.key === "Enter" && onApplyPromo()} />
                    <button onClick={onApplyPromo} className="min-h-11 shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)] sm:min-h-0" style={{ background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)", borderColor: "var(--glass-border)" }}>Apply</button>
                  </div>
                  {promoError && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{promoError}</p>}
                </>
              ) : (
                <div className="flex items-center justify-between p-2 border rounded-lg text-sm" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", borderColor: "color-mix(in srgb, var(--success) 30%, transparent)" }}>
                  <span className="font-semibold" style={{ color: "var(--success)" }}>{promoApplied.code}: {promoApplied.discount_type === "PERCENT" ? promoApplied.discount_value + "% off" : "R" + promoApplied.discount_value + " off"}</span>
                  <button onClick={onRemovePromo} className="min-h-11 px-2 text-xs sm:min-h-0" style={{ color: "var(--danger)" }}>Remove</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remove guests: refund/voucher choice */}
        {guestDiff < 0 && (
          <div className="mb-5 space-y-2">
            <p className="text-sm font-medium text-[color:var(--text)]">Credit for {Math.abs(guestDiff)} removed guest{Math.abs(guestDiff) === 1 ? "" : "s"}:</p>
            <label className="surface-muted !rounded-xl flex items-center gap-3 p-3 cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)] text-sm">
              <input type="radio" value="VOUCHER" checked={guestExcessAction === "VOUCHER"} onChange={() => setGuestExcessAction("VOUCHER")} className="accent-[color:var(--accent)]" />
              <span><strong>Voucher</strong> &middot; R{(Math.abs(guestDiff) * unitPrice).toFixed(2)} &middot; full value</span>
            </label>
            <label className="surface-muted !rounded-xl flex items-center gap-3 p-3 cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)] text-sm">
              <input type="radio" value="REFUND" checked={guestExcessAction === "REFUND"} onChange={() => setGuestExcessAction("REFUND")} className="accent-[color:var(--accent)]" />
              <span><strong>Refund</strong> &middot; R{(Math.abs(guestDiff) * unitPrice * refundFraction).toFixed(2)} ({refundPct}% per policy)</span>
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
