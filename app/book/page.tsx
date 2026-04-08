"use client";
import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useTheme } from "../components/ThemeProvider";
import BookingFlowSkeleton from "../components/skeletons/BookingFlowSkeleton";
import Toast from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { fmtDate, fmtTime, fmtMonth, dateKeyInTz, isSameDay, getDaysInMonth, getFirstDay } from "../lib/format";
import type { Tour, Slot, VoucherCredit, AddOn, AppliedPromo } from "../lib/types";

function BookingFlow() {
  const params = useSearchParams();
  const theme = useTheme();
  const tz = theme.timezone || "Africa/Johannesburg";
  const tourId = params.get("tour");
  const [step, setStep] = useState<"calendar" | "details" | "payment">("calendar");
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [vouchers, setVouchers] = useState<VoucherCredit[]>([]);
  const [voucherTotal, setVoucherTotal] = useState(0);
  const [voucherError, setVoucherError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [voucherRemainders, setVoucherRemainders] = useState<{ code: string; remaining: number }[]>([]);
  const [soldOutMsg, setSoldOutMsg] = useState("");
  const [tourNotFound, setTourNotFound] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [availableAddOns, setAvailableAddOns] = useState<AddOn[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [waiverUrl, setWaiverUrl] = useState("");
  const [draftBookingId, setDraftBookingId] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();

  const IMG: Record<string, string> = {
    "Sea Kayak": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=500&fit=crop",
    "Sunset Paddle": "https://images.unsplash.com/photo-1500259571355-332da5cb07aa?w=800&h=500&fit=crop",
    "Private Tour": "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=800&h=500&fit=crop",
  };

  useEffect(() => {
    if (!theme.id) return; // wait for ThemeProvider to resolve business id
    (async () => {
      const q = supabase.from("tours").select("*").eq("business_id", theme.id).order("sort_order", { ascending: true });
      const { data } = await q;
      setTours((data || []) as unknown as Tour[]);
      if (tourId) {
        const t = ((data || []) as unknown as Tour[]).find((x) => x.id === tourId);
        if (t && !t.hidden && t.active !== false) {
          setSelectedTour(t);
          loadSlots(t.id);
        } else {
          setTourNotFound(true);
        }
      }
      // Fetch active add-ons for this business
      const { data: addOnsData } = await supabase.from("add_ons").select("id, name, description, price, image_url").eq("business_id", theme.id).eq("active", true).order("sort_order");
      setAvailableAddOns((addOnsData || []) as AddOn[]);
      setLoading(false);
    })();
  }, [tourId, theme.id]);

  const BOOKING_CUTOFF_MINUTES = 60;

  async function loadSlots(tid: string) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + BOOKING_CUTOFF_MINUTES * 60 * 1000);
    const later = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const { data } = await supabase.from("slots").select("*").eq("tour_id", tid).eq("status", "OPEN")
      .gt("start_time", cutoff.toISOString()).lt("start_time", later.toISOString()).order("start_time", { ascending: true });
    setAllSlots(((data || []) as unknown as Slot[]).filter((s) => s.capacity_total - s.booked - (s.held || 0) > 0));
  }

  const availDates = useMemo(() => {
    const ds = new Set<string>();
    allSlots.forEach(s => { ds.add(dateKeyInTz(s.start_time, tz)); });
    return ds;
  }, [allSlots, tz]);

  const daySlots = useMemo(() => {
    if (!selectedDate) return [];
    return allSlots.filter(s => isSameDay(new Date(s.start_time), selectedDate));
  }, [allSlots, selectedDate]);

  const baseTotal = selectedTour ? selectedTour.base_price_per_person * qty : 0;
  const addOnsTotal = useMemo(() => {
    return availableAddOns.reduce((sum, ao) => {
      const q = selectedAddOns[ao.id] || 0;
      return sum + ao.price * q;
    }, 0);
  }, [availableAddOns, selectedAddOns]);
  const grandTotal = baseTotal + addOnsTotal;
  // Promo discount applied before voucher credit
  const computedPromoDiscount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.discount_type === "PERCENT") {
      return Math.round(grandTotal * appliedPromo.discount_value / 100 * 100) / 100;
    }
    return Math.min(appliedPromo.discount_value, grandTotal);
  }, [appliedPromo, grandTotal]);
  const afterPromoTotal = Math.max(0, grandTotal - computedPromoDiscount);
  // Compute effective voucher credit: sequential drain against post-promo total
  const effectiveVoucherCredit = useMemo(() => {
    if (!selectedTour || vouchers.length === 0) return 0;
    let remaining = afterPromoTotal;
    for (const v of vouchers) {
      if (remaining <= 0) break;
      remaining -= Math.min(v.value, remaining);
    }
    return afterPromoTotal - remaining;
  }, [vouchers, afterPromoTotal, selectedTour]);
  const finalTotal = Math.max(0, afterPromoTotal - effectiveVoucherCredit);
  const avail = selectedSlot ? selectedSlot.capacity_total - selectedSlot.booked - (selectedSlot.held || 0) : 10;

  function toggleAddOn(id: string) {
    setSelectedAddOns(prev => {
      const copy = { ...prev };
      if (copy[id]) { delete copy[id]; } else { copy[id] = 1; }
      return copy;
    });
  }
  function setAddOnQty(id: string, q: number) {
    setSelectedAddOns(prev => {
      if (q <= 0) { const copy = { ...prev }; delete copy[id]; return copy; }
      return { ...prev, [id]: q };
    });
  }

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
    const bal = Number(data.current_balance ?? data.value ?? data.purchase_amount ?? 0);
    if (bal <= 0) { setVoucherError("No balance remaining"); return; }

    setVouchers([...vouchers, { id: data.id, code, value: bal }]);
    setVoucherTotal(voucherTotal + bal);
    setVoucherCode("");
  }

  function removeVoucher(i: number) { const v = vouchers[i]; setVouchers(vouchers.filter((_, j) => j !== i)); setVoucherTotal(voucherTotal - v.value); }

  async function saveDraft() {
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone.trim()) return;
    if (!selectedTour || !selectedSlot) return;
    const draftData = {
      business_id: selectedTour.business_id, tour_id: selectedTour.id, slot_id: selectedSlot.id,
      customer_name: name.trim(), email: email.toLowerCase().trim(),
      qty, unit_price: selectedTour.base_price_per_person,
      total_amount: grandTotal, original_total: grandTotal,
      status: "DRAFT" as const, source: "WEB" as const,
    };
    try {
      if (draftBookingId) {
        await supabase.from("bookings").update(draftData).eq("id", draftBookingId).eq("status", "DRAFT");
      } else {
        const { data } = await supabase.from("bookings").insert(draftData).select("id").single();
        if (data) setDraftBookingId(data.id);
      }
    } catch (e) { /* draft save is best-effort */ }
  }

  async function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoError("");
    // Read DOM value as fallback for browser autofill (autofill may not trigger onChange)
    const emailEl = document.getElementById("book-email") as HTMLInputElement;
    const emailVal = (emailEl?.value || email).trim();
    if (emailVal && emailVal !== email) setEmail(emailVal);
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setPromoError("Please enter your email address first");
      return;
    }
    const code = promoCode.toUpperCase().trim();
    const phoneVal = phone ? phone.replace(/[^\d]/g, "").replace(/^0/, "27") : "";
    // Server-side validation (checks expiry, usage limits, per-email, per-phone)
    const { data: result } = await supabase.rpc("validate_promo_code", {
      p_business_id: theme.id,
      p_code: code,
      p_order_amount: grandTotal,
      p_customer_email: emailVal.toLowerCase(),
      p_customer_phone: phoneVal || null,
    });
    if (!result || !result.valid) {
      setPromoError(result?.error || "Invalid promo code");
      return;
    }
    setAppliedPromo({ id: result.promo_id, code: result.code, discount_type: result.discount_type, discount_value: Number(result.discount_value) });
    setPromoCode("");
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoError("");
  }

  async function submitBooking() {
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone.trim()) return;
    setSubmitting(true);
    const promoInsertFields: Record<string, unknown> = {};
    if (appliedPromo) {
      promoInsertFields.discount_type = appliedPromo.discount_type === "PERCENT" ? "PERCENT" : "FLAT";
      promoInsertFields.discount_percent = appliedPromo.discount_type === "PERCENT" ? appliedPromo.discount_value : null;
      promoInsertFields.discount_amount = computedPromoDiscount;
      promoInsertFields.discount_notes = "Promo: " + appliedPromo.code;
      promoInsertFields.promo_code = appliedPromo.code;
    }
    const bookingPayload = {
      business_id: selectedTour!.business_id, tour_id: selectedTour!.id, slot_id: selectedSlot!.id,
      customer_name: name, phone: phone ? phone.replace(/[^\d]/g, "").replace(/^0/, "27") : "", email: email.toLowerCase(),
      qty, unit_price: selectedTour!.base_price_per_person, total_amount: finalTotal, original_total: grandTotal,
      status: "PENDING", source: "WEB",
      marketing_opt_in: marketingOptIn || null,
      ...promoInsertFields,
    };
    let booking: any; let error: any;
    if (draftBookingId) {
      const res = await supabase.from("bookings").update(bookingPayload).eq("id", draftBookingId).select().single();
      booking = res.data; error = res.error;
    } else {
      const res = await supabase.from("bookings").insert(bookingPayload).select().single();
      booking = res.data; error = res.error;
    }
    if (error || !booking) { showToast("Something went wrong.", "error"); setSubmitting(false); return; }
    setBookingRef(booking.id.substring(0, 8).toUpperCase());

    // Save add-on line items (snapshot unit_price at booking time)
    const addOnRows = availableAddOns
      .filter(ao => selectedAddOns[ao.id] && selectedAddOns[ao.id] > 0)
      .map(ao => ({ booking_id: booking.id, add_on_id: ao.id, qty: selectedAddOns[ao.id], unit_price: ao.price }));
    if (addOnRows.length > 0) {
      await supabase.from("booking_add_ons").insert(addOnRows);
    }

    // Record promo usage atomically (prevents race conditions and duplicate uses)
    if (appliedPromo) {
      await supabase.rpc("apply_promo_code", {
        p_promo_id: appliedPromo.id,
        p_customer_email: email.toLowerCase(),
        p_booking_id: booking.id,
        p_customer_phone: phone ? phone.replace(/[^\d]/g, "").replace(/^0/, "27") : null,
      });
    }

    if (finalTotal <= 0) {
      await supabase.from("bookings").update({ status: "PAID", yoco_payment_id: "VOUCHER_WEB" }).eq("id", booking.id);
      // Sequential voucher deduction using atomic RPC (prevents double-spend race conditions)
      let remainingCost = grandTotal;
      const remainders: { code: string; remaining: number }[] = [];
      for (const v of vouchers) {
        if (remainingCost <= 0) break;
        const deductionAmount = Math.min(v.value, remainingCost);
        // Atomic deduction via RPC — drains this voucher fully before moving to next
        const { data: rpcResult } = await supabase.rpc("deduct_voucher_balance", { p_voucher_id: v.id, p_amount: deductionAmount });
        if (rpcResult?.success) {
          const deducted = Number(rpcResult.deducted);
          const remaining = Number(rpcResult.remaining);
          remainingCost -= deducted;
          await supabase.from("vouchers").update({ redeemed_booking_id: booking.id }).eq("id", v.id);
          if (remaining > 0) {
            remainders.push({ code: v.code, remaining });
            try {
              await supabase.functions.invoke("send-email", {
                body: {
                  type: "VOUCHER_BALANCE",
                  data: {
                    email: email.toLowerCase(),
                    customer_name: name,
                    voucher_code: v.code,
                    original_value: v.value,
                    amount_used: deducted,
                    remaining_balance: remaining,
                    booking_ref: booking.id.substring(0, 8).toUpperCase(),
                    tour_name: selectedTour!.name,
                    business_id: selectedTour!.business_id,
                  },
                },
              });
            } catch (e) { console.error("VOUCHER_BALANCE_EMAIL_ERR:", e); }
          }
        }
      }
      await supabase.rpc("create_hold_with_capacity_check", {
        p_booking_id: booking.id,
        p_slot_id: selectedSlot!.id,
        p_qty: qty,
        p_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      // Confirm booking (handles email + WhatsApp + invoice + marketing sync)
      try {
        await supabase.functions.invoke("confirm-booking", {
          body: { booking_id: booking.id },
        });
      } catch (e) { console.error("VOUCHER_CONFIRM_ERR:", e); }
      // Fetch waiver token to show CTA on confirmation screen
      try {
        const { data: waiverData } = await supabase.from("bookings").select("waiver_token, waiver_status").eq("id", booking.id).single();
        if (waiverData?.waiver_token && waiverData.waiver_status !== "SIGNED") {
          setWaiverUrl("/waiver?booking=" + booking.id + "&token=" + waiverData.waiver_token);
        }
      } catch (e) { console.error("WAIVER_FETCH_ERR:", e); }
      setVoucherRemainders(remainders);
      setPaymentUrl("FREE"); setStep("payment"); setSubmitting(false); return;
    }

    // Atomic capacity check + hold creation to prevent overbooking
    const { data: holdResult, error: holdError } = await supabase.rpc("create_hold_with_capacity_check", {
      p_booking_id: booking.id,
      p_slot_id: selectedSlot!.id,
      p_qty: qty,
      p_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    if (holdError || !holdResult?.success) {
      // Capacity exceeded or hold failed — clean up the booking and redirect to calendar
      await supabase.from("bookings").update({ status: "CANCELLED", cancellation_reason: "No capacity" }).eq("id", booking.id);
      setSoldOutMsg(holdResult?.error || "This slot just sold out! Please select another time.");
      setSelectedSlot(null);
      setStep("calendar");
      setSubmitting(false);
      if (selectedTour) loadSlots(selectedTour.id);
      return;
    }
    await supabase.from("bookings").update({ status: "HELD" }).eq("id", booking.id);

    const yocoRes = await supabase.functions.invoke("create-checkout", {
      body: { booking_id: booking.id, amount: finalTotal, customer_name: name, qty, voucher_codes: vouchers.map(v => v.code), voucher_ids: vouchers.map(v => v.id) },
    });
    if (yocoRes.data?.redirectUrl) { setPaymentUrl(yocoRes.data.redirectUrl); setStep("payment"); }
    else showToast("Payment link unavailable. Please try again.", "error");
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
          className={"relative aspect-square rounded-full flex items-center justify-center text-[15px] font-extrabold transition-all outline-none " +
            (sel ? "bg-teal-700 text-white shadow-md scale-105 " : "") +
            (!sel && has && !past ? "bg-[#FDFDFB] text-slate-800 hover:bg-white border border-slate-100 hover:border-teal-200 hover:shadow-sm hover:text-teal-700 cursor-pointer " : "") +
            (past || !has ? "text-slate-300 cursor-not-allowed bg-transparent " : "") +
            (isToday && !sel ? "ring-2 ring-teal-500/20 ring-offset-2 " : "")}>
          {day}
          {has && !past && !sel && <span className={"absolute bottom-[4px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full " + (sel ? "bg-white" : "bg-teal-500")} />}
        </button>
      );
    }
    const canPrev = calYear > today.getFullYear() || calMonth > today.getMonth();
    return (
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
            disabled={!canPrev} className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">{fmtMonth(new Date(calYear, calMonth))}</h3>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
            className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-3">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d} className="text-center text-[11px] font-bold text-slate-400 py-1 uppercase tracking-wider">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{cells}</div>
        <div className="flex items-center gap-5 mt-6 pt-5 border-t border-slate-100 text-[12px] font-bold text-slate-500 justify-center">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block shadow-sm" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" /> Unavailable</span>
        </div>
      </div>
    );
  }

  if (loading) return <BookingFlowSkeleton />;

  if (tourNotFound) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-3xl">🚫</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">This tour is no longer available</h2>
      <p className="text-gray-500 mb-8">The tour you are looking for may have been removed or is currently unavailable. Check out our current adventures!</p>
      <a href="/" className="inline-block bg-gray-900 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 shadow-md">
        Browse Available Tours
      </a>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      {/* Progress */}
      <div className="flex items-center justify-between mb-10 bg-white rounded-full p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 max-w-lg mx-auto">
        {[{ l: "Date", s: "calendar" }, { l: "Details", s: "details" }, { l: "Pay", s: "payment" }].map((x, i) => {
          const steps = ["calendar", "details", "payment"];
          const ci = steps.indexOf(step);
          const active = i <= ci;
          const isDone = i < ci;
          return (
            <div key={x.l} className="flex items-center flex-1 last:flex-none">
              <div className={"flex items-center gap-2 " + (active ? "bg-teal-50 pl-2 pr-4 py-2 rounded-full" : "px-3")}>
                <div className={"w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 transition-all " + (active ? "bg-teal-700 text-white shadow-sm" : "bg-slate-100 text-slate-400")}>
                  {isDone ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : i + 1}
                </div>
                <span className={"text-[13px] tracking-wide " + (active ? "text-teal-900 font-extrabold" : "text-slate-400 font-bold")}>{x.l}</span>
              </div>
              {i < 2 && <div className="flex-1 px-2"><div className={"h-0.5 w-full rounded-full " + (isDone ? "bg-teal-500" : "bg-slate-100")} /></div>}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Calendar */}
      {step === "calendar" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {soldOutMsg && (
            <div className="mb-6 p-5 bg-orange-50 border border-orange-200/60 rounded-[1.5rem] flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-[14px] font-bold text-orange-900">{soldOutMsg}</p>
                <p className="text-[13px] font-medium text-orange-700/80 mt-1">Available slots have been refreshed below so you can try again.</p>
              </div>
              <button onClick={() => setSoldOutMsg("")} className="w-8 h-8 rounded-full flex items-center justify-center bg-orange-100/50 text-orange-500 hover:bg-orange-200 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          
          <div className="text-center mb-10 w-full flex flex-col items-center justify-center">
             <a href="/" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-full text-[13px] font-bold text-slate-600 transition-colors mb-6 shadow-sm hover:shadow-md">
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
               Back to tours
             </a>
             <div className="inline-flex items-center gap-4 p-2 pr-6 bg-white rounded-full border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] mb-2">
               <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <div className="text-left">
                 <h3 className="font-extrabold text-[16px] text-slate-800 leading-tight">{selectedTour?.name}</h3>
                 <p className="text-slate-500 text-[12px] font-bold mt-0.5">{selectedTour?.duration_minutes} min &middot; R{selectedTour?.base_price_per_person} per person</p>
               </div>
             </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 mb-6 pl-2 tracking-tight">Pick a Date</h2>
              {renderCalendar()}
            </div>
            
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 mb-6 pl-2 tracking-tight">{selectedDate ? "Times for " + fmtDate(selectedDate.toISOString(), tz) : "Select timeslot"}</h2>
              
              {!selectedDate ? (
                <div className="bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 text-center py-16 px-6 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center text-teal-500 mb-4">
                     <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="text-[14px] font-bold text-slate-600">No date selected</p>
                   <p className="text-[13px] font-medium text-slate-400 mt-1">Tap a highlighted date to see available times.</p>
                </div>
              ) : daySlots.length === 0 ? (
                <div className="bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 text-center py-16 px-6 flex flex-col items-center justify-center">
                   <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center text-slate-400 mb-4">
                     <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[14px] font-bold text-slate-600">No times available</p>
                  <p className="text-[13px] font-medium text-slate-400 mt-1">Try selecting another date to proceed.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {daySlots.map((s: Slot) => {
                    const a = s.capacity_total - s.booked - (s.held || 0);
                    const isSel = selectedSlot?.id === s.id;
                    return (
                      <button key={s.id} onClick={() => setSelectedSlot(s)}
                        className={"w-full text-left rounded-[1.5rem] p-5 transition-all outline-none border flex items-center gap-4 group " + (isSel ? "border-teal-600 bg-teal-800 text-white shadow-lg overflow-hidden relative" : "border-slate-100 bg-[#FDFDFB] hover:shadow-md hover:border-slate-200")}>
                        {isSel && <div className="absolute inset-0 bg-teal-700/50 mix-blend-overlay"></div>}
                        <div className={"w-12 h-12 rounded-full flex items-center justify-center shrink-0 relative z-10 " + (isSel ? "bg-white text-teal-800" : "bg-teal-50 text-teal-600 group-hover:bg-teal-100")}>
                           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0 relative z-10">
                           <p className={"text-[18px] font-extrabold leading-tight " + (isSel ? "text-white" : "text-slate-800")}>{fmtTime(s.start_time, tz)}</p>
                           <p className={"text-[12px] font-bold mt-0.5 " + (isSel ? "text-teal-100" : "text-slate-500")}>{a} {a === 1 ? "spot" : "spots"} remaining</p>
                        </div>
                        <div className="shrink-0 relative z-10">
                          {isSel ? (
                            <span className="bg-white/20 text-white pl-2 pr-3 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 border border-white/20">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              Selected
                            </span>
                          ) : (
                            <span className={"text-[11px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-full " + (a <= 3 ? "bg-orange-50 text-orange-600" : "bg-slate-50 text-slate-500")}>
                              {a <= 3 ? "Selling Fast" : "Available"}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  
                  {selectedSlot && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                       <button onClick={() => setStep("details")} className="w-full bg-teal-800 text-white pt-4 pb-[1.125rem] rounded-[1.5rem] text-[15px] font-bold hover:bg-teal-900 shadow-lg shadow-teal-900/20 transition-all flex items-center justify-center gap-2 group">
                         Continue to Details
                         <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                       </button>
                    </div>
                  )}
                  
                  <p className="text-[12px] font-bold text-slate-400 mt-2 flex items-center justify-center gap-1.5 text-center">
                    <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Bookings automatically close 1 hour prior to departure
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* STEP 2: Details */}
      {step === "details" && (
        <div>
          <button onClick={() => setStep("calendar")} className="flex items-center gap-1.5 text-[13px] font-bold text-slate-400 mb-6 hover:text-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Back to calendar
          </button>
          <h2 className="text-3xl font-extrabold text-slate-800 mb-8 tracking-tight pl-2">Complete Booking</h2>
          <div className="grid md:grid-cols-5 gap-8 lg:gap-12">
            <div className="md:col-span-3 space-y-6">
              
              {/* Qty Selector */}
              <div className="bg-[#FDFDFB] rounded-[1.5rem] p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <label className="block text-[14px] font-extrabold text-slate-800 mb-4">Number of People</label>
                <div className="flex items-center gap-5">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-[1.125rem] flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                  </button>
                  <span className="text-3xl font-extrabold w-10 text-center text-slate-800">{qty}</span>
                  <button onClick={() => setQty(Math.min(avail, qty + 1))} className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-[1.125rem] flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  </button>
                  <span className="text-[13px] font-bold text-slate-400 ml-2">max {avail} limit</span>
                </div>
              </div>

              {/* Personal Details */}
              <div className="bg-[#FDFDFB] rounded-[1.5rem] p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
                 <h3 className="text-[14px] font-extrabold text-slate-800 tracking-wide mb-2 uppercase">Your Details</h3>
                 <div>
                   <label htmlFor="book-name" className="block text-[13px] font-bold text-slate-600 mb-2 ml-1">Full Name *</label>
                   <input id="book-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                     className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all placeholder:text-slate-400" />
                 </div>
                 <div>
                   <label htmlFor="book-email" className="block text-[13px] font-bold text-slate-600 mb-2 ml-1">Email Address *</label>
                   <input id="book-email" type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={saveDraft} placeholder="john@example.com"
                     className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all placeholder:text-slate-400" />
                 </div>
                 <div>
                   <label htmlFor="book-phone" className="block text-[13px] font-bold text-slate-600 mb-2 ml-1">Phone *</label>
                   <div className="relative">
                     <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+27</span>
                     <input id="book-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="71 234 5678"
                       className="w-full pl-14 pr-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all placeholder:text-slate-400" />
                   </div>
                 </div>
              </div>

              {availableAddOns.length > 0 && (
                <div className="bg-[#FDFDFB] rounded-[1.5rem] p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  <label className="block text-[14px] font-extrabold text-slate-800 tracking-wide mb-4 uppercase">Extras & Add-Ons</label>
                  <div className="space-y-3">
                    {availableAddOns.map(ao => {
                      const isSelected = !!selectedAddOns[ao.id];
                      return (
                        <div key={ao.id} className={"rounded-[1.25rem] border p-4 transition-all " + (isSelected ? "border-teal-500 bg-teal-50/30" : "border-slate-100 bg-slate-50/50 hover:bg-slate-50")}>
                          <div className="flex items-start gap-4">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleAddOn(ao.id)}
                              className="mt-1 w-5 h-5 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <span className="text-[15px] font-bold text-slate-800">{ao.name}</span>
                                <span className="text-[14px] font-extrabold text-teal-700 bg-teal-100 px-2.5 py-0.5 rounded-lg shrink-0 ml-2">+R{ao.price}</span>
                              </div>
                              {ao.description && <p className="text-[13px] text-slate-500 mt-1 font-medium leading-relaxed">{ao.description}</p>}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-3 mt-4 ml-9 bg-white p-2 w-max rounded-xl border border-slate-100">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-2">Qty</span>
                              <button onClick={() => setAddOnQty(ao.id, (selectedAddOns[ao.id] || 1) - 1)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                              </button>
                              <span className="text-[14px] font-extrabold w-6 text-center text-slate-800">{selectedAddOns[ao.id]}</span>
                              <button onClick={() => setAddOnQty(ao.id, (selectedAddOns[ao.id] || 1) + 1)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discounts Block */}
              <div className="bg-[#FDFDFB] rounded-[1.5rem] p-6 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
                 <div>
                   <label className="block text-[14px] font-extrabold text-slate-800 tracking-wide mb-3 uppercase">Promo Code</label>
                   {!appliedPromo ? (
                     <>
                       <div className="flex gap-2 relative">
                         <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                         </div>
                         <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="e.g. SUMMER20"
                           className="flex-1 pl-10 pr-4 py-3.5 bg-slate-50 border-transparent rounded-2xl text-[14px] font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white placeholder:normal-case placeholder:font-medium placeholder:text-slate-400"
                           onKeyDown={e => e.key === "Enter" && applyPromo()} />
                         <button onClick={applyPromo} className="bg-slate-800 text-white px-6 py-3.5 rounded-2xl text-[14px] font-extrabold hover:bg-slate-900 transition-colors">Apply</button>
                       </div>
                       {promoError && <p className="text-red-500 text-[12px] font-bold mt-2 ml-1">{promoError}</p>}
                     </>
                   ) : (
                     <div className="flex items-center justify-between bg-blue-50 border border-blue-200/60 px-5 py-4 rounded-[1.25rem]">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                         </div>
                         <span className="text-[14px] text-blue-900 font-extrabold">
                           {appliedPromo.code} <span className="text-blue-600/70 ml-1 font-bold">({appliedPromo.discount_type === "PERCENT" ? appliedPromo.discount_value + "% off" : "R" + appliedPromo.discount_value + " off"})</span>
                         </span>
                       </div>
                       <button onClick={removePromo} className="text-slate-400 bg-white hover:bg-slate-100 hover:text-red-500 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                     </div>
                   )}
                 </div>
                 
                 <div className="pt-6 border-t border-slate-100">
                   <label htmlFor="book-voucher" className="block text-[14px] font-extrabold text-slate-800 tracking-wide mb-3 uppercase">Gift Voucher</label>
                   <div className="flex gap-2">
                     <input id="book-voucher" type="text" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" maxLength={8}
                       className="flex-1 px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-[15px] font-bold font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:bg-white placeholder:normal-case placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400" />
                     <button onClick={applyVoucher} className="bg-slate-800 text-white px-6 py-3.5 rounded-2xl text-[14px] font-extrabold hover:bg-slate-900 transition-colors">Apply</button>
                   </div>
                   {voucherError && <p className="text-red-500 text-[12px] font-bold mt-2 ml-1">{voucherError}</p>}
                   {vouchers.map((v, i) => (
                     <div key={v.code} className="flex items-center justify-between mt-3 bg-emerald-50 border border-emerald-200/60 px-5 py-4 rounded-[1.25rem]">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                         </div>
                         <span className="text-[14px] text-emerald-900 font-extrabold font-mono tracking-widest">{v.code} <span className="font-sans text-emerald-700/80 tracking-normal ml-2">— R{v.value} applied</span></span>
                       </div>
                       <button onClick={() => removeVoucher(i)} className="text-slate-400 bg-white hover:bg-slate-100 hover:text-red-500 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                     </div>
                   ))}
                 </div>
              </div>

              <div className="mt-4 p-5 bg-amber-50 border border-amber-200/50 rounded-[1.5rem] flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-[14px] font-extrabold text-amber-900">Waiver Required</p>
                  <p className="text-[13px] font-medium text-amber-800/80 mt-1">All participants must complete a digital waiver before arriving. A secure link will be included in your confirmation email.</p>
                </div>
              </div>
              
              <label className="flex items-start gap-4 mt-6 cursor-pointer group bg-[#FDFDFB] rounded-[1.5rem] p-5 border border-slate-100 hover:border-slate-200 transition-colors">
                <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 w-5 h-5 shrink-0 rounded text-teal-600 focus:ring-teal-500 cursor-pointer" />
                <span className="text-[13px] font-bold text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">I agree to receive booking updates and upcoming promotions via SMS. You can opt out at any time by replying STOP.</span>
              </label>
            </div>
            
            {/* Sticky Order Summary */}
            <div className="md:col-span-2">
              <div className="bg-slate-900 text-white rounded-[2rem] p-7 sticky top-6 shadow-2xl shadow-slate-900/10">
                <h3 className="text-[18px] font-extrabold mb-6 tracking-tight">Booking Summary</h3>
                <div className="space-y-4 text-[14px]">
                  <div className="flex justify-between items-center"><span className="text-slate-400 font-bold">Tour</span><span className="font-extrabold text-right">{selectedTour?.name}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-400 font-bold">Date</span><span className="font-extrabold text-right">{selectedSlot && fmtDate(selectedSlot.start_time, tz)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-400 font-bold">Time</span><span className="font-extrabold text-right">{selectedSlot && fmtTime(selectedSlot.start_time, tz)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-400 font-bold">Guests</span><span className="font-extrabold text-right">{qty}</span></div>
                  
                  <div className="border-t border-slate-700/50 pt-4 mt-4 space-y-3">
                    <div className="flex justify-between items-center"><span className="text-slate-300 font-medium tracking-wide">R{selectedTour?.base_price_per_person} × {qty}</span><span className="font-extrabold text-[15px]">R{baseTotal}</span></div>
                    {availableAddOns.filter(ao => selectedAddOns[ao.id]).map(ao => (
                      <div key={ao.id} className="flex justify-between items-center text-teal-300">
                        <span className="font-medium tracking-wide">{ao.name}{selectedAddOns[ao.id] > 1 ? ` × ${selectedAddOns[ao.id]}` : ""}</span>
                        <span className="font-extrabold text-[15px]">R{ao.price * selectedAddOns[ao.id]}</span>
                      </div>
                    ))}
                    {computedPromoDiscount > 0 && appliedPromo && (
                      <div className="flex justify-between items-center text-blue-300">
                        <span className="font-medium tracking-wide">Discount ({appliedPromo.code}) {appliedPromo.discount_type === "PERCENT" ? appliedPromo.discount_value + "%" : ""}</span>
                        <span className="font-extrabold text-[15px]">−R{computedPromoDiscount}</span>
                      </div>
                    )}
                    {effectiveVoucherCredit > 0 && (
                      <div className="flex justify-between items-center text-emerald-300">
                        <span className="font-medium tracking-wide">Voucher Credit</span>
                        <span className="font-extrabold text-[15px]">−R{effectiveVoucherCredit}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-slate-700/50 pt-5 mt-5">
                    <div className="flex justify-between items-end">
                       <span className="text-[14px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Total Limit</span>
                       <span className="text-3xl font-extrabold tracking-tight">{finalTotal <= 0 ? "FREE" : "R" + finalTotal}</span>
                    </div>
                  </div>
                </div>
                
                <button onClick={submitBooking} disabled={submitting || !name.trim() || !email.trim() || !phone.trim()}
                  className={"w-full mt-8 py-4 rounded-[1.5rem] text-[15px] font-extrabold transition-all shadow-lg flex items-center justify-center gap-2 " + 
                   (submitting || !name.trim() || !email.trim() || !phone.trim() ? "bg-slate-800 text-slate-500 shadow-none" : "bg-teal-500 text-slate-900 hover:bg-teal-400 shadow-teal-500/20")}>
                  {submitting ? "Processing..." : finalTotal <= 0 ? "Confirm Booking ✓" : "Pay R" + finalTotal + " Securely"}
                </button>
                <div className="flex items-center justify-center gap-2 mt-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Yoco Secure Payment
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Payment */}
      {step === "payment" && (
        <div className="text-center py-16 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {paymentUrl === "FREE" ? (
            <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-emerald-900/5 border border-slate-100 flex flex-col items-center">
              <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <div className="w-16 h-16 bg-emerald-400 rounded-full flex items-center justify-center text-white shadow-md">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">You&apos;re All Set!</h2>
              <p className="text-[15px] font-bold text-slate-500 mb-8">Booking confirmed. Your itinerary is on its way.</p>
              
              <div className="w-full bg-slate-50/50 rounded-[1.5rem] p-6 text-left mb-8 space-y-3 text-[14px] border border-slate-100">
                <div className="flex justify-between items-center"><span className="text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">Reference Tag</span><span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">{bookingRef}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">Tour</span><span className="font-extrabold text-slate-800">{selectedTour?.name}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">Date</span><span className="font-extrabold text-slate-800">{selectedSlot && fmtDate(selectedSlot.start_time, tz)}</span></div>
                <div className="flex justify-between items-center"><span className="text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">Time / Guests</span><span className="font-extrabold text-slate-800">{selectedSlot && fmtTime(selectedSlot.start_time, tz)} &middot; {qty} Guests</span></div>
              </div>

              {voucherRemainders.length > 0 && (
                <div className="w-full bg-emerald-50 border border-emerald-200/50 rounded-[1.5rem] p-6 text-left mb-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                     <svg className="w-16 h-16 text-emerald-900" fill="currentColor" viewBox="0 0 24 24"><path d="M21.582 5.764a.75.75 0 00-1.164-.264L12 12.181l-8.418-6.68a.75.75 0 00-1.164.264v12.47a.75.75 0 00.75.75h17.664a.75.75 0 00.75-.75V5.764z"/></svg>
                  </div>
                  <p className="text-[14px] font-extrabold text-emerald-900 tracking-wide uppercase mb-3 relative z-10">Voucher Credit Return</p>
                  {voucherRemainders.map((vr) => (
                    <div key={vr.code} className="flex flex-col mb-2 last:mb-0 relative z-10">
                      <span className="font-mono font-bold text-emerald-800/60 mb-0.5">Code: {vr.code}</span>
                      <span className="text-2xl font-extrabold tracking-tight text-emerald-700">R{vr.remaining} remaining</span>
                    </div>
                  ))}
                  <p className="text-[12px] font-bold text-emerald-700/80 mt-4 leading-snug relative z-10">Use your remaining balance on your next adventure. Details sent to your email.</p>
                </div>
              )}

              {waiverUrl && (
                <div className="w-full bg-amber-50 border border-amber-200/50 rounded-[1.5rem] p-6 text-left mb-8 flex flex-col items-start">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-3 shadow-sm border border-amber-200">
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </div>
                  <p className="text-[15px] font-extrabold text-amber-900 mb-1">Sign Waiver Document</p>
                  <p className="text-[13px] font-bold text-amber-800/70 mb-5 leading-relaxed">It is mandatory for all group members to sign the safety waiver. Complete it now to save time.</p>
                  <a href={waiverUrl} className="w-full text-center bg-amber-500 text-amber-950 py-3.5 rounded-xl text-[14px] font-extrabold hover:bg-amber-400 transition-colors shadow-sm">Review & Sign Documents</a>
                </div>
              )}

              <div className="w-full flex flex-col gap-3">
                <a href="/my-bookings" className="w-full block text-center bg-teal-800 text-white py-4 rounded-[1.25rem] text-[15px] font-extrabold hover:bg-teal-900 shadow-md transition-colors">Manage this booking</a>
                <a href="/" className="w-full block text-center bg-[#FDFDFB] text-slate-700 border border-slate-200 hover:bg-slate-50 py-4 rounded-[1.25rem] text-[15px] font-extrabold transition-colors">Browse other tours</a>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-900/5 border border-slate-100 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
                 <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Finalizing Checkout</h2>
              <p className="text-[14px] font-bold text-slate-500 mb-6">Spots are held exclusively for 15 minutes.</p>
              
              <div className="border-t border-b border-slate-100 w-full py-6 mb-8 text-center bg-slate-50/50">
                 <p className="text-[12px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Payload Total</p>
                 <p className="text-5xl font-extrabold tracking-tighter text-slate-800">R{finalTotal}</p>
              </div>
              
              <a href={paymentUrl} className="w-full block text-center bg-teal-500 text-slate-900 hover:bg-teal-400 py-4.5 rounded-[1.5rem] text-[16px] font-extrabold shadow-lg shadow-teal-500/20 transition-all">Proceed to Secure Portal &rarr;</a>
              <div className="flex items-center justify-center gap-2 mt-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Regulated via Yoco · Ref: {bookingRef}
              </div>
            </div>
          )}
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}

export default function BookPage() {
  return (<Suspense fallback={<BookingFlowSkeleton />}><BookingFlow /></Suspense>);
}
