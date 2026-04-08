import Modal from "../Modal";
import { fmtDate, fmtTime } from "../../lib/format";
import type { Booking } from "../../lib/types";

interface CancelModalProps {
  booking: Booking | null;
  actionLoading: string | null;
  onClose: () => void;
  onCancelRefund: () => void;
  onCancelVoucher: () => void;
}

export default function CancelModal({ booking, actionLoading, onClose, onCancelRefund, onCancelVoucher }: CancelModalProps) {
  if (!booking) return <Modal open={false} onClose={onClose} title="Cancel Booking"><div /></Modal>;

  var ypi = (booking.yoco_payment_id || "").toUpperCase();
  var isVoucherPaid = ypi.startsWith("VOUCHER");
  var isManualPaid = !ypi && booking.status === "PAID";
  var isSplitPaid = ypi.startsWith("SPLIT");

  var isZeroValue = Number(booking.total_amount) === 0;

  return (
    <Modal open={true} onClose={onClose} title="Cancel Booking">
      <div>
        <div className="bg-[color:var(--surface2)] rounded-xl p-4 mb-5">
          <p className="font-semibold text-sm text-[color:var(--text)]">{booking.tours?.name}</p>
          {booking.slots?.start_time && <p className="text-xs text-[color:var(--textMuted)] mt-0.5">{fmtDate(booking.slots.start_time)} at {fmtTime(booking.slots.start_time)}</p>}
          <p className="text-xs text-[color:var(--textMuted)] mt-0.5">{booking.qty} {booking.qty === 1 ? "person" : "people"}{!isZeroValue ? " \u00b7 R" + booking.total_amount : ""}</p>
        </div>

        {isZeroValue ? (
          <div className="text-center py-4 mb-5">
            <p className="text-sm text-[color:var(--text)] mb-4">Are you sure you want to cancel this booking?</p>
            <p className="text-sm text-[color:var(--textMuted)]">We hope you can join us again soon!</p>
            <button onClick={onCancelRefund} disabled={actionLoading === "cancel"}
              className="mt-5 w-full py-3 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60">
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel Booking"}
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-[color:var(--text)] mb-3">How would you like to proceed?</p>

            <div className="space-y-2 mb-5">
              <button onClick={onCancelVoucher} disabled={actionLoading === "cancel"}
                className="w-full text-left p-4 border border-[color:var(--border)] rounded-xl hover:border-[color:var(--accent)] hover:shadow-sm transition-all disabled:opacity-60 group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]">Gift Voucher</p>
                    <p className="text-xs text-[color:var(--textMuted)] mt-0.5">
                      {isVoucherPaid
                        ? "Full value voucher (no fee)"
                        : "R" + booking.total_amount + " voucher \u00b7 No fees \u00b7 Valid 3 years"}
                    </p>
                  </div>
                  {!isManualPaid && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0 ml-2">BEST VALUE</span>}
                </div>
              </button>

              {isManualPaid && (
                <div className="p-4 border border-[color:var(--border)] rounded-xl bg-amber-50 text-sm text-amber-800">
                  Manual refund will be arranged by our team
                </div>
              )}

              {isSplitPaid && (
                <button onClick={onCancelRefund} disabled={actionLoading === "cancel"}
                  className="w-full text-left p-4 border border-[color:var(--border)] rounded-xl hover:border-[color:var(--accent)] hover:shadow-sm transition-all disabled:opacity-60 group">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]">Refund</p>
                    <p className="text-xs text-[color:var(--textMuted)] mt-0.5">Voucher portion restored + card refund (less 5% fee on card amount)</p>
                  </div>
                </button>
              )}

              {!isVoucherPaid && !isManualPaid && !isSplitPaid && (
                <button onClick={onCancelRefund} disabled={actionLoading === "cancel"}
                  className="w-full text-left p-4 border border-[color:var(--border)] rounded-xl hover:border-[color:var(--accent)] hover:shadow-sm transition-all disabled:opacity-60 group">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]">Refund</p>
                    <p className="text-xs text-[color:var(--textMuted)] mt-0.5">R{(Number(booking.total_amount) * 0.95).toFixed(2)} (less 5% fee) &middot; 5-7 business days</p>
                  </div>
                </button>
              )}
            </div>

            {actionLoading === "cancel" && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-[color:var(--textMuted)]">
                <div className="spinner" /> Processing...
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
