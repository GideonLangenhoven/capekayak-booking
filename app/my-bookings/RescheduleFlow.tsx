"use client";
import Button from "../components/ui/Button";

import MiniCalendar from "./MiniCalendar";
import { fmtFull, fmtTime } from "../lib/format";
import { rescheduleUnitPrice, paidPortions } from "../lib/pricing";
import type { Booking, Slot } from "../lib/types";

interface RescheduleFlowProps {
  rescheduling: Booking;
  rebookConfirmSlot: Slot | null;
  setRebookConfirmSlot: (s: Slot | null) => void;
  rescheduleSlots: Slot[];
  loadingSlots: boolean;
  rescheduleQty: number;
  setRescheduleQty: (n: number) => void;
  excessAction: string;
  setExcessAction: (v: string) => void;
  actionLoading: string | null;
  reschedulePaymentUrl: string;
  reschedulePaymentDiff: number;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function RescheduleFlow({
  rescheduling, rebookConfirmSlot, setRebookConfirmSlot,
  rescheduleSlots, loadingSlots, rescheduleQty, setRescheduleQty,
  excessAction, setExcessAction,
  actionLoading, reschedulePaymentUrl, reschedulePaymentDiff, onCancel, onSubmit,
}: RescheduleFlowProps) {
  // Remediation reschedule of an operator-cancelled booking: any tour, party
  // size may shrink, and excess refunds carry no processing fee.
  const isClaim = rescheduling.status === "CANCELLED";
  const paid = paidPortions(rescheduling);
  const credit = paid.cash + (rescheduling.converted_to_voucher_id ? 0 : paid.voucher);
  // Payment screen
  if (reschedulePaymentUrl) {
    return (
      <div className="app-container max-w-lg page-wrap py-8 pb-28 lg:pb-8">
        <div className="text-center">

          <h2 className="text-xl font-bold text-[color:var(--text)] mb-2">Complete Payment</h2>
          <p className="text-sm text-[color:var(--textMuted)] mb-6">Your new slot is held. Pay the R{reschedulePaymentDiff} difference to secure your new slot.</p>
          <a href={reschedulePaymentUrl} className="inline-block w-full rounded-full py-4 text-base font-bold text-white bg-[color:var(--cta,#0f766e)] hover:opacity-90 transition-opacity text-center">
            Pay Now: R{reschedulePaymentDiff}
          </a>
          <p className="text-xs text-[color:var(--textMuted)] mt-4">You will be redirected to a secure payment page.</p>
        </div>
      </div>
    );
  }

  // Confirm screen
  if (rebookConfirmSlot) {
    const qty = isClaim ? rescheduleQty : rescheduling.qty;
    const slotSpots = rebookConfirmSlot.capacity_total - rebookConfirmSlot.booked - (rebookConfirmSlot.held || 0);
    const unitPrice = rescheduleUnitPrice(rebookConfirmSlot, rebookConfirmSlot.tours!.base_price_per_person);
    const newTotal = unitPrice * qty;
    const diff = newTotal - credit;
    const refundFactor = isClaim ? 1 : 0.95;
    const notEnoughSpots = slotSpots < qty;

    return (
      <div className="app-container max-w-lg page-wrap py-8 pb-28 lg:pb-8">
        <button onClick={() => setRebookConfirmSlot(null)} className="flex items-center gap-1 py-2 -my-2 text-sm text-[color:var(--textMuted)] hover:text-[color:var(--text)] mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to dates
        </button>
        <h2 className="text-xl font-bold text-[color:var(--text)] mb-5">Confirm Reschedule</h2>

        <div className="glass p-5 mb-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[color:var(--textMuted)] text-xs mb-0.5">Tour</p><p className="font-medium text-[color:var(--text)]">{rebookConfirmSlot.tours!.name}</p></div>
            <div>
              <p className="text-[color:var(--textMuted)] text-xs mb-0.5">Guests</p>
              {isClaim && rescheduling.qty > 1 ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setRescheduleQty(Math.max(1, rescheduleQty - 1))} disabled={rescheduleQty <= 1}
                    className="h-11 w-11 sm:h-7 sm:w-7 rounded-full border text-[color:var(--text)] disabled:opacity-30 hover:border-[color:var(--accent)] transition-colors" style={{ background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)", borderColor: "var(--glass-border)" }} aria-label="Fewer guests">−</button>
                  <span className="font-medium text-[color:var(--text)] min-w-[1.5rem] text-center">{rescheduleQty}</span>
                  <button type="button" onClick={() => setRescheduleQty(Math.min(rescheduling.qty, rescheduleQty + 1))} disabled={rescheduleQty >= rescheduling.qty}
                    className="h-11 w-11 sm:h-7 sm:w-7 rounded-full border text-[color:var(--text)] disabled:opacity-30 hover:border-[color:var(--accent)] transition-colors" style={{ background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)", borderColor: "var(--glass-border)" }} aria-label="More guests">+</button>
                </div>
              ) : (
                <p className="font-medium text-[color:var(--text)]">{qty} {qty === 1 ? "person" : "people"}</p>
              )}
              {isClaim && rescheduling.qty > 1 && <p className="mt-1 text-[12px] text-[color:var(--textMuted)]">Fewer guests? The difference is refunded.</p>}
            </div>
            <div><p className="text-[color:var(--textMuted)] text-xs mb-0.5">Date</p><p className="font-medium text-[color:var(--text)]">{fmtFull(rebookConfirmSlot.start_time)}</p></div>
            <div><p className="text-[color:var(--textMuted)] text-xs mb-0.5">Time</p><p className="font-medium text-[color:var(--text)]">{fmtTime(rebookConfirmSlot.start_time)}</p></div>
          </div>
          <div className="mt-4 pt-4 border-t border-[color:var(--glass-border)] flex justify-between items-center">
            <span className="text-sm text-[color:var(--textMuted)]">Originally paid</span><span className="text-sm">R{credit}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm font-semibold text-[color:var(--text)]">New total</span><span className="text-sm font-bold text-[color:var(--text)]">R{newTotal}</span>
          </div>
        </div>

        {diff > 0 && (
          <div className="mb-5 p-4 rounded-xl border text-sm" style={{ background: "color-mix(in srgb, var(--warning) 10%, transparent)", borderColor: "color-mix(in srgb, var(--warning) 30%, transparent)", color: "var(--warning)" }}>
            <p className="font-semibold mb-1">Additional payment of R{diff} required</p>
            <p className="text-xs">You&apos;ll be taken to a secure payment page after confirming.</p>
          </div>
        )}

        {diff < 0 && (
          <div className="mb-5 space-y-2">
            <p className="text-sm font-semibold text-[color:var(--text)]">R{Math.abs(diff)} credit. How would you like it?</p>
            <label className="surface-muted !rounded-xl flex items-center gap-3 p-3 cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)]">
              <input type="radio" value="VOUCHER" checked={excessAction === "VOUCHER"} onChange={() => setExcessAction("VOUCHER")} className="accent-[color:var(--accent)]" />
              <div className="text-sm"><span className="font-semibold">Gift Voucher</span> <span className="text-[color:var(--textMuted)]">&middot; R{Math.abs(diff)} (full amount)</span></div>
            </label>
            <label className="surface-muted !rounded-xl flex items-center gap-3 p-3 cursor-pointer hover:border-[color:var(--accent)] transition-colors has-[:checked]:border-[color:var(--accent)] has-[:checked]:bg-[color:var(--accentSoft)]">
              <input type="radio" value="REFUND" checked={excessAction === "REFUND"} onChange={() => setExcessAction("REFUND")} className="accent-[color:var(--accent)]" />
              <div className="text-sm"><span className="font-semibold">Refund</span> <span className="text-[color:var(--textMuted)]">&middot; R{(Math.abs(diff) * refundFactor).toFixed(2)}{isClaim ? " (full amount)" : " (less 5% fee)"}</span></div>
            </label>
          </div>
        )}

        {notEnoughSpots && (
          <p className="mb-3 text-sm" style={{ color: "var(--danger)" }}>Only {slotSpots} {slotSpots === 1 ? "spot" : "spots"} left on this slot. Reduce the guest count or pick another date.</p>
        )}
        <Button onClick={onSubmit} disabled={actionLoading === "reschedule" || notEnoughSpots} fullWidth className="py-3.5 font-semibold">
          {actionLoading === "reschedule" ? "Processing..." : diff > 0 ? "Confirm & Pay R" + diff : "Confirm Reschedule"}
        </Button>
      </div>
    );
  }

  // Calendar screen
  return (
    <div className="app-container max-w-lg page-wrap py-8 pb-28 lg:pb-8">
      <button onClick={onCancel} className="flex items-center gap-1 py-2 -my-2 text-sm text-[color:var(--textMuted)] hover:text-[color:var(--text)] mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to bookings
      </button>
      <h2 className="text-xl font-bold text-[color:var(--text)] mb-1">Choose a New Date</h2>
      <p className="text-sm text-[color:var(--textMuted)] mb-6">
        {isClaim
          ? <>Any tour &middot; up to {rescheduling.qty} {rescheduling.qty === 1 ? "person" : "people"} &middot; R{credit} credit</>
          : <>{rescheduling.tours?.name} &middot; {rescheduling.qty} {rescheduling.qty === 1 ? "person" : "people"}</>}
      </p>
      {loadingSlots ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : rescheduleSlots.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[color:var(--textMuted)]">No available dates found.</p>
          <p className="text-sm text-[color:var(--textMuted)] mt-1">Please contact us for assistance.</p>
        </div>
      ) : (
        <MiniCalendar slots={rescheduleSlots} onSelect={(sl) => { setRebookConfirmSlot(sl); setExcessAction("VOUCHER"); }} />
      )}
    </div>
  );
}
