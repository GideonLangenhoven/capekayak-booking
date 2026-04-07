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
      const q = supabase.from("tours").select("*").eq("business_id", theme.id).order("base_price_per_person");
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
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
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
    const { data: promo } = await supabase
      .from("promotions")
      .select("*")
      .eq("code", code)
      .eq("business_id", theme.id)
      .maybeSingle();
    if (!promo) { setPromoError("Code not found"); return; }
    if (!promo.active) { setPromoError("This code is no longer active"); return; }
    if (promo.valid_from && new Date(promo.valid_from) > new Date()) { setPromoError("This code is not yet valid"); return; }
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) { setPromoError("This code has expired"); return; }
    if (promo.max_uses != null && promo.used_count >= promo.max_uses) { setPromoError("This code has reached its usage limit"); return; }
    if (promo.min_order_amount && grandTotal < promo.min_order_amount) { setPromoError("Minimum order of R" + promo.min_order_amount + " required"); return; }
    // Per-email check
    const { data: existingUse } = await supabase
      .from("promotion_uses")
      .select("id")
      .eq("promotion_id", promo.id)
      .eq("email", emailVal.toLowerCase())
      .maybeSingle();
    if (existingUse) { setPromoError("You have already used this promo code"); return; }
    setAppliedPromo({ id: promo.id, code: promo.code, discount_type: promo.discount_type, discount_value: Number(promo.discount_value) });
    setPromoCode("");
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoError("");
  }

  async function submitBooking() {
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
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

    // Record promo usage and increment counter
    if (appliedPromo) {
      await supabase.from("promotion_uses").insert({
        promotion_id: appliedPromo.id,
        email: email.toLowerCase(),
        booking_id: booking.id,
      });
      await supabase.from("promotions").update({
        used_count: (await supabase.from("promotions").select("used_count").eq("id", appliedPromo.id).single()).data?.used_count + 1,
      }).eq("id", appliedPromo.id);
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-10">
        {[{ l: "Date & Time", s: "calendar" }, { l: "Details", s: "details" }, { l: "Payment", s: "payment" }].map((x, i) => {
          const steps = ["calendar", "details", "payment"];
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
              {i < 2 && <div className={"h-0.5 flex-1 mx-2 rounded " + (active && i < ci ? "bg-gray-900" : "bg-gray-200")} />}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Calendar */}
      {step === "calendar" && (
        <div>
          {soldOutMsg && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <span className="text-red-500 text-xl">⚠</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">{soldOutMsg}</p>
                <p className="text-xs text-red-600 mt-0.5">Available slots have been refreshed below.</p>
              </div>
              <button onClick={() => setSoldOutMsg("")} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
            </div>
          )}
          <a href="/" className="text-sm text-gray-500 mb-6 hover:text-gray-900 inline-block">← Back to tours</a>
          <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center text-xl">🛶</div>
            <div><h3 className="font-semibold text-lg">{selectedTour?.name}</h3><p className="text-gray-500 text-sm">{selectedTour?.duration_minutes} min · R{selectedTour?.base_price_per_person}/pp</p></div>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div><h2 className="text-xl font-bold mb-4">Pick a Date</h2>{renderCalendar()}</div>
            <div>
              <h2 className="text-xl font-bold mb-4">{selectedDate ? "Times for " + fmtDate(selectedDate.toISOString(), tz) : "Select a date"}</h2>
              {!selectedDate ? (
                <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">📅</p><p>Tap a highlighted date to see available times.</p></div>
              ) : daySlots.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><p>No available slots on this date.</p></div>
              ) : (
                <div className="space-y-2">
                  {daySlots.map((s: Slot) => {
                    const a = s.capacity_total - s.booked - (s.held || 0);
                    const isSel = selectedSlot?.id === s.id;
                    return (
                      <button key={s.id} onClick={() => setSelectedSlot(s)}
                        className={"w-full text-left rounded-xl p-4 transition-all border " + (isSel ? "border-gray-900 bg-gray-900 text-white shadow-lg" : "border-gray-200 bg-white hover:border-gray-400")}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={"text-lg font-semibold " + (isSel ? "text-white" : "")}>{fmtTime(s.start_time, tz)}</p>
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
              {selectedDate && daySlots.length > 0 && (
                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1"><span>&#9432;</span> Bookings close 1 hour before departure</p>
              )}
              {selectedSlot && <button onClick={() => setStep("details")} className="w-full mt-4 bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 shadow-md">Continue →</button>}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Details */}
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
              <div><label htmlFor="book-name" className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                <input id="book-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
              <div><label htmlFor="book-email" className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                <input id="book-email" type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={saveDraft} placeholder="john@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
              <div><label htmlFor="book-phone" className="block text-sm font-semibold text-gray-700 mb-2">Phone (optional)</label>
                <input id="book-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 71 234 5678"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
              {availableAddOns.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Extras & Add-Ons</label>
                  <div className="space-y-2">
                    {availableAddOns.map(ao => {
                      const isSelected = !!selectedAddOns[ao.id];
                      return (
                        <div key={ao.id} className={"rounded-xl border p-3 transition-all " + (isSelected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white")}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={isSelected} onChange={() => toggleAddOn(ao.id)}
                              className="mt-1 w-4 h-4 shrink-0 rounded border-gray-300" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900">{ao.name}</span>
                                <span className="text-sm font-semibold text-gray-700">R{ao.price}</span>
                              </div>
                              {ao.description && <p className="text-xs text-gray-500 mt-0.5">{ao.description}</p>}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-3 mt-2 ml-7">
                              <span className="text-xs text-gray-500">Qty:</span>
                              <button onClick={() => setAddOnQty(ao.id, (selectedAddOns[ao.id] || 1) - 1)}
                                className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-sm hover:bg-gray-50">−</button>
                              <span className="text-sm font-semibold w-5 text-center">{selectedAddOns[ao.id]}</span>
                              <button onClick={() => setAddOnQty(ao.id, (selectedAddOns[ao.id] || 1) + 1)}
                                className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-sm hover:bg-gray-50">+</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Have a promo code?</label>
                {!appliedPromo ? (
                  <>
                    <div className="flex gap-2">
                      <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="e.g. SUMMER20"
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-mono uppercase tracking-wider focus:outline-none focus:border-gray-900"
                        onKeyDown={e => e.key === "Enter" && applyPromo()} />
                      <button onClick={applyPromo} className="bg-gray-100 text-gray-700 px-5 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200">Apply</button>
                    </div>
                    {promoError && <p className="text-red-500 text-xs mt-2">{promoError}</p>}
                  </>
                ) : (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl">
                    <span className="text-sm text-blue-700 font-semibold">
                      {appliedPromo.code} — {appliedPromo.discount_type === "PERCENT" ? appliedPromo.discount_value + "% off" : "R" + appliedPromo.discount_value + " off"}
                    </span>
                    <button onClick={removePromo} className="text-red-400 text-xs hover:text-red-600 font-medium">Remove</button>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t border-gray-100">
                <label htmlFor="book-voucher" className="block text-sm font-semibold text-gray-700 mb-2">Got a voucher code?</label>
                <div className="flex gap-2">
                  <input id="book-voucher" type="text" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" maxLength={8}
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
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <span className="text-amber-500 text-lg leading-none mt-0.5">&#9998;</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Waiver Required</p>
                  <p className="text-xs text-amber-700 mt-0.5">All participants must complete a digital waiver before the trip. A link will be sent to your email after booking.</p>
                </div>
              </div>
              <label className="flex items-start gap-3 mt-4 cursor-pointer">
                <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)}
                  className="mt-1 w-4 h-4 shrink-0 rounded border-gray-300" />
                <span className="text-xs text-gray-500 leading-relaxed">I agree to receive marketing messages and promotions. You can opt out at any time by replying STOP.</span>
              </label>
            </div>
            <div className="md:col-span-2">
              <div className="bg-gray-50 rounded-2xl p-5 sticky top-6">
                <h3 className="font-bold mb-4">Booking Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Tour</span><span className="font-medium">{selectedTour?.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{selectedSlot && fmtDate(selectedSlot.start_time, tz)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{selectedSlot && fmtTime(selectedSlot.start_time, tz)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Guests</span><span className="font-medium">{qty}</span></div>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between"><span className="text-gray-500">R{selectedTour?.base_price_per_person} × {qty}</span><span>R{baseTotal}</span></div>
                    {availableAddOns.filter(ao => selectedAddOns[ao.id]).map(ao => (
                      <div key={ao.id} className="flex justify-between mt-1 text-gray-600">
                        <span>{ao.name}{selectedAddOns[ao.id] > 1 ? ` × ${selectedAddOns[ao.id]}` : ""}</span>
                        <span>R{ao.price * selectedAddOns[ao.id]}</span>
                      </div>
                    ))}
                    {computedPromoDiscount > 0 && appliedPromo && (
                      <div className="flex justify-between text-blue-600 mt-1">
                        <span>Promo ({appliedPromo.code}) {appliedPromo.discount_type === "PERCENT" ? appliedPromo.discount_value + "%" : ""}</span>
                        <span>−R{computedPromoDiscount}</span>
                      </div>
                    )}
                    {effectiveVoucherCredit > 0 && <div className="flex justify-between text-emerald-600 mt-1"><span>Voucher credit</span><span>−R{effectiveVoucherCredit}</span></div>}
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

      {/* STEP 3: Payment */}
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
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{selectedSlot && fmtDate(selectedSlot.start_time, tz)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{selectedSlot && fmtTime(selectedSlot.start_time, tz)}</span></div>
              </div>
              {voucherRemainders.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-left mb-8">
                  <p className="text-sm font-semibold text-emerald-800 mb-2">Voucher Balance Remaining</p>
                  {voucherRemainders.map((vr) => (
                    <div key={vr.code} className="flex justify-between text-sm py-1">
                      <span className="font-mono text-emerald-700">{vr.code}</span>
                      <span className="font-bold text-emerald-700">R{vr.remaining} credit</span>
                    </div>
                  ))}
                  <p className="text-xs text-emerald-600 mt-2">Use your remaining credit on your next booking. Details sent to your email.</p>
                </div>
              )}
              {waiverUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left mb-8">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Complete Your Waiver</p>
                  <p className="text-xs text-amber-700 mb-3">All participants must sign a waiver before the trip. Complete it now to save time on the day.</p>
                  <a href={waiverUrl} className="inline-block bg-amber-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 shadow-sm">Sign Waiver Now →</a>
                </div>
              )}
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
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}

export default function BookPage() {
  return (<Suspense fallback={<BookingFlowSkeleton />}><BookingFlow /></Suspense>);
}
