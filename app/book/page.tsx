"use client";
import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}
function fmtMonth(d: Date) { return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }); }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function BookingFlow() {
  const params = useSearchParams();
  const tourId = params.get("tour");
  const [step, setStep] = useState<"tour" | "calendar" | "details" | "payment">("tour");
  const [tours, setTours] = useState<any[]>([]);
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [allSlots, setAllSlots] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [voucherTotal, setVoucherTotal] = useState(0);
  const [voucherError, setVoucherError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [bookingRef, setBookingRef] = useState("");

  const IMG: Record<string, string> = {
    "Sea Kayak": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=500&fit=crop",
    "Sunset Paddle": "https://images.unsplash.com/photo-1500259571355-332da5cb07aa?w=800&h=500&fit=crop",
    "Private Tour": "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=800&h=500&fit=crop",
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tours").select("*").order("base_price_per_person");
      setTours(data || []);
      if (tourId) { const t = (data || []).find((x: any) => x.id === tourId); if (t) { setSelectedTour(t); setStep("calendar"); loadSlots(t.id); } }
      setLoading(false);
    })();
  }, [tourId]);

  async function loadSlots(tid: string) {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const { data } = await supabase.from("slots").select("*").eq("tour_id", tid).eq("status", "OPEN")
      .gt("start_time", now.toISOString()).lt("start_time", later.toISOString()).order("start_time", { ascending: true });
    setAllSlots((data || []).filter((s: any) => s.capacity_total - s.booked - (s.held || 0) > 0));
  }

  const availDates = useMemo(() => {
    const ds = new Set<string>();
    allSlots.forEach(s => { const d = new Date(s.start_time); ds.add(d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate()); });
    return ds;
  }, [allSlots]);

  const daySlots = useMemo(() => {
    if (!selectedDate) return [];
    return allSlots.filter(s => isSameDay(new Date(s.start_time), selectedDate));
  }, [allSlots, selectedDate]);

  const baseTotal = selectedTour ? selectedTour.base_price_per_person * qty : 0;
  const finalTotal = Math.max(0, baseTotal - voucherTotal);
  const avail = selectedSlot ? selectedSlot.capacity_total - selectedSlot.booked - (selectedSlot.held || 0) : 10;

  async function applyVoucher() {
    if (!voucherCode.trim()) return;
    setVoucherError("");
    const code = voucherCode.toUpperCase().replace(/\s/g, "");
    if (code.length !== 8) { setVoucherError("Codes are 8 characters"); return; }
    if (vouchers.some(v => v.code === code)) { setVoucherError("Already applied"); return; }
    const { data } = await supabase.from("vouchers").select("*").eq("code", code).single();
    if (!data) { setVoucherError("Code not found"); return; }
    if (data.status === "REDEEMED") { setVoucherError("Already redeemed"); return; }
    if (data.status !== "ACTIVE") { setVoucherError("Not valid"); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { setVoucherError("Expired"); return; }
    const val = Number(data.value || data.purchase_amount || 0);
    setVouchers([...vouchers, { id: data.id, code, value: val }]);
    setVoucherTotal(voucherTotal + val);
    setVoucherCode("");
  }

  function removeVoucher(i: number) { const v = vouchers[i]; setVouchers(vouchers.filter((_, j) => j !== i)); setVoucherTotal(voucherTotal - v.value); }

  async function submitBooking() {
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setSubmitting(true);
    const { data: booking, error } = await supabase.from("bookings").insert({
      business_id: selectedTour.business_id, tour_id: selectedTour.id, slot_id: selectedSlot.id,
      customer_name: name, phone: phone || "", email: email.toLowerCase(),
      qty, unit_price: selectedTour.base_price_per_person, total_amount: finalTotal, original_total: baseTotal,
      status: "PENDING", source: "WEB",
    }).select().single();
    if (error || !booking) { alert("Something went wrong."); setSubmitting(false); return; }
    setBookingRef(booking.id.substring(0, 8).toUpperCase());

    if (finalTotal <= 0) {
      await supabase.from("bookings").update({ status: "PAID", yoco_payment_id: "VOUCHER_WEB" }).eq("id", booking.id);
      for (const v of vouchers) await supabase.from("vouchers").update({ status: "REDEEMED", redeemed_at: new Date().toISOString(), redeemed_booking_id: booking.id }).eq("id", v.id);
      const { data: sl } = await supabase.from("slots").select("booked").eq("id", selectedSlot.id).single();
      if (sl) await supabase.from("slots").update({ booked: sl.booked + qty }).eq("id", selectedSlot.id);
      setPaymentUrl("FREE"); setStep("payment"); setSubmitting(false); return;
    }

    await supabase.from("holds").insert({ booking_id: booking.id, slot_id: selectedSlot.id, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), status: "ACTIVE" });
    const { data: sl2 } = await supabase.from("slots").select("held").eq("id", selectedSlot.id).single();
    if (sl2) await supabase.from("slots").update({ held: (sl2.held || 0) + qty }).eq("id", selectedSlot.id);
    await supabase.from("bookings").update({ status: "HELD" }).eq("id", booking.id);

    const yocoRes = await supabase.functions.invoke("create-checkout", {
      body: { booking_id: booking.id, amount: finalTotal, customer_name: name, qty, voucher_codes: vouchers.map(v => v.code), voucher_ids: vouchers.map(v => v.id) },
    });
    console.log("YOCO_RES:", JSON.stringify(yocoRes)); console.log("YOCO_RES:", JSON.stringify(yocoRes.data), JSON.stringify(yocoRes.error));
    if (yocoRes.data?.redirectUrl) { setPaymentUrl(yocoRes.data.redirectUrl); setStep("payment"); }
    else alert("Payment link unavailable. Please try again.");
    setSubmitting(false);
  }

  function renderCalendar() {
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
            disabled={!canPrev} className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30">←</button>
          <h3 className="text-lg font-semibold">{fmtMonth(new Date(calYear, calMonth))}</h3>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50">→</button>
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-10">
        {[{ l: "Tour", s: "tour" }, { l: "Date & Time", s: "calendar" }, { l: "Details", s: "details" }, { l: "Payment", s: "payment" }].map((x, i) => {
          const steps = ["tour", "calendar", "details", "payment"];
          const ci = steps.indexOf(step);
          const active = i <= ci;
          return (
            <div key={x.l} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-1">
                <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all " + (active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400")}>
                  {active && i < ci ? "✓" : i + 1}
                </div>
                <span className={"text-sm hidden sm:block " + (active ? "text-gray-900 font-medium" : "text-gray-400")}>{x.l}</span>
              </div>
              {i < 3 && <div className={"h-0.5 flex-1 mx-2 rounded " + (active && i < ci ? "bg-gray-900" : "bg-gray-200")} />}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Tour */}
      {step === "tour" && (
        <div>
          <h2 className="text-3xl font-bold mb-2 text-center">Choose Your Adventure</h2>
          <p className="text-gray-500 mb-10 text-center">Select a tour to see available dates.</p>
          <div className="grid gap-8 justify-items-center" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {tours.map(t => (
              <div key={t.id} className="relative w-full max-w-[228px] aspect-[228/343] mx-auto group cursor-pointer"
                onClick={() => { setSelectedTour(t); setStep("calendar"); loadSlots(t.id); }}>
                <div className="absolute inset-0 top-[4px] left-[4px] right-[-4px] bottom-[-4px] sm:top-[7px] sm:left-[7px] sm:right-[-7px] sm:bottom-[-7px] overflow-hidden bg-white shadow-sm rounded-2xl transition-all duration-300 sm:group-hover:inset-0 sm:group-hover:top-[3px] sm:group-hover:left-[3px] sm:group-hover:right-[-3px] sm:group-hover:bottom-[-3px] sm:group-hover:shadow-[0_13px_21px_-5px_rgba(0,0,0,0.3)]">

                  {/* Image */}
                  <div className="absolute top-0 left-0 w-full h-[65%]">
                    <img src={t.image_url || IMG[t.name] || IMG["Sea Kayak"]} alt={t.name}
                      className="w-full h-full object-cover" />
                    <div className="absolute inset-0 opacity-30 sm:opacity-0 transition-opacity duration-300 sm:group-hover:opacity-70"
                      style={{ backgroundColor: 'var(--hoverOverlay, #48cfad)' }} />
                    <span className="card-cta-btn absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white text-white text-xs sm:text-sm text-center uppercase font-bold px-5 py-2 opacity-100 sm:opacity-0 transition-all duration-300 sm:group-hover:opacity-100 z-10 whitespace-nowrap">
                      Select Tour
                    </span>
                  </div>

                  {/* Stats (slides up on hover) */}
                  <div className="absolute top-[65%] left-0 w-full h-[65%] bg-white px-4 sm:px-5 pt-3 sm:pt-4 pb-4 sm:pb-5 transition-all duration-300 sm:group-hover:top-[35%] text-left">
                    <div className="text-[30px] text-[#393c45] font-semibold tracking-tight leading-tight line-clamp-2">
                      {t.name}
                    </div>

                    <div className="opacity-0 transition-opacity duration-300 sm:group-hover:opacity-100 mt-2">
                      <div className="font-semibold text-[18px]" style={{ color: 'var(--hoverOverlay, #48cfad)' }}>
                        R{t.base_price_per_person}<span className="text-[12px] font-normal text-[#b1b1b3] ml-0.5">/pp</span>
                      </div>
                      <p className="text-xs text-[#b1b1b3] mt-0.5 mb-2 sm:mb-3">
                        {t.duration_minutes} min
                      </p>
                      <div className="text-xs text-[#969699] line-clamp-3 leading-relaxed">
                        {t.description || "An incredible kayaking experience along Cape Town's stunning coastline."}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Calendar */}
      {step === "calendar" && (
        <div>
          <button onClick={() => { setStep("tour"); setSelectedTour(null); setSelectedDate(null); setSelectedSlot(null); }}
            className="text-sm text-gray-500 mb-6 hover:text-gray-900">← Back to tours</button>
          <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center text-xl">🛶</div>
            <div><h3 className="font-semibold text-lg">{selectedTour?.name}</h3><p className="text-gray-500 text-sm">{selectedTour?.duration_minutes} min · R{selectedTour?.base_price_per_person}/pp</p></div>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div><h2 className="text-xl font-bold mb-4">Pick a Date</h2>{renderCalendar()}</div>
            <div>
              <h2 className="text-xl font-bold mb-4">{selectedDate ? "Times for " + fmtDate(selectedDate.toISOString()) : "Select a date"}</h2>
              {!selectedDate ? (
                <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">📅</p><p>Tap a highlighted date to see available times.</p></div>
              ) : daySlots.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><p>No available slots on this date.</p></div>
              ) : (
                <div className="space-y-2">
                  {daySlots.map((s: any) => {
                    const a = s.capacity_total - s.booked - (s.held || 0);
                    const isSel = selectedSlot?.id === s.id;
                    return (
                      <button key={s.id} onClick={() => setSelectedSlot(s)}
                        className={"w-full text-left rounded-xl p-4 transition-all border " + (isSel ? "border-gray-900 bg-gray-900 text-white shadow-lg" : "border-gray-200 bg-white hover:border-gray-400")}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={"text-lg font-semibold " + (isSel ? "text-white" : "")}>{fmtTime(s.start_time)}</p>
                            <p className={"text-sm " + (isSel ? "text-gray-300" : "text-gray-500")}>{a} {a === 1 ? "spot" : "spots"} left</p>
                          </div>
                          {isSel ? <span className="bg-white text-gray-900 px-4 py-1.5 rounded-lg text-sm font-medium">Selected ✓</span>
                            : <span className={"text-sm " + (a <= 3 ? "text-orange-500 font-medium" : "text-gray-400")}>{a <= 3 ? "Almost full" : "Available"}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedSlot && <button onClick={() => setStep("details")} className="w-full mt-4 bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 shadow-md">Continue →</button>}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Details */}
      {step === "details" && (
        <div>
          <button onClick={() => setStep("calendar")} className="text-sm text-gray-500 mb-6 hover:text-gray-900">← Back to calendar</button>
          <h2 className="text-3xl font-bold mb-8">Complete Your Booking</h2>
          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-3 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Number of People</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-11 h-11 border-2 border-gray-200 rounded-xl flex items-center justify-center text-xl hover:bg-gray-50">−</button>
                  <span className="text-2xl font-bold w-8 text-center">{qty}</span>
                  <button onClick={() => setQty(Math.min(avail, qty + 1))} className="w-11 h-11 border-2 border-gray-200 rounded-xl flex items-center justify-center text-xl hover:bg-gray-50">+</button>
                  <span className="text-sm text-gray-400">max {avail}</span>
                </div>
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Phone (optional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 71 234 5678"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Got a voucher code?</label>
                <div className="flex gap-2">
                  <input type="text" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" maxLength={8}
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-gray-900" />
                  <button onClick={applyVoucher} className="bg-gray-100 text-gray-700 px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200">Apply</button>
                </div>
                {voucherError && <p className="text-red-500 text-xs mt-2">{voucherError}</p>}
                {vouchers.map((v, i) => (
                  <div key={v.code} className="flex items-center justify-between mt-2 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
                    <span className="text-sm text-emerald-700 font-semibold">{v.code} — R{v.value} credit</span>
                    <button onClick={() => removeVoucher(i)} className="text-red-400 text-xs hover:text-red-600 font-medium">Remove</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="bg-gray-50 rounded-2xl p-5 sticky top-6">
                <h3 className="font-bold mb-4">Booking Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Tour</span><span className="font-medium">{selectedTour?.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{selectedSlot && fmtDate(selectedSlot.start_time)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{selectedSlot && fmtTime(selectedSlot.start_time)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Guests</span><span className="font-medium">{qty}</span></div>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between"><span className="text-gray-500">R{selectedTour?.base_price_per_person} × {qty}</span><span>R{baseTotal}</span></div>
                    {voucherTotal > 0 && <div className="flex justify-between text-emerald-600 mt-1"><span>Voucher credit</span><span>−R{Math.min(voucherTotal, baseTotal)}</span></div>}
                  </div>
                  <div className="border-t border-gray-200 pt-3"><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{finalTotal <= 0 ? "FREE" : "R" + finalTotal}</span></div></div>
                </div>
                <button onClick={submitBooking} disabled={submitting || !name.trim() || !email.trim()}
                  className="w-full mt-5 bg-gray-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 shadow-md">
                  {submitting ? "Processing..." : finalTotal <= 0 ? "Confirm Booking" : "Pay R" + finalTotal}
                </button>
                <p className="text-xs text-gray-400 text-center mt-3">Secure payment via Yoco</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Payment */}
      {step === "payment" && (
        <div className="text-center py-16 max-w-md mx-auto">
          {paymentUrl === "FREE" ? (
            <>
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
              <h2 className="text-3xl font-bold mb-3">You&apos;re All Set!</h2>
              <p className="text-gray-500 mb-8">Booking confirmed. Confirmation email on its way.</p>
              <div className="bg-gray-50 rounded-2xl p-6 text-left mb-8 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Reference</span><span className="font-mono font-bold">{bookingRef}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tour</span><span className="font-medium">{selectedTour?.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{selectedSlot && fmtDate(selectedSlot.start_time)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{selectedSlot && fmtTime(selectedSlot.start_time)}</span></div>
              </div>
              <a href="/" className="block bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800">Browse More Tours</a>
              <a href="/my-bookings" className="block text-gray-500 text-sm mt-3 hover:text-gray-900">View My Bookings</a>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">💳</span></div>
              <h2 className="text-3xl font-bold mb-3">Complete Payment</h2>
              <p className="text-gray-500 mb-2">Spots held for 15 minutes.</p>
              <p className="text-3xl font-bold mb-8">R{finalTotal}</p>
              <a href={paymentUrl} className="inline-block bg-gray-900 text-white px-10 py-4 rounded-xl text-sm font-semibold hover:bg-gray-800 shadow-md">Pay Now →</a>
              <p className="text-xs text-gray-400 mt-6">Secure payment by Yoco · Ref: {bookingRef}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookPage() {
  return (<Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>}><BookingFlow /></Suspense>);
}
