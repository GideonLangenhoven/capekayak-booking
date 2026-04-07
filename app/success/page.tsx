"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useTheme } from "../components/ThemeProvider";
import ConfirmationSkeleton from "../components/skeletons/ConfirmationSkeleton";
import { fmtFull, fmtTime, gCalFmt } from "../lib/format";
import type { Booking } from "../lib/types";

function SuccessContent() {
  const params = useSearchParams();
  const theme = useTheme();
  const ref = params.get("ref");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [otherTours, setOtherTours] = useState<any[]>([]);

  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("bookings")
        .select("id, customer_name, email, phone, qty, total_amount, unit_price, status, created_at, waiver_status, waiver_token, tours(id, name, duration_minutes), slots(start_time)")
        .eq("id", ref).single();
      var tourObj = Array.isArray(data?.tours) ? data.tours[0] : data?.tours;
      var slotObj = Array.isArray(data?.slots) ? data.slots[0] : data?.slots;
      var normalizedData = data ? { ...data, tours: tourObj, slots: slotObj } : null;
      setBooking(normalizedData as unknown as Booking);

      // Load other tours for upsell
      if (tourObj?.id && theme.id) {
        const { data: tours } = await supabase.from("tours")
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
  }, [ref, theme.id]);

  if (loading) return <ConfirmationSkeleton />;

  if (!booking) return (
    <div className="app-container max-w-md py-16 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-4xl">✅</span></div>
      <h2 className="headline-lg mb-3">Booking Confirmed</h2>
      <p className="mb-8">Your payment was successful. Check your email for your booking details.</p>
      <Link href="/" className="btn btn-primary px-8 py-3">Back to Tours</Link>
    </div>
  );

  const startDate = booking.slots?.start_time ? new Date(booking.slots.start_time) : null;
  const endDate = startDate ? new Date(startDate.getTime() + (booking.tours?.duration_minutes || 90) * 60 * 1000) : null;
  const meetingLocation = theme.directions || "See confirmation email for meeting point";
  const gCalUrl = startDate && endDate ? "https://www.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(booking.tours?.name || "Kayak Tour") + "&dates=" + gCalFmt(startDate) + "/" + gCalFmt(endDate) + "&location=" + encodeURIComponent(meetingLocation) + "&details=" + encodeURIComponent("Ref: " + booking.id.substring(0, 8).toUpperCase() + ". Arrive 15 min early.") : null;

  const shareText = encodeURIComponent("I just booked a " + (booking.tours?.name || "kayak tour") + " with " + (theme.business_name || "us") + "! Join me?");

  return (
    <div className="app-container max-w-md page-wrap">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-4xl">🎉</span></div>
        <h2 className="headline-lg mb-2">You&apos;re Confirmed</h2>
        <p>Your kayak session is booked and ready.</p>
      </div>

      <div className="surface mb-6 overflow-hidden">
        <div className="bg-[color:var(--accent)] p-4 text-white">
          <p className="text-xs uppercase tracking-wider !text-white/75">Booking Confirmation</p>
          <p className="mt-1 text-lg font-bold !text-white">{booking.tours?.name}</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider">Date &amp; Time</p>
              <p className="mt-0.5 font-semibold text-[color:var(--text)]">{startDate ? fmtFull(booking.slots!.start_time) : "—"}</p>
              <p>{startDate ? fmtTime(booking.slots!.start_time) : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider">Duration</p>
              <p className="mt-0.5 font-semibold text-[color:var(--text)]">{booking.tours?.duration_minutes} min</p>
            </div>
          </div>
          <div className="flex justify-between border-t border-[color:var(--border)] pt-4">
            <div>
              <p className="text-xs uppercase tracking-wider">Guest</p>
              <p className="mt-0.5 font-semibold text-[color:var(--text)]">{booking.customer_name}</p>
              <p className="text-sm">{booking.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider">People</p>
              <p className="mt-0.5 font-semibold text-[color:var(--text)]">{booking.qty}</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-4">
            <div>
              <p className="text-xs uppercase tracking-wider">Total Paid</p>
              <p className="mt-0.5 text-2xl font-bold text-[color:var(--text)]">R{booking.total_amount}</p>
            </div>
            <span className="status-pill status-success">Confirmed</span>
          </div>
          <div className="border-t border-[color:var(--border)] pt-4">
            <p className="text-xs uppercase tracking-wider">Reference</p>
            <p className="mt-0.5 font-mono font-semibold text-[color:var(--text)]">{booking.id.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="surface-muted mb-6 p-4 toast-enter">
        <p className="text-sm font-medium text-[color:var(--text)]">📧 Confirmation emailed to {booking.email}</p>
        <p className="mt-1 text-xs">Please check your inbox (and spam folder) for your receipt and details.</p>
      </div>

      {theme.directions && (
        <div className="surface-muted mb-6 p-4">
          <p className="mb-2 text-sm font-semibold text-[color:var(--text)]">📍 Meeting Point</p>
          <p className="text-sm whitespace-pre-line">{theme.directions}</p>
        </div>
      )}

      {theme.what_to_bring && (
        <div className="surface-muted mb-6 p-4">
          <p className="mb-2 text-sm font-semibold text-[color:var(--text)]">🎒 What to Bring</p>
          <p className="text-sm">{theme.what_to_bring}</p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {gCalUrl && (
          <div className="flex gap-2">
            <a href={gCalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex-1 py-3 text-center">📅 Google Calendar</a>
            <a href={"data:text/calendar;charset=utf-8," + encodeURIComponent("BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:" + (booking.tours?.name || "Kayak Tour") + "\nDTSTART:" + gCalFmt(startDate!) + "\nDTEND:" + gCalFmt(endDate!) + "\nLOCATION:" + meetingLocation + "\nDESCRIPTION:Ref " + booking.id.substring(0, 8).toUpperCase() + ". Arrive 15 min early.\nEND:VEVENT\nEND:VCALENDAR")} download="kayak-booking.ics" className="btn btn-secondary flex-1 py-3 text-center">📅 Apple Calendar</a>
          </div>
        )}
        <Link href="/my-bookings" className="btn btn-primary w-full py-3 text-center">View My Bookings</Link>
      </div>

      {/* Share with friends */}
      <div className="surface-muted mb-8 p-5 text-center">
        <p className="text-sm font-semibold text-[color:var(--text)] mb-3">Bring your friends along!</p>
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
              <Link key={t.id} href={"/book?tour=" + t.id} className="surface flex items-center gap-4 p-3 rounded-xl hover:shadow-md transition-shadow">
                <div className="w-16 h-16 relative rounded-lg overflow-hidden shrink-0">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[color:var(--accentSoft)] flex items-center justify-center text-2xl">🛶</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[color:var(--text)] truncate">{t.name}</p>
                  <p className="text-xs text-[color:var(--textMuted)]">R{t.base_price_per_person}/pp • {t.duration_minutes} min</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full text-white shrink-0" style={{ backgroundColor: 'var(--cta)' }}>Book</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Gift voucher CTA */}
      <div className="surface mb-6 p-5 text-center rounded-xl" style={{ borderLeft: '4px solid var(--accent)' }}>
        <p className="text-sm font-semibold text-[color:var(--text)] mb-1">Know someone who&apos;d love this?</p>
        <p className="text-xs text-[color:var(--textMuted)] mb-3">Send them a gift voucher they can use anytime.</p>
        <Link href="/voucher" className="btn btn-primary px-6 py-2 text-sm">🎁 Send a Gift Voucher</Link>
      </div>

      <Link href="/" className="btn btn-ghost w-full text-center">Back to Tours</Link>
    </div>
  );
}

export default function SuccessPage() {
  return <Suspense fallback={<ConfirmationSkeleton />}><SuccessContent /></Suspense>;
}
