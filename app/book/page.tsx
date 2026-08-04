"use client";
import { useEffect, useState, useRef, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createTenantSupabase, createVoucherSupabase, supabase } from "../lib/supabase";
import { formatDuration } from "../lib/duration";
import { useTheme } from "../components/ThemeProvider";
import TenantClosedNotice, { useTenantTrading } from "../components/TenantClosedNotice";
import BookingFlowSkeleton from "../components/skeletons/BookingFlowSkeleton";
import Toast from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";
import { fmtDate, fmtTime, fmtMonth, dateKeyInTz, isSameDay, getDaysInMonth, getFirstDay } from "../lib/format";
import type { Tour, Slot, VoucherCredit, AddOn, AppliedPromo, Booking } from "../lib/types";
import { normalizePhone, DIAL_CODES } from "../lib/phone";
import { BOOKING_CUTOFF_MINUTES } from "../lib/pricing";
import { HoldCountdown } from "../components/HoldCountdown";
import { saveDraft as saveLocalDraft, clearDraft as clearLocalDraft, readValidDraft } from "@/app/lib/booking-draft";

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string | null;
  reviewer_avatar_url: string | null;
  source: string | null;
  submitted_at: string;
};

export function BookingFlow({ embed = false }: { embed?: boolean }) {
  const params = useSearchParams();
  const theme = useTheme();
  const trading = useTenantTrading();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  const tz = theme.timezone || "Africa/Johannesburg";
  const tzAbbr = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date());
      return parts.find(p => p.type === "timeZoneName")?.value || tz;
    } catch { return tz; }
  }, [tz]);
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
  const [dialCode, setDialCode] = useState("+27");
  const [isCompany, setIsCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [availableAddOns, setAvailableAddOns] = useState<AddOn[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [waiverUrl, setWaiverUrl] = useState("");
  const [draftBookingId, setDraftBookingId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const { toast, showToast, dismissToast } = useToast();
  const draftSlotId = params.get("slot");
  const draftDate = params.get("date");
  const hydratedRef = useRef(false);

  // Hydrate form fields from localStorage draft on mount (once slots/tour are loaded).
  // PII-safety: only restore name/email/phone/promo when the visitor explicitly
  // clicked "Resume" from the home-page banner (?resume=1). Otherwise a stale
  // draft from a previous customer on a shared browser would leak their PII
  // into a fresh visitor's form (POPIA risk). Slot/date selection is still
  // pulled from the URL because those are not PII.
  // One-time draft/URL hydration once the tour + slots are ready. This must
  // stay an effect: it reads localStorage, clears it, and stamps a
  // Date.now()-based hold expiry — all impure operations React's render-purity
  // rule forbids in the component body. hydratedRef guards it to fire once.
  /* eslint-disable react-hooks/set-state-in-effect -- impure (localStorage + Date.now()) one-time hydration, cannot run in render */
  useEffect(() => {
    if (hydratedRef.current || !selectedTour || allSlots.length === 0) return;
    hydratedRef.current = true;
    const explicitResume = params.get("resume") === "1";
    const d = readValidDraft();
    // Always honour an explicit slot+date in the URL (deep-linking from
    // marketing, calendar, etc.). PII restoration is gated separately.
    if (draftSlotId && draftDate) {
      const matchSlot = allSlots.find(function (s) { return s.id === draftSlotId; });
      if (matchSlot) {
        setSelectedDate(new Date(draftDate));
        setSelectedSlot(matchSlot);
        if (explicitResume && d?.tourId === selectedTour.id && d.step >= 2) {
          setHoldExpiresAt(new Date(Date.now() + 15 * 60 * 1000));
          setStep("details");
        }
      } else if (draftDate) {
        setSelectedDate(new Date(draftDate));
      }
    }
    if (!explicitResume) {
      // No explicit resume request — proactively clear the stored draft so the
      // next interaction can start clean.
      clearLocalDraft();
      return;
    }
    if (!d || d.tourId !== selectedTour.id) return;
    if (d.customerName) setName(d.customerName);
    if (d.customerEmail) setEmail(d.customerEmail);
    if (d.customerPhone) setPhone(d.customerPhone);
    if (d.customerDialCode) setDialCode(d.customerDialCode);
    if (d.qty > 1) setQty(d.qty);
    if (d.marketingConsent) setMarketingOptIn(true);
    if (d.promoCode) setPromoCode(d.promoCode);
    if (d.addOns?.length) {
      const ao: Record<string, number> = {};
      d.addOns.forEach(function (a) { ao[a.id] = a.qty; });
      setSelectedAddOns(ao);
    }
  }, [selectedTour, allSlots, draftSlotId, draftDate, params]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-fill from authenticated customer session — PII-gated.
  // Without ?resume=1, a previous customer's session on a shared browser
  // would silently fill the next visitor's name/email/phone (POPIA risk).
  // Same gate as the localStorage draft restore above.
  useEffect(() => {
    if (params.get("resume") !== "1") return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase.from("customers")
        .select("name, email, phone")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle()
        .then(({ data: customer }) => {
          if (customer) {
            if (customer.name && !name) setName(customer.name);
            if (customer.email && !email) setEmail(customer.email);
            if (customer.phone && !phone) setPhone(customer.phone);
          } else if (session.user.email && !email) {
            setEmail(session.user.email);
          }
        });
    });
  }, []);

  // Debounced save to localStorage on form field changes
  useEffect(() => {
    if (!selectedTour) return;
    const id = setTimeout(function () {
      saveLocalDraft({
        tourId: selectedTour.id,
        tourName: selectedTour.name,
        date: selectedDate ? selectedDate.toISOString().slice(0, 10) : null,
        slotId: selectedSlot?.id || null,
        slotTime: selectedSlot ? fmtTime(selectedSlot.start_time, tz) : null,
        qty,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerDialCode: dialCode,
        marketingConsent: marketingOptIn,
        promoCode,
        voucherCode,
        addOns: Object.entries(selectedAddOns).filter(function (e) { return e[1] > 0; }).map(function (e) { return { id: e[0], qty: e[1] }; }),
        step: step === "payment" ? 3 : step === "details" ? 2 : 1,
      });
    }, 500);
    return function () { clearTimeout(id); };
  }, [selectedTour, selectedDate, selectedSlot, qty, name, email, phone, dialCode, marketingOptIn, promoCode, voucherCode, selectedAddOns, step]);

  const IMG: Record<string, string> = {
    "Sea Kayak": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=500&fit=crop",
    "Sunset Paddle": "https://images.unsplash.com/photo-1500259571355-332da5cb07aa?w=800&h=500&fit=crop",
    "Private Tour": "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=800&h=500&fit=crop",
  };

  async function loadSlots(tid: string) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + BOOKING_CUTOFF_MINUTES * 60 * 1000);
    const later = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const { data } = await tenantSupabase.from("slots").select("*").eq("tour_id", tid).eq("status", "OPEN")
      .gt("start_time", cutoff.toISOString()).lt("start_time", later.toISOString()).order("start_time", { ascending: true });
    setAllSlots(((data || []) as unknown as Slot[]).filter((s) => s.capacity_total - s.booked - (s.held || 0) > 0));
  }

  useEffect(() => {
    if (!theme.id) return; // wait for ThemeProvider to resolve business id
    (async () => {
      const q = tenantSupabase.from("tours").select("*").eq("business_id", theme.id).order("sort_order", { ascending: true });
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
      const { data: addOnsData } = await tenantSupabase.from("add_ons").select("id, name, description, price, image_url").eq("business_id", theme.id).eq("active", true).order("sort_order");
      setAvailableAddOns((addOnsData || []) as AddOn[]);
      setLoading(false);
    })();
  }, [tenantSupabase, tourId, theme.id]);

  useEffect(() => {
    if (!theme.id) return;
    (async () => {
      const { data } = await tenantSupabase.from("reviews")
        .select("id, rating, comment, reviewer_name, reviewer_avatar_url, source, submitted_at")
        .eq("business_id", theme.id).eq("status", "APPROVED").not("rating", "is", null)
        .order("submitted_at", { ascending: false }).limit(20);
      setReviews((data || []) as ReviewItem[]);
    })();
  }, [tenantSupabase, theme.id]);

  const availDates = useMemo(() => {
    const ds = new Set<string>();
    allSlots.forEach(s => { ds.add(dateKeyInTz(s.start_time, tz)); });
    return ds;
  }, [allSlots, tz]);

  // Both blocks below only need to react to allSlots loading in — track the
  // previous reference during render (React's documented pattern for
  // "adjust state when a prop changes") instead of an effect.
  const [prevAllSlots, setPrevAllSlots] = useState(allSlots);
  if (allSlots !== prevAllSlots) {
    setPrevAllSlots(allSlots);
    if (allSlots.length > 0) {
      const first = new Date(allSlots[0].start_time);
      setCalMonth(first.getMonth());
      setCalYear(first.getFullYear());
    }
    // Smart Defaults: auto-select the first available date and slot if not already set.
    if (allSlots.length > 0 && !selectedDate && !selectedSlot && !params.get("slot") && !params.get("date")) {
      const firstSlot = allSlots[0];
      setSelectedDate(new Date(firstSlot.start_time));
      setSelectedSlot(firstSlot);
    }
  }

  const daySlots = useMemo(() => {
    if (!selectedDate) return [];
    return allSlots.filter(s => isSameDay(new Date(s.start_time), selectedDate));
  }, [allSlots, selectedDate]);

  // Effective per-person price honours slot.price_per_person_override (peak
  // pricing) when the customer has selected a specific slot. Falls back to
  // the tour's base price before a slot is picked. The backend recomputes
  // and overrides anyway, but the booking-summary UI must agree with what
  // the customer is actually charged.
  const effectiveUnitPrice = selectedSlot && selectedSlot.price_per_person_override != null
    ? Number(selectedSlot.price_per_person_override)
    : selectedTour
      ? Number(selectedTour.base_price_per_person || 0)
      : 0;
  // A last-minute slot also carries an override, so it must win over the Peak
  // badge. The override check keeps a stale flag from rendering a broken price.
  const isLastMinute = !!selectedSlot?.last_minute_at && selectedSlot?.price_per_person_override != null;
  const isPeakPrice = !isLastMinute && !!(selectedSlot && selectedSlot.price_per_person_override != null
    && Number(selectedSlot.price_per_person_override) !== Number(selectedTour?.base_price_per_person || 0));
  const baseTotal = effectiveUnitPrice * qty;
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
  // Per-voucher applied / remaining breakdown for the "R200 applied · R400 remaining" copy.
  const voucherBreakdown = useMemo(() => {
    let remaining = afterPromoTotal;
    const rows: { code: string; value: number; applied: number; leftover: number }[] = [];
    for (const v of vouchers) {
      const applied = Math.min(v.value, Math.max(0, remaining));
      remaining = Math.max(0, remaining - applied);
      rows.push({ code: v.code, value: v.value, applied, leftover: Math.max(0, v.value - applied) });
    }
    return rows;
  }, [vouchers, afterPromoTotal]);
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
    // Vouchers are operator-specific — scope the lookup to this tenant (the
    // RLS policy also requires the x-tenant-business-id header to match).
    const { data } = await createVoucherSupabase(code, theme.id).from("vouchers").select("*").eq("code", code).eq("business_id", theme.id).single();
    if (!data) { setVoucherError("Code not valid for this operator"); return; }
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
      qty, unit_price: effectiveUnitPrice,
      total_amount: grandTotal, original_total: grandTotal,
      status: "DRAFT" as const, source: embed ? "WIDGET" : "WEB",
    };
    try {
      if (draftBookingId) {
        await tenantSupabase.from("bookings").update(draftData).eq("id", draftBookingId).eq("status", "DRAFT");
      } else {
        const { data } = await tenantSupabase.from("bookings").insert(draftData).select("id").single();
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
    // Server-side validation (checks expiry, usage limits, per-email).
    // NOTE: 5-arg overload (with p_customer_phone) was dropped in migration
    // 20260507135500_drop_validate_promo_duplicate_overload.sql. Sending the
    // extra arg makes PostgREST return 404. Per-phone limits are not
    // currently enforced server-side.
    const { data: result } = await supabase.rpc("validate_promo_code", {
      p_business_id: theme.id,
      p_code: code,
      p_order_amount: grandTotal,
      p_customer_email: emailVal.toLowerCase(),
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
    if (!name.trim() || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone.trim() || !termsAccepted) return;
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
      customer_name: name, phone: phone ? normalizePhone(dialCode, phone) : "", email: email.toLowerCase(),
      qty, unit_price: effectiveUnitPrice, total_amount: finalTotal, original_total: grandTotal,
      voucher_amount_paid: effectiveVoucherCredit,
      status: "PENDING", source: embed ? "WIDGET" : "WEB",
      marketing_opt_in: marketingOptIn || null,
      terms_accepted_at: new Date().toISOString(),
      customer_company_name: isCompany && companyName.trim() ? companyName.trim() : null,
      customer_vat_number: isCompany && vatNumber.trim() ? vatNumber.trim() : null,
      ...promoInsertFields,
    };
    let booking: Booking | null; let error: PostgrestError | null;
    if (draftBookingId) {
      const res = await tenantSupabase.from("bookings").update(bookingPayload).eq("id", draftBookingId).select().single();
      booking = res.data; error = res.error;
    } else {
      const res = await tenantSupabase.from("bookings").insert(bookingPayload).select().single();
      booking = res.data; error = res.error;
    }
    if (error || !booking) { showToast("Something went wrong.", "error"); setSubmitting(false); return; }
    setBookingRef(booking.id.substring(0, 8).toUpperCase());

    // Save add-on line items (snapshot unit_price at booking time)
    const addOnRows = availableAddOns
      .filter(ao => selectedAddOns[ao.id] && selectedAddOns[ao.id] > 0)
      .map(ao => ({ booking_id: booking.id, add_on_id: ao.id, qty: selectedAddOns[ao.id], unit_price: ao.price }));
    if (addOnRows.length > 0) {
      await tenantSupabase.from("booking_add_ons").insert(addOnRows);
    }

    // Record promo usage atomically (prevents race conditions and duplicate uses)
    if (appliedPromo) {
      await supabase.rpc("apply_promo_code", {
        p_promo_id: appliedPromo.id,
        p_customer_email: email.toLowerCase(),
        p_booking_id: booking.id,
        p_customer_phone: phone ? normalizePhone(dialCode, phone) : null,
      });
    }

    if (finalTotal <= 0) {
      // Server-side confirmation: confirm_voucher_booking recomputes the total,
      // verifies the vouchers actually cover it, reserves capacity, deducts the
      // vouchers and sets PAID — all atomically. Anon can no longer mark a booking
      // PAID directly, and capacity is checked before confirmation (never PAID on
      // a sold-out slot).
      const { data: confirmRes, error: confirmErr } = await supabase.rpc("confirm_voucher_booking", {
        p_booking_id: booking.id,
        p_voucher_ids: vouchers.map(v => v.id),
      });
      if (confirmErr || !confirmRes?.ok) {
        if (confirmRes?.error === "no_capacity") {
          await tenantSupabase.from("bookings").update({ status: "CANCELLED", cancellation_reason: "No capacity" }).eq("id", booking.id);
          setSoldOutMsg(confirmRes?.message || "This slot just sold out! Please select another time.");
          setSelectedSlot(null);
          setStep("calendar");
          setSubmitting(false);
          if (selectedTour) loadSlots(selectedTour.id);
          return;
        }
        showToast(confirmRes?.error === "insufficient_voucher"
          ? "Your voucher no longer covers the full amount. Please try again."
          : "We couldn't confirm your booking. Please try again.", "error");
        setSubmitting(false);
        return;
      }
      // Email customers any leftover voucher balance the server reported.
      const remainders: { code: string; remaining: number }[] = (confirmRes.remainders || []).map((r: { code: string; remaining: number }) => ({ code: r.code, remaining: Number(r.remaining) }));
      for (const r of remainders) {
        const used = vouchers.find(v => v.code === r.code);
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              type: "VOUCHER_BALANCE",
              data: {
                email: email.toLowerCase(),
                customer_name: name,
                voucher_code: r.code,
                original_value: used?.value ?? null,
                amount_used: used ? used.value - r.remaining : null,
                remaining_balance: r.remaining,
                booking_ref: booking.id.substring(0, 8).toUpperCase(),
                tour_name: selectedTour!.name,
                business_id: selectedTour!.business_id,
              },
            },
          });
        } catch (e) { console.error("VOUCHER_BALANCE_EMAIL_ERR:", e); }
      }
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
      clearLocalDraft(); setPaymentUrl("FREE"); setStep("payment"); setSubmitting(false); return;
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
      await tenantSupabase.from("bookings").update({ status: "CANCELLED", cancellation_reason: "No capacity" }).eq("id", booking.id);
      setSoldOutMsg(holdResult?.error || "This slot just sold out! Please select another time.");
      setSelectedSlot(null);
      setStep("calendar");
      setSubmitting(false);
      if (selectedTour) loadSlots(selectedTour.id);
      return;
    }
    await tenantSupabase.from("bookings").update({ status: "HELD" }).eq("id", booking.id);

    // skip_notifications: the customer is being redirected to the payment page
    // right now — emailing/WhatsApping them the same link is noise. If they
    // abandon, the hold-expiry sweep sends the follow-up instead.
    const yocoRes = await supabase.functions.invoke("create-checkout", {
      body: { booking_id: booking.id, amount: finalTotal, customer_name: name, qty, voucher_codes: vouchers.map(v => v.code), voucher_ids: vouchers.map(v => v.id), skip_notifications: true },
    });
    if (yocoRes.data?.redirectUrl) { clearLocalDraft(); setPaymentUrl(yocoRes.data.redirectUrl); setStep("payment"); }
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
        <button key={day} data-shot="calendar-day" disabled={past || !has} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
          className={"relative aspect-square rounded-full flex items-center justify-center text-[15px] font-extrabold transition-all outline-none " +
            (sel ? "bg-[color:var(--accent)] text-[color:var(--ink-on-main)] shadow-md scale-105 " : "") +
            (!sel && has && !past ? "bg-[color:var(--glass-tint-card)] text-[color:var(--ink)] border border-[color:var(--glass-border)] hover:bg-[color:var(--hover-overlay)] hover:shadow-sm cursor-pointer " : "") +
            (past || !has ? "text-[color:var(--ink-faint)] cursor-not-allowed bg-transparent " : "") +
            (isToday && !sel ? "ring-2 ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] ring-offset-2 " : "")}>
          {day}
          {has && !past && !sel && <span className={"absolute bottom-[4px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full " + (sel ? "bg-[color:var(--ink-on-main)]" : "bg-[color:var(--accent)]")} />}
        </button>
      );
    }
    const canPrev = calYear > today.getFullYear() || calMonth > today.getMonth();
    return (
      <div className="glass p-6" data-shot="calendar">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
            disabled={!canPrev} className="w-10 h-10 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full surface-muted flex items-center justify-center text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)] disabled:opacity-30 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-xl font-extrabold text-[color:var(--ink)] tracking-tight">{fmtMonth(new Date(calYear, calMonth))}</h3>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
            className="w-10 h-10 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full surface-muted flex items-center justify-center text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-3">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d} className="text-center text-[11px] font-bold text-[color:var(--ink-muted)] py-1 uppercase tracking-wider">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{cells}</div>
        <div className="flex items-center gap-5 mt-6 pt-5 border-t border-[color:var(--glass-border)] text-[12px] font-bold text-[color:var(--ink-muted)] justify-center">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[color:var(--accent)] inline-block shadow-sm" /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[color:var(--glass-border)] inline-block" /> Unavailable</span>
        </div>
      </div>
    );
  }

  if (loading) return <BookingFlowSkeleton />;

  if (tourNotFound) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">

      <h2 className="text-2xl font-bold text-[color:var(--ink)] mb-3">This tour is no longer available</h2>
      <p className="text-[color:var(--ink-muted)] mb-8">The tour you are looking for may have been removed or is currently unavailable. Check out our current adventures!</p>
      <Link href="/" className="btn btn-primary px-8 py-3">
        Browse Available Tours
      </Link>
    </div>
  );

  // Fix 3a: never render a booking flow for an operator that is not trading.
  // create-checkout would reject the payment anyway; failing here means the
  // customer finds out before filling in guest details, not after.
  if (!trading) return <TenantClosedNotice />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      {/* Progress */}
      <div className="flex items-center justify-between mb-10 glass !rounded-full p-2.5 max-w-lg mx-auto">
        {[{ l: "Date", s: "calendar" }, { l: "Details", s: "details" }, { l: "Pay", s: "payment" }].map((x, i) => {
          const steps = ["calendar", "details", "payment"];
          const ci = steps.indexOf(step);
          const active = i <= ci;
          const isDone = i < ci;
          return (
            <div key={x.l} className="flex items-center flex-1 last:flex-none">
              <div className={"flex items-center gap-2 " + (active ? "bg-[color:var(--accentSoft)] pl-2 pr-4 py-2 rounded-full" : "px-3")}>
                <div className={"w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 transition-all " + (active ? "bg-[color:var(--accent)] text-[color:var(--ink-on-main)] shadow-sm" : "bg-[color:var(--hover-overlay)] text-[color:var(--ink-muted)]")}>
                  {isDone ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : i + 1}
                </div>
                <span className={"text-[13px] tracking-wide " + (active ? "text-[color:var(--accent-text)] font-extrabold" : "text-[color:var(--ink-muted)] font-bold")}>{x.l}</span>
              </div>
              {i < 2 && <div className="flex-1 px-2"><div className={"h-0.5 w-full rounded-full " + (isDone ? "bg-[color:var(--accent)]" : "bg-[color:var(--glass-border)]")} /></div>}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Calendar */}
      {step === "calendar" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {soldOutMsg && (
            <div className="mb-6 p-5 glass flex items-start gap-4">

              <div className="flex-1 pt-0.5">
                <p className="text-[14px] font-bold text-[color:var(--ink)]">{soldOutMsg}</p>
                <p className="text-[13px] font-medium text-[color:var(--ink-muted)] mt-1">Available slots have been refreshed below so you can try again.</p>
              </div>
              <button onClick={() => setSoldOutMsg("")} className="w-8 h-8 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full flex items-center justify-center bg-[color:var(--hover-overlay)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink)] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          
          <div className="text-center mb-10 w-full flex flex-col items-center justify-center">
             {!embed && <Link href="/" className="glass-chip inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold text-[color:var(--ink-muted)] transition-colors mb-6 hover:shadow-md">
               Back to tours
             </Link>}
             {/* Only render once the tour row is loaded — "0 min · From R" placeholders read as broken */}
             {selectedTour && <div className="glass-chip inline-flex items-center gap-4 p-2 pr-6 mb-2">
               <div className="text-left">
                 <h3 className="font-extrabold text-[16px] text-[color:var(--ink)] leading-tight">{selectedTour?.name}</h3>
                 <p className="text-[color:var(--ink-muted)] text-[12px] font-bold mt-0.5">
                   {formatDuration(selectedTour?.duration_minutes)} &middot; {selectedSlot
                     ? <>{isLastMinute ? <span className="mr-1 line-through text-[color:var(--ink-faint)]">R{selectedTour?.base_price_per_person}</span> : null}R{effectiveUnitPrice} per person{isPeakPrice ? <span className="ml-1 inline-block rounded-full bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[color:var(--warning)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">Peak</span> : null}{isLastMinute ? <span className="ml-1 inline-block rounded-full bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[color:var(--success)] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">Last minute</span> : null}</>
                     : <>From R{selectedTour?.base_price_per_person} per person</>}
                 </p>
               </div>
             </div>}
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div>
              <h2 className="glass-chip mb-6 inline-block px-4 py-1.5 text-2xl font-extrabold tracking-tight text-[color:var(--ink)]">Pick a Date</h2>
              {renderCalendar()}
            </div>
            
            <div>
              <div className="glass-chip mb-5 inline-flex flex-col items-start !rounded-3xl px-4 py-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-[color:var(--ink)]">{selectedDate ? "Times for " + fmtDate(selectedDate.toISOString(), tz) : "Select timeslot"}</h2>
                <p className="text-xs font-medium text-[color:var(--ink-muted)]">All times shown in {tzAbbr}</p>
              </div>

              {!selectedDate ? (
                <div className="glass !border-dashed text-center py-16 px-6 flex flex-col items-center justify-center">

                  <p className="text-[14px] font-bold text-[color:var(--ink)]">No date selected</p>
                   <p className="text-[13px] font-medium text-[color:var(--ink-muted)] mt-1">Tap a highlighted date to see available times.</p>
                </div>
              ) : daySlots.length === 0 ? (
                <div className="glass !border-dashed text-center py-16 px-6 flex flex-col items-center justify-center">
                  <p className="text-[14px] font-bold text-[color:var(--ink)]">No times available</p>
                  <p className="text-[13px] font-medium text-[color:var(--ink-muted)] mt-1">Try selecting another date to proceed.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {daySlots.map((s: Slot) => {
                    const a = s.capacity_total - s.booked - (s.held || 0);
                    const isSel = selectedSlot?.id === s.id;
                    const lowThreshold = Math.max(3, Math.floor(s.capacity_total * 0.3));
                    const isVeryLow = a > 0 && a <= 3;
                    const isLow = a > 0 && a <= lowThreshold;
                    let badgeClass: string, badgeText: string;
                    if (isVeryLow) {
                      badgeClass = "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[color:var(--danger)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)]";
                      badgeText = a === 1 ? "Last spot!" : "Only " + a + " left!";
                    } else if (isLow) {
                      badgeClass = "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[color:var(--warning)] border border-[color-mix(in_srgb,var(--warning)_30%,transparent)]";
                      badgeText = a + " left";
                    } else {
                      badgeClass = "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[color:var(--success)] border border-[color-mix(in_srgb,var(--success)_30%,transparent)]";
                      badgeText = a + " spots";
                    }
                    return (
                      <button key={s.id} data-slot-id={s.id} data-slot-date={s.start_time} onClick={() => setSelectedSlot(s)}
                        aria-label={fmtTime(s.start_time, tz) + ", " + a + " spots " + (isLow ? "remaining, book soon" : "available")}
                        className={"w-full text-left rounded-[1.5rem] p-5 transition-all outline-none flex items-center gap-4 group " + (isSel ? "border-2 border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--ink-on-main)] shadow-lg overflow-hidden relative" : "glass !rounded-[1.5rem] hover:shadow-md")}>
                        {isSel && <div className="absolute inset-0 bg-[color:var(--main-overlay)] mix-blend-overlay"></div>}

                        <div className="flex-1 min-w-0 relative z-10">
                           <p className={"text-[18px] font-extrabold leading-tight " + (isSel ? "text-[color:var(--ink-on-main)]" : "text-[color:var(--ink)]")}>{fmtTime(s.start_time, tz)}
                             {s.last_minute_at && s.price_per_person_override != null ? <span className="ml-2 align-middle inline-block rounded-full bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[color:var(--success)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">R{s.price_per_person_override} last minute</span> : null}
                           </p>
                           <p className={"text-[12px] font-bold mt-0.5 " + (isSel ? "text-[color:var(--ink-on-main)] opacity-80" : isVeryLow ? "text-[color:var(--danger)]" : isLow ? "text-[color:var(--warning)]" : "text-[color:var(--ink-muted)]")}>{a} {a === 1 ? "spot" : "spots"} remaining</p>
                        </div>
                        <div className="shrink-0 relative z-10" data-shot="seat-count">
                          {isSel ? (
                            <span className="bg-[color-mix(in_srgb,var(--ink-on-main)_20%,transparent)] text-[color:var(--ink-on-main)] pl-2 pr-3 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 border border-[color-mix(in_srgb,var(--ink-on-main)_20%,transparent)]">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              Selected
                            </span>
                          ) : (
                            <span className={"text-[11px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-full " + badgeClass}>
                              {badgeText}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                     {selectedSlot && (
                    <div className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-2">
                      {/* Qty Selector */}
                      <div className="glass p-5">
                        <label className="block text-[14px] font-extrabold text-[color:var(--ink)] mb-3">Number of Guests</label>
                        <div className="flex items-center gap-5">
                          <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 surface-muted rounded-[1.125rem] flex items-center justify-center text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)] hover:text-[color:var(--ink)] transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                          </button>
                          <span className="text-3xl font-extrabold w-10 text-center text-[color:var(--ink)]">{qty}</span>
                          <button onClick={() => setQty(Math.min(avail, qty + 1))} className="w-12 h-12 surface-muted rounded-[1.125rem] flex items-center justify-center text-[color:var(--ink-muted)] hover:bg-[color:var(--hover-overlay)] hover:text-[color:var(--ink)] transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                          </button>
                          <span className="text-[13px] font-bold text-[color:var(--ink-muted)] ml-2">max {avail} limit</span>
                        </div>
                      </div>

                      {/* Extras & Add-Ons Selector */}
                      {availableAddOns.length > 0 && (
                        <div className="glass p-5">
                          <label className="block text-[14px] font-extrabold text-[color:var(--ink)] tracking-wide mb-3 uppercase">Extras & Add-Ons</label>
                          <div className="space-y-3">
                            {availableAddOns.map(ao => {
                              const isSelected = !!selectedAddOns[ao.id];
                              const percentage = Math.round((ao.price / baseTotal) * 100);
                              const contrastLabel = percentage > 0 ? ` (just ${percentage}% of booking)` : "";
                              return (
                                <div key={ao.id} data-shot="addon-row" className={"rounded-[1.25rem] p-3.5 transition-all " + (isSelected ? "border-2 border-[color:var(--accent)] bg-[color:var(--accentSoft)]" : "surface-muted !rounded-[1.25rem] hover:bg-[color:var(--hover-overlay)]")}>
                                  <div className="flex items-start gap-3">
                                    <input type="checkbox" checked={isSelected} onChange={() => toggleAddOn(ao.id)}
                                      className="mt-1 w-5 h-5 shrink-0 rounded border-[color:var(--glass-border)] text-[color:var(--accent)] focus:ring-[color:var(--accent)] cursor-pointer" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between">
                                        <span className="text-[14px] font-bold text-[color:var(--ink)]">{ao.name}</span>
                                        <span className="text-[13px] font-extrabold text-[color:var(--accent-text)] bg-[color:var(--accentSoft)] px-2 py-0.5 rounded-full shrink-0 ml-2">
                                          +R{ao.price}{contrastLabel}
                                        </span>
                                      </div>
                                      {ao.description && <p className="text-[12px] text-[color:var(--ink-muted)] mt-1 font-medium leading-relaxed">{ao.description}</p>}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="flex items-center gap-2.5 mt-3 ml-8 surface-muted p-1.5 w-max !rounded-full">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink-muted)] ml-1.5">Qty</span>
                                      <button onClick={() => setAddOnQty(ao.id, (selectedAddOns[ao.id] || 1) - 1)}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-[color:var(--ink-muted)] bg-[color:var(--hover-overlay)] hover:text-[color:var(--ink)] transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                                      </button>
                                      <span className="text-[13px] font-extrabold w-5 text-center text-[color:var(--ink)]">{selectedAddOns[ao.id]}</span>
                                      <button onClick={() => setAddOnQty(ao.id, (selectedAddOns[ao.id] || 1) + 1)}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-[color:var(--ink-muted)] bg-[color:var(--hover-overlay)] hover:text-[color:var(--ink)] transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Brief Reciprocity/Endowment Pricing Summary */}
                      <div className="glass p-5">
                        <div className="space-y-2 text-[14px]">
                          <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-bold">Base Price ({qty} Guests)</span><span className="font-extrabold text-[color:var(--ink)]">R{baseTotal}</span></div>
                          {addOnsTotal > 0 && (
                            <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-bold">Selected Extras</span><span className="font-extrabold text-[color:var(--accent-text)]">+R{addOnsTotal}</span></div>
                          )}
                          <div className="border-t border-[color:var(--glass-border)] pt-3 mt-3 flex justify-between items-end">
                            <span className="text-[13px] font-extrabold uppercase tracking-widest text-[color:var(--ink-muted)]">Subtotal</span>
                            <span className="text-2xl font-extrabold tracking-tight text-[color:var(--ink)]" data-shot="running-total">R{grandTotal}</span>
                          </div>
                        </div>
                      </div>

                      <button onClick={() => { setHoldExpiresAt(new Date(Date.now() + 15 * 60 * 1000)); setStep("details"); }} className="btn btn-primary w-full !py-4 text-[15px] group">
                        Continue to Details
                      </button>
                    </div>
                  )}
                  
                  <p className="text-[12px] font-bold text-[color:var(--ink-muted)] mt-2 flex items-center justify-center gap-1.5 text-center">
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
          <button onClick={() => { setHoldExpiresAt(null); setStep("calendar"); }} className="flex items-center gap-1.5 text-[13px] font-bold text-[color:var(--ink-muted)] mb-6 hover:text-[color:var(--ink)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Back to calendar
          </button>
          {holdExpiresAt && (
            <HoldCountdown expiresAt={holdExpiresAt} onExpire={() => {
              setHoldExpiresAt(null);
              setSelectedSlot(null);
              setStep("calendar");
              setSoldOutMsg("Your seat hold expired. Please pick another time.");
              if (selectedTour) loadSlots(selectedTour.id);
            }} />
          )}
          <h2 className="text-3xl font-extrabold text-[color:var(--ink)] mb-8 tracking-tight pl-2">Complete Booking</h2>
          <div className="grid md:grid-cols-5 gap-8 lg:gap-12">
            <div className="md:col-span-3 space-y-6">

              {/* Personal Details */}
              <div className="glass p-6 space-y-5">
                 <h3 className="text-[14px] font-extrabold text-[color:var(--ink)] tracking-wide mb-2 uppercase">Your Details</h3>
                 <div>
                   <label htmlFor="book-name" className="field-label ml-1">Full Name *</label>
                   <input id="book-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                     className="field" />
                 </div>
                 <div>
                   <label htmlFor="book-email" className="field-label ml-1">Email Address *</label>
                   <input id="book-email" type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={saveDraft} placeholder="john@example.com"
                     className="field" />
                 </div>
                 <div>
                   <label htmlFor="book-phone" className="field-label ml-1">Phone *</label>
                   <div className="flex gap-2">
                     <select value={dialCode} onChange={e => setDialCode(e.target.value)} aria-label="Country dial code"
                       className="field !w-auto shrink-0 cursor-pointer !px-2.5" style={{ minWidth: "96px" }}>
                       {DIAL_CODES.map((d, i) => <option key={d.country + i} value={d.code}>{d.flag} {d.code}</option>)}
                     </select>
                     <input id="book-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="71 234 5678"
                       className="field min-w-0 flex-1" />
                   </div>
                 </div>
                 <div className="pt-1">
                   <label className="flex items-center gap-2.5 cursor-pointer select-none">
                     <input type="checkbox" checked={isCompany} onChange={e => setIsCompany(e.target.checked)}
                       className="h-4 w-4 rounded border-[color:var(--glass-border)] text-[color:var(--accent)] focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]" />
                     <span className="text-[13px] font-bold text-[color:var(--ink-muted)]">Booking on behalf of a company? Add invoice details</span>
                   </label>
                 </div>
                 {isCompany && (
                   <>
                     <div>
                       <label htmlFor="book-company" className="field-label ml-1">Company Name</label>
                       <input id="book-company" type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme (Pty) Ltd"
                         className="field" />
                     </div>
                     <div>
                       <label htmlFor="book-vat" className="field-label ml-1">VAT Number</label>
                       <input id="book-vat" type="text" value={vatNumber} onChange={e => setVatNumber(e.target.value)} placeholder="4XXXXXXXXX"
                         className="field" />
                     </div>
                   </>
                 )}
              </div>

              {/* Discounts Block */}
              <div className="glass p-6 space-y-6">
                 <div>
                   <label htmlFor="book-promo" className="block text-[14px] font-extrabold text-[color:var(--ink)] tracking-wide mb-3 uppercase">Promo Code</label>
                   {!appliedPromo ? (
                     <>
                       <div className="flex gap-2">
                         <input id="book-promo" data-shot="promo-input" type="text" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="e.g. SUMMER20"
                           className="field flex-1 pl-4 font-bold uppercase tracking-wider placeholder:normal-case placeholder:font-medium"
                           onKeyDown={e => e.key === "Enter" && applyPromo()} />
                         <button onClick={applyPromo} className="btn btn-primary px-6">Apply</button>
                       </div>
                       {promoError && <p className="text-[color:var(--danger)] text-[12px] font-bold mt-2 ml-1">{promoError}</p>}
                     </>
                   ) : (
                     <div className="flex items-center justify-between bg-[color:var(--accentSoft)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-5 py-4 rounded-full">
                       <div className="flex items-center gap-3">
                         <span className="text-[14px] text-[color:var(--accent-text)] font-extrabold">
                           {appliedPromo.code} <span className="text-[color:var(--accent-text)] opacity-70 ml-1 font-bold">({appliedPromo.discount_type === "PERCENT" ? appliedPromo.discount_value + "% off" : "R" + appliedPromo.discount_value + " off"})</span>
                         </span>
                       </div>
                       <button onClick={removePromo} className="text-[color:var(--ink-muted)] bg-[color:var(--glass-tint-card)] hover:bg-[color:var(--hover-overlay)] hover:text-[color:var(--danger)] w-8 h-8 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full flex items-center justify-center transition-colors">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                     </div>
                   )}
                 </div>

                 <div className="pt-6 border-t border-[color:var(--glass-border)]">
                   <label htmlFor="book-voucher" className="block text-[14px] font-extrabold text-[color:var(--ink)] tracking-wide mb-3 uppercase">Gift Voucher</label>
                   <div className="flex gap-2">
                     <input id="book-voucher" type="text" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" maxLength={8}
                       className="field flex-1 font-bold font-mono tracking-widest uppercase placeholder:normal-case placeholder:font-medium placeholder:tracking-normal" />
                     <button onClick={applyVoucher} className="btn btn-primary px-6">Apply</button>
                   </div>
                   {voucherError && <p className="text-[color:var(--danger)] text-[12px] font-bold mt-2 ml-1">{voucherError}</p>}
                   {vouchers.map((v, i) => {
                     const b = voucherBreakdown[i];
                     return (
                       <div key={v.code} className="flex items-center justify-between mt-3 bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_30%,transparent)] px-5 py-4 rounded-full">
                         <div className="flex items-center gap-3">
                           <span className="text-[14px] text-[color:var(--ink)] font-extrabold font-mono tracking-widest">
                             {v.code}
                             <span className="font-sans text-[color:var(--success)] tracking-normal ml-2">
                               : R{b?.applied ?? v.value} applied{b && b.leftover > 0 ? ` · R${b.leftover} remaining` : ""}
                             </span>
                           </span>
                         </div>
                         <button onClick={() => removeVoucher(i)} className="text-[color:var(--ink-muted)] bg-[color:var(--glass-tint-card)] hover:bg-[color:var(--hover-overlay)] hover:text-[color:var(--danger)] w-8 h-8 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 rounded-full flex items-center justify-center transition-colors">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                       </div>
                     );
                   })}
                 </div>
              </div>

              <div className="mt-4 p-5 glass flex items-start gap-4">
                <div className="flex-1 pt-0.5">
                  <p className="text-[14px] font-extrabold text-[color:var(--ink)]">Waiver Required</p>
                  <p className="text-[13px] font-medium text-[color:var(--ink-muted)] mt-1">All participants must complete a digital waiver before arriving. A secure link will be included in your confirmation email.</p>
                </div>
              </div>
              
              <label className="flex items-start gap-4 mt-6 cursor-pointer group glass p-5 transition-colors">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 shrink-0 rounded text-[color:var(--accent)] focus:ring-[color:var(--accent)] cursor-pointer" />
                <span className="text-[13px] font-bold text-[color:var(--ink-muted)] leading-relaxed group-hover:text-[color:var(--ink)] transition-colors">
                  I accept the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent-text)] underline">Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[color:var(--accent-text)] underline">Privacy Policy</a>.
                </span>
              </label>

              <label className="flex items-start gap-4 mt-3 cursor-pointer group glass p-5 transition-colors">
                <input type="checkbox" checked={marketingOptIn} onChange={e => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 w-5 h-5 shrink-0 rounded text-[color:var(--accent)] focus:ring-[color:var(--accent)] cursor-pointer" />
                <span className="text-[13px] font-bold text-[color:var(--ink-muted)] leading-relaxed group-hover:text-[color:var(--ink)] transition-colors">I agree to receive booking updates and occasional promotions by email and SMS. You can opt out at any time.</span>
              </label>
            </div>
            
            {/* Sticky Order Summary */}
            <div className="md:col-span-2">
              <div className="glass-sheet !rounded-[20px] p-7 pb-[calc(1.75rem+env(safe-area-inset-bottom))] sticky top-6">
                <h3 className="text-[18px] font-extrabold mb-6 tracking-tight">Booking Summary</h3>
                <div className="space-y-4 text-[14px]">
                  <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-bold">Tour</span><span className="font-extrabold text-right">{selectedTour?.name}</span></div>
                  <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-bold">Date</span><span className="font-extrabold text-right">{selectedSlot && fmtDate(selectedSlot.start_time, tz)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-bold">Time</span><span className="font-extrabold text-right">{selectedSlot && fmtTime(selectedSlot.start_time, tz)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-bold">Guests</span><span className="font-extrabold text-right">{qty}</span></div>

                  <div className="border-t border-[color:var(--glass-border)] pt-4 mt-4 space-y-3">
                    <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-medium tracking-wide">R{effectiveUnitPrice} × {qty}{isPeakPrice ? <span className="ml-1.5 inline-block rounded-full bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] text-[color:var(--warning)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Peak</span> : null}</span><span className="font-extrabold text-[15px]">R{baseTotal}</span></div>
                    {availableAddOns.filter(ao => selectedAddOns[ao.id]).map(ao => (
                      <div key={ao.id} className="flex justify-between items-center text-[color:var(--accent-text)]">
                        <span className="font-medium tracking-wide">{ao.name}{selectedAddOns[ao.id] > 1 ? ` × ${selectedAddOns[ao.id]}` : ""}</span>
                        <span className="font-extrabold text-[15px]">R{ao.price * selectedAddOns[ao.id]}</span>
                      </div>
                    ))}
                    {computedPromoDiscount > 0 && appliedPromo && (
                      <div className="flex justify-between items-center text-[color:var(--accent-text)]" data-shot="discount-line">
                        <span className="font-medium tracking-wide">Discount ({appliedPromo.code}) {appliedPromo.discount_type === "PERCENT" ? appliedPromo.discount_value + "%" : ""}</span>
                        <span className="font-extrabold text-[15px]">−R{computedPromoDiscount}</span>
                      </div>
                    )}
                    {effectiveVoucherCredit > 0 && (
                      <div className="flex justify-between items-center text-[color:var(--success)]">
                        <span className="font-medium tracking-wide">Voucher Credit</span>
                        <span className="font-extrabold text-[15px]">−R{effectiveVoucherCredit}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[color:var(--glass-border)] pt-5 mt-5">
                    <div className="flex justify-between items-end">
                       <span className="text-[14px] font-extrabold uppercase tracking-widest text-[color:var(--ink-muted)] mb-1">Total</span>
                       <span className="text-3xl font-extrabold tracking-tight">{finalTotal <= 0 ? "FREE" : "R" + finalTotal}</span>
                    </div>
                  </div>
                </div>

                <button onClick={submitBooking} data-shot="pay-button" disabled={submitting || !name.trim() || !email.trim() || !phone.trim() || !termsAccepted}
                  className="btn btn-primary w-full mt-8 !py-4 text-[15px]">
                  {submitting ? "Processing..." : finalTotal <= 0 ? "Confirm Booking ✓" : "Pay R" + finalTotal + " now →"}
                </button>
                <div className="surface-muted !rounded-full flex items-center justify-center gap-2 mt-4 px-4 py-2 text-[11px] font-bold text-[color:var(--ink-muted)] uppercase tracking-widest">
                  Yoco Secure Payment
                </div>
                <div className="mt-4 space-y-2 text-[12px] text-[color:var(--ink-muted)]">
                  <div className="flex items-center gap-2">
                    <span>Card details handled directly by Yoco and never touch our servers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Processed by a PCI DSS compliant provider over encrypted TLS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Flexible cancellation policy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Confirmation email sent within 1 minute</span>
                  </div>
                  {theme.refund_policy_text && (
                    <details className="mt-2 text-[11px] text-[color:var(--ink-muted)]">
                      <summary className="cursor-pointer underline decoration-dotted">Cancellation policy</summary>
                      <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{theme.refund_policy_text}</p>
                    </details>
                  )}
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
            <div className="glass p-8 flex flex-col items-center">
              <h2 className="text-3xl font-extrabold text-[color:var(--ink)] mb-2 tracking-tight">You&apos;re All Set!</h2>
              <p className="text-[15px] font-bold text-[color:var(--ink-muted)] mb-8">Booking confirmed. Your itinerary is on its way.</p>

              <div className="w-full surface-muted p-6 text-left mb-8 space-y-3 text-[14px]">
                <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-extrabold uppercase tracking-wider text-[11px]">Reference Tag</span><span className="font-mono font-bold text-[color:var(--ink)] bg-[color:var(--glass-tint-card)] px-2 py-0.5 rounded shadow-sm border border-[color:var(--glass-border)]">{bookingRef}</span></div>
                <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-extrabold uppercase tracking-wider text-[11px]">Tour</span><span className="font-extrabold text-[color:var(--ink)]">{selectedTour?.name}</span></div>
                <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-extrabold uppercase tracking-wider text-[11px]">Date</span><span className="font-extrabold text-[color:var(--ink)]">{selectedSlot && fmtDate(selectedSlot.start_time, tz)}</span></div>
                <div className="flex justify-between items-center"><span className="text-[color:var(--ink-muted)] font-extrabold uppercase tracking-wider text-[11px]">Time / Guests</span><span className="font-extrabold text-[color:var(--ink)]">{selectedSlot && fmtTime(selectedSlot.start_time, tz)} &middot; {qty} Guests</span></div>
              </div>

              {voucherRemainders.length > 0 && (
                <div className="w-full bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] rounded-[1.5rem] p-6 text-left mb-8 relative overflow-hidden">
                  <p className="text-[14px] font-extrabold text-[color:var(--success)] tracking-wide uppercase mb-3 relative z-10">Voucher Credit Return</p>
                  {voucherRemainders.map((vr) => (
                    <div key={vr.code} className="flex flex-col mb-2 last:mb-0 relative z-10">
                      <span className="font-mono font-bold text-[color:var(--ink-muted)] mb-0.5">Code: {vr.code}</span>
                      <span className="text-2xl font-extrabold tracking-tight text-[color:var(--success)]">R{vr.remaining} remaining</span>
                    </div>
                  ))}
                  <p className="text-[12px] font-bold text-[color:var(--ink-muted)] mt-4 leading-snug relative z-10">Use your remaining balance on your next adventure. Details sent to your email.</p>
                </div>
              )}

              {waiverUrl && (
                <div className="w-full bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] border border-[color-mix(in_srgb,var(--warning)_25%,transparent)] rounded-[1.5rem] p-6 text-left mb-8 flex flex-col items-start">
                  <p className="text-[15px] font-extrabold text-[color:var(--ink)] mb-1">Sign Waiver Document</p>
                  <p className="text-[13px] font-bold text-[color:var(--ink-muted)] mb-5 leading-relaxed">It is mandatory for all group members to sign the safety waiver. Complete it now to save time.</p>
                  <a href={waiverUrl} className="btn btn-primary w-full !py-3.5">Review & Sign Documents</a>
                </div>
              )}

              <div className="w-full flex flex-col gap-3">
                <a href="/my-bookings" target={embed ? "_blank" : undefined} className="btn btn-primary w-full !py-4 text-[15px]">Manage this booking</a>
                {!embed && <Link href="/" className="btn btn-secondary w-full !py-4 text-[15px]">Browse other tours</Link>}
              </div>
            </div>
          ) : (
            <div className="glass p-8 flex flex-col items-center">
              <h2 className="text-3xl font-extrabold text-[color:var(--ink)] mb-2 tracking-tight">Finalizing Checkout</h2>
              {holdExpiresAt ? (
                <div className="mb-4 mt-2">
                  <HoldCountdown expiresAt={holdExpiresAt} onExpire={() => {
                    setHoldExpiresAt(null);
                    setSelectedSlot(null);
                    setPaymentUrl("");
                    setStep("calendar");
                    setSoldOutMsg("Your seat hold expired. Please pick another time.");
                    if (selectedTour) loadSlots(selectedTour.id);
                  }} />
                </div>
              ) : (
                <p className="text-[14px] font-bold text-[color:var(--ink-muted)] mb-6">Spots are held exclusively for 15 minutes.</p>
              )}

              <div className="surface-muted w-full py-6 mb-8 text-center">
                 <p className="text-[12px] font-extrabold uppercase tracking-widest text-[color:var(--ink-muted)] mb-1">Payload Total</p>
                 <p className="text-5xl font-extrabold tracking-tighter text-[color:var(--ink)]">R{finalTotal}</p>
              </div>

              <a href={paymentUrl} onClick={embed ? (e) => { e.preventDefault(); if (window.top) window.top.location.href = paymentUrl; else window.location.href = paymentUrl; } : undefined} className="btn btn-primary w-full !py-4 text-[16px]">Proceed to Secure Portal &rarr;</a>
              <div className="surface-muted !rounded-full flex items-center justify-center gap-2 mt-6 px-4 py-2 text-[11px] font-bold text-[color:var(--ink-muted)] uppercase tracking-widest">
                Regulated via Yoco · Ref: {bookingRef}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Reviews Feed */}
      {reviews.length > 0 && step === "calendar" && (
        <div className="mt-12 animate-in fade-in duration-500">
          <h2 className="text-xl font-extrabold text-[color:var(--ink)] mb-6 text-center tracking-tight">What Others Say</h2>
          <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
            {reviews.map(r => (
              <div key={r.id} className="glass p-5">
                <div className="flex items-center gap-3 mb-2">
                  {r.reviewer_avatar_url ? (
                    <img src={r.reviewer_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full surface-muted flex items-center justify-center text-[color:var(--ink-muted)] text-xs font-bold">
                      {(r.reviewer_name || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-[color:var(--ink)] text-sm truncate block">{r.reviewer_name || "Guest"}</span>
                    <span className="text-[color:var(--warning)] text-xs">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </div>
                  {r.source === "GOOGLE" && (
                    <span className="text-[10px] font-semibold text-[color:var(--ink-muted)] surface-muted !rounded-full px-2 py-0.5">Google</span>
                  )}
                </div>
                {r.comment && <p className="text-[13px] text-[color:var(--ink-muted)] leading-relaxed line-clamp-3">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}

export default function BookPage() {
  return (<Suspense fallback={<BookingFlowSkeleton />}><BookingFlow /></Suspense>);
}
