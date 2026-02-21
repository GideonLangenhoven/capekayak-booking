"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }); }
function fmtFull(iso: string) { return new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }); }
function dateKey(iso: string) { return new Date(iso).toISOString().split("T")[0]; }

var STATUS_STYLE: Record<string, string> = { PAID: "bg-emerald-100 text-emerald-700", CONFIRMED: "bg-emerald-100 text-emerald-700", HELD: "bg-yellow-100 text-yellow-700", PENDING: "bg-yellow-100 text-yellow-700", CANCELLED: "bg-red-100 text-red-700", COMPLETED: "bg-blue-100 text-blue-700" };
var STATUS_LABEL: Record<string, string> = { PAID: "Confirmed", CONFIRMED: "Confirmed", HELD: "Awaiting Payment", PENDING: "Pending", CANCELLED: "Cancelled", COMPLETED: "Completed" };

function MiniCalendar({ slots, onSelect }: { slots: any[]; onSelect: (id: string) => void }) {
  var now = new Date();
  var [vMonth, setVMonth] = useState(now.getMonth());
  var [vYear, setVYear] = useState(now.getFullYear());
  var [selectedDate, setSelectedDate] = useState<string | null>(null);

  var slotsByDate: Record<string, any[]> = {};
  for (var s of slots) { var dk = dateKey(s.start_time); if (!slotsByDate[dk]) slotsByDate[dk] = []; slotsByDate[dk].push(s); }

  var firstDay = new Date(vYear, vMonth, 1).getDay();
  var daysInMonth = new Date(vYear, vMonth + 1, 0).getDate();
  var monthName = new Date(vYear, vMonth).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  var dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  var canPrev = vYear > now.getFullYear() || (vYear === now.getFullYear() && vMonth > now.getMonth());
  var maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  var canNext = new Date(vYear, vMonth + 1, 1) < maxDate;

  var cells: any[] = [];
  for (var i = 0; i < firstDay; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = vYear + "-" + String(vMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    var isPast = new Date(ds) < new Date(now.toISOString().split("T")[0]);
    cells.push({ day: d, date: ds, isPast: isPast, hasSlots: !!slotsByDate[ds] });
  }

  var daySlots = selectedDate ? (slotsByDate[selectedDate] || []) : [];

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { if (vMonth === 0) { setVMonth(11); setVYear(vYear - 1); } else setVMonth(vMonth - 1); }} disabled={!canPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-20 text-gray-600">◀</button>
          <span className="text-sm font-semibold text-gray-800">{monthName}</span>
          <button onClick={() => { if (vMonth === 11) { setVMonth(0); setVYear(vYear + 1); } else setVMonth(vMonth + 1); }} disabled={!canNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-20 text-gray-600">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(dn => <div key={dn} className="text-center text-xs font-medium text-gray-400 py-1">{dn}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={"e" + i} />;
            if (c.isPast || !c.hasSlots) return <div key={c.date} className="text-center py-2 text-sm text-gray-300 rounded-lg">{c.day}</div>;
            var isSelected = selectedDate === c.date;
            return (
              <button key={c.date} onClick={() => setSelectedDate(c.date)}
                className={"text-center py-2 text-sm font-semibold rounded-lg transition-colors relative " + (isSelected ? "bg-gray-900 text-white" : "text-gray-900 hover:bg-emerald-100")}>
                {c.day}
                {!isSelected && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 text-center mt-3">Green dots = available dates</p>
      </div>

      {selectedDate && daySlots.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">{fmtFull(daySlots[0].start_time)}</p>
          {daySlots.map((sl: any) => {
            var avail = sl.capacity_total - sl.booked - (sl.held || 0);
            return (
              <button key={sl.id} onClick={() => onSelect(sl.id)}
                className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-gray-900 transition-colors bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{fmtTime(sl.start_time)}</p>
                    <p className="text-sm text-gray-500">{avail} spots available</p>
                  </div>
                  <span className="text-sm text-gray-400">Select →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyBookings() {
  var [email, setEmail] = useState("");
  var [loggedIn, setLoggedIn] = useState(false);
  var [bookings, setBookings] = useState<any[]>([]);
  var [loading, setLoading] = useState(false);
  var [cancellingId, setCancellingId] = useState<string | null>(null);
  var [rescheduling, setRescheduling] = useState<any>(null);
  var [rescheduleSlots, setRescheduleSlots] = useState<any[]>([]);
  var [loadingSlots, setLoadingSlots] = useState(false);
  var [emailError, setEmailError] = useState("");

  async function lookupBookings() {
    if (!email.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Please enter a valid email"); return; }
    setEmailError("");
    setLoading(true);
    var { data } = await supabase.from("bookings")
      .select("id, customer_name, email, phone, qty, total_amount, status, refund_status, created_at, unit_price, tour_id, slot_id, slots(start_time), tours(name)")
      .eq("email", email.toLowerCase()).order("created_at", { ascending: false });
    setBookings(data || []);
    setLoggedIn(true);
    setLoading(false);
  }

  async function cancelBooking(id: string, total: number) {
    if (!confirm("Cancel this booking? You'll receive a full refund.")) return;
    setCancellingId(id);
    var b = bookings.find(x => x.id === id);
    await supabase.from("bookings").update({ status: "CANCELLED", cancelled_at: new Date().toISOString(), cancellation_reason: "Cancelled via web", refund_status: "REQUESTED", refund_amount: total }).eq("id", id);
    if (b?.slot_id) {
      var { data: sl } = await supabase.from("slots").select("booked").eq("id", b.slot_id).single();
      if (sl) await supabase.from("slots").update({ booked: Math.max(0, sl.booked - b.qty) }).eq("id", b.slot_id);
    }
    setCancellingId(null);
    lookupBookings();
  }

  async function startReschedule(b: any) {
    setRescheduling(b);
    setLoadingSlots(true);
    var now = new Date();
    var later = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    var { data } = await supabase.from("slots").select("*").eq("tour_id", b.tour_id).eq("status", "OPEN")
      .gt("start_time", now.toISOString()).lt("start_time", later.toISOString()).order("start_time", { ascending: true });
    setRescheduleSlots((data || []).filter((s: any) => s.capacity_total - s.booked - (s.held || 0) >= b.qty && s.id !== b.slot_id));
    setLoadingSlots(false);
  }

  async function confirmReschedule(newSlotId: string) {
    if (!rescheduling) return;
    var b = rescheduling;
    var { data: oldSl } = await supabase.from("slots").select("booked").eq("id", b.slot_id).single();
    if (oldSl) await supabase.from("slots").update({ booked: Math.max(0, oldSl.booked - b.qty) }).eq("id", b.slot_id);
    var { data: newSl } = await supabase.from("slots").select("booked").eq("id", newSlotId).single();
    if (newSl) await supabase.from("slots").update({ booked: newSl.booked + b.qty }).eq("id", newSlotId);
    await supabase.from("bookings").update({ slot_id: newSlotId }).eq("id", b.id);
    setRescheduling(null);
    setRescheduleSlots([]);
    lookupBookings();
  }

  if (rescheduling) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <button onClick={() => { setRescheduling(null); setRescheduleSlots([]); }} className="text-sm text-gray-500 mb-6 hover:text-gray-900">← Back to bookings</button>
        <h2 className="text-2xl font-bold mb-2">Reschedule</h2>
        <p className="text-gray-500 mb-6">Pick a new date for your {rescheduling.tours?.name} ({rescheduling.qty} {rescheduling.qty === 1 ? "person" : "people"})</p>
        {loadingSlots ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div> :
          rescheduleSlots.length === 0 ? <p className="text-gray-500 text-center py-12">No available slots with enough space. Please contact us.</p> :
            <MiniCalendar slots={rescheduleSlots} onSelect={confirmReschedule} />
        }
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">📋</span></div>
          <h2 className="text-2xl font-bold">My Bookings</h2>
          <p className="text-gray-500 mt-2">Enter the email you used when booking.</p>
        </div>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
          onKeyDown={(e) => e.key === "Enter" && lookupBookings()} placeholder="your@email.com"
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 mb-2" />
        {emailError && <p className="text-red-500 text-xs mb-2">{emailError}</p>}
        <button onClick={lookupBookings} disabled={loading}
          className="w-full bg-gray-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
          {loading ? "Looking up..." : "View My Bookings"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">My Bookings</h2>
        <button onClick={() => { setLoggedIn(false); setBookings([]); setEmail(""); }} className="text-sm text-gray-500 hover:text-gray-900">Change Email</button>
      </div>
      <p className="text-gray-500 text-sm mb-6">{email}</p>
      {bookings.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg mb-4">No bookings found</p>
          <Link href="/" className="inline-block bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800">Browse Tours</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b: any) => {
            var isPast = b.slots?.start_time && new Date(b.slots.start_time) < new Date();
            var canModify = ["PAID", "CONFIRMED"].includes(b.status) && !isPast;
            return (
              <div key={b.id} className="border border-gray-200 rounded-2xl p-5 hover:shadow-sm transition-shadow bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{b.tours?.name}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{b.slots?.start_time ? fmtDate(b.slots.start_time) + " at " + fmtTime(b.slots.start_time) : "No date"}</p>
                  </div>
                  <span className={"px-3 py-1 rounded-full text-xs font-semibold " + (STATUS_STYLE[b.status] || "bg-gray-100 text-gray-600")}>{STATUS_LABEL[b.status] || b.status}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{b.qty} {b.qty === 1 ? "person" : "people"}</span>
                  <span>R{b.total_amount}</span>
                  <span className="font-mono text-xs">Ref: {b.id.substring(0, 8).toUpperCase()}</span>
                </div>
                {b.refund_status === "REQUESTED" && <p className="text-orange-600 text-xs mt-2 font-medium">Refund pending</p>}
                {canModify && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                    <button onClick={() => startReschedule(b)} className="text-sm text-gray-700 font-medium hover:text-gray-900 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Reschedule</button>
                    <button onClick={() => cancelBooking(b.id, b.total_amount)} disabled={cancellingId === b.id}
                      className="text-sm text-red-600 font-medium hover:text-red-800 px-4 py-2 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
                      {cancellingId === b.id ? "Cancelling..." : "Cancel Booking"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
