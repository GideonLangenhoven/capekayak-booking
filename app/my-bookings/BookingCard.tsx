"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDate, fmtTime } from "../lib/format";
import { STATUS_TONE, STATUS_LABEL, getTimeTier, getHrsBefore, getCountdownText, type StatusTone } from "./constants";
import ActionBtn from "./ActionBtn";
import type { Booking, BookingLog } from "../lib/types";

/* ─── Inline icons (stroke 1.8 per brand — never emoji) ─── */
const ic = "shrink-0";
function IconUsers({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
}
function IconPin({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function IconClock({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function IconCheck({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
function IconPen({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
}
function IconChevron({ open, className = "h-3.5 w-3.5" }: { open?: boolean; className?: string }) {
  return <svg className={ic + " transition-transform " + (open ? "rotate-90 " : "") + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;
}
function IconCamera({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function IconTicket({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>;
}
function IconAlert({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
}
function IconLock({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <svg className={ic + " " + className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
}

/* ─── Status pill ─── */
const TONE_VARS: Record<StatusTone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--accent)",
  muted: "var(--textMuted)",
};

function StatusPill({ status, onDark = false }: { status: string; onDark?: boolean }) {
  const tone = STATUS_TONE[status] || "muted";
  const label = STATUS_LABEL[status] || status;
  if (onDark) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-[#F7F5F0]">
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
        {label}
      </span>
    );
  }
  const v = TONE_VARS[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ color: v, background: `color-mix(in srgb, ${v} 10%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* ─── Countdown / relative-time label ─── */
function relativeStart(b: Booking): string | null {
  if (!b.slots?.start_time) return null;
  const near = getCountdownText(b.slots.start_time); // < 48h, minute-precise
  if (near) return near;
  // Calendar-day difference so a Wednesday trip seen on Saturday reads "In 3 days"
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const tripDay = new Date(b.slots.start_time);
  tripDay.setHours(0, 0, 0, 0);
  const days = Math.round((tripDay.getTime() - startOfToday.getTime()) / 86400000);
  if (days <= 0) return null;
  return days === 1 ? "Tomorrow" : "In " + days + " days";
}

interface BookingCardProps {
  b: Booking;
  variant?: "hero" | "card" | "row";
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
  onContactUs: (b: Booking) => void;
  onClaimCredit: (b: Booking, action: "VOUCHER" | "REFUND") => void;
  refundCalc?: { percent: number; amount: number } | null;
}

export default function BookingCard({
  b, variant = "card", countdownTick, paymentPending, actionLoading, tripPhotos,
  expandedWhatToBring, setExpandedWhatToBring,
  onReschedule, onEditGuests, onContactDetails, onSpecialRequest, onCancel, onAdminReview, onContactUs, onClaimCredit,
  refundCalc,
}: BookingCardProps) {
  const router = useRouter();
  const tier = getTimeTier(b);
  const isPast = tier === "PAST";
  const isActive = ["PAID", "CONFIRMED"].includes(b.status);
  const isCancelled = b.status === "CANCELLED";
  const isExpired = b.status === "EXPIRED";
  const isCompleted = b.status === "COMPLETED" || (isActive && isPast);
  void countdownTick; // 60s tick re-render

  const countdown = !isPast && !isCancelled ? relativeStart(b) : null;
  const waiverSigned = b.waiver_status === "SIGNED" || b.waiver_status === "signed";
  const waiverPending = !waiverSigned && !isPast && !isCancelled && isActive;
  const isUrgentWaiver = waiverPending && b.slots?.start_time && getHrsBefore(b) < 24;
  const meetingPoint = b.tours?.meeting_point;
  const whatToBring = b.tours?.what_to_bring;
  const mapsUrl = meetingPoint ? "https://www.google.com/maps/search/" + encodeURIComponent(meetingPoint) : null;
  const photos = b.slot_id ? tripPhotos[b.slot_id] : null;
  const bringOpen = !!expandedWhatToBring[b.id];
  const ref = b.id.substring(0, 6).toUpperCase();
  const hasCredit = (b.refund_status === "CREDIT_PENDING" || b.refund_status === "ACTION_REQUIRED")
    && Number(b.refund_amount || 0) > 0 && !b.converted_to_voucher_id;

  /* ════════ ROW — compact line for past / cancelled / expired ════════ */
  if (variant === "row") {
    const d = b.slots?.start_time ? new Date(b.slots.start_time) : null;
    const day = d ? d.toLocaleDateString("en-ZA", { day: "numeric", timeZone: "Africa/Johannesburg" }) : "—";
    const mon = d ? d.toLocaleDateString("en-ZA", { month: "short", timeZone: "Africa/Johannesburg" }) : "";
    return (
      <article className="flex items-center gap-3.5 rounded-xl border bg-[color:var(--surface)] px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className={"w-11 shrink-0 rounded-lg py-1.5 text-center " + (isCancelled || isExpired ? "opacity-55" : "")} style={{ background: "var(--surface2)" }}>
          <span className="font-display block text-[17px] font-semibold leading-none text-[color:var(--text)]">{day}</span>
          <span className="mt-0.5 block text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--textMuted)]">{mon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={"truncate text-[14px] font-semibold " + (isCancelled || isExpired ? "text-[color:var(--textMuted)]" : "text-[color:var(--text)]")}>
            {b.tours?.name || "Booking"}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[color:var(--textMuted)]">
            {b.slots?.start_time ? fmtTime(b.slots.start_time) + " · " : ""}{b.qty} {b.qty === 1 ? "guest" : "guests"}{Number(b.total_amount) > 0 ? " · R" + b.total_amount : ""}
            {isCancelled && b.converted_to_voucher_id ? " · voucher issued" : ""}
            {b.refund_status === "REQUESTED" ? " · refund pending" : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill status={b.status} />
          <div className="flex items-center gap-2">
            {isCompleted && photos && photos.length > 0 && (
              <a href={photos[0]} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 py-1.5 text-[12px] font-semibold text-[color:var(--accent)] hover:underline">
                <IconCamera /> Photos
              </a>
            )}
            {(isCompleted || isExpired || (isCancelled && !hasCredit && (b.refund_status === "NONE" || !b.refund_status))) && (
              <button onClick={() => router.push("/book?tour=" + b.tour_id)}
                className="py-1.5 text-[12px] font-semibold text-[color:var(--accent)] hover:underline">
                Book again
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  /* ════════ Shared blocks for hero + card ════════ */
  const creditPanel = hasCredit && (
    <div className={variant === "hero"
      ? "rounded-xl bg-white/10 p-4"
      : "rounded-xl p-4"}
      style={variant === "hero" ? undefined : { background: "var(--accentSoft)" }}>
      <p className={"text-[13.5px] font-semibold " + (variant === "hero" ? "text-[#F7F5F0]" : "text-[color:var(--text)]")}>
        {String(b.cancellation_reason || "").toLowerCase().includes("weather") ? "Trip was weather-cancelled" : "Available credit"} — R{Number(b.refund_amount).toFixed(2)}
      </p>
      <p className={"mt-0.5 text-[12.5px] " + (variant === "hero" ? "text-[#F7F5F0]/75" : "text-[color:var(--textMuted)]")}>
        Pick a new date, take a voucher, or request a refund.
      </p>
      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
        <ActionBtn label="Pick a new date" onClick={() => onReschedule(b)} disabled={actionLoading === b.id} variant="primary" />
        <ActionBtn label={actionLoading === b.id ? "…" : `Voucher · R${Number(b.refund_amount).toFixed(0)}`} onClick={() => onClaimCredit(b, "VOUCHER")} disabled={actionLoading === b.id} />
        <ActionBtn label={actionLoading === b.id ? "…" : `Refund · R${Number(b.refund_amount).toFixed(2)}`} onClick={() => onClaimCredit(b, "REFUND")} disabled={actionLoading === b.id} />
      </div>
    </div>
  );

  /* ════════ HERO — the next trip ════════ */
  if (variant === "hero") {
    const heroSolid = "inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[#F7F5F0] px-4 text-[13.5px] font-semibold text-[#1c2620] transition-colors hover:bg-white sm:h-10";
    const heroOutline = "inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-white/25 px-4 text-[13.5px] font-semibold text-[#F7F5F0]/90 transition-colors hover:bg-white/10 sm:h-10";
    const heroQuiet = "inline-flex h-11 items-center justify-center rounded-[10px] px-3.5 text-[13.5px] font-semibold text-[#F7F5F0]/60 transition-colors hover:bg-white/10 hover:text-[#F7F5F0] sm:h-10";
    return (
      <article
        className="relative overflow-hidden rounded-2xl text-[#F7F5F0]"
        style={{
          background: "linear-gradient(140deg, color-mix(in srgb, var(--accent) 46%, #0e130f) 0%, color-mix(in srgb, var(--accent) 22%, #0e130f) 100%)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* dotted-trail motif (echoes the brand mark) */}
        <svg aria-hidden className="pointer-events-none absolute -right-5 -top-8 h-44 w-44 opacity-[0.13]" viewBox="0 0 120 120" fill="none">
          <path d="M12 96C34 88 40 64 56 52c14-10 34-12 48-28" stroke="#F7F5F0" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.5 9" />
          <circle cx="104" cy="22" r="5" stroke="#F7F5F0" strokeWidth="2" />
          <circle cx="12" cy="96" r="3" fill="#F7F5F0" />
        </svg>

        <div className="relative p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F7F5F0]/60">Next trip</p>
            {paymentPending === b.id ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Payment pending
              </span>
            ) : countdown ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold">
                <IconClock className="h-3 w-3" /> {countdown}
              </span>
            ) : (
              <StatusPill status={b.status} onDark />
            )}
          </div>

          {/* explicit color: the global heading rule would paint var(--text) on the dark panel */}
          <h3 className="font-display mt-2.5 text-[26px] font-semibold leading-[1.12] tracking-[-0.02em] text-[#F7F5F0] sm:text-[30px]">
            {b.tours?.name || "Booking"}
          </h3>
          {b.slots?.start_time && (
            <p className="mt-1.5 text-[15px] text-[#F7F5F0]/85">
              {fmtDate(b.slots.start_time)} · {fmtTime(b.slots.start_time)}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-[#F7F5F0]/85">
              <IconUsers /> {b.qty} {b.qty === 1 ? "guest" : "guests"}
            </span>
            {Number(b.total_amount) > 0 && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-[#F7F5F0]/85">
                R{b.total_amount}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium tabular-nums text-[#F7F5F0]/85">
              Ref {ref}
            </span>
            {!countdown && paymentPending !== b.id ? null : <StatusPill status={b.status} onDark />}
          </div>

          {/* Trip prep */}
          <div className="mt-6 space-y-2.5 border-t border-white/12 pt-5">
            {waiverPending && b.waiver_token ? (
              <Link
                href={"/waiver?booking=" + b.id + "&token=" + b.waiver_token}
                className={heroSolid + " w-full sm:w-auto" + (isUrgentWaiver ? " ring-2 ring-white/35" : "")}
              >
                <IconPen />
                {isUrgentWaiver ? "Sign waiver — required before your trip" : "Sign your waiver"}
              </Link>
            ) : waiverSigned ? (
              <p className="flex items-center gap-2 text-[13px] text-[#F7F5F0]/75">
                <IconCheck className="h-3.5 w-3.5 text-[#F7F5F0]" /> Waiver signed — you're all set
              </p>
            ) : null}

            {meetingPoint && (
              <p className="flex items-start gap-2 text-[13px] text-[#F7F5F0]/85">
                <IconPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Meet at{" "}
                  {mapsUrl ? (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#F7F5F0] underline decoration-white/40 underline-offset-2 hover:decoration-white">
                      {meetingPoint}
                    </a>
                  ) : (
                    <span className="font-semibold">{meetingPoint}</span>
                  )}
                </span>
              </p>
            )}

            {whatToBring && (
              <div>
                <button
                  onClick={() => setExpandedWhatToBring(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                  className="flex items-center gap-1.5 py-1 text-[13px] font-semibold text-[#F7F5F0]/75 transition-colors hover:text-[#F7F5F0]"
                >
                  <IconChevron open={bringOpen} className="h-3 w-3" /> What to bring
                </button>
                {bringOpen && (
                  <div className="mt-2 whitespace-pre-line rounded-xl bg-white/8 p-3.5 text-[13px] leading-relaxed text-[#F7F5F0]/85">
                    {whatToBring}
                  </div>
                )}
              </div>
            )}

            {b.custom_fields?.special_requests && (
              <p className="text-[12.5px] italic text-[#F7F5F0]/65">
                “{b.custom_fields.special_requests.substring(0, 90)}{b.custom_fields.special_requests.length > 90 ? "…" : ""}”
              </p>
            )}

            {creditPanel}

            {b.refund_status === "REQUESTED" && (
              <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#F7F5F0]/80">
                <IconClock /> Refund of R{b.refund_amount || b.total_amount} pending
              </p>
            )}
            {isActive && !isPast && tier === "LIMITED" && (
              <p className="flex items-center gap-2 text-[12.5px] text-[#F7F5F0]/70">
                <IconAlert /> Trip is within 24 hours — changes are limited
              </p>
            )}
            {isActive && !isPast && tier === "LOCKED" && (
              <p className="flex items-center gap-2 text-[12.5px] text-[#F7F5F0]/70">
                <IconLock /> Trip is within 12 hours — contact us for changes
              </p>
            )}
          </div>

          {/* Actions */}
          {(isActive || isCompleted) && (
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {isActive && tier === "FULL" && (
                <>
                  <button className={waiverPending && b.waiver_token ? heroOutline : heroSolid} onClick={() => onReschedule(b)}>Reschedule</button>
                  <button className={heroOutline} onClick={() => onEditGuests(b)}>Edit guests</button>
                  <button className={heroOutline} onClick={() => onContactDetails(b)}>Details</button>
                  <button className={heroOutline} onClick={() => onSpecialRequest(b)}>Request</button>
                  <button className={heroQuiet + " col-span-2 sm:col-auto"} onClick={() => onCancel(b)}>Cancel</button>
                </>
              )}
              {isActive && tier === "LIMITED" && (
                <>
                  <button className={heroOutline} onClick={() => onEditGuests(b)}>Edit guests</button>
                  <button className={heroOutline} onClick={() => onContactDetails(b)}>Details</button>
                  <button className={heroOutline} onClick={() => onSpecialRequest(b)}>Request</button>
                  <button className={heroOutline} disabled={actionLoading === b.id} onClick={() => onAdminReview(b, "change")}>Request change</button>
                  {/* Cancel stays available in the 12–24h window — the refund policy
                      still quotes a (reduced) refund here, and the hint below advertises
                      it, so the button must be present to act on it. Was FULL-only,
                      which hid Cancel on exactly the soonest (hero) trip. */}
                  <button className={heroQuiet + " col-span-2 sm:col-auto"} onClick={() => onCancel(b)}>Cancel</button>
                </>
              )}
              {isActive && tier === "LOCKED" && (
                <>
                  <button className={heroSolid} onClick={() => onSpecialRequest(b)}>Special request</button>
                  <button className={heroOutline} onClick={() => onContactUs(b)}>Contact us</button>
                </>
              )}
              {isCompleted && (
                <button className={heroSolid + " col-span-2 sm:col-auto"} onClick={() => router.push("/book?tour=" + b.tour_id)}>Book again</button>
              )}
            </div>
          )}

          {isActive && !isPast && refundCalc && Number(b.total_amount) > 0 && (
            <p className="mt-4 text-[12px] text-[#F7F5F0]/50">
              Cancel now and get R{refundCalc.amount.toFixed(2)} back ({refundCalc.percent}%).
            </p>
          )}
        </div>
      </article>
    );
  }

  /* ════════ CARD — standard upcoming / action-needed ════════ */
  return (
    <article
      className={"rounded-2xl border bg-[color:var(--surface)] p-5 transition-shadow " + (isCancelled ? "" : "hover:shadow-[var(--shadow-md)]")}
      style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold leading-snug text-[color:var(--text)]">{b.tours?.name || "Booking"}</h3>
          {b.slots?.start_time && (
            <p className="mt-0.5 text-[13.5px] text-[color:var(--textMuted)]">
              {fmtDate(b.slots.start_time)} · {fmtTime(b.slots.start_time)}
            </p>
          )}
        </div>
        {paymentPending === b.id ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: "var(--warning)", background: "color-mix(in srgb, var(--warning) 10%, transparent)" }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Payment pending
          </span>
        ) : (
          <StatusPill status={b.status} />
        )}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[color:var(--textMuted)]">
        <span className="inline-flex items-center gap-1"><IconUsers className="h-3 w-3" /> {b.qty}</span>
        {Number(b.total_amount) > 0 && <><span aria-hidden>·</span><span>R{b.total_amount}</span></>}
        <span aria-hidden>·</span>
        <span className="tabular-nums">Ref {ref}</span>
        {countdown && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--accent)" }}>
              <IconClock className="h-3 w-3" /> {countdown}
            </span>
          </>
        )}
      </p>

      {(waiverPending && b.waiver_token) || meetingPoint || whatToBring || b.custom_fields?.special_requests || hasCredit
        || b.refund_status === "REQUESTED" || (isCancelled && b.converted_to_voucher_id) || (isActive && !isPast && tier !== "FULL") ? (
        <div className="mt-3.5 space-y-2.5 border-t pt-3.5" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)" }}>
          {waiverPending && b.waiver_token && (
            <Link
              href={"/waiver?booking=" + b.id + "&token=" + b.waiver_token}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 sm:inline-flex sm:w-auto sm:py-1.5 sm:text-[12.5px]"
              style={{ background: isUrgentWaiver ? "var(--danger)" : "var(--warning)" }}
            >
              <IconPen /> {isUrgentWaiver ? "Sign waiver now — required" : "Sign your waiver"}
            </Link>
          )}

          {meetingPoint && !isCancelled && (
            <p className="flex items-start gap-1.5 text-[12.5px] text-[color:var(--textMuted)]">
              <IconPin className="mt-0.5 h-3 w-3" />
              <span>
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[color:var(--accent)] hover:underline">{meetingPoint}</a>
                ) : meetingPoint}
              </span>
            </p>
          )}

          {whatToBring && !isCancelled && (
            <div>
              <button
                onClick={() => setExpandedWhatToBring(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                className="flex items-center gap-1.5 py-1 text-[12.5px] font-semibold text-[color:var(--textMuted)] transition-colors hover:text-[color:var(--text)]"
              >
                <IconChevron open={bringOpen} className="h-3 w-3" /> What to bring
              </button>
              {bringOpen && (
                <div className="mt-2 whitespace-pre-line rounded-xl p-3 text-[13px] leading-relaxed text-[color:var(--textMuted)]" style={{ background: "var(--surface2)" }}>
                  {whatToBring}
                </div>
              )}
            </div>
          )}

          {b.custom_fields?.special_requests && (
            <p className="text-[12.5px] italic text-[color:var(--textMuted)]">
              “{b.custom_fields.special_requests.substring(0, 80)}{b.custom_fields.special_requests.length > 80 ? "…" : ""}”
            </p>
          )}

          {creditPanel}

          {b.refund_status === "REQUESTED" && (
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--warning)" }}>
              <IconClock /> Refund of R{b.refund_amount || b.total_amount} pending
            </p>
          )}
          {isCancelled && b.converted_to_voucher_id && (
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
              <IconTicket /> Converted to voucher — check your email
            </p>
          )}
          {isActive && !isPast && tier === "LIMITED" && (
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--warning)" }}>
              <IconAlert /> Trip within 24h — changes limited
            </p>
          )}
          {isActive && !isPast && tier === "LOCKED" && (
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>
              <IconLock /> Trip within 12h — contact us for changes
            </p>
          )}
        </div>
      ) : null}

      {isCompleted && photos && photos.length > 0 && (
        <a href={photos[0]} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--accent)] hover:underline">
          <IconCamera /> View trip photos
        </a>
      )}

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2 empty:mt-0 empty:hidden sm:flex sm:flex-wrap">
        {isActive && tier === "FULL" && (
          <>
            <ActionBtn label="Reschedule" onClick={() => onReschedule(b)} />
            <ActionBtn label="Edit guests" onClick={() => onEditGuests(b)} />
            <ActionBtn label="Details" onClick={() => onContactDetails(b)} />
            <ActionBtn label="Request" onClick={() => onSpecialRequest(b)} />
            <ActionBtn label="Cancel" onClick={() => onCancel(b)} variant="danger" className="col-span-2 sm:col-auto" />
          </>
        )}
        {isActive && tier === "LIMITED" && (
          <>
            <ActionBtn label="Edit guests" onClick={() => onEditGuests(b)} />
            <ActionBtn label="Details" onClick={() => onContactDetails(b)} />
            <ActionBtn label="Request" onClick={() => onSpecialRequest(b)} />
            <ActionBtn label="Request change" onClick={() => onAdminReview(b, "change")} disabled={actionLoading === b.id} variant="muted" />
            {/* See hero branch: Cancel must be present wherever the refund hint is. */}
            <ActionBtn label="Cancel" onClick={() => onCancel(b)} variant="danger" className="col-span-2 sm:col-auto" />
          </>
        )}
        {isActive && tier === "LOCKED" && (
          <>
            <ActionBtn label="Special request" onClick={() => onSpecialRequest(b)} />
            <ActionBtn label="Contact us" onClick={() => onContactUs(b)} variant="muted" />
          </>
        )}
        {isCompleted && (
          <ActionBtn label="Book again" onClick={() => router.push("/book?tour=" + b.tour_id)} variant="primary" className="col-span-2 sm:col-auto" />
        )}
        {isCancelled && !b.converted_to_voucher_id && (b.refund_status === "NONE" || !b.refund_status) && (
          <ActionBtn label="Rebook trip" onClick={() => router.push("/book?tour=" + b.tour_id)} variant="primary" className="col-span-2 sm:col-auto" />
        )}
        {isExpired && (
          <ActionBtn label="Rebook trip" onClick={() => router.push("/book?tour=" + b.tour_id)} variant="primary" className="col-span-2 sm:col-auto" />
        )}
      </div>

      {isActive && !isPast && refundCalc && Number(b.total_amount) > 0 && (
        <p className="mt-3 text-[12px] text-[color:var(--textMuted)]">
          Cancel now: R{refundCalc.amount.toFixed(2)} back ({refundCalc.percent}%).
        </p>
      )}
    </article>
  );
}
