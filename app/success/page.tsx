"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createScopedSupabase, createTenantSupabase, supabase } from "../lib/supabase";
import { useTheme } from "../components/ThemeProvider";
import ConfirmationSkeleton from "../components/skeletons/ConfirmationSkeleton";
import { CheckCircleGlyph, CalendarGlyph, GiftGlyph, ImagePlaceholderGlyph } from "../components/ui/Glyphs";
import { fmtFull, fmtTime, gCalFmt } from "../lib/format";
import { formatDuration, isMultiDay, tourEndDate } from "../lib/duration";
import type { Booking } from "../lib/types";
import { clearDraft as clearLocalDraft } from "../lib/booking-draft";

function SuccessContent() {
  const params = useSearchParams();
  const theme = useTheme();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const ref = params.get("ref");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [otherTours, setOtherTours] = useState<any[]>([]);

  // Defence-in-depth: a successful booking means the customer is done with
  // this device's draft. Clear localStorage so the next visitor on a shared
  // browser never sees this customer's name/email/phone pre-filled.
  useEffect(() => { clearLocalDraft(); }, []);

  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    (async () => {
      const scopedSupabase = createScopedSupabase({
        "x-booking-success-token": ref,
        ...(theme.id ? { "x-tenant-business-id": theme.id } : {}),
      });
      const { data } = await scopedSupabase.from("bookings")
        .select("id, business_id, customer_name, email, phone, qty, total_amount, unit_price, status, created_at, waiver_status, waiver_token, tours(id, name, duration_minutes), slots(start_time)")
        .eq("id", ref).single();
      const tourObj = Array.isArray(data?.tours) ? data.tours[0] : data?.tours;
      const slotObj = Array.isArray(data?.slots) ? data.slots[0] : data?.slots;
      const normalizedData = data ? { ...data, tours: tourObj, slots: slotObj } : null;
      setBooking(normalizedData as unknown as Booking);

      // Load other tours for upsell
      if (tourObj?.id && theme.id) {
        const { data: tours } = await tenantSupabase.from("tours")
          .select("id, name, base_price_per_person, duration_minutes, image_url")
          .eq("business_id", theme.id)
          .eq("active", true)
          .neq("id", tourObj.id)
          .limit(3);
        setOtherTours((tours || []).filter((t: any) => !t.hidden));
      }

      setLoading(false);
      // Trigger confirmation email/WhatsApp as a fallback if the Yoco webhook missed it
      if (data?.status === "PAID" || data?.status === "COMPLETED") {
        supabase.functions.invoke("confirm-booking", { body: { booking_id: data.id } }).catch(() => {});
      }
    })();
  }, [tenantSupabase, ref, theme.id]);

  if (loading) return <ConfirmationSkeleton />;

  if (!booking) return (
    <div className="app-container max-w-md py-16 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--accentSoft)] text-[color:var(--accent)]"><CheckCircleGlyph size={40} /></div>
      <h2 className="headline-lg mb-3">Booking Confirmed</h2>
      <p className="mb-8">Your payment was successful. Check your email for your booking details.</p>
      <Link href="/" className="btn btn-primary px-8 py-3">Back to Tours</Link>
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
  const gCalUrl = startDate && endDate ? "https://www.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(booking.tours?.name || "Kayak Tour") + "&dates=" + gCalFmt(startDate) + "/" + gCalFmt(endDate) + "&ctz=" + encodeURIComponent(theme.timezone || "Africa/Johannesburg") + "&location=" + encodeURIComponent(meetingLocation) + "&details=" + encodeURIComponent("Ref: " + booking.id.substring(0, 8).toUpperCase() + ". Arrive 15 min early.") : null;
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

      <div className="glass mb-6 overflow-hidden">
        <div className="bg-[color:var(--accent)] p-4 text-[color:var(--ink-on-main)]">
          <p className="text-xs uppercase tracking-wider !text-[color:var(--ink-on-main)] opacity-75">Booking Confirmation</p>
          <p className="mt-1 text-lg font-bold !text-[color:var(--ink-on-main)]">{booking.tours?.name}</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider !text-[color:var(--ink-muted)]">Date &amp; Time</p>
              <p className="mt-0.5 font-semibold !text-[color:var(--ink)]">{startDate ? fmtFull(booking.slots!.start_time) : "—"}</p>
              {startDate && isMultiDay(booking.tours?.duration_minutes) && (
                <p className="mt-0.5 font-semibold !text-[color:var(--ink)]">– {fmtFull(tourEndDate(booking.slots!.start_time, booking.tours?.duration_minutes)!.toISOString())}</p>
              )}
              <p className="!text-[color:var(--ink)]">{startDate ? fmtTime(booking.slots!.start_time) : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider !text-[color:var(--ink-muted)]">Duration</p>
              <p className="mt-0.5 font-semibold !text-[color:var(--ink)]">{formatDuration(booking.tours?.duration_minutes)}</p>
            </div>
          </div>
          <div className="flex justify-between border-t border-[color:var(--glass-border)] pt-4">
            <div>
              <p className="text-xs uppercase tracking-wider !text-[color:var(--ink-muted)]">Guest</p>
              <p className="mt-0.5 font-semibold !text-[color:var(--ink)]">{booking.customer_name}</p>
              <p className="text-sm !text-[color:var(--ink)]">{booking.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider !text-[color:var(--ink-muted)]">People</p>
              <p className="mt-0.5 font-semibold !text-[color:var(--ink)]">{booking.qty}</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[color:var(--glass-border)] pt-4">
            <div>
              <p className="text-xs uppercase tracking-wider !text-[color:var(--ink-muted)]">Total Paid</p>
              <p className="mt-0.5 text-2xl font-bold !text-[color:var(--ink)]">R{booking.total_amount}</p>
            </div>
            <span className="status-pill status-success">Confirmed</span>
          </div>
          <div className="border-t border-[color:var(--glass-border)] pt-4">
            <p className="text-xs uppercase tracking-wider !text-[color:var(--ink-muted)]">Reference</p>
            <p className="mt-0.5 font-mono font-semibold !text-[color:var(--ink)]">{booking.id.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="glass mb-6 p-4 toast-enter">
        <p className="text-sm font-medium !text-[color:var(--ink)]">📧 Confirmation emailed to {booking.email}</p>
        <p className="mt-1 text-xs !text-[color:var(--ink-muted)]">Please check your inbox (and spam folder) for your receipt and details.</p>
      </div>

      {/* Waiver CTA — sign it now while still in-tab; otherwise it shows up as
          a green completed badge once signed. */}
      {booking.waiver_status === "SIGNED" ? (
        <div className="glass mb-6 p-4 flex items-center gap-3" style={{ borderLeft: "4px solid var(--success)" }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--success)] text-[color:var(--ink-on-main)] text-base">✓</span>
          <div>
            <p className="text-sm font-semibold !text-[color:var(--ink)]">Waiver completed</p>
            <p className="text-xs !text-[color:var(--ink-muted)]">Thanks — you're all set. See you on the water!</p>
          </div>
        </div>
      ) : (
        (booking as any).waiver_token && (
          <div className="glass mb-6 p-4" style={{ borderLeft: "4px solid var(--warning)" }}>
            <p className="text-sm font-semibold !text-[color:var(--ink)] mb-1">📝 Sign your waiver</p>
            <p className="text-xs !text-[color:var(--ink-muted)] mb-3">
              All participants need to complete a quick digital waiver before launch. Save time on the day — sign now.
            </p>
            <Link
              href={"/waiver?booking=" + booking.id + "&token=" + (booking as any).waiver_token}
              className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              Sign Waiver Now →
            </Link>
          </div>
        )
      )}

      {directionsText && (
        <div className="glass mb-6 p-4">
          <p className="mb-2 text-sm font-semibold !text-[color:var(--ink)]">📍 Meeting Point</p>
          <p className="text-sm whitespace-pre-line !text-[color:var(--ink)]">{directionsText}</p>
        </div>
      )}

      {theme.what_to_bring && (
        <div className="glass mb-6 p-4">
          <p className="mb-2 text-sm font-semibold !text-[color:var(--ink)]">🎒 What to Bring</p>
          <p className="text-sm !text-[color:var(--ink)]">{theme.what_to_bring}</p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {gCalUrl && icsUrl && (
          <div className="flex gap-2">
            <a href={gCalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex-1 py-3 text-center"><CalendarGlyph size={16} className="shrink-0" /> Google Calendar</a>
            <a href={icsUrl} className="btn btn-secondary flex-1 py-3 text-center"><CalendarGlyph size={16} className="shrink-0" /> Apple Calendar</a>
          </div>
        )}
        <Link href="/my-bookings" className="btn btn-primary w-full py-3 text-center">View My Bookings</Link>
      </div>

      {/* Share with friends */}
      <div className="glass mb-8 p-5 text-center">
        <p className="text-sm font-semibold !text-[color:var(--ink)] mb-3">Bring your friends along!</p>
        <div className="flex gap-2 justify-center">
          <a href={"https://wa.me/?text=" + shareText + "%20" + encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")} target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary px-4 py-2 text-xs">Share on WhatsApp</a>
          <button type="button" onClick={() => { if (navigator.share) navigator.share({ text: decodeURIComponent(shareText), url: typeof window !== "undefined" ? window.location.origin : "" }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(decodeURIComponent(shareText) + " " + (typeof window !== "undefined" ? window.location.origin : "")); }}
            className="btn btn-secondary px-4 py-2 text-xs">Copy Link</button>
        </div>
      </div>

      {/* Upsell: other tours */}
      {otherTours.length > 0 && (
        <div className="mb-8">
          <p className="text-sm font-semibold text-[color:var(--text)] mb-4 text-center">Explore more adventures</p>
          <div className="grid gap-3">
            {otherTours.map((t) => (
              <Link key={t.id} href={"/book?tour=" + t.id} className="glass flex items-center gap-4 p-3 hover:shadow-md transition-shadow">
                <div className="w-16 h-16 relative rounded-lg overflow-hidden shrink-0">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[color:var(--accentSoft)] flex items-center justify-center text-[color:var(--accent)]"><ImagePlaceholderGlyph size={28} /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm !text-[color:var(--ink)] truncate">{t.name}</p>
                  <p className="text-xs !text-[color:var(--ink-muted)]">R{t.base_price_per_person}/pp • {formatDuration(t.duration_minutes)}</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full text-[color:var(--ink-on-cta)] shrink-0" style={{ backgroundColor: 'var(--cta)' }}>Book</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Gift voucher CTA */}
      <div className="glass mb-6 p-5 text-center" style={{ borderLeft: '4px solid var(--accent)' }}>
        <p className="text-sm font-semibold !text-[color:var(--ink)] mb-1">Know someone who&apos;d love this?</p>
        <p className="text-xs !text-[color:var(--ink-muted)] mb-3">Send them a gift voucher they can use anytime.</p>
        <Link href="/voucher" className="btn btn-primary px-6 py-2 text-sm"><GiftGlyph size={16} className="shrink-0" /> Send a Gift Voucher</Link>
      </div>

      <Link href="/" className="btn btn-ghost w-full text-center">Back to Tours</Link>
    </div>
  );
}

export default function SuccessPage() {
  return <Suspense fallback={<ConfirmationSkeleton />}><SuccessContent /></Suspense>;
}
