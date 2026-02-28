"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}
function gCalFmt(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + "00Z";
}

function SuccessContent() {
  const params = useSearchParams();
  const ref = params.get("ref");
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("bookings")
        .select("id, customer_name, email, phone, qty, total_amount, unit_price, status, created_at, tours(name, duration_minutes), slots(start_time)")
        .eq("id", ref).single();
      setBooking(data);
      setLoading(false);
    })();
  }, [ref]);

  if (loading) return <div className="app-loader min-h-screen"><div className="spinner" /></div>;

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
  const gCalUrl = startDate && endDate ? "https://www.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(booking.tours?.name || "Kayak Tour") + "&dates=" + gCalFmt(startDate) + "/" + gCalFmt(endDate) + "&location=" + encodeURIComponent("Three Anchor Bay, Beach Road, Sea Point, Cape Town") + "&details=" + encodeURIComponent("Ref: " + booking.id.substring(0, 8).toUpperCase() + ". Arrive 15 min early.") : null;

  return (
    <div className="app-container max-w-md page-wrap">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-4xl">🎉</span></div>
        <h2 className="headline-lg mb-2">You&apos;re Confirmed</h2>
        <p>Your kayak session is booked and ready.</p>
      </div>

      <div className="surface mb-6 overflow-hidden">
        <div className="bg-[color:var(--accent)] p-4 text-white">
          <p className="text-xs uppercase tracking-wider text-white/75">Booking Confirmation</p>
          <p className="mt-1 text-lg font-bold">{booking.tours?.name}</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider">Date &amp; Time</p>
              <p className="mt-0.5 font-semibold text-[color:var(--text)]">{startDate ? fmtDate(booking.slots.start_time) : "—"}</p>
              <p>{startDate ? fmtTime(booking.slots.start_time) : ""}</p>
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

      <div className="surface-muted mb-6 p-4">
        <p className="mb-2 text-sm font-semibold text-[color:var(--text)]">📍 Meeting Point</p>
        <p className="text-sm">Three Anchor Bay, Beach Road, Sea Point, Cape Town</p>
        <p className="mt-1 text-sm">Please arrive <strong>15 minutes early</strong> for your safety briefing.</p>
        <a href="https://www.google.com/maps/place/CAPE+KAYAK+ADVENTURES" target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-semibold underline">Open in Google Maps</a>
      </div>

      <div className="surface-muted mb-8 p-4">
        <p className="mb-2 text-sm font-semibold text-[color:var(--text)]">🎒 What to Bring</p>
        <p className="text-sm">Sunscreen, hat, sunglasses (with strap), towel, change of clothes, and water. We provide all equipment.</p>
      </div>

      <div className="space-y-3">
        {gCalUrl && (
          <div className="flex gap-2">
            <a href={gCalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex-1 py-3 text-center">📅 Google Calendar</a>
            <a href={"data:text/calendar;charset=utf-8," + encodeURIComponent("BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:" + (booking.tours?.name || "Kayak Tour") + "\nDTSTART:" + gCalFmt(startDate!) + "\nDTEND:" + gCalFmt(endDate!) + "\nLOCATION:Three Anchor Bay, Beach Rd, Sea Point\nDESCRIPTION:Ref " + booking.id.substring(0, 8).toUpperCase() + ". Arrive 15 min early.\nEND:VEVENT\nEND:VCALENDAR")} download="kayak-booking.ics" className="btn btn-secondary flex-1 py-3 text-center">📅 Apple Calendar</a>
          </div>
        )}
        <Link href="/my-bookings" className="btn btn-primary w-full py-3 text-center">View My Bookings</Link>
        <Link href="/" className="btn btn-ghost w-full text-center">Back to Tours</Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return <Suspense fallback={<div className="app-loader min-h-screen"><div className="spinner" /></div>}><SuccessContent /></Suspense>;
}
