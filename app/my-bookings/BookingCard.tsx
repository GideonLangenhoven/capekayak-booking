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
    <div key={b.id} className={"rounded-[1.5rem] p-5 shadow-sm border mb-3 flex flex-col relative overflow-hidden transition-shadow " + (isCancelled ? "bg-slate-50 border-slate-100 opacity-80" : "bg-[#FDFDFB] border-slate-100 hover:shadow-md")}>
      {/* C9: Countdown banner embedded */}
      {countdown && (
        <div className="absolute top-0 inset-x-0 px-5 py-1.5 bg-cyan-50/80 border-b border-cyan-100/50">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wide text-cyan-800 uppercase">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {countdown}
          </div>
        </div>
      )}

      {/* C14: Payment pending indicator */}
      {paymentPending === b.id && (
        <div className="absolute top-0 inset-x-0 px-5 py-1.5 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-wide text-amber-700 uppercase">
            <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
            Payment pending
          </div>
        </div>
      )}

      <div className={"flex gap-4 " + ((countdown || paymentPending === b.id) ? "mt-5" : "")}>
         {/* Left visual indicator */}
         <div className="flex flex-col items-center shrink-0">
             <div className={"w-10 h-10 rounded-full flex items-center justify-center shrink-0 " + 
               (isActive ? "bg-teal-50 text-teal-600" : 
                isCancelled ? "bg-slate-200 text-slate-500" : 
                "bg-slate-100 text-slate-600")}>
                <div className={"w-3 h-3 rounded-full " + (isActive ? "bg-teal-500" : "bg-slate-400")}></div>
             </div>
             <div className="w-[2px] flex-1 bg-slate-100 mt-2 mb-[-1rem] rounded-full hidden"></div>
         </div>

         {/* Center content */}
         <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-0.5">
               <h3 className="font-extrabold text-slate-800 text-[16px] leading-tight pr-2">
                  {b.tours?.name || "Booking"}
               </h3>
               <span className={"shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider relative " + 
                  (b.status === "CANCELLED" ? "bg-slate-100 text-slate-600" : STATUS_STYLE[b.status] || "bg-slate-100 text-slate-600")}>
                 {STATUS_LABEL[b.status] || b.status}
               </span>
            </div>

            {b.slots?.start_time && (
               <p className="text-[13px] text-slate-500 font-medium mb-1">
                  {fmtDate(b.slots.start_time)} at {fmtTime(b.slots.start_time)}
               </p>
            )}
            
            <div className="flex items-center gap-2 text-[12px] text-slate-400 font-semibold mb-3">
               <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  {b.qty}
               </span>
               <span>&bull;</span>
               <span className="text-slate-600">R{b.total_amount}</span>
               <span>&bull;</span>
               <span className="font-mono">{b.id.substring(0, 6).toUpperCase()}</span>
            </div>

            {/* Expandable / Important infos */}
            {waiverPending && b.waiver_token && (
               <div className={"flex items-center gap-2 mb-3 " + (isUrgentWaiver ? "p-2.5 rounded-xl bg-orange-50 border border-orange-200/60" : "")}>
                  <Link href={"/waiver?booking=" + b.id + "&token=" + b.waiver_token}
                    className={"text-[13px] font-bold " + (isUrgentWaiver ? "text-orange-800" : "text-orange-600 hover:text-orange-800 underline underline-offset-2")}>
                    {isUrgentWaiver ? "Sign Waiver Now (Required)" : "Sign Waiver"}
                  </Link>
               </div>
            )}

            {meetingPoint && !isCancelled && (
               <div className="mb-3">
                 <span className="text-[12px] font-bold text-slate-600">Meeting point:</span>{" "}
                 {mapsUrl ? (
                   <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-teal-600 hover:underline">{meetingPoint}</a>
                 ) : (
                   <span className="text-[12px] font-medium text-slate-500">{meetingPoint}</span>
                 )}
               </div>
            )}

            {b.custom_fields?.special_requests && (
               <div className="mb-3 text-[12px] text-slate-600 italic bg-amber-50/50 px-3 py-2 rounded-lg border border-amber-100/50">
                  "{b.custom_fields.special_requests.substring(0, 80)}{b.custom_fields.special_requests.length > 80 ? "..." : ""}"
               </div>
            )}

            {whatToBring && !isCancelled && (
              <div className="mb-3">
                <button onClick={() => setExpandedWhatToBring(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500 hover:text-slate-700 transition-colors">
                  <svg className={"w-3.5 h-3.5 transition-transform " + (expandedWhatToBring[b.id] ? "rotate-90" : "text-teal-500")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  What to bring
                </button>
                {expandedWhatToBring[b.id] && (
                  <div className="mt-2 text-[13px] text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-line border border-slate-100">
                    {whatToBring}
                  </div>
                )}
              </div>
            )}

            {/* Status indicators */}
            {b.refund_status === "CREDIT_PENDING" && Number(b.refund_amount || 0) > 0 && (
              <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
                  <p className="text-[13px] font-bold text-teal-900 mb-1">Available credit: R{Number(b.refund_amount).toFixed(2)}</p>
                  <p className="text-[12px] text-teal-700 mb-3">Choose how to receive your credit:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onClaimCredit(b, "VOUCHER")}
                      disabled={actionLoading === b.id}
                      className="px-3.5 py-1.5 text-[12px] font-bold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === b.id ? "..." : `Voucher (R${Number(b.refund_amount).toFixed(2)})`}
                    </button>
                    <button
                      onClick={() => onClaimCredit(b, "REFUND")}
                      disabled={actionLoading === b.id}
                      className="px-3.5 py-1.5 text-[12px] font-bold rounded-lg border border-teal-300 text-teal-800 hover:bg-teal-100 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === b.id ? "..." : `Refund (R${(Number(b.refund_amount) * 0.95).toFixed(2)})`}
                    </button>
                  </div>
              </div>
            )}

            {b.refund_status === "REQUESTED" && (
              <div className="mb-3 text-[12px] font-bold text-orange-600 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Refund of R{b.refund_amount || b.total_amount} pending
              </div>
            )}

            {isCancelled && b.converted_to_voucher_id && (
              <div className="mb-3 text-[12px] font-bold text-indigo-600 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                Converted to voucher (check email)
              </div>
            )}

            {/* Time tier warning */}
            {isActive && !isPast && tier === "LIMITED" && (
              <div className="mb-3 text-[12px] font-bold text-orange-600 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                Trip within 24h
              </div>
            )}
            {isActive && !isPast && tier === "LOCKED" && (
              <div className="mb-3 text-[12px] font-bold text-rose-500 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Trip within 12h
              </div>
            )}

            {/* C4: Trip photos for completed bookings */}
            {isCompleted && photos && photos.length > 0 && (
              <div className="mb-3">
                <a href={photos[0]} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  View Trip Photos
                </a>
              </div>
            )}

            {/* Actions Block */}
            <div className="flex flex-wrap gap-2 mt-4">
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
            </div>

         </div>
      </div>
    </div>
  );
}
