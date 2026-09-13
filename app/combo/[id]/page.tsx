"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createTenantSupabase } from "../../lib/supabase";
import { useTheme } from "../../components/ThemeProvider";
import { fmtDate, fmtTime, fmtMonth, dateKeyInTz, isSameDay, getDaysInMonth, getFirstDay } from "../../lib/format";
import type { Slot, Tour } from "../../lib/types";
import { formatDuration } from "../../lib/duration";
import { normalizePhone } from "../../lib/phone";

const BOOKING_CUTOFF_MINUTES = 60;
const SU = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SK = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Every leg date on this page is a local-midnight Date built by the calendar,
// so a plain Y/M/D day number is enough to measure gaps in calendar days.
const dayNum = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

const POLICY_NOTE: Record<string, string> = {
  VOUCHER_ONLY: "Cancellations are refunded as a credit voucher.",
  NO_CANCEL: "This package is non-refundable once booked.",
  // POLICY_REFUND is the standard behaviour, so it needs no line.
};

// An unset max gap is absent, not zero: max_gap_days 0 legitimately means
// "same day", so Number(null) === 0 would turn no rule into the tightest one.
const maxGapOf = (rules: ComboRules) => (rules.max_gap_days == null ? NaN : Number(rules.max_gap_days));

function describeRules(rules?: ComboRules | null): string {
  if (!rules) return "";
  const parts: string[] = [];
  const minGap = Number(rules.min_gap_days);
  if (Number.isFinite(minGap) && minGap > 0) parts.push("at least " + minGap + " day" + (minGap === 1 ? "" : "s") + " apart");
  const maxGap = maxGapOf(rules);
  if (Number.isFinite(maxGap) && maxGap >= 0) {
    parts.push(maxGap === 0 ? "on the same day" : "within " + maxGap + " day" + (maxGap === 1 ? "" : "s") + " of each other");
  }
  if (rules.enforce_order) parts.push("taken in order");
  if (parts.length === 0) return "";
  const list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
  return "These tours must be " + list + ".";
}

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

// Offer-level rules. Enforcement lives in create-paysafe-checkout (_shared/
// combo.ts validateComboDates); everything below only mirrors it in the UI.
type ComboRules = { min_gap_days?: number | null; max_gap_days?: number | null; enforce_order?: boolean };

type OfferWithItems = {
  id: string;
  name: string;
  description?: string | null;
  combo_price: number;
  original_price: number;
  currency?: string;
  cancellation_policy?: string | null;
  combo_rules?: ComboRules | null;
  items?: Array<{ id: string; tour_id: string; business_id: string; position: number; tours: Tour | null }>;
  tour_a?: Tour | null;
  tour_b?: Tour | null;
};

// One selectable leg per tour in the combo (2 for classic combos, up to 10)
type Leg = {
  itemId: string | null;
  tour: Tour | null;
  slots: Slot[];
  date: Date | null;
  slot: Slot | null;
  calMonth: number;
  calYear: number;
};

