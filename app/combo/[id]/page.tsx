"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../components/ThemeProvider";

function fmtDate(iso: string, tz: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
}
function fmtTime(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}
function fmtMonth(d: Date) { return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }); }

function dateKeyInTz(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const y = parts.find(p => p.type === "year")?.value ?? "";
  const m = parts.find(p => p.type === "month")?.value ?? "1";
  const d = parts.find(p => p.type === "day")?.value ?? "1";
  return `${y}-${Number(m) - 1}-${Number(d)}`;
}
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }

const BOOKING_CUTOFF_MINUTES = 60;
const SU = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SK = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function ComboBookingPage() {
  const { id: comboId } = useParams<{ id: string }>();
  const theme = useTheme();
  const tz = theme.timezone || "Africa/Johannesburg";

  const [combo, setCombo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"slots" | "details" | "payment">("slots");

  // Tour A calendar state
  const [slotsA, setSlotsA] = useState<any[]>([]);
  const [dateA, setDateA] = useState<Date | null>(null);
  const [slotA, setSlotA] = useState<any>(null);
  const [calMonthA, setCalMonthA] = useState(new Date().getMonth());
  const [calYearA, setCalYearA] = useState(new Date().getFullYear());

  // Tour B calendar state
  const [slotsB, setSlotsB] = useState<any[]>([]);
  const [dateB, setDateB] = useState<Date | null>(null);
  const [slotB, setSlotB] = useState<any>(null);
  const [calMonthB, setCalMonthB] = useState(new Date().getMonth());
  const [calYearB, setCalYearB] = useState(new Date().getFullYear());

  // Customer details
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Payment state
  const [submitting, setSubmitting] = useState(false);
  const [comboBookingId, setComboBookingId] = useState("");
  const [bookingRefA, setBookingRefA] = useState("");
  const [bookingRefB, setBookingRefB] = useState("");
  const [paysafeReady, setPaysafeReady] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [paymentError, setPaymentError] = useState("");
  const [soldOutMsg, setSoldOutMsg] = useState("");

  // Load combo offer
  useEffect(() => {
    if (!comboId) return;
    (async () => {
      const { data } = await supabase.from("combo_offers")
        .select("*, tour_a:tours!combo_offers_tour_a_id_fkey(id, name, image_url, duration_minutes, base_price_per_person, business_id), tour_b:tours!combo_offers_tour_b_id_fkey(id, name, image_url, duration_minutes, base_price_per_person, business_id)")
        .eq("id", comboId)
        .eq("active", true)
        .single();
      if (data) {
        setCombo(data);
        loadSlots(data.tour_a.id, setSlotsA);
        loadSlots(data.tour_b.id, setSlotsB);
      }
      setLoading(false);
    })();
  }, [comboId]);

  // Load Paysafe SDK
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.querySelector('script[src*="paysafe.checkout"]')) { setPaysafeReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://hosted.paysafe.com/checkout/v2/paysafe.checkout.min.js";
    s.async = true;
    s.onload = () => setPaysafeReady(true);
    document.head.appendChild(s);
  }, []);

  async function loadSlots(tourId: string, setter: (s: any[]) => void) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + BOOKING_CUTOFF_MINUTES * 60 * 1000);
    const later = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const { data } = await supabase.from("slots").select("*").eq("tour_id", tourId).eq("status", "OPEN")
      .gt("start_time", cutoff.toISOString()).lt("start_time", later.toISOString()).order("start_time", { ascending: true });
    setter((data || []).filter((s: any) => s.capacity_total - s.booked - (s.held || 0) > 0));
  }

  const availDatesA = useMemo(() => {
    const ds = new Set<string>();
    slotsA.forEach(s => ds.add(dateKeyInTz(s.start_time, tz)));
    return ds;
  }, [slotsA, tz]);

  const availDatesB = useMemo(() => {
    const ds = new Set<string>();
    slotsB.forEach(s => ds.add(dateKeyInTz(s.start_time, tz)));
    return ds;
  }, [slotsB, tz]);

  const daySlotsA = useMemo(() => {
    if (!dateA) return [];
    return slotsA.filter(s => isSameDay(new Date(s.start_time), dateA));
  }, [slotsA, dateA]);

  const daySlotsB = useMemo(() => {
    if (!dateB) return [];
    return slotsB.filter(s => isSameDay(new Date(s.start_time), dateB));
  }, [slotsB, dateB]);

  const comboTotal = combo ? combo.combo_price * qty : 0;
  const availA = slotA ? slotA.capacity_total - slotA.booked - (slotA.held || 0) : 10;
  const availB = slotB ? slotB.capacity_total - slotB.booked - (slotB.held || 0) : 10;
  const maxQty = Math.min(availA, availB);

  function renderCalendar(
    calYear: number, calMonth: number,
    setCalYear: (y: number) => void, setCalMonth: (m: number) => void,
    availDates: Set<string>, selectedDate: Date | null,
    setSelectedDate: (d: Date) => void, setSelectedSlot: (s: any) => void
  ) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dim = getDaysInMonth(calYear, calMonth);
    const fd = getFirstDay(calYear, calMonth);
    const cells = [];
    for (let i = 0; i < fd; i++) cells.push(<div key={"e" + i} />);
    for (let day = 1; day <= dim; day++) {
      const date = new Date(calYear, calMonth, day);
      const k = calYear + "-" + calMonth + "-" + day;
      const has = availDates.has(k);
      const past = date < today;
      const sel = selectedDate && isSameDay(date, selectedDate);
      const isToday = isSameDay(date, today);
      cells.push(
        <button key={day} disabled={past || !has} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
          className={"relative aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all " +
            (sel ? "bg-gray-900 text-white shadow-lg scale-105 " : "") +
            (!sel && has && !past ? "bg-white text-gray-900 hover:bg-gray-100 border border-gray-200 cursor-pointer " : "") +
            (past || !has ? "text-gray-300 cursor-not-allowed " : "") +
            (isToday && !sel ? "ring-2 ring-gray-900 ring-offset-2 " : "")}>
          {day}
          {has && !past && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />}
        </button>
      );
    }
    const canPrev = calYear > today.getFullYear() || calMonth > today.getMonth();
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
            disabled={!canPrev} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30">&larr;</button>
          <h3 className="text-lg font-semibold">{fmtMonth(new Date(calYear, calMonth))}</h3>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50">&rarr;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Unavailable</span>
        </div>
      </div>
    );
  }

  function renderSlots(daySlots: any[], selectedSlot: any, setSelectedSlot: (s: any) => void) {
    if (daySlots.length === 0) return <div className="text-center py-8 text-gray-400"><p>No available slots.</p></div>;
    return (
      <div className="space-y-2">
        {daySlots.map((s: any) => {
          const a = s.capacity_total - s.booked - (s.held || 0);
          const isSel = selectedSlot?.id === s.id;
          return (
            <button key={s.id} onClick={() => setSelectedSlot(s)}
              className={"w-full text-left rounded-xl p-3 transition-all border " + (isSel ? "border-gray-900 bg-gray-900 text-white shadow-lg" : "border-gray-200 bg-white hover:border-gray-400")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={"text-base font-semibold " + (isSel ? "text-white" : "")}>{fmtTime(s.start_time, tz)}</p>
                  <p className={"text-xs " + (isSel ? "text-gray-300" : "text-gray-500")}>{a} {a === 1 ? "spot" : "spots"} left</p>
                </div>
                {isSel ? <span className="bg-white text-gray-900 px-3 py-1 rounded-lg text-xs font-medium">Selected</span>
                  : <span className={"text-xs " + (a <= 3 ? "text-orange-500 font-medium" : "text-gray-400")}>{a <= 3 ? "Almost full" : "Available"}</span>}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  async function submitComboBooking() {
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (!slotA || !slotB || !combo) return;
    setSubmitting(true);
    setSoldOutMsg("");
    setPaymentError("");

    try {
      // Call create-paysafe-checkout to create both bookings + combo record
      const res = await fetch(SU + "/functions/v1/create-paysafe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK },
        body: JSON.stringify({
          combo_offer_id: combo.id,
          slot_a_id: slotA.id,
          slot_b_id: slotB.id,
          qty,
          customer_name: name,
          customer_email: email.toLowerCase(),
          customer_phone: phone ? phone.replace(/[^\d]/g, "").replace(/^0/, "27") : "",
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error?.includes("capacity") || data.error?.includes("sold out")) {
          setSoldOutMsg(data.error || "A slot just sold out. Please select different times.");
          setStep("slots");
          if (combo) {
            loadSlots(combo.tour_a.id, setSlotsA);
            loadSlots(combo.tour_b.id, setSlotsB);
          }
          setSlotA(null); setSlotB(null);
        } else {
          setPaymentError(data.error || "Something went wrong. Please try again.");
        }
        setSubmitting(false);
        return;
      }

      setComboBookingId(data.combo_booking_id);
      setBookingRefA((data.booking_a_id || "").substring(0, 8).toUpperCase());
      setBookingRefB((data.booking_b_id || "").substring(0, 8).toUpperCase());

      // Launch Paysafe checkout overlay
      if (paysafeReady && (window as any).paysafe?.checkout) {
        const totalCents = Math.round(comboTotal * 100);
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || name;
        const lastName = nameParts.slice(1).join(" ") || name;

        (window as any).paysafe.checkout.setup(data.paysafe_api_key, {
          amount: totalCents,
          currency: combo.currency || "ZAR",
          merchantRefNum: data.combo_booking_id,
          environment: "LIVE",
          companyName: theme.business_name || theme.name || "Combo Booking",
          customer: { firstName, lastName, email: email.toLowerCase() },
          displayPaymentMethods: ["card"],
        }, (instance: any, error: any, result: any) => {
          if (error) {
            console.error("PAYSAFE_CHECKOUT_ERROR:", error);
            setPaymentError("Payment was cancelled or failed. Please try again.");
            setSubmitting(false);
            return;
          }
          if (result?.paymentHandleToken) {
            setPaymentStatus("processing");
            setStep("payment");
            // Process the payment server-side
            processPayment(data.combo_booking_id, result.paymentHandleToken, instance);
          }
        }, (stage: string, expired: boolean) => {
          if (expired) {
            setPaymentError("Payment session expired. Please try again.");
            setSubmitting(false);
          }
        });
      } else {
        setPaymentError("Payment system is loading. Please wait and try again.");
        setSubmitting(false);
      }
    } catch (err: any) {
      setPaymentError(err?.message || "Something went wrong.");
      setSubmitting(false);
    }
  }

  async function processPayment(cbId: string, token: string, paysafeInstance: any) {
    try {
      const res = await fetch(SU + "/functions/v1/create-paysafe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK },
        body: JSON.stringify({ action: "process", combo_booking_id: cbId, paymentHandleToken: token }),
      });
      const data = await res.json();
      if (paysafeInstance?.close) paysafeInstance.close();

      if (res.ok && data.success) {
        setPaymentStatus("success");
      } else {
        setPaymentStatus("failed");
        setPaymentError(data.error || "Payment processing failed.");
      }
    } catch (err: any) {
      if (paysafeInstance?.close) paysafeInstance.close();
      setPaymentStatus("failed");
      setPaymentError(err?.message || "Payment processing failed.");
    }
    setSubmitting(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>;

  if (!combo) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-3xl">&#x1F6AB;</span></div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Combo Not Available</h2>
      <p className="text-gray-500 mb-8">This combo package may have been removed or is currently unavailable.</p>
      <a href="/" className="inline-block bg-gray-900 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 shadow-md">Browse Tours</a>
    </div>
  );

  const tourA = combo.tour_a;
  const tourB = combo.tour_b;
  const savings = combo.original_price - combo.combo_price;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-10">
        {[{ l: "Select Dates", s: "slots" }, { l: "Details", s: "details" }, { l: "Payment", s: "payment" }].map((x, i) => {
          const steps = ["slots", "details", "payment"];
          const ci = steps.indexOf(step);
          const active = i <= ci;
          return (
            <div key={x.l} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-1">
                <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all " + (active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400")}>
                  {active && i < ci ? "\u2713" : i + 1}
                </div>
                <span className={"text-sm hidden sm:block " + (active ? "text-gray-900 font-medium" : "text-gray-400")}>{x.l}</span>
              </div>
              {i < 2 && <div className={"h-0.5 flex-1 mx-2 rounded " + (active && i < ci ? "bg-gray-900" : "bg-gray-200")} />}
            </div>
          );
        })}
      </div>

      {/* Combo Header */}
      <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 rounded-xl">
        <div className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center text-xl">&#x1F3AF;</div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{combo.name}</h3>
          <p className="text-gray-500 text-sm">{tourA?.name} + {tourB?.name}</p>
        </div>
        <div className="text-right">
          <div className="font-bold text-lg">R{combo.combo_price}<span className="text-xs font-normal text-gray-400">/pp</span></div>
          {savings > 0 && <div className="text-xs text-emerald-600 font-semibold">Save R{savings}</div>}
        </div>
      </div>

      {/* STEP 1: Select Dates */}
      {step === "slots" && (
        <div>
          <a href="/" className="text-sm text-gray-500 mb-6 hover:text-gray-900 inline-block">&larr; Back to tours</a>

          {soldOutMsg && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <span className="text-red-500 text-xl">&#x26A0;</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">{soldOutMsg}</p>
                <p className="text-xs text-red-600 mt-0.5">Available slots have been refreshed.</p>
              </div>
              <button onClick={() => setSoldOutMsg("")} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
            </div>
          )}

          {/* Tour A */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <h2 className="text-xl font-bold">{tourA?.name}</h2>
              <span className="text-sm text-gray-400">{tourA?.duration_minutes} min</span>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                {renderCalendar(calYearA, calMonthA, setCalYearA, setCalMonthA, availDatesA, dateA, setDateA, setSlotA)}
              </div>
              <div>
                <h3 className="text-base font-semibold mb-3">{dateA ? "Times for " + fmtDate(dateA.toISOString(), tz) : "Select a date"}</h3>
                {!dateA ? (
                  <div className="text-center py-8 text-gray-400"><p className="text-3xl mb-2">&#x1F4C5;</p><p className="text-sm">Tap a date to see times.</p></div>
                ) : renderSlots(daySlotsA, slotA, setSlotA)}
              </div>
            </div>
          </div>

          {/* Tour B */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <h2 className="text-xl font-bold">{tourB?.name}</h2>
              <span className="text-sm text-gray-400">{tourB?.duration_minutes} min</span>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                {renderCalendar(calYearB, calMonthB, setCalYearB, setCalMonthB, availDatesB, dateB, setDateB, setSlotB)}
              </div>
              <div>
                <h3 className="text-base font-semibold mb-3">{dateB ? "Times for " + fmtDate(dateB.toISOString(), tz) : "Select a date"}</h3>
                {!dateB ? (
                  <div className="text-center py-8 text-gray-400"><p className="text-3xl mb-2">&#x1F4C5;</p><p className="text-sm">Tap a date to see times.</p></div>
                ) : renderSlots(daySlotsB, slotB, setSlotB)}
              </div>
            </div>
          </div>

          {slotA && slotB && (
            <button onClick={() => setStep("details")}
              className="w-full mt-4 bg-gray-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-800 shadow-md">
              Continue &rarr;
            </button>
          )}
        </div>
      )}

      {/* STEP 2: Details */}
      {step === "details" && (
        <div>
          <button onClick={() => setStep("slots")} className="text-sm text-gray-500 mb-6 hover:text-gray-900">&larr; Back to dates</button>
          <h2 className="text-3xl font-bold mb-8">Complete Your Combo Booking</h2>
          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-3 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Number of People</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-11 h-11 border-2 border-gray-200 rounded-xl flex items-center justify-center text-xl hover:bg-gray-50">&minus;</button>
                  <span className="text-2xl font-bold w-8 text-center">{qty}</span>
                  <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-11 h-11 border-2 border-gray-200 rounded-xl flex items-center justify-center text-xl hover:bg-gray-50">+</button>
                  <span className="text-sm text-gray-400">max {maxQty}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone (optional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 71 234 5678"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" />
              </div>
              <label className="flex items-start gap-3 mt-4 cursor-pointer">
                <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)}
                  className="mt-1 w-4 h-4 shrink-0 rounded border-gray-300" />
                <span className="text-xs text-gray-500 leading-relaxed">I agree to receive marketing messages and promotions. You can opt out at any time by replying STOP.</span>
              </label>

              {paymentError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{paymentError}</p>
                </div>
              )}
            </div>

            {/* Booking Summary Sidebar */}
            <div className="md:col-span-2">
              <div className="bg-gray-50 rounded-2xl p-5 sticky top-6">
                <h3 className="font-bold mb-4">Combo Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="pb-3 border-b border-gray-200">
                    <p className="font-semibold text-gray-900">{tourA?.name}</p>
                    <div className="flex justify-between text-gray-500 mt-1">
                      <span>Date</span><span className="font-medium text-gray-700">{slotA && fmtDate(slotA.start_time, tz)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 mt-0.5">
                      <span>Time</span><span className="font-medium text-gray-700">{slotA && fmtTime(slotA.start_time, tz)}</span>
                    </div>
                  </div>
                  <div className="pb-3 border-b border-gray-200">
                    <p className="font-semibold text-gray-900">{tourB?.name}</p>
                    <div className="flex justify-between text-gray-500 mt-1">
                      <span>Date</span><span className="font-medium text-gray-700">{slotB && fmtDate(slotB.start_time, tz)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 mt-0.5">
                      <span>Time</span><span className="font-medium text-gray-700">{slotB && fmtTime(slotB.start_time, tz)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-500">Guests</span><span className="font-medium">{qty}</span></div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between"><span className="text-gray-500">Combo price &times; {qty}</span><span>R{comboTotal}</span></div>
                    {savings > 0 && (
                      <div className="flex justify-between text-emerald-600 mt-1">
                        <span>You save</span><span>R{savings * qty}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-lg font-bold"><span>Total</span><span>R{comboTotal}</span></div>
                  </div>
                </div>
                <button onClick={submitComboBooking} disabled={submitting || !name.trim() || !email.trim()}
                  className="w-full mt-5 bg-gray-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 shadow-md">
                  {submitting ? "Processing..." : "Pay R" + comboTotal}
                </button>
                <p className="text-xs text-gray-400 text-center mt-3">Secure payment via Paysafe</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Payment */}
      {step === "payment" && (
        <div className="text-center py-16 max-w-md mx-auto">
          {paymentStatus === "processing" && (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
              <h2 className="text-3xl font-bold mb-3">Processing Payment</h2>
              <p className="text-gray-500">Please wait while we confirm your payment...</p>
            </>
          )}

          {paymentStatus === "success" && (
            <>
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">&#x2705;</span></div>
              <h2 className="text-3xl font-bold mb-3">Combo Booked!</h2>
              <p className="text-gray-500 mb-8">Both adventures are confirmed. Check your email for details.</p>

              <div className="bg-gray-50 rounded-2xl p-6 text-left mb-4 space-y-3">
                <h4 className="font-bold text-sm text-gray-900 mb-2">{tourA?.name}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="font-mono font-bold">{bookingRefA}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{slotA && fmtDate(slotA.start_time, tz)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{slotA && fmtTime(slotA.start_time, tz)}</span></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 text-left mb-8 space-y-3">
                <h4 className="font-bold text-sm text-gray-900 mb-2">{tourB?.name}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="font-mono font-bold">{bookingRefB}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{slotB && fmtDate(slotB.start_time, tz)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{slotB && fmtTime(slotB.start_time, tz)}</span></div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-left mb-8">
                <div className="flex justify-between text-sm">
                  <span className="text-purple-700 font-semibold">Combo Total Paid</span>
                  <span className="font-bold text-purple-900">R{comboTotal}</span>
                </div>
                {savings > 0 && (
                  <p className="text-xs text-purple-600 mt-1">You saved R{savings * qty} with this combo!</p>
                )}
              </div>

              <a href="/" className="block bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800">Browse More Tours</a>
            </>
          )}

          {paymentStatus === "failed" && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">&#x274C;</span></div>
              <h2 className="text-3xl font-bold mb-3">Payment Failed</h2>
              <p className="text-gray-500 mb-4">{paymentError || "Something went wrong with your payment."}</p>
              <button onClick={() => { setStep("details"); setPaymentStatus("idle"); setPaymentError(""); setSubmitting(false); }}
                className="inline-block bg-gray-900 text-white px-10 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 shadow-md">
                Try Again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
