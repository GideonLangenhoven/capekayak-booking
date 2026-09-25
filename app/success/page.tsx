"use client";
import { paidPortions } from "../lib/pricing";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createTenantSupabase, supabase } from "../lib/supabase";
import { useTheme } from "../components/ThemeProvider";
import ConfirmationSkeleton from "../components/skeletons/ConfirmationSkeleton";

import { fmtFull, fmtTime, gCalFmt } from "../lib/format";
import { formatDuration, isMultiDay, tourEndDate } from "../lib/duration";
import type { Booking, Tour } from "../lib/types";
import { clearDraft as clearLocalDraft } from "../lib/booking-draft";

function SuccessContent() {
  const params = useSearchParams();
  const theme = useTheme();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const ref = params.get("ref");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(() => Boolean(ref));
  const [otherTours, setOtherTours] = useState<Tour[]>([]);
  const [notice, setNotice] = useState("Use your confirmation link or sign in to My Bookings to view your details.");
  const [retry, setRetry] = useState(0);

  // Defence-in-depth: a successful booking means the customer is done with
  // this device's draft. Clear localStorage so the next visitor on a shared
  // browser never sees this customer's name/email/phone pre-filled.
  useEffect(() => { clearLocalDraft(); }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get("token");
    const amendmentId = fragment.get("amendment");
    async function loadConfirmation(attempt = 0) {
      if (!ref || !theme.id || !token) {
        setBooking(null);
        setLoading(false);
        setNotice("Use your confirmation link or sign in to My Bookings to view your details.");
        return;
      }
      try {
        if (attempt === 0) { setLoading(true); setBooking(null); setOtherTours([]); }
        const { data, error } = await tenantSupabase.functions.invoke("booking-success", { body: { booking_id: ref, token, amendment_id: amendmentId } });
        if (!active) return;
        const result = data?.booking;
        if (error || result?.id !== ref || result?.business_id !== theme.id) throw new Error("Booking unavailable");
        if (data.payment_confirmed === false || data.amendment_confirmed === false || !["PAID", "CONFIRMED", "COMPLETED"].includes(result.status)) {
          setLoading(false);
          setNotice("Your booking is not yet confirmed. Check My Bookings for the latest payment status; please do not pay again.");
          if (attempt < 30 && result.status !== "CANCELLED") {
            timer = setTimeout(() => { void loadConfirmation(attempt + 1); }, 2000);
          }
          return;
        }
        setBooking(result as Booking);
        setLoading(false);
        // Existing delivery fallback; the server sends only to stored recipients.
        tenantSupabase.functions.invoke("confirm-booking", { body: { booking_id: result.id, booking_token: result.waiver_token } }).catch(() => {});
        if (result.tours?.id) {
          const { data: tours } = await tenantSupabase.from("tours")
            .select("id, name, base_price_per_person, duration_minutes, image_url")
            .eq("business_id", theme.id).eq("active", true).neq("id", result.tours.id).limit(3);
          if (active) setOtherTours(((tours || []) as unknown as Tour[]).filter((t) => !t.hidden));
        }
      } catch {
        if (active) {
          setLoading(false);
          setNotice("We couldn't load your booking details. Retry, or sign in to My Bookings if this link has expired.");
        }
      }
    }
    void loadConfirmation();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [tenantSupabase, ref, theme.id, retry]);

  if (loading) return <ConfirmationSkeleton />;

  if (!booking || booking.id !== ref || booking.business_id !== theme.id) return (
    <div className="app-container max-w-md py-16 text-center">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 text-slate-900">
        <h2 className="headline-lg mb-3">View your booking</h2>
        <p className="mb-8 text-slate-600" role="status">{notice}</p>
        <div className="mb-4 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => setRetry(n => n + 1)} className="btn btn-secondary px-6 py-3">Retry</button>
          <Link href="/my-bookings" className="btn btn-primary px-6 py-3">My Bookings</Link>
        </div>
        <Link href="/" className="btn btn-ghost px-8 py-3">Back to Tours</Link>
      </div>
    </div>
  );

  const startDate = booking.slots?.start_time ? new Date(booking.slots.start_time) : null;
  // Multi-day tours: calendar event ends on the last day, not days×24h after departure.
  const endDate = startDate
    ? (isMultiDay(booking.tours?.duration_minutes)
        ? tourEndDate(booking.slots!.start_time, booking.tours?.duration_minutes)
        : new Date(startDate.getTime() + (booking.tours?.duration_minutes || 90) * 60 * 1000))
    : null;
  // Operators paste HTML (<br>, &nbsp;) into directions — render it as plain text.
  const directionsText = (theme.directions || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim();
  const meetingLocation = directionsText || "See confirmation email for meeting point";
  // ctz pins Google's add-event UI to the tour's timezone — without it,
  // viewers whose Google account timezone differs see a shifted time.
  const gCalUrl = startDate && endDate ? "https://www.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(booking.tours?.name || "Tour") + "&dates=" + gCalFmt(startDate) + "/" + gCalFmt(endDate) + "&ctz=" + encodeURIComponent(theme.timezone || "Africa/Johannesburg") + "&location=" + encodeURIComponent(meetingLocation) + "&details=" + encodeURIComponent("Ref: " + booking.id.substring(0, 8).toUpperCase() + ". Arrive 15 min early.") : null;
  const icsUrl = startDate && endDate ? "/api/ics?" + new URLSearchParams({
    title: booking.tours?.name || "Tour",
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    loc: meetingLocation,
    ref: booking.id.substring(0, 8).toUpperCase(),
  }).toString() : null;

  const shareText = encodeURIComponent("I just booked a " + (booking.tours?.name || "tour") + " with " + (theme.business_name || "us") + "! Join me?");

  return (
    <div className="app-container max-w-md page-wrap">
      <div className="mb-8 text-center">
        <h2 className="headline-lg mb-2">You&apos;re Confirmed</h2>
        <p>Your adventure is booked and ready.</p>
      </div>

      {/* Unified Booking Confirmation Card - Solid White for all operators */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden mb-6 text-slate-900">
        {/* Accent Header Banner */}
        <div className="bg-[color:var(--accent)] p-4 sm:p-5 text-[color:var(--ink-on-main)]">
          <p className="text-xs uppercase tracking-wider font-medium opacity-80 !text-[color:var(--ink-on-main)]">
            Booking Confirmation
          </p>
          <p className="mt-1 text-xl font-bold !text-[color:var(--ink-on-main)]">
            {booking.tours?.name}
          </p>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Waiver Callout Banner inside the card */}
          {booking.waiver_status === "SIGNED" ? (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-3 text-emerald-950">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-sm shrink-0">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold text-emerald-950">Waiver completed</p>
                <p className="text-xs text-emerald-800">Thanks, you&apos;re all set. See you on the water!</p>
              </div>
            </div>
          ) : (
            booking.waiver_token && (
              <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-200/80 text-amber-800 text-xs font-bold shrink-0">
                    !
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-950">Sign your waiver</p>
                    <p className="mt-0.5 text-xs text-amber-900/90 leading-relaxed">
                      All participants need to complete a quick digital waiver before launch. Save time on the day. Sign now.
                    </p>
                    <div className="mt-3">
                      <Link
                        href={"/waiver?booking=" + booking.id + "&token=" + booking.waiver_token}
                        className="btn btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium shadow-sm"
                      >
                        Sign Waiver Now →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Date & Time and Duration */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Date &amp; Time</p>
              <p className="mt-1 font-semibold text-slate-900 text-base">{startDate ? fmtFull(booking.slots!.start_time) : "—"}</p>
              {startDate && isMultiDay(booking.tours?.duration_minutes) && (
                <p className="mt-0.5 font-semibold text-slate-900 text-base">– {fmtFull(tourEndDate(booking.slots!.start_time, booking.tours?.duration_minutes)!.toISOString())}</p>
              )}
              <p className="text-sm text-slate-600 mt-0.5">{startDate ? fmtTime(booking.slots!.start_time) : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Duration</p>
              <p className="mt-1 font-semibold text-slate-900 text-base">{formatDuration(booking.tours?.duration_minutes)}</p>
            </div>
          </div>

          {/* Calendar Quick Add */}
          {gCalUrl && icsUrl && (
            <div className="flex gap-2 pt-1">
              <a href={gCalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex-1 py-2 text-center text-xs font-medium">Google Calendar</a>
              <a href={icsUrl} className="btn btn-secondary flex-1 py-2 text-center text-xs font-medium">Apple Calendar</a>
            </div>
          )}

          {/* Guest and People */}
          <div className="flex justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Guest</p>
              <p className="mt-1 font-semibold text-slate-900">{booking.customer_name}</p>
              <p className="text-sm text-slate-600">{booking.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">People</p>
              <p className="mt-1 font-semibold text-slate-900">{booking.qty}</p>
            </div>
          </div>

          {/* Total Paid and Confirmed Badge */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Total Paid</p>
              <p className="mt-0.5 text-2xl font-bold text-slate-900">R{paidPortions(booking).total}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Confirmed
            </span>
          </div>

          {/* Reference */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Reference</p>
            <p className="mt-1 font-mono font-bold text-base text-slate-900 tracking-wider" data-shot="booking-ref">
              {booking.id.substring(0, 8).toUpperCase()}
            </p>
          </div>

          {/* Meeting Point inside the confirmation window */}
          {directionsText && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
                <span>📍</span> Meeting Point
              </p>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                {directionsText}
              </div>
            </div>
          )}

          {/* What to Bring inside the confirmation window */}
          {theme.what_to_bring && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
                <span>🎒</span> What to Bring
              </p>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-800 leading-relaxed">
                {theme.what_to_bring}
              </div>
            </div>
          )}

          {/* Self-Service Portal / View My Bookings section */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5">Manage Your Booking</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Manage your reservation anytime through our self-service portal without having to call or email. Easily reschedule dates, adjust guest numbers, update details, and manage credits directly from your personal dashboard.
            </p>
            <Link href="/my-bookings" className="btn btn-primary w-full py-3 text-center font-medium">
              View My Bookings
            </Link>
          </div>
        </div>
      </div>

      {/* Confirmation emailed notice - Solid White Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm mb-6 p-4 text-slate-800">
        <p className="text-sm font-semibold text-slate-900">Confirmation emailed to {booking.email}</p>
        <p className="mt-1 text-xs text-slate-500">Please check your inbox (and spam folder) for your receipt and details.</p>
      </div>

      {/* Share with friends - Solid White Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm mb-6 p-5 text-center text-slate-900">
        <p className="text-sm font-semibold text-slate-900 mb-3">Bring your friends along!</p>
        <div className="flex gap-2 justify-center">
          <a href={"https://wa.me/?text=" + shareText + "%20" + encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")} target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary px-4 py-2 text-xs font-medium">Share on WhatsApp</a>
          <button type="button" onClick={() => { if (navigator.share) navigator.share({ text: decodeURIComponent(shareText), url: typeof window !== "undefined" ? window.location.origin : "" }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(decodeURIComponent(shareText) + " " + (typeof window !== "undefined" ? window.location.origin : "")); }}
            className="btn btn-secondary px-4 py-2 text-xs font-medium">Copy Link</button>
        </div>
      </div>

      {/* Upsell: other tours - Solid White Cards */}
      {otherTours.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-[color:var(--text)] mb-3 text-center">Explore more adventures</p>
          <div className="grid gap-3">
            {otherTours.map((t) => (
              <Link key={t.id} href={"/book?tour=" + t.id} className="bg-white rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4 p-3 hover:shadow-md transition text-slate-900">
                <div className="w-16 h-16 relative rounded-lg overflow-hidden shrink-0 bg-slate-100">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[color:var(--accentSoft)] flex items-center justify-center text-[color:var(--accent)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{t.name}</p>
                  <p className="text-xs text-slate-500">R{t.base_price_per_person}/pp • {formatDuration(t.duration_minutes)}</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full text-[color:var(--ink-on-cta)] shrink-0" style={{ backgroundColor: 'var(--cta)' }}>Book</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Gift voucher CTA - Solid White Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm mb-6 p-5 text-center text-slate-900" style={{ borderLeft: '4px solid var(--accent)' }}>
        <p className="text-sm font-semibold text-slate-900 mb-1">Know someone who&apos;d love this?</p>
        <p className="text-xs text-slate-500 mb-3">Send them a gift voucher they can use anytime.</p>
        <Link href="/voucher" className="btn btn-primary px-6 py-2 text-sm font-medium">Send a Gift Voucher</Link>
      </div>

      <Link href="/" className="btn btn-ghost w-full text-center">Back to Tours</Link>
    </div>
  );
}

export default function SuccessPage() {
  return <Suspense fallback={<ConfirmationSkeleton />}><SuccessContent /></Suspense>;
}
