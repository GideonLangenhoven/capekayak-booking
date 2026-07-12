"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { createTenantSupabase } from "../../lib/supabase";
import { useTheme } from "../../components/ThemeProvider";
import { fmtDate, fmtTime, fmtMonth, dateKeyInTz, isSameDay, getDaysInMonth, getFirstDay } from "../../lib/format";
import type { ComboOffer, Slot } from "../../lib/types";
import { formatDuration } from "../../lib/duration";
import { normalizePhone } from "../../lib/phone";

const BOOKING_CUTOFF_MINUTES = 60;
const SU = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SK = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type PaysafeCheckout = {
  setup: (
    apiKey: string,
    options: Record<string, unknown>,
    callback: (instance: { close?: () => void }, error: unknown, result: { paymentHandleToken?: string } | null) => void,
    closeCallback?: (stage: string, expired: boolean) => void,
  ) => void;
};

type PaysafeWindow = Window & {
  paysafe?: { checkout?: PaysafeCheckout };
};

export default function ComboBookingPage() {
  const { id: comboId } = useParams<{ id: string }>();
  const theme = useTheme();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const tz = theme.timezone || "Africa/Johannesburg";

  const [combo, setCombo] = useState<ComboOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"slots" | "details" | "payment">("slots");

  // Tour A calendar state
  const [slotsA, setSlotsA] = useState<Slot[]>([]);
  const [dateA, setDateA] = useState<Date | null>(null);
  const [slotA, setSlotA] = useState<Slot | null>(null);
  const [calMonthA, setCalMonthA] = useState(new Date().getMonth());
  const [calYearA, setCalYearA] = useState(new Date().getFullYear());

  // Tour B calendar state
  const [slotsB, setSlotsB] = useState<Slot[]>([]);
  const [dateB, setDateB] = useState<Date | null>(null);
  const [slotB, setSlotB] = useState<Slot | null>(null);
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
    if (!comboId || !theme.id) return;
    (async () => {
      const { data } = await tenantSupabase.from("combo_offers")
        .select("*, tour_a:tours!combo_offers_tour_a_id_fkey(id, name, image_url, duration_minutes, base_price_per_person, business_id), tour_b:tours!combo_offers_tour_b_id_fkey(id, name, image_url, duration_minutes, base_price_per_person, business_id)")
        .eq("id", comboId)
        .eq("active", true)
        .single();
      if (data) {
        const offer = data as unknown as ComboOffer;
        setCombo(offer);
        loadSlots(offer.tour_a.id, setSlotsA);
        loadSlots(offer.tour_b.id, setSlotsB);
      }
      setLoading(false);
    })();
  }, [tenantSupabase, comboId, theme.id]);

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

  async function loadSlots(tourId: string, setter: (s: Slot[]) => void) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + BOOKING_CUTOFF_MINUTES * 60 * 1000);
    const later = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const { data } = await tenantSupabase.from("slots").select("*").eq("tour_id", tourId).eq("status", "OPEN")
      .gt("start_time", cutoff.toISOString()).lt("start_time", later.toISOString()).order("start_time", { ascending: true });
    setter(((data || []) as unknown as Slot[]).filter((s) => s.capacity_total - s.booked - (s.held || 0) > 0));
  }

  useEffect(() => {
    if (slotsA.length > 0) {
      const first = new Date(slotsA[0].start_time);
      setCalMonthA(first.getMonth());
      setCalYearA(first.getFullYear());
    }
  }, [slotsA]);

  useEffect(() => {
    if (slotsB.length > 0) {
      const first = new Date(slotsB[0].start_time);
      setCalMonthB(first.getMonth());
      setCalYearB(first.getFullYear());
    }
  }, [slotsB]);

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
    setSelectedDate: (d: Date) => void, setSelectedSlot: (s: Slot | null) => void
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
          className={"relative aspect-square rounded-full flex items-center justify-center text-sm font-medium transition-all " +
            (sel ? "bg-[color:var(--accent)] text-[color:var(--ink-on-main)] shadow-lg scale-105 " : "") +
            (!sel && has && !past ? "bg-[color:var(--glass-tint-card)] text-[color:var(--ink)] hover:bg-[color:var(--hover-overlay)] border border-[color:var(--glass-border)] cursor-pointer " : "") +
            (past || !has ? "text-[color:var(--ink-faint)] cursor-not-allowed " : "") +
            (isToday && !sel ? "ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] ring-offset-2 " : "")}>
          {day}
          {has && !past && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[color:var(--accent)]" />}
        </button>
      );
    }
    const canPrev = calYear > today.getFullYear() || calMonth > today.getMonth();
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
            disabled={!canPrev} className="w-9 h-9 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full surface-muted flex items-center justify-center text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)] disabled:opacity-30">&larr;</button>
          <h3 className="text-lg font-semibold text-[color:var(--ink)]">{fmtMonth(new Date(calYear, calMonth))}</h3>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
            className="w-9 h-9 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full surface-muted flex items-center justify-center text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)]">&rarr;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d} className="text-center text-xs font-medium text-[color:var(--ink-muted)] py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
        <div className="flex items-center gap-4 mt-4 text-xs text-[color:var(--ink-muted)]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[color:var(--accent)] inline-block" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[color:var(--glass-border)] inline-block" /> Unavailable</span>
        </div>
      </div>
    );
  }

  function renderSlots(daySlots: Slot[], selectedSlot: Slot | null, setSelectedSlot: (s: Slot) => void) {
    if (daySlots.length === 0) return <div className="text-center py-8 text-[color:var(--ink-muted)]"><p>No available slots.</p></div>;
    return (
      <div className="space-y-2">
        {daySlots.map((s: Slot) => {
          const a = s.capacity_total - s.booked - (s.held || 0);
          const isSel = selectedSlot?.id === s.id;
          return (
            <button key={s.id} onClick={() => setSelectedSlot(s)}
              className={"w-full text-left rounded-2xl p-3 transition-all " + (isSel ? "border-2 border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--ink-on-main)] shadow-lg" : "glass !rounded-2xl hover:shadow-md")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={"text-base font-semibold " + (isSel ? "text-[color:var(--ink-on-main)]" : "text-[color:var(--ink)]")}>{fmtTime(s.start_time, tz)}</p>
                  <p className={"text-xs " + (isSel ? "text-[color:var(--ink-on-main)] opacity-80" : "text-[color:var(--ink-muted)]")}>{a} {a === 1 ? "spot" : "spots"} left</p>
                </div>
                {isSel ? <span className="bg-[color:var(--ink-on-main)] text-[color:var(--accent)] px-3 py-1 rounded-full text-xs font-medium">Selected</span>
                  : <span className={"text-xs " + (a <= 3 ? "text-[color:var(--warning)] font-medium" : "text-[color:var(--ink-muted)]")}>{a <= 3 ? "Almost full" : "Available"}</span>}
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
          customer_phone: phone ? normalizePhone("+27", phone) : "",
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
      const paysafeCheckout = (window as PaysafeWindow).paysafe?.checkout;
      if (paysafeReady && paysafeCheckout) {
        const totalCents = Math.round(comboTotal * 100);
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || name;
        const lastName = nameParts.slice(1).join(" ") || name;

        paysafeCheckout.setup(data.paysafe_api_key, {
          amount: totalCents,
          currency: combo.currency || "ZAR",
          merchantRefNum: data.combo_booking_id,
          environment: "LIVE",
          companyName: theme.business_name || "Combo Booking",
          customer: { firstName, lastName, email: email.toLowerCase() },
          displayPaymentMethods: ["card"],
        }, (instance: { close?: () => void }, error: unknown, result: { paymentHandleToken?: string } | null) => {
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
    } catch (err: unknown) {
      setPaymentError((err instanceof Error ? err.message : null) || "Something went wrong.");
      setSubmitting(false);
    }
  }

  async function processPayment(cbId: string, token: string, paysafeInstance: { close?: () => void }) {
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
    } catch (err: unknown) {
      if (paysafeInstance?.close) paysafeInstance.close();
      setPaymentStatus("failed");
      setPaymentError((err instanceof Error ? err.message : null) || "Payment processing failed.");
    }
    setSubmitting(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--accent)]" /></div>;

  if (!combo) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-[color:var(--hover-overlay)] text-[color:var(--ink-muted)] rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M5.6 5.6l12.8 12.8" /></svg>
      </div>
      <h2 className="text-2xl font-bold text-[color:var(--ink)] mb-3">Combo Not Available</h2>
      <p className="text-[color:var(--ink-muted)] mb-8">This combo package may have been removed or is currently unavailable.</p>
      <a href="/" className="btn btn-primary px-8 py-3">Browse Tours</a>
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
                <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all " + (active ? "bg-[color:var(--accent)] text-[color:var(--ink-on-main)]" : "bg-[color:var(--hover-overlay)] text-[color:var(--ink-muted)]")}>
                  {active && i < ci ? "\u2713" : i + 1}
                </div>
                <span className={"text-sm hidden sm:block " + (active ? "text-[color:var(--ink)] font-medium" : "text-[color:var(--ink-muted)]")}>{x.l}</span>
              </div>
              {i < 2 && <div className={"h-0.5 flex-1 mx-2 rounded " + (active && i < ci ? "bg-[color:var(--accent)]" : "bg-[color:var(--glass-border)]")} />}
            </div>
          );
        })}
      </div>

      {/* Combo Header */}
      <div className="glass flex items-center gap-4 mb-8 p-4">
        <div className="w-12 h-12 bg-[color:var(--accent)] text-[color:var(--ink-on-main)] rounded-full flex items-center justify-center">
          <svg viewBox="0 0 256 256" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="16" aria-hidden="true">
            <circle cx="98" cy="128" r="58" />
            <circle cx="158" cy="128" r="58" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-[color:var(--ink)]">{combo.name}</h3>
          <p className="text-[color:var(--ink-muted)] text-sm">{tourA?.name} + {tourB?.name}</p>
        </div>
        <div className="text-right">
          <div className="font-bold text-lg text-[color:var(--ink)]">R{combo.combo_price}<span className="text-xs font-normal text-[color:var(--ink-muted)]">/pp</span></div>
          {savings > 0 && <div className="text-xs text-[color:var(--success)] font-semibold">Save R{savings}</div>}
        </div>
      </div>

      {/* STEP 1: Select Dates */}
      {step === "slots" && (
        <div>
          <a href="/" className="text-sm text-[color:var(--ink-muted)] mb-6 hover:text-[color:var(--ink)] inline-block">&larr; Back to tours</a>

          {soldOutMsg && (
            <div className="mb-4 p-4 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] rounded-2xl flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0 text-[color:var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[color:var(--danger)]">{soldOutMsg}</p>
                <p className="text-xs text-[color:var(--ink-muted)] mt-0.5">Available slots have been refreshed.</p>
              </div>
              <button onClick={() => setSoldOutMsg("")} className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center text-[color:var(--ink-muted)] hover:text-[color:var(--danger)] text-lg">&times;</button>
            </div>
          )}

          {/* Tour A */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 bg-[color:var(--accent)] text-[color:var(--ink-on-main)] rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <h2 className="text-xl font-bold text-[color:var(--ink)]">{tourA?.name}</h2>
              <span className="text-sm text-[color:var(--ink-muted)]">{formatDuration(tourA?.duration_minutes)}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                {renderCalendar(calYearA, calMonthA, setCalYearA, setCalMonthA, availDatesA, dateA, setDateA, setSlotA)}
              </div>
              <div>
                <h3 className="text-base font-semibold mb-3">{dateA ? "Times for " + fmtDate(dateA.toISOString(), tz) : "Select a date"}</h3>
                {!dateA ? (
                  <div className="text-center py-8 text-[color:var(--ink-muted)]"><svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p className="text-sm">Tap a date to see times.</p></div>
                ) : renderSlots(daySlotsA, slotA, setSlotA)}
              </div>
            </div>
          </div>

          {/* Tour B */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 bg-[color:var(--accent)] text-[color:var(--ink-on-main)] rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <h2 className="text-xl font-bold text-[color:var(--ink)]">{tourB?.name}</h2>
              <span className="text-sm text-[color:var(--ink-muted)]">{formatDuration(tourB?.duration_minutes)}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                {renderCalendar(calYearB, calMonthB, setCalYearB, setCalMonthB, availDatesB, dateB, setDateB, setSlotB)}
              </div>
              <div>
                <h3 className="text-base font-semibold mb-3">{dateB ? "Times for " + fmtDate(dateB.toISOString(), tz) : "Select a date"}</h3>
                {!dateB ? (
                  <div className="text-center py-8 text-[color:var(--ink-muted)]"><svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p className="text-sm">Tap a date to see times.</p></div>
                ) : renderSlots(daySlotsB, slotB, setSlotB)}
              </div>
            </div>
          </div>

          {slotA && slotB && (
            <button onClick={() => setStep("details")}
              className="btn btn-primary w-full mt-4 !py-3.5">
              Continue &rarr;
            </button>
          )}
        </div>
      )}

      {/* STEP 2: Details */}
      {step === "details" && (
        <div>
          <button onClick={() => setStep("slots")} className="text-sm text-[color:var(--ink-muted)] mb-6 hover:text-[color:var(--ink)]">&larr; Back to dates</button>
          <h2 className="text-3xl font-bold mb-8 text-[color:var(--ink)]">Complete Your Combo Booking</h2>
          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-3 space-y-5">
              <div>
                <label className="field-label">Number of People</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-11 h-11 rounded-full surface-muted flex items-center justify-center text-xl text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)]">&minus;</button>
                  <span className="text-2xl font-bold w-8 text-center text-[color:var(--ink)]">{qty}</span>
                  <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-11 h-11 rounded-full surface-muted flex items-center justify-center text-xl text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)]">+</button>
                  <span className="text-sm text-[color:var(--ink-muted)]">max {maxQty}</span>
                </div>
              </div>
              <div>
                <label className="field-label">Full Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                  className="field" />
              </div>
              <div>
                <label className="field-label">Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com"
                  className="field" />
              </div>
              <div>
                <label className="field-label">Phone (optional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 71 234 5678"
                  className="field" />
              </div>
              <label className="flex items-start gap-3 mt-4 cursor-pointer">
                <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)}
                  className="mt-1 w-4 h-4 shrink-0 rounded border-[color:var(--glass-border)]" />
                <span className="text-xs text-[color:var(--ink-muted)] leading-relaxed">I agree to receive booking updates and occasional promotions by email and SMS. You can opt out at any time.</span>
              </label>

              {paymentError && (
                <div className="p-4 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] rounded-2xl">
                  <p className="text-sm text-[color:var(--danger)]">{paymentError}</p>
                </div>
              )}
            </div>

            {/* Booking Summary Sidebar */}
            <div className="md:col-span-2">
              <div className="glass-sheet !rounded-[20px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sticky top-6">
                <h3 className="font-bold mb-4">Combo Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="pb-3 border-b border-[color:var(--glass-border)]">
                    <p className="font-semibold text-[color:var(--ink)]">{tourA?.name}</p>
                    <div className="flex justify-between text-[color:var(--ink-muted)] mt-1">
                      <span>Date</span><span className="font-medium text-[color:var(--ink)]">{slotA && fmtDate(slotA.start_time, tz)}</span>
                    </div>
                    <div className="flex justify-between text-[color:var(--ink-muted)] mt-0.5">
                      <span>Time</span><span className="font-medium text-[color:var(--ink)]">{slotA && fmtTime(slotA.start_time, tz)}</span>
                    </div>
                  </div>
                  <div className="pb-3 border-b border-[color:var(--glass-border)]">
                    <p className="font-semibold text-[color:var(--ink)]">{tourB?.name}</p>
                    <div className="flex justify-between text-[color:var(--ink-muted)] mt-1">
                      <span>Date</span><span className="font-medium text-[color:var(--ink)]">{slotB && fmtDate(slotB.start_time, tz)}</span>
                    </div>
                    <div className="flex justify-between text-[color:var(--ink-muted)] mt-0.5">
                      <span>Time</span><span className="font-medium text-[color:var(--ink)]">{slotB && fmtTime(slotB.start_time, tz)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Guests</span><span className="font-medium">{qty}</span></div>
                  <div className="border-t border-[color:var(--glass-border)] pt-3">
                    <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Combo price &times; {qty}</span><span>R{comboTotal}</span></div>
                    {savings > 0 && (
                      <div className="flex justify-between text-[color:var(--success)] mt-1">
                        <span>You save</span><span>R{savings * qty}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-[color:var(--glass-border)] pt-3">
                    <div className="flex justify-between text-lg font-bold"><span>Total</span><span>R{comboTotal}</span></div>
                  </div>
                </div>
                <button onClick={submitComboBooking} disabled={submitting || !name.trim() || !email.trim()}
                  className="btn btn-primary w-full mt-5 !py-3.5">
                  {submitting ? "Processing..." : "Pay R" + comboTotal}
                </button>
                <p className="surface-muted !rounded-full px-4 py-2 text-xs text-[color:var(--ink-muted)] text-center mt-3">Secure payment via Paysafe, a PCI DSS compliant provider — card details never touch our servers</p>
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
              <div className="w-20 h-20 bg-[color:var(--accentSoft)] rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--accent)]" />
              </div>
              <h2 className="text-3xl font-bold mb-3 text-[color:var(--ink)]">Processing Payment</h2>
              <p className="text-[color:var(--ink-muted)]">Please wait while we confirm your payment...</p>
            </>
          )}

          {paymentStatus === "success" && (
            <>
              <div className="w-20 h-20 bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[color:var(--success)] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>
              </div>
              <h2 className="text-3xl font-bold mb-3 text-[color:var(--ink)]">Combo Booked!</h2>
              <p className="text-[color:var(--ink-muted)] mb-8">Both adventures are confirmed. Check your email for details.</p>

              <div className="glass p-6 text-left mb-4 space-y-3">
                <h4 className="font-bold text-sm text-[color:var(--ink)] mb-2">{tourA?.name}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Reference</span><span className="font-mono font-bold">{bookingRefA}</span></div>
                  <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Date</span><span className="font-medium">{slotA && fmtDate(slotA.start_time, tz)}</span></div>
                  <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Time</span><span className="font-medium">{slotA && fmtTime(slotA.start_time, tz)}</span></div>
                </div>
              </div>

              <div className="glass p-6 text-left mb-8 space-y-3">
                <h4 className="font-bold text-sm text-[color:var(--ink)] mb-2">{tourB?.name}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Reference</span><span className="font-mono font-bold">{bookingRefB}</span></div>
                  <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Date</span><span className="font-medium">{slotB && fmtDate(slotB.start_time, tz)}</span></div>
                  <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Time</span><span className="font-medium">{slotB && fmtTime(slotB.start_time, tz)}</span></div>
                </div>
              </div>

              <div className="bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] rounded-2xl p-5 text-left mb-8">
                <div className="flex justify-between text-sm">
                  <span className="text-[color:var(--warning)] font-semibold">Combo Total Paid</span>
                  <span className="font-bold text-[color:var(--ink)]">R{comboTotal}</span>
                </div>
                {savings > 0 && (
                  <p className="text-xs text-[color:var(--warning)] mt-1">You saved R{savings * qty} with this combo!</p>
                )}
              </div>

              <a href="/" className="btn btn-primary w-full">Browse More Tours</a>
            </>
          )}

          {paymentStatus === "failed" && (
            <>
              <div className="w-20 h-20 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[color:var(--danger)] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M9 9l6 6M15 9l-6 6" /></svg>
              </div>
              <h2 className="text-3xl font-bold mb-3 text-[color:var(--ink)]">Payment Failed</h2>
              <p className="text-[color:var(--ink-muted)] mb-4">{paymentError || "Something went wrong with your payment."}</p>
              <button onClick={() => { setStep("details"); setPaymentStatus("idle"); setPaymentError(""); setSubmitting(false); }}
                className="btn btn-primary px-10 !py-3">
                Try Again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
