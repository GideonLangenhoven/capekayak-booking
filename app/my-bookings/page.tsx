"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import Card from "../components/ui/Card";

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }); }
function fmtFull(iso: string) { return new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }); }
function dateKey(iso: string) { return new Date(iso).toISOString().split("T")[0]; }

var STATUS_STYLE: Record<string, string> = {
  PAID: "status-success",
  CONFIRMED: "status-success",
  HELD: "status-warning",
  PENDING: "status-warning",
  CANCELLED: "status-danger",
  COMPLETED: "bg-[color:var(--accentSoft)] text-[color:var(--accent)]",
};
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
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => { if (vMonth === 0) { setVMonth(11); setVYear(vYear - 1); } else setVMonth(vMonth - 1); }} disabled={!canPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[color:var(--surface2)] disabled:opacity-20 text-[color:var(--textMuted)]">◀</button>
          <span className="text-sm font-semibold text-[color:var(--text)]">{monthName}</span>
          <button onClick={() => { if (vMonth === 11) { setVMonth(0); setVYear(vYear + 1); } else setVMonth(vMonth + 1); }} disabled={!canNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[color:var(--surface2)] disabled:opacity-20 text-[color:var(--textMuted)]">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(dn => <div key={dn} className="text-center text-xs font-medium text-[color:var(--textMuted)]/70 py-1">{dn}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={"e" + i} />;
            if (c.isPast || !c.hasSlots) return <div key={c.date} className="text-center py-2 text-sm text-[color:var(--textMuted)]/35 rounded-lg">{c.day}</div>;
            var isSelected = selectedDate === c.date;
            return (
              <button key={c.date} onClick={() => setSelectedDate(c.date)}
                className={"text-center py-2 text-sm font-semibold rounded-lg transition-colors relative " + (isSelected ? "bg-[color:var(--accent)] text-white" : "text-[color:var(--text)] hover:bg-[color:var(--accentSoft)]")}>
                {c.day}
                {!isSelected && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--success)]"></span>}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[color:var(--textMuted)] text-center mt-3">Dots indicate available dates.</p>
      </Card>

      {selectedDate && daySlots.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[color:var(--text)]">{fmtFull(daySlots[0].start_time)}</p>
          {daySlots.map((sl: any) => {
            var avail = sl.capacity_total - sl.booked - (sl.held || 0);
            return (
              <button key={sl.id} onClick={() => onSelect(sl.id)}
                className="w-full text-left border border-[color:var(--border)] rounded-xl p-4 hover:border-[color:var(--accent)] transition-colors bg-[color:var(--surface)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[color:var(--text)]">{fmtTime(sl.start_time)}</p>
                    <p className="text-sm text-[color:var(--textMuted)]">{avail} spots available</p>
                  </div>
                  <span className="text-sm text-[color:var(--textMuted)]">Select</span>
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
      <div className="app-container max-w-lg page-wrap">
        <Button onClick={() => { setRescheduling(null); setRescheduleSlots([]); }} variant="ghost" className="mb-5 px-0">← Back to bookings</Button>
        <h2 className="headline-md mb-2">Choose a New Date</h2>
        <p className="mb-6">Pick a new date for your {rescheduling.tours?.name} ({rescheduling.qty} {rescheduling.qty === 1 ? "person" : "people"}).</p>
        {loadingSlots ? <div className="app-loader py-12"><div className="spinner" /></div> :
          rescheduleSlots.length === 0 ? <p className="empty-state py-12">No slots currently have enough space for this booking. Please contact us.</p> :
            <MiniCalendar slots={rescheduleSlots} onSelect={confirmReschedule} />
        }
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="app-container max-w-md py-16">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-3xl">📋</span></div>
          <h2 className="headline-md">Access Your Bookings</h2>
          <p className="mt-2">Enter the email address you used when booking.</p>
        </div>
        <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
          onKeyDown={(e) => e.key === "Enter" && lookupBookings()} placeholder="your@email.com"
          className="mb-2 py-3.5" />
        {emailError && <p className="mb-2 text-xs text-[color:var(--danger)]">{emailError}</p>}
        <Button onClick={lookupBookings} disabled={loading} fullWidth className="py-3.5">
          {loading ? "Finding Bookings..." : "Find Bookings"}
        </Button>
      </div>
    );
  }

  return (
    <div className="app-container max-w-2xl page-wrap">
      <div className="flex items-center justify-between mb-6">
        <h2 className="headline-md">Your Bookings</h2>
        <Button onClick={() => { setLoggedIn(false); setBookings([]); setEmail(""); }} variant="ghost" className="px-0 text-sm">Use Another Email</Button>
      </div>
      <p className="text-sm mb-6">{email}</p>
      {bookings.length === 0 ? (
        <div className="empty-state py-16">
          <p className="mb-4 text-lg text-[color:var(--textMuted)]">No bookings found for this email.</p>
          <Link href="/" className="btn btn-primary">Browse Tours</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b: any) => {
            var isPast = b.slots?.start_time && new Date(b.slots.start_time) < new Date();
            var canModify = ["PAID", "CONFIRMED"].includes(b.status) && !isPast;
            return (
              <Card key={b.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-[color:var(--text)]">{b.tours?.name}</h3>
                    <p className="text-sm mt-0.5">{b.slots?.start_time ? fmtDate(b.slots.start_time) + " at " + fmtTime(b.slots.start_time) : "No date"}</p>
                  </div>
                  <span className={"status-pill " + (STATUS_STYLE[b.status] || "bg-[color:var(--surface2)] text-[color:var(--textMuted)]")}>{STATUS_LABEL[b.status] || b.status}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{b.qty} {b.qty === 1 ? "person" : "people"}</span>
                  <span>R{b.total_amount}</span>
                  <span className="font-mono text-xs">Ref: {b.id.substring(0, 8).toUpperCase()}</span>
                </div>
                {b.refund_status === "REQUESTED" && <p className="text-xs mt-2 font-medium text-[color:var(--warning)]">Refund pending</p>}
                {canModify && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-[color:var(--border)]">
                    <Button onClick={() => startReschedule(b)} variant="secondary" className="px-4 py-2">Reschedule</Button>
                    <Button onClick={() => cancelBooking(b.id, b.total_amount)} disabled={cancellingId === b.id} variant="destructive" className="px-4 py-2">
                      {cancellingId === b.id ? "Cancelling..." : "Cancel Booking"}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