export default function ComboBookingPage() {
  const { id: comboId } = useParams<{ id: string }>();
  const theme = useTheme();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const tz = theme.timezone || "Africa/Johannesburg";

  const [combo, setCombo] = useState<OfferWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"slots" | "details" | "payment">("slots");
  const [legs, setLegs] = useState<Leg[]>([]);

  // Customer details
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Payment state
  const [submitting, setSubmitting] = useState(false);
  const [bookingRefs, setBookingRefs] = useState<string[]>([]);
  const [paysafeReady, setPaysafeReady] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [paymentError, setPaymentError] = useState("");
  const [soldOutMsg, setSoldOutMsg] = useState("");

  function patchLeg(idx: number, patch: Partial<Leg>) {
    setLegs((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  const loadLegSlots = useCallback(async (idx: number, tourId: string) => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + BOOKING_CUTOFF_MINUTES * 60 * 1000);
    const later = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const { data } = await tenantSupabase.from("slots").select("*").eq("tour_id", tourId).eq("status", "OPEN")
      .gt("start_time", cutoff.toISOString()).lt("start_time", later.toISOString()).order("start_time", { ascending: true });
    const open = ((data || []) as unknown as Slot[]).filter((s) => s.capacity_total - s.booked - (s.held || 0) > 0);
    setLegs((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const first = open[0] ? new Date(open[0].start_time) : new Date();
      return { ...l, slots: open, calMonth: first.getMonth(), calYear: first.getFullYear() };
    }));
  }, [tenantSupabase]);

  // Load combo offer + build one leg per tour
  useEffect(() => {
    if (!comboId || !theme.id) return;
    (async () => {
      const { data } = await tenantSupabase.from("combo_offers")
        .select("*, items:combo_offer_items(id, tour_id, business_id, position, tours:tours(id, name, image_url, duration_minutes, base_price_per_person, business_id)), tour_a:tours!combo_offers_tour_a_id_fkey(id, name, image_url, duration_minutes, base_price_per_person, business_id), tour_b:tours!combo_offers_tour_b_id_fkey(id, name, image_url, duration_minutes, base_price_per_person, business_id)")
        .eq("id", comboId)
        .eq("active", true)
        .single();
      if (data) {
        const offer = data as unknown as OfferWithItems;
        setCombo(offer);
        const sortedItems = (offer.items || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
        const now = new Date();
        const built: Leg[] = sortedItems.length >= 2
          ? sortedItems.map((it) => ({ itemId: it.id, tour: it.tours, slots: [], date: null, slot: null, calMonth: now.getMonth(), calYear: now.getFullYear() }))
          : [
              { itemId: null, tour: offer.tour_a || null, slots: [], date: null, slot: null, calMonth: now.getMonth(), calYear: now.getFullYear() },
              { itemId: null, tour: offer.tour_b || null, slots: [], date: null, slot: null, calMonth: now.getMonth(), calYear: now.getFullYear() },
            ];
        setLegs(built);
        built.forEach((leg, i) => { if (leg.tour?.id) loadLegSlots(i, leg.tour.id); });
      }
      setLoading(false);
    })();
  }, [tenantSupabase, comboId, theme.id, loadLegSlots]);

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

  const comboTotal = combo ? combo.combo_price * qty : 0;
  const allSelected = legs.length >= 2 && legs.every((l) => l.slot);
  const maxQty = legs.reduce((m, l) => {
    if (!l.slot) return m;
    return Math.min(m, l.slot.capacity_total - l.slot.booked - (l.slot.held || 0));
  }, 10);

  // Would picking `day` for this leg break the offer's date rules, given what
  // the other legs already have? Mirrors validateComboDates, but only over the
  // legs already chosen — the server is still the authority at checkout.
  function breaksRules(idx: number, day: number): boolean {
    const rules = combo?.combo_rules;
    if (!rules) return false;
    const days = legs.map((l, i) => (i === idx ? day : l.date ? dayNum(l.date) : null));

    if (rules.enforce_order) {
      for (let i = 0; i < days.length; i++) {
        const d = days[i];
        if (d === null || i === idx) continue;
        if (i < idx ? d > day : d < day) return true;
      }
    }

    const minGap = Number(rules.min_gap_days);
    if (Number.isFinite(minGap) && minGap > 0) {
      for (let i = 1; i < days.length; i++) {
        const a = days[i - 1], b = days[i];
        if (a !== null && b !== null && Math.abs(b - a) < minGap) return true;
      }
    }

    const maxGap = maxGapOf(rules);
    if (Number.isFinite(maxGap) && maxGap >= 0) {
      const known = days.filter((d): d is number => d !== null);
      if (Math.max(...known) - Math.min(...known) > maxGap) return true;
    }

    return false;
  }

  function renderCalendar(idx: number) {
    const leg = legs[idx];
    const availDates = new Set<string>();
    leg.slots.forEach((s) => availDates.add(dateKeyInTz(s.start_time, tz)));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dim = getDaysInMonth(leg.calYear, leg.calMonth);
    const fd = getFirstDay(leg.calYear, leg.calMonth);
    const cells = [];
    for (let i = 0; i < fd; i++) cells.push(<div key={"e" + i} />);
    for (let day = 1; day <= dim; day++) {
      const date = new Date(leg.calYear, leg.calMonth, day);
      const k = leg.calYear + "-" + leg.calMonth + "-" + day;
      const has = availDates.has(k);
      const past = date < today;
      const sel = leg.date && isSameDay(date, leg.date);
      const isToday = isSameDay(date, today);
      const blocked = past || !has || breaksRules(idx, dayNum(date));
      cells.push(
        <button key={day} disabled={blocked} onClick={() => patchLeg(idx, { date, slot: null })}
          className={"relative aspect-square rounded-full flex items-center justify-center text-sm font-medium transition-all " +
            (sel ? "bg-[color:var(--accent)] text-[color:var(--ink-on-main)] shadow-lg scale-105 " : "") +
            (!sel && !blocked ? "bg-[color:var(--glass-tint-card)] text-[color:var(--ink)] hover:bg-[color:var(--hover-overlay)] border border-[color:var(--glass-border)] cursor-pointer " : "") +
            (blocked ? "text-[color:var(--ink-faint)] cursor-not-allowed " : "") +
            (isToday && !sel ? "ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] ring-offset-2 " : "")}>
          {day}
          {!blocked && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[color:var(--accent)]" />}
        </button>
      );
    }
    const canPrev = leg.calYear > today.getFullYear() || leg.calMonth > today.getMonth();
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { if (leg.calMonth === 0) patchLeg(idx, { calMonth: 11, calYear: leg.calYear - 1 }); else patchLeg(idx, { calMonth: leg.calMonth - 1 }); }}
            disabled={!canPrev} className="w-9 h-9 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full surface-muted flex items-center justify-center text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)] disabled:opacity-30">&larr;</button>
          <h3 className="text-lg font-semibold text-[color:var(--ink)]">{fmtMonth(new Date(leg.calYear, leg.calMonth))}</h3>
          <button onClick={() => { if (leg.calMonth === 11) patchLeg(idx, { calMonth: 0, calYear: leg.calYear + 1 }); else patchLeg(idx, { calMonth: leg.calMonth + 1 }); }}
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

  function renderSlots(idx: number) {
    const leg = legs[idx];
    const daySlots = leg.date ? leg.slots.filter((s) => isSameDay(new Date(s.start_time), leg.date as Date)) : [];
    if (daySlots.length === 0) return <div className="text-center py-8 text-[color:var(--ink-muted)]"><p>No available slots.</p></div>;
    return (
      <div className="space-y-2">
        {daySlots.map((s: Slot) => {
          const a = s.capacity_total - s.booked - (s.held || 0);
          const isSel = leg.slot?.id === s.id;
          return (
            <button key={s.id} onClick={() => patchLeg(idx, { slot: s })}
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

  function refreshAllSlots() {
    legs.forEach((leg, i) => {
      if (leg.tour?.id) loadLegSlots(i, leg.tour.id);
      patchLeg(i, { slot: null });
    });
  }

  async function submitComboBooking() {
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (!combo || !allSelected) return;
    setSubmitting(true);
    setSoldOutMsg("");
    setPaymentError("");

    try {
      // slot_ids maps offer item → chosen slot (N-party); slot_a/b keep older
      // edge-function builds working for classic 2-tour combos.
      const slotIds: Record<string, string> = {};
      legs.forEach((leg) => { if (leg.itemId && leg.slot) slotIds[leg.itemId] = leg.slot.id; });
      const res = await fetch(SU + "/functions/v1/create-paysafe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + SK },
        body: JSON.stringify({
          combo_offer_id: combo.id,
          slot_ids: slotIds,
          slot_a_id: legs[0]?.slot?.id,
          slot_b_id: legs[1]?.slot?.id,
          qty,
          customer_name: name,
          customer_email: email.toLowerCase(),
          customer_phone: phone ? normalizePhone("+27", phone) : "",
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        const msg = String(data.error || "");
        // Match the capacity errors precisely: the date-rule messages say "must
        // be taken in order" / "taken within N days", which a bare "taken"
        // test mistook for "those spots were just taken" and answered by
        // clearing every selection.
        if (res.status === 409 || /capacity|just taken|sold out/i.test(msg)) {
          setSoldOutMsg(msg || "A slot just sold out. Please select different times.");
          setStep("slots");
          refreshAllSlots();
        } else {
          setPaymentError(msg || "Something went wrong. Please try again.");
        }
        setSubmitting(false);
        return;
      }

      const ids: string[] = Array.isArray(data.booking_ids) ? data.booking_ids : [data.booking_a_id, data.booking_b_id].filter(Boolean);
      setBookingRefs(ids.map((id: string) => String(id).substring(0, 8).toUpperCase()));

      // Manual-settlement model: the primary operator collects the full amount
      // via their own Yoco account — hosted checkout page, so just redirect.
      if (data.provider === "yoco" && data.redirect_url) {
        // eslint-disable-next-line react-hooks/immutability -- browser navigation in a click-handler callback, not a render/effect mutation
        window.location.href = data.redirect_url;
        return;
      }

      // Launch Paysafe checkout overlay (2-tour combos with SplitPay configured)
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

  if (!combo || legs.length < 2) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">

      <h2 className="text-2xl font-bold text-[color:var(--ink)] mb-3">Combo Not Available</h2>
      <p className="text-[color:var(--ink-muted)] mb-8">This combo package may have been removed or is currently unavailable.</p>
      <Link href="/" className="btn btn-primary px-8 py-3">Browse Tours</Link>
    </div>
  );

  const savings = combo.original_price - combo.combo_price;
  const tourNamesLine = legs.map((l) => l.tour?.name).filter(Boolean).join(" + ");
  const rulesLine = describeRules(combo.combo_rules);
  const policyNote = POLICY_NOTE[String(combo.cancellation_policy || "")] || "";

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
                  {active && i < ci ? "✓" : i + 1}
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

        <div className="flex-1">
          <h3 className="font-semibold text-lg text-[color:var(--ink)]">{combo.name}</h3>
          <p className="text-[color:var(--ink-muted)] text-sm">{tourNamesLine}</p>
        </div>
        <div className="text-right">
          <div className="font-bold text-lg text-[color:var(--ink)]">R{combo.combo_price}<span className="text-xs font-normal text-[color:var(--ink-muted)]">/pp</span></div>
          {savings > 0 && <div className="text-xs text-[color:var(--success)] font-semibold">Save R{savings}</div>}
        </div>
      </div>

      {/* STEP 1: Select Dates */}
      {step === "slots" && (
        <div>
          <Link href="/" className="text-sm text-[color:var(--ink-muted)] mb-6 hover:text-[color:var(--ink)] inline-block">&larr; Back to tours</Link>

          {rulesLine && (
            <p className="text-sm text-[color:var(--ink-muted)] mb-6">{rulesLine} Dates that do not fit are greyed out.</p>
          )}

          {soldOutMsg && (
            <div className="mb-4 p-4 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] rounded-2xl flex items-center gap-3">

              <div className="flex-1">
                <p className="text-sm font-semibold text-[color:var(--danger)]">{soldOutMsg}</p>
                <p className="text-xs text-[color:var(--ink-muted)] mt-0.5">Available slots have been refreshed.</p>
              </div>
              <button onClick={() => setSoldOutMsg("")} className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center text-[color:var(--ink-muted)] hover:text-[color:var(--danger)] text-lg">&times;</button>
            </div>
          )}

          {legs.map((leg, idx) => (
            <div key={leg.itemId || idx} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 bg-[color:var(--accent)] text-[color:var(--ink-on-main)] rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                <h2 className="text-xl font-bold text-[color:var(--ink)]">{leg.tour?.name}</h2>
                <span className="text-sm text-[color:var(--ink-muted)]">{formatDuration(leg.tour?.duration_minutes)}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  {renderCalendar(idx)}
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-3">{leg.date ? "Times for " + fmtDate(leg.date.toISOString(), tz) : "Select a date"}</h3>
                  {!leg.date ? (
                    <div className="text-center py-8 text-[color:var(--ink-muted)]"><p className="text-sm">Tap a date to see times.</p></div>
                  ) : renderSlots(idx)}
                </div>
              </div>
            </div>
          ))}

          {allSelected && (
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
            </div>

            {/* Booking Summary Sidebar */}
            <div className="md:col-span-2">
              <div className="glass-sheet !rounded-[20px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sticky top-6">
                <h3 className="font-bold mb-4">Combo Summary</h3>
                <div className="space-y-3 text-sm">
                  {legs.map((leg, idx) => (
                    <div key={leg.itemId || idx} className="pb-3 border-b border-[color:var(--glass-border)]">
                      <p className="font-semibold text-[color:var(--ink)]">{leg.tour?.name}</p>
                      <div className="flex justify-between text-[color:var(--ink-muted)] mt-1">
                        <span>Date</span><span className="font-medium text-[color:var(--ink)]">{leg.slot && fmtDate(leg.slot.start_time, tz)}</span>
                      </div>
                      <div className="flex justify-between text-[color:var(--ink-muted)] mt-0.5">
                        <span>Time</span><span className="font-medium text-[color:var(--ink)]">{leg.slot && fmtTime(leg.slot.start_time, tz)}</span>
                      </div>
                    </div>
                  ))}
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
                {/* Rejections (date rules, payment) belong beside the button
                    that triggered them, not at the foot of the form column. */}
                {paymentError && (
                  <div className="mt-5 p-4 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] rounded-2xl">
                    <p className="text-sm text-[color:var(--danger)]">{paymentError}</p>
                  </div>
                )}
                <button onClick={submitComboBooking} disabled={submitting || !name.trim() || !email.trim()}
                  className="btn btn-primary w-full mt-5 !py-3.5">
                  {submitting ? "Processing..." : "Pay R" + comboTotal}
                </button>
                {policyNote && <p className="text-xs text-[color:var(--ink-muted)] text-center mt-3">{policyNote}</p>}
                <p className="surface-muted !rounded-full px-4 py-2 text-xs text-[color:var(--ink-muted)] text-center mt-3">Secure payment via a PCI DSS compliant provider: card details never touch our servers</p>
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

              <h2 className="text-3xl font-bold mb-3 text-[color:var(--ink)]">Combo Booked!</h2>
              <p className="text-[color:var(--ink-muted)] mb-8">All your adventures are confirmed. Check your email for details.</p>

              {legs.map((leg, idx) => (
                <div key={leg.itemId || idx} className="glass p-6 text-left mb-4 space-y-3">
                  <h4 className="font-bold text-sm text-[color:var(--ink)] mb-2">{leg.tour?.name}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Reference</span><span className="font-mono font-bold">{bookingRefs[idx] || ""}</span></div>
                    <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Date</span><span className="font-medium">{leg.slot && fmtDate(leg.slot.start_time, tz)}</span></div>
                    <div className="flex justify-between"><span className="text-[color:var(--ink-muted)]">Time</span><span className="font-medium">{leg.slot && fmtTime(leg.slot.start_time, tz)}</span></div>
                  </div>
                </div>
              ))}

              <div className="bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] rounded-2xl p-5 text-left mb-8 mt-8">
                <div className="flex justify-between text-sm">
                  <span className="text-[color:var(--warning)] font-semibold">Combo Total Paid</span>
                  <span className="font-bold text-[color:var(--ink)]">R{comboTotal}</span>
                </div>
                {savings > 0 && (
                  <p className="text-xs text-[color:var(--warning)] mt-1">You saved R{savings * qty} with this combo!</p>
                )}
              </div>

              <Link href="/" className="btn btn-primary w-full">Browse More Tours</Link>
            </>
          )}

          {paymentStatus === "failed" && (
            <>

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
