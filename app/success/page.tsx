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
  var p = (n: number) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + "T" + p(d.getUTCHours()) + p(d.getUTCMinutes()) + "00Z";
}

function SuccessContent() {
  var params = useSearchParams();
  var ref = params.get("ref");
  var [booking, setBooking] = useState<any>(null);
  var [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    (async () => {
      var { data } = await supabase.from("bookings")
        .select("id, customer_name, email, phone, qty, total_amount, unit_price, status, created_at, tours(name, duration_minutes), slots(start_time)")
        .eq("id", ref).single();
      setBooking(data);
      setLoading(false);
    })();
  }, [ref]);

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" /></div>;

  if (!booking) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
      <h2 className="text-3xl font-bold mb-3">Payment Successful!</h2>
      <p className="text-gray-500 mb-8">Your booking is confirmed. Check your email for details.</p>
      <Link href="/" className="inline-block bg-gray-900 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800">Back to Home</Link>
    </div>
  );

  var startDate = booking.slots?.start_time ? new Date(booking.slots.start_time) : null;
  var endDate = startDate ? new Date(startDate.getTime() + (booking.tours?.duration_minutes || 90) * 60 * 1000) : null;
  var gCalUrl = startDate && endDate ? "https://www.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(booking.tours?.name || "Kayak Tour") + "&dates=" + gCalFmt(startDate) + "/" + gCalFmt(endDate) + "&location=" + encodeURIComponent("Three Anchor Bay, Beach Road, Sea Point, Cape Town") + "&details=" + encodeURIComponent("Ref: " + booking.id.substring(0, 8).toUpperCase() + ". Arrive 15 min early.") : null;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-4xl">🎉</span></div>
        <h2 className="text-3xl font-bold mb-2">You&apos;re Booked!</h2>
        <p className="text-gray-500">We can&apos;t wait to see you on the water</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="bg-gray-900 text-white p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Booking Confirmation</p>
          <p className="text-lg font-bold mt-1">{booking.tours?.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Date &amp; Time</p>
              <p className="font-semibold mt-0.5">{startDate ? fmtDate(booking.slots.start_time) : "—"}</p>
              <p className="text-gray-600">{startDate ? fmtTime(booking.slots.start_time) : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Duration</p>
              <p className="font-semibold mt-0.5">{booking.tours?.duration_minutes} min</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 flex justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Guest</p>
              <p className="font-semibold mt-0.5">{booking.customer_name}</p>
              <p className="text-sm text-gray-500">{booking.email}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wider">People</p>
              <p className="font-semibold mt-0.5">{booking.qty}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total Paid</p>
              <p className="text-2xl font-bold mt-0.5">R{booking.total_amount}</p>
            </div>
            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">Confirmed</span>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Reference</p>
            <p className="font-mono font-semibold mt-0.5">{booking.id.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-800 font-medium">📧 Confirmation emailed to {booking.email}</p>
        <p className="text-xs text-blue-600 mt-1">Check your inbox (and spam folder) for the full details.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold text-amber-800 mb-2">📍 Meeting Point</p>
        <p className="text-sm text-amber-700">Three Anchor Bay, Beach Road, Sea Point, Cape Town</p>
        <p className="text-sm text-amber-700 mt-1">Please arrive <strong>15 minutes early</strong> for your safety briefing.</p>
        <a href="https://www.google.com/maps/place/CAPE+KAYAK+ADVENTURES" target="_blank" rel="noopener noreferrer"
          className="inline-block mt-2 text-xs text-amber-800 font-semibold underline hover:text-amber-900">Open in Google Maps →</a>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
        <p className="text-sm font-semibold text-gray-800 mb-2">🎒 What to Bring</p>
        <p className="text-sm text-gray-600">Sunscreen, hat, sunglasses (with strap), towel, change of clothes, water bottle. We provide all equipment.</p>
      </div>

      <div className="space-y-3">
        {gCalUrl && (
          <div className="flex gap-2">
            <a href={gCalUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-white border-2 border-gray-200 text-gray-800 py-3 rounded-xl text-sm font-semibold text-center hover:bg-gray-50">📅 Google Calendar</a>
            <a href={"data:text/calendar;charset=utf-8," + encodeURIComponent("BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:" + (booking.tours?.name || "Kayak Tour") + "\nDTSTART:" + gCalFmt(startDate!) + "\nDTEND:" + gCalFmt(endDate!) + "\nLOCATION:Three Anchor Bay, Beach Rd, Sea Point\nDESCRIPTION:Ref " + booking.id.substring(0, 8).toUpperCase() + ". Arrive 15 min early.\nEND:VEVENT\nEND:VCALENDAR")} download="kayak-booking.ics" className="flex-1 bg-white border-2 border-gray-200 text-gray-800 py-3 rounded-xl text-sm font-semibold text-center hover:bg-gray-50">📅 Apple Calendar</a>
          </div>
        )}
        <Link href="/my-bookings" className="block bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold text-center hover:bg-gray-800">View My Bookings</Link>
        <Link href="/" className="block text-center text-gray-500 text-sm hover:text-gray-900">Back to Home</Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" /></div>}><SuccessContent /></Suspense>;
}
