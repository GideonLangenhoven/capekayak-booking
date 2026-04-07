"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDate, fmtTime } from "../lib/format";
import { STATUS_STYLE, STATUS_LABEL, getTimeTier, getHrsBefore, getCountdownText } from "./constants";
import ActionBtn from "./ActionBtn";
import type { Booking, BookingLog } from "../lib/types";

interface BookingCardProps {
  b: Booking;
  countdownTick: number;
  paymentPending: string | null;
  actionLoading: string | null;
  tripPhotos: Record<string, string[]>;
  bookingLogs: Record<string, BookingLog[]>;
  expandedTimeline: Record<string, boolean>;
  setExpandedTimeline: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  expandedWhatToBring: Record<string, boolean>;
  setExpandedWhatToBring: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  onReschedule: (b: Booking) => void;
  onEditGuests: (b: Booking) => void;
  onContactDetails: (b: Booking) => void;
  onSpecialRequest: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onAdminReview: (b: Booking, action: string) => void;
  onClaimCredit: (b: Booking, action: "VOUCHER" | "REFUND") => void;
}

export default function BookingCard({
  b, countdownTick, paymentPending, actionLoading, tripPhotos, bookingLogs,
  expandedTimeline, setExpandedTimeline, expandedWhatToBring, setExpandedWhatToBring,
  onReschedule, onEditGuests, onContactDetails, onSpecialRequest, onCancel, onAdminReview, onClaimCredit,
}: BookingCardProps) {
  var router = useRouter();
  var tier = getTimeTier(b);
  var isPast = tier === "PAST";
  var isActive = ["PAID", "CONFIRMED"].includes(b.status);
  var isCancelled = b.status === "CANCELLED";
  var isExpired = b.status === "EXPIRED";
  var isCompleted = b.status === "COMPLETED" || (isActive && isPast);

  // C9: countdown
  var countdown = b.slots?.start_time && !isPast ? getCountdownText(b.slots.start_time) : null;
  void countdownTick;

  // C2: waiver
  var waiverSigned = b.waiver_status === "SIGNED" || b.waiver_status === "signed";
  var waiverPending = !waiverSigned && !isPast && !isCancelled && isActive;
  var isUrgentWaiver = waiverPending && b.slots?.start_time && getHrsBefore(b) < 24;

  // C10: meeting point
  var meetingPoint = b.tours?.meeting_point;
  var whatToBring = b.tours?.what_to_bring;
  var mapsUrl = meetingPoint ? "https://www.google.com/maps/search/" + encodeURIComponent(meetingPoint) : null;

  // C4: trip photos
  var photos = b.slot_id ? tripPhotos[b.slot_id] : null;

  // C7: timeline logs
  var logs = bookingLogs[b.id] || [];

  return (
    <div key={b.id} className="bg-[color:var(--surface)] rounded-2xl border border-[color:var(--border)] overflow-hidden hover:shadow-md transition-shadow">
      {/* C9: Countdown banner */}
      {countdown && (
        <div className="px-5 py-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {countdown}
          </div>
        </div>
      )}

      {/* C14: Payment pending indicator */}
      {paymentPending === b.id && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <div className="spinner" style={{ width: 14, height: 14 }} />
            Payment pending... checking status
          </div>
        </div>
      )}

      {/* Booking header */}
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[color:var(--text)] truncate">{b.tours?.name || "Booking"}</h3>
            {b.slots?.start_time && (
              <p className="text-sm text-[color:var(--textMuted)] mt-0.5">
                {fmtDate(b.slots.start_time)} &middot; {fmtTime(b.slots.start_time)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {/* C2: Waiver badge */}
            {isActive && !isPast && waiverSigned && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Waiver Signed &#10003;</span>
            )}
            {waiverPending && (
              <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full border " + (isUrgentWaiver ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse" : "bg-amber-50 text-amber-700 border-amber-200")}>Waiver Pending</span>
            )}
            <span className={"text-xs font-semibold px-2.5 py-1 rounded-full " + (STATUS_STYLE[b.status] || "bg-gray-100 text-gray-600")}>{STATUS_LABEL[b.status] || b.status}</span>
          </div>
        </div>

        {/* C2: Sign waiver link */}
        {waiverPending && b.waiver_token && (
          <div className={"flex items-center gap-2 pb-3 " + (isUrgentWaiver ? "p-2 -mx-2 rounded-lg bg-amber-50 border border-amber-200 mb-2" : "")}>
            <Link href={"/waiver?booking=" + b.id + "&token=" + b.waiver_token}
              className={"text-xs font-semibold underline " + (isUrgentWaiver ? "text-amber-800" : "text-amber-600 hover:text-amber-800")}>
              {isUrgentWaiver ? "Sign Waiver Now (required before trip)" : "Sign Waiver"}
            </Link>
          </div>
        )}

        {/* Details */}
        <div className="flex items-center gap-3 text-sm text-[color:var(--textMuted)] pb-4">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            {b.qty}
          </span>
          <span className="font-medium text-[color:var(--text)]">R{b.total_amount}</span>
          <span className="font-mono text-xs opacity-60">{b.id.substring(0, 8).toUpperCase()}</span>
        </div>

        {/* C10: Meeting point */}
        {meetingPoint && !isCancelled && (
          <div className="flex items-start gap-2 pb-3 text-xs text-[color:var(--textMuted)]">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <div>
              <span className="font-medium text-[color:var(--text)]">Meeting point: </span>
              {mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{meetingPoint}</a>
              ) : (
                <span>{meetingPoint}</span>
              )}
            </div>
          </div>
        )}

        {/* C10: What to bring (collapsible) */}
        {whatToBring && !isCancelled && (
          <div className="pb-3">
            <button onClick={() => setExpandedWhatToBring(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
              className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--textMuted)] hover:text-[color:var(--text)] transition-colors">
              <svg className={"w-3 h-3 transition-transform " + (expandedWhatToBring[b.id] ? "rotate-90" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              What to bring
            </button>
            {expandedWhatToBring[b.id] && (
              <div className="mt-1.5 ml-5 text-xs text-[color:var(--textMuted)] bg-[color:var(--surface2)] rounded-lg p-3 whitespace-pre-line">
                {whatToBring}
              </div>
            )}
          </div>
        )}

        {/* Special request note */}
        {b.custom_fields?.special_requests && (
          <div className="flex items-start gap-2 pb-3 text-xs text-[color:var(--textMuted)]">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
            <span className="italic">{b.custom_fields.special_requests.substring(0, 80)}{b.custom_fields.special_requests.length > 80 ? "..." : ""}</span>
          </div>
        )}

        {/* Status indicators */}
        {b.refund_status === "CREDIT_PENDING" && Number(b.refund_amount || 0) > 0 && (
          <div className="pb-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800 mb-1">You have a credit of R{Number(b.refund_amount).toFixed(2)}</p>
              <p className="text-xs text-emerald-700 mb-3">Choose how you'd like to receive your credit:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onClaimCredit(b, "VOUCHER")}
                  disabled={actionLoading === b.id}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === b.id ? "..." : `Get Voucher (R${Number(b.refund_amount).toFixed(2)})`}
                </button>
                <button
                  onClick={() => onClaimCredit(b, "REFUND")}
                  disabled={actionLoading === b.id}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === b.id ? "..." : `Get Refund (R${(Number(b.refund_amount) * 0.95).toFixed(2)})`}
                </button>
              </div>
            </div>
          </div>
        )}
        {b.refund_status === "REQUESTED" && (
          <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-amber-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Refund of R{b.refund_amount || b.total_amount} pending
          </div>
        )}
        {isCancelled && b.converted_to_voucher_id && (
          <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-blue-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
            Converted to voucher — check your email
          </div>
        )}
        {(isCancelled || isExpired) && b.cancelled_at && (
          <div className="flex items-start gap-2 pb-3 text-xs text-[color:var(--textMuted)]">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            <div>
              <span>Cancelled on {fmtDate(b.cancelled_at)}</span>
              {b.cancellation_reason && <span className="ml-1">— {b.cancellation_reason}</span>}
            </div>
          </div>
        )}

        {/* Time tier warning */}
        {isActive && !isPast && tier === "LIMITED" && (
          <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-amber-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            Some changes limited (trip within 24 hours)
          </div>
        )}
        {isActive && !isPast && tier === "LOCKED" && (
          <div className="flex items-center gap-1.5 pb-3 text-xs font-medium text-red-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Changes require team review (trip within 12 hours)
          </div>
        )}

        {/* C4: Trip photos for completed bookings */}
        {isCompleted && photos && photos.length > 0 && (
          <div className="pb-3">
            <a href={photos[0]} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              View Trip Photos ({photos.length} {photos.length === 1 ? "photo" : "photos"})
            </a>
          </div>
        )}

        {/* C7: Activity timeline (collapsible) */}
        {logs.length > 0 && (
          <div className="pb-3">
            <button onClick={() => setExpandedTimeline(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
              className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--textMuted)] hover:text-[color:var(--text)] transition-colors">
              <svg className={"w-3 h-3 transition-transform " + (expandedTimeline[b.id] ? "rotate-90" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              Activity ({logs.length})
            </button>
            {expandedTimeline[b.id] && (
              <div className="mt-2 ml-1 border-l-2 border-[color:var(--border)] pl-3 space-y-2">
                {logs.map((log: BookingLog) => (
                  <div key={log.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] -ml-[calc(0.75rem+1px)]"></div>
                      <span className="font-medium text-[color:var(--text)]">
                        {(log.action || "Event").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    </div>
                    <p className="text-[color:var(--textMuted)] ml-0 mt-0.5">
                      {new Date(log.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" })} at {fmtTime(log.created_at)}
                      {log.details && typeof log.details === "string" && <span className="ml-1">— {log.details.substring(0, 60)}</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions bar */}
      <div className="px-5 py-3 border-t border-[color:var(--border)] bg-[color:var(--bg)]/50">
        <div className="flex flex-wrap gap-2">
          {/* FULL ACCESS (>24h) */}
          {isActive && tier === "FULL" && (
            <>
              <ActionBtn label="Reschedule" onClick={() => onReschedule(b)} />
              <ActionBtn label="Edit Guests" onClick={() => onEditGuests(b)} />
              <ActionBtn label="Details" onClick={() => onContactDetails(b)} />
              <ActionBtn label="Request" onClick={() => onSpecialRequest(b)} />
              <ActionBtn label="Cancel" onClick={() => onCancel(b)} variant="danger" />
            </>
          )}

          {/* LIMITED (12-24h) */}
          {isActive && tier === "LIMITED" && (
            <>
              <ActionBtn label="Edit Guests" onClick={() => onEditGuests(b)} />
              <ActionBtn label="Details" onClick={() => onContactDetails(b)} />
              <ActionBtn label="Request" onClick={() => onSpecialRequest(b)} />
              <ActionBtn label="Request Change" onClick={() => onAdminReview(b, "change")} disabled={actionLoading === b.id} variant="muted" />
            </>
          )}

          {/* LOCKED (<12h) */}
          {isActive && tier === "LOCKED" && (
            <>
              <ActionBtn label="Special Request" onClick={() => onSpecialRequest(b)} />
              <ActionBtn label="Contact Team" onClick={() => onAdminReview(b, "change")} disabled={actionLoading === b.id} variant="muted" />
            </>
          )}

          {/* PAST TRIP */}
          {isCompleted && (
            <>
              <ActionBtn label="Book Again" onClick={() => router.push("/book?tour=" + b.tour_id)} variant="primary" />
              <Link href="/" className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[color:var(--border)] hover:bg-[color:var(--surface2)] transition-colors text-[color:var(--textMuted)]">Browse Tours</Link>
            </>
          )}

          {/* CANCELLED */}
          {isCancelled && !b.converted_to_voucher_id && (b.refund_status === "NONE" || !b.refund_status) && (
            <ActionBtn label="Rebook Trip" onClick={() => router.push("/book?tour=" + b.tour_id)} variant="primary" />
          )}

          {/* EXPIRED */}
          {isExpired && (
            <ActionBtn label="Rebook Trip" onClick={() => router.push("/book?tour=" + b.tour_id)} variant="primary" />
          )}

          {/* HELD / PENDING */}
          {(b.status === "HELD" || b.status === "PENDING") && (
            <>
              <p className="text-xs text-[color:var(--textMuted)] py-1">Check your email for the payment link.</p>
              <ActionBtn label="Cancel" onClick={() => onCancel(b)} variant="danger" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
