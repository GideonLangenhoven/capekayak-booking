"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { normalizePhone } from "../lib/phone";
import { getTimeTier, getHrsBefore } from "./constants";
import type { Booking, Slot, BookingLog } from "../lib/types";

import LoginScreen from "./LoginScreen";
import RescheduleFlow from "./RescheduleFlow";
import BookingCard from "./BookingCard";
import EditGuestsModal from "./modals/EditGuestsModal";
import ContactModal from "./modals/ContactModal";
import SpecialRequestModal from "./modals/SpecialRequestModal";
import CancelModal from "./modals/CancelModal";
import VoucherCheckerModal from "./modals/VoucherCheckerModal";

/* ═══════════════════════════════════════════════════════
   TOAST BANNER (kept inline — 12 lines, specific positioning)
   ═══════════════════════════════════════════════════════ */
function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
  if (!message) return null;
  var bg = type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800";
  return (
    <div className={"mb-4 p-4 rounded-xl border text-sm " + bg + " flex items-start gap-3"}>
      <span className="shrink-0 mt-0.5">{type === "success" ? "\u2705" : "\u274C"}</span>
      <p className="flex-1 font-medium">{message}</p>
      <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function MyBookings() {
  // Login — restore from sessionStorage if available
  var [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("mb_email") || "";
    return "";
  });
  var [dialCode, setDialCode] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("mb_dialCode") || "+27";
    return "+27";
  });
  var [phoneDigits, setPhoneDigits] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("mb_phone") || "";
    return "";
  });
  var [loggedIn, setLoggedIn] = useState(false);
  var [bookings, setBookings] = useState<Booking[]>([]);
  var [loading, setLoading] = useState(false);
  var [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  var [emailError, setEmailError] = useState("");
  var [phoneError, setPhoneError] = useState("");
  var [loginError, setLoginError] = useState("");

  // OTP verification
  var [otpStep, setOtpStep] = useState(false);
  var [otpToken, setOtpToken] = useState("");
  var [otpCode, setOtpCode] = useState("");
  var [otpError, setOtpError] = useState("");
  var [otpSending, setOtpSending] = useState(false);
  var [otpVerifying, setOtpVerifying] = useState(false);
  var [otpSentAt, setOtpSentAt] = useState(0);
  var [resendCountdown, setResendCountdown] = useState(0);

  // Feedback
  var [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  var [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reschedule
  var [rescheduling, setRescheduling] = useState<Booking | null>(null);
  var [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  var [loadingSlots, setLoadingSlots] = useState(false);
  var [rebookConfirmSlot, setRebookConfirmSlot] = useState<Slot | null>(null);
  var [excessAction, setExcessAction] = useState("VOUCHER");
  var [reschedulePaymentUrl, setReschedulePaymentUrl] = useState("");
  var [reschedulePaymentDiff, setReschedulePaymentDiff] = useState(0);

  // Edit guests modal
  var [editGuestsBooking, setEditGuestsBooking] = useState<Booking | null>(null);
  var [guestQty, setGuestQty] = useState(1);
  var [guestExcessAction, setGuestExcessAction] = useState("VOUCHER");
  var [guestVoucherCode, setGuestVoucherCode] = useState("");
  var [guestVoucherApplied, setGuestVoucherApplied] = useState<{ code: string; balance: number } | null>(null);
  var [guestVoucherError, setGuestVoucherError] = useState("");
  var [guestPromoCode, setGuestPromoCode] = useState("");
  var [guestPromoApplied, setGuestPromoApplied] = useState<{ id: string; code: string; discount_type: string; discount_value: number } | null>(null);
  var [guestPromoError, setGuestPromoError] = useState("");

  // Contact details modal
  var [contactBooking, setContactBooking] = useState<Booking | null>(null);
  var [contactName, setContactName] = useState("");
  var [contactEmail, setContactEmail] = useState("");
  var [contactPhone, setContactPhone] = useState("");

  // Special request modal
  var [requestBooking, setRequestBooking] = useState<Booking | null>(null);
  var [specialRequest, setSpecialRequest] = useState("");

  // Cancel modal
  var [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  // C9: Countdown timer tick
  var [countdownTick, setCountdownTick] = useState(0);

  // C11: Voucher balance checker
  var [voucherCode, setVoucherCode] = useState("");
  var [voucherResult, setVoucherResult] = useState<{ code: string; status: string; current_balance: number; expires_at?: string | null } | null>(null);
  var [voucherLoading, setVoucherLoading] = useState(false);
  var [voucherError, setVoucherError] = useState("");

  // C4: Trip photos
  var [tripPhotos, setTripPhotos] = useState<Record<string, string[]>>({});

  // C7: Booking logs / timeline
  var [bookingLogs, setBookingLogs] = useState<Record<string, BookingLog[]>>({});
  var [expandedTimeline, setExpandedTimeline] = useState<Record<string, boolean>>({});

  // C10: Meeting point / what to bring
  var [expandedWhatToBring, setExpandedWhatToBring] = useState<Record<string, boolean>>({});

  // Tab navigation
  var [activeTab, setActiveTab] = useState<"bookings" | "vouchers">("bookings");

  // C14: Payment polling
  var [paymentPending, setPaymentPending] = useState<string | null>(null);
  var paymentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ───── Auto-login from session ───── */
  useEffect(() => {
    if (autoLoginAttempted || loggedIn) return;
    setAutoLoginAttempted(true);
    if (typeof window !== "undefined" && sessionStorage.getItem("mb_loggedIn") === "1" && email && phoneDigits) {
      lookupBookings();
    }
  }, [autoLoginAttempted, loggedIn, email, phoneDigits]);

  /* ───── C9: Countdown interval ───── */
  useEffect(() => {
    if (!loggedIn || bookings.length === 0) return;
    var interval = setInterval(() => setCountdownTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [loggedIn, bookings.length]);

  /* ───── C14: Payment polling cleanup ───── */
  useEffect(() => {
    return () => {
      if (paymentPollRef.current) clearInterval(paymentPollRef.current);
    };
  }, []);

  /* ───── Toast helper ───── */
  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    if (type === "success") setTimeout(() => setToast(null), 8000);
  }

  /* ───── Edge function caller ───── */
  async function callRebook(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    var resp = await supabase.functions.invoke("rebook-booking", { body });
    if (resp.error) {
      var msg = "Something went wrong. Please try again.";
      try {
        if (resp.error && typeof (resp.error as Record<string, unknown>).context === "object") {
          var ctx = (resp.error as Record<string, unknown>).context as { json?: () => Promise<{ error?: string }> } | null;
          if (ctx && typeof ctx.json === "function") {
            var parsed = await ctx.json();
            if (parsed?.error) msg = parsed.error;
          }
        } else if (resp.data && typeof resp.data === "object" && (resp.data as Record<string, unknown>).error) {
          msg = (resp.data as Record<string, unknown>).error as string;
        } else if (resp.error.message && resp.error.message !== "non-2xx status code") {
          msg = resp.error.message;
        }
      } catch (_) { void _; }
      throw new Error(msg);
    }
    if ((resp.data as Record<string, unknown>)?.error) throw new Error((resp.data as Record<string, unknown>).error as string);
    return resp.data as Record<string, unknown>;
  }

  /* ───── Resend cooldown timer ───── */
  useEffect(() => {
    if (!otpSentAt) return;
    var update = () => { var left = Math.max(0, 60 - Math.floor((Date.now() - otpSentAt) / 1000)); setResendCountdown(left); };
    update();
    var iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [otpSentAt]);

  /* ───── Send OTP ───── */
  var sendOtp = useCallback(async function () {
    if (!email.trim() || !phoneDigits.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Please enter a valid email"); return; }
    var cleanDigits = phoneDigits.replace(/\D/g, "");
    if (cleanDigits.length < 6 || cleanDigits.length > 12) { setPhoneError("Please enter a valid phone number"); return; }
    setEmailError(""); setPhoneError(""); setLoginError(""); setOtpError("");
    setOtpSending(true);
    var norm = normalizePhone(dialCode, phoneDigits);
    var phoneTail = norm.replace(/\D/g, "").slice(-9);
    try {
      var resp = await supabase.functions.invoke("send-otp", {
        body: { action: "send", email: email.toLowerCase(), phone_tail: phoneTail },
      });
      if (resp.error || !(resp.data as Record<string, unknown>)?.success) {
        var errMsg = "Something went wrong. Please try again.";
        if (resp.data && typeof resp.data === "object" && (resp.data as Record<string, unknown>).error) {
          errMsg = (resp.data as Record<string, unknown>).error as string;
        }
        setLoginError(errMsg);
        setOtpSending(false);
        return;
      }
      setOtpToken((resp.data as Record<string, unknown>).token as string);
      setOtpStep(true);
      setOtpCode("");
      setOtpSentAt(Date.now());
    } catch {
      setLoginError("Failed to send verification code. Please try again.");
    }
    setOtpSending(false);
  }, [email, phoneDigits, dialCode]);

  /* ───── Verify OTP then load bookings ───── */
  var verifyOtp = useCallback(async function () {
    if (!otpToken || !otpCode.trim()) return;
    setOtpError("");
    setOtpVerifying(true);
    try {
      var resp = await supabase.functions.invoke("send-otp", {
        body: { action: "verify", token: otpToken, code: otpCode.trim() },
      });
      var respData = (resp.data || {}) as Record<string, unknown>;
      if (!respData.verified) {
        setOtpError(String(respData.error || "Invalid code. Please try again."));
        setOtpVerifying(false);
        return;
      }
      // OTP verified — now load bookings
      await lookupBookings();
    } catch {
      setOtpError("Verification failed. Please try again.");
    }
    setOtpVerifying(false);
  }, [otpToken, otpCode]);

  /* ───── Lookup bookings (called after OTP verified) ───── */
  var lookupBookings = useCallback(async function () {
    setLoading(true);
    var norm = normalizePhone(dialCode, phoneDigits);
    var phoneTail = norm.replace(/\D/g, "").slice(-9);
    var { data } = await supabase.from("bookings")
      .select("id, business_id, customer_name, email, phone, qty, total_amount, status, refund_status, refund_amount, created_at, unit_price, tour_id, slot_id, custom_fields, converted_to_voucher_id, cancelled_at, cancellation_reason, waiver_status, waiver_token, yoco_payment_id, slots(start_time, capacity_total, booked, held), tours(name, description, duration_minutes)")
      .eq("email", email.toLowerCase()).order("created_at", { ascending: false });
    var matched = (data || []).filter(function (b) {
      var rawPhone = (b.phone || "").replace(/\D/g, "");
      if (!rawPhone) return true;
      return rawPhone.slice(-9) === phoneTail;
    });
    if (matched.length === 0) {
      setLoginError("No bookings found for this email and phone combination.");
      setLoading(false);
      return;
    }
    data = matched;
    setBookings(data as unknown as Booking[]);
    setLoggedIn(true);
    setLoading(false);
    // Persist session so navigating away and back stays logged in
    sessionStorage.setItem("mb_email", email.toLowerCase());
    sessionStorage.setItem("mb_dialCode", dialCode);
    sessionStorage.setItem("mb_phone", phoneDigits);
    sessionStorage.setItem("mb_loggedIn", "1");

    // C4: Fetch trip photos for completed bookings
    var completedSlotIds = (data as unknown as Booking[])
      .filter((b) => b.status === "COMPLETED" || (["PAID", "CONFIRMED"].includes(b.status) && getTimeTier(b) === "PAST"))
      .map((b) => b.slot_id)
      .filter(Boolean);
    if (completedSlotIds.length > 0) {
      var { data: photos } = await supabase.from("trip_photos")
        .select("id, photo_urls, slot_id")
        .in("slot_id", completedSlotIds);
      if (photos && photos.length > 0) {
        var photoMap: Record<string, string[]> = {};
        for (var p of photos) {
          if (p.slot_id && p.photo_urls) {
            if (!photoMap[p.slot_id]) photoMap[p.slot_id] = [];
            photoMap[p.slot_id] = photoMap[p.slot_id].concat(Array.isArray(p.photo_urls) ? p.photo_urls : [p.photo_urls]);
          }
        }
        setTripPhotos(photoMap);
      }
    }

    // C7: Fetch booking logs
    var bookingIds = (data as unknown as Booking[]).map((b: Booking) => b.id);
    if (bookingIds.length > 0) {
      var { data: logs } = await supabase.from("logs")
        .select("id, booking_id, action, created_at, details")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: true });
      if (logs && logs.length > 0) {
        var logMap: Record<string, BookingLog[]> = {};
        for (var l of logs) {
          if (!logMap[l.booking_id]) logMap[l.booking_id] = [];
          logMap[l.booking_id].push(l);
        }
        setBookingLogs(logMap);
      }
    }
  }, [email, phoneDigits, dialCode]);

  /* ───── C11: Voucher balance check ───── */
  async function checkVoucherBalance() {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError("");
    setVoucherResult(null);
    var { data, error } = await supabase.from("vouchers")
      .select("code, status, current_balance, expires_at")
      .eq("code", voucherCode.trim().toUpperCase())
      .maybeSingle();
    if (error || !data) {
      setVoucherError("Voucher not found. Please check the code and try again.");
    } else {
      setVoucherResult(data);
    }
    setVoucherLoading(false);
  }

  /* ───── C14: Start payment polling ───── */
  function startPaymentPolling(bookingId: string) {
    setPaymentPending(bookingId);
    var attempts = 0;
    if (paymentPollRef.current) clearInterval(paymentPollRef.current);
    paymentPollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 12) {
        if (paymentPollRef.current) clearInterval(paymentPollRef.current);
        setPaymentPending(null);
        return;
      }
      var { data } = await supabase.from("bookings")
        .select("status")
        .eq("id", bookingId)
        .maybeSingle();
      if (data && ["PAID", "CONFIRMED"].includes(data.status)) {
        if (paymentPollRef.current) clearInterval(paymentPollRef.current);
        setPaymentPending(null);
        showToast("Payment confirmed! Your booking is updated.");
        lookupBookings();
      }
    }, 10000);
  }

  /* ───── Admin review (locked bookings) ───── */
  async function requestAdminReview(b: Booking, action: string) {
    if (!confirm("Your trip is within 12 hours. Send a request to our team?")) return;
    setActionLoading(b.id);
    var hrs = getHrsBefore(b);
    await supabase.from("chat_messages").insert({
      business_id: b.business_id,
      phone: b.phone,
      direction: "IN",
      body: "[URGENT] Request to " + action.toUpperCase() + " booking " + b.id.substring(0, 8).toUpperCase() + " (Trip in " + Math.round(hrs) + "h). Customer: " + b.customer_name,
      sender: b.customer_name,
    });
    showToast("Request sent! Our team will get back to you shortly.");
    setActionLoading(null);
  }

  /* ───── Reschedule ───── */
  async function startReschedule(b: Booking) {
    setRescheduling(b);
    setLoadingSlots(true);
    var now = new Date();
    var cutoff = new Date(Date.now() + 60 * 60 * 1000);
    var later = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    var { data } = await supabase.from("slots").select("*, tours(name, base_price_per_person)")
      .eq("status", "OPEN").eq("tour_id", b.tour_id)
      .gt("start_time", cutoff.toISOString()).lt("start_time", later.toISOString())
      .order("start_time", { ascending: true });
    setRescheduleSlots(((data || []) as unknown as Slot[]).filter((s) => s.capacity_total - s.booked - (s.held || 0) >= b.qty && s.id !== b.slot_id));
    setLoadingSlots(false);
  }

  async function submitReschedule() {
    if (!rescheduling || !rebookConfirmSlot) return;
    setActionLoading("reschedule");
    try {
      var result = await callRebook({
        booking_id: rescheduling.id,
        action: "RESCHEDULE",
        new_slot_id: rebookConfirmSlot.id,
        excess_action: excessAction,
      });
      if ((result.diff as number) > 0 && result.payment_url) {
        setReschedulePaymentUrl(result.payment_url as string);
        setReschedulePaymentDiff(result.diff as number);
        startPaymentPolling(rescheduling.id);
        setActionLoading(null);
        return;
      } else if (result.voucher_code) {
        showToast("Rescheduled! Voucher " + result.voucher_code + " for R" + result.voucher_amount + " sent to you.");
      } else {
        showToast("Booking rescheduled successfully!");
      }
      setRescheduling(null); setRebookConfirmSlot(null); setRescheduleSlots([]);
      lookupBookings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    }
    setActionLoading(null);
  }

  /* ───── Edit guests ───── */
  function openEditGuests(b: Booking) {
    setEditGuestsBooking(b);
    setGuestQty(b.qty);
    setGuestExcessAction("VOUCHER");
    setGuestVoucherCode(""); setGuestVoucherApplied(null); setGuestVoucherError("");
    setGuestPromoCode(""); setGuestPromoApplied(null); setGuestPromoError("");
  }

  async function applyGuestVoucher() {
    if (!guestVoucherCode.trim()) return;
    setGuestVoucherError("");
    var code = guestVoucherCode.toUpperCase().replace(/\s/g, "");
    if (code.length !== 8) { setGuestVoucherError("Codes are 8 characters"); return; }
    var { data } = await supabase.from("vouchers").select("*").eq("code", code).single();
    if (!data) { setGuestVoucherError("Code not found"); return; }
    if (data.status === "REDEEMED") { setGuestVoucherError("Already redeemed"); return; }
    if (data.status !== "ACTIVE") { setGuestVoucherError("Not valid"); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { setGuestVoucherError("Expired"); return; }
    var bal = Number(data.current_balance ?? data.value ?? data.purchase_amount ?? 0);
    if (bal <= 0) { setGuestVoucherError("No balance remaining"); return; }
    setGuestVoucherApplied({ code, balance: bal });
    setGuestVoucherCode("");
  }

  async function applyGuestPromo() {
    if (!guestPromoCode.trim() || !editGuestsBooking) return;
    setGuestPromoError("");
    var code = guestPromoCode.toUpperCase().trim();
    var { data: promo } = await supabase.from("promotions").select("*").eq("code", code).eq("business_id", editGuestsBooking.business_id).maybeSingle();
    if (!promo) { setGuestPromoError("Code not found"); return; }
    if (!promo.active) { setGuestPromoError("No longer active"); return; }
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) { setGuestPromoError("Expired"); return; }
    if (promo.max_uses != null && promo.used_count >= promo.max_uses) { setGuestPromoError("Usage limit reached"); return; }
    setGuestPromoApplied({ id: promo.id, code: promo.code, discount_type: promo.discount_type, discount_value: Number(promo.discount_value) });
    setGuestPromoCode("");
  }

  async function submitEditGuests() {
    if (!editGuestsBooking || guestQty === editGuestsBooking.qty) { setEditGuestsBooking(null); return; }
    var b = editGuestsBooking;
    setActionLoading("guests");
    try {
      if (guestQty > b.qty) {
        var result = await callRebook({ booking_id: b.id, action: "ADD_GUESTS", new_qty: guestQty });
        if (result.payment_url) {
          showToast((guestQty - b.qty) + " guest(s) added! Pay R" + result.diff + " to confirm.");
          window.open(result.payment_url as string, "_blank");
          startPaymentPolling(b.id);
        } else {
          showToast("Guests added!");
        }
      } else {
        var result2 = await callRebook({ booking_id: b.id, action: "REMOVE_GUESTS", new_qty: guestQty, excess_action: guestExcessAction });
        if (result2.voucher_code) {
          showToast("Guests removed. Voucher " + result2.voucher_code + " for R" + result2.voucher_amount + " sent to you.");
        } else if (result2.refund_amount) {
          showToast("Guests removed. Refund of R" + Number(result2.refund_amount).toFixed(2) + " requested.");
        } else {
          showToast("Guests updated!");
        }
      }
      setEditGuestsBooking(null);
      lookupBookings();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Something went wrong", "error"); }
    setActionLoading(null);
  }

  /* ───── Contact details ───── */
  function openContactDetails(b: Booking) {
    setContactBooking(b); setContactName(b.customer_name || ""); setContactEmail(b.email || ""); setContactPhone(b.phone || "");
  }
  async function submitContactDetails() {
    if (!contactBooking) return;
    setActionLoading("contact");
    try {
      await callRebook({ booking_id: contactBooking.id, action: "UPDATE_CONTACT", contact_name: contactName, contact_email: contactEmail, contact_phone: normalizePhone(dialCode, contactPhone) });
      showToast("Contact details updated!");
      setContactBooking(null);
      lookupBookings();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Something went wrong", "error"); }
    setActionLoading(null);
  }

  /* ───── Special request ───── */
  function openSpecialRequest(b: Booking) {
    setRequestBooking(b); setSpecialRequest((b.custom_fields?.special_requests) || "");
  }
  async function submitSpecialRequest() {
    if (!requestBooking || !specialRequest.trim()) return;
    setActionLoading("request");
    try {
      await callRebook({ booking_id: requestBooking.id, action: "SPECIAL_REQUEST", special_requests: specialRequest });
      showToast("Special request saved!");
      setRequestBooking(null);
      lookupBookings();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Something went wrong", "error"); }
    setActionLoading(null);
  }

  /* ───── Cancel with refund ───── */
  async function submitCancelRefund() {
    if (!cancelTarget) return;
    setActionLoading("cancel");
    try {
      var result = await callRebook({ booking_id: cancelTarget.id, action: "CANCEL_REFUND" });
      if (result.voucher_code) {
        showToast("Your booking has been cancelled. A voucher of R" + result.voucher_amount + " has been issued. Code: " + result.voucher_code);
      } else if (result.manual_refund || result.refund_type === "MANUAL_EFT_REQUIRED") {
        showToast("Your booking has been cancelled. A manual refund will be processed by the team.");
      } else if (result.refund_amount != null) {
        showToast("Cancelled. Refund of R" + Number(result.refund_amount).toFixed(2) + " requested (5-7 business days).");
      } else {
        showToast("Your booking has been cancelled.");
      }
      setCancelTarget(null);
      lookupBookings();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Something went wrong", "error"); }
    setActionLoading(null);
  }

  /* ───── Cancel with voucher ───── */
  async function submitCancelVoucher() {
    if (!cancelTarget) return;
    setActionLoading("cancel");
    try {
      var result = await callRebook({ booking_id: cancelTarget.id, action: "CANCEL_VOUCHER" });
      showToast("Converted to voucher! Code: " + result.voucher_code + " (R" + result.voucher_amount + ")");
      setCancelTarget(null);
      lookupBookings();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Something went wrong", "error"); }
    setActionLoading(null);
  }

  /* ───── Claim credit ───── */
  async function handleClaimCredit(b: Booking, creditAction: "VOUCHER" | "REFUND") {
    setActionLoading(b.id);
    try {
      var res = await callRebook({ booking_id: b.id, action: "CLAIM_CREDIT", credit_action: creditAction });
      if (creditAction === "VOUCHER") {
        showToast("Voucher issued! Code: " + (res.voucher_code || "Check your email") + " for R" + Number(b.refund_amount).toFixed(2));
      } else {
        showToast("Refund of R" + (res.refund_amount ? Number(res.refund_amount).toFixed(2) : (Number(b.refund_amount) * 0.95).toFixed(2)) + " requested. Please allow 5-10 business days.");
      }
      lookupBookings();
    } catch (e: unknown) { showToast((e instanceof Error ? e.message : null) || "Failed to claim credit", "error"); }
    setActionLoading(null);
  }

  /* ═══════════════════════════════════════════════════════
     RESCHEDULE FLOW
     ═══════════════════════════════════════════════════════ */
  if (rescheduling) {
    return (
      <RescheduleFlow
        rescheduling={rescheduling}
        rebookConfirmSlot={rebookConfirmSlot}
        setRebookConfirmSlot={setRebookConfirmSlot}
        rescheduleSlots={rescheduleSlots}
        loadingSlots={loadingSlots}
        excessAction={excessAction}
        setExcessAction={setExcessAction}
        actionLoading={actionLoading}
        reschedulePaymentUrl={reschedulePaymentUrl}
        reschedulePaymentDiff={reschedulePaymentDiff}
        onCancel={() => { setRescheduling(null); setRescheduleSlots([]); setReschedulePaymentUrl(""); setReschedulePaymentDiff(0); }}
        onSubmit={submitReschedule}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════
     LOGIN SCREEN
     ═══════════════════════════════════════════════════════ */
  if (!loggedIn) {
    return (
      <LoginScreen
        email={email} setEmail={setEmail}
        dialCode={dialCode} setDialCode={setDialCode}
        phoneDigits={phoneDigits} setPhoneDigits={setPhoneDigits}
        emailError={emailError} setEmailError={setEmailError}
        phoneError={phoneError} setPhoneError={setPhoneError}
        loginError={loginError} setLoginError={setLoginError}
        loading={loading}
        otpStep={otpStep}
        otpCode={otpCode} setOtpCode={setOtpCode}
        otpError={otpError}
        otpSending={otpSending}
        otpVerifying={otpVerifying}
        resendCountdown={resendCountdown}
        onSendOtp={sendOtp}
        onVerifyOtp={verifyOtp}
        onResendOtp={sendOtp}
        onBackToEmail={() => { setOtpStep(false); setOtpToken(""); setOtpCode(""); setOtpError(""); setOtpSentAt(0); }}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════
     BOOKINGS LIST
     ═══════════════════════════════════════════════════════ */
  var upcoming = bookings.filter(b => ["PAID", "CONFIRMED", "HELD", "PENDING"].includes(b.status) && getTimeTier(b) !== "PAST");
  var past = bookings.filter(b => b.status === "COMPLETED" || b.status === "EXPIRED" || (["PAID", "CONFIRMED"].includes(b.status) && getTimeTier(b) === "PAST"));
  var cancelled = bookings.filter(b => b.status === "CANCELLED");

  var cardProps = {
    countdownTick, paymentPending, actionLoading, tripPhotos, bookingLogs,
    expandedTimeline, setExpandedTimeline, expandedWhatToBring, setExpandedWhatToBring,
    onReschedule: startReschedule, onEditGuests: openEditGuests,
    onContactDetails: openContactDetails, onSpecialRequest: openSpecialRequest,
    onCancel: setCancelTarget, onAdminReview: requestAdminReview,
    onClaimCredit: handleClaimCredit,
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="app-container max-w-5xl px-4 pt-6 lg:pt-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 lg:mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xl shrink-0">
              {email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold">CapeKayak Family</p>
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight truncate tracking-tight">
                Hi, {email.split('@')[0]}!
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setLoggedIn(false); setBookings([]); setEmail(""); setDialCode("+27"); setPhoneDigits(""); setLoginError(""); setToast(null); sessionStorage.removeItem("mb_loggedIn"); sessionStorage.removeItem("mb_email"); sessionStorage.removeItem("mb_dialCode"); sessionStorage.removeItem("mb_phone"); }}
              className="w-10 h-10 shrink-0 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors border border-slate-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-6 items-start">
           {/* Left Column */}
           <div className="lg:col-span-5 space-y-6">
              {/* Quick Actions / Steps */}
              <div>
                <h2 className="text-sm font-bold text-slate-800 mb-3 ml-1">Get started with these simple steps</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 px-1 snap-x hide-scrollbar">
                   <Link href="/" className="snap-start shrink-0 w-[110px] bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <span className="text-[13px] font-bold text-slate-700 leading-tight">Book Trips</span>
                   </Link>
                   <Link href="/contact" className="snap-start shrink-0 w-[110px] bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center gap-3 hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <span className="text-[13px] font-bold text-slate-700 leading-tight">Contact Team</span>
                   </Link>
                </div>
              </div>

              {/* Toast */}
              {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

              {/* Wallet / Vouchers styled */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <p className="text-[13px] font-bold text-slate-500 mb-1">Your Wallet</p>
                <div className="flex items-end justify-between mb-4">
                   <h3 className="text-3xl font-extrabold text-slate-900 leading-none">
                       {voucherResult ? `R${voucherResult.current_balance}` : 'R0.00'}
                   </h3>
                   <div className="flex items-center gap-2">
                      {voucherResult ? (
                         <button onClick={() => { setVoucherResult(null); setVoucherCode(""); }} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">
                           Clear
                         </button>
                      ) : (
                         <button onClick={checkVoucherBalance} disabled={voucherLoading || !voucherCode.trim()} className="px-4 py-2 bg-teal-800 text-white font-bold rounded-xl text-sm shadow-sm hover:bg-teal-900 transition-colors disabled:opacity-50">
                           Check
                         </button>
                      )}
                   </div>
                </div>
                
                {!voucherResult ? (
                   <div className="flex items-center gap-3">
                       <input 
                         type="text" 
                         value={voucherCode} 
                         onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(""); }} 
                         onKeyDown={e => e.key === "Enter" && checkVoucherBalance()}
                         placeholder="Enter voucher code" 
                         className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium tracking-wider outline-none focus:border-teal-500 transition-colors uppercase"
                       />
                   </div>
                ) : (
                   <div className="flex items-center justify-between text-sm py-2 px-3 bg-teal-50 text-teal-800 rounded-lg">
                      <span className="font-medium">Active Voucher Code:</span>
                      <span className="font-mono font-bold">{voucherResult.code}</span>
                   </div>
                )}
                {voucherError && <p className="text-xs text-red-500 mt-2 ml-1 font-medium">{voucherError}</p>}
              </div>
           </div>

           {/* Right Column */}
           <div className="lg:col-span-7">
              {/* Notifications / Bookings list */}
              <div>
                 <div className="flex justify-between items-center mb-4 px-1">
                    <h2 className="text-sm font-bold text-slate-800">Notifications</h2>
                    <Link href="/" className="text-[13px] text-teal-700 font-bold hover:text-teal-800">View all</Link>
                 </div>
                 
                 <div className="space-y-4">
                    {bookings.length === 0 ? (
                       <div className="bg-orange-50 rounded-[1.5rem] p-6 shadow-sm border border-orange-100/50 flex flex-col items-center">
                          <p className="text-[14px] text-orange-800 font-semibold mb-1">No upcoming trips yet.</p>
                          <p className="text-[13px] text-orange-700/80 mb-4">Time to plan your next adventure!</p>
                          <Link href="/" className="inline-block px-5 py-2.5 bg-orange-100 text-orange-800 font-bold rounded-xl text-[13px] hover:bg-orange-200 transition-colors shadow-sm">Explore Tours</Link>
                       </div>
                    ) : (
                       <>
                         {upcoming.length > 0 && upcoming.map(b => <BookingCard key={b.id} b={b} {...cardProps} />)}
                         {past.length > 0 && past.map(b => <BookingCard key={b.id} b={b} {...cardProps} />)}
                         {cancelled.length > 0 && cancelled.map(b => <BookingCard key={b.id} b={b} {...cardProps} />)}
                       </>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* MODALS */}
      <EditGuestsModal
        booking={editGuestsBooking} guestQty={guestQty} setGuestQty={setGuestQty}
        guestExcessAction={guestExcessAction} setGuestExcessAction={setGuestExcessAction}
        actionLoading={actionLoading} onClose={() => setEditGuestsBooking(null)} onSubmit={submitEditGuests}
        voucherCode={guestVoucherCode} setVoucherCode={setGuestVoucherCode}
        voucherApplied={guestVoucherApplied} voucherError={guestVoucherError}
        onApplyVoucher={applyGuestVoucher} onRemoveVoucher={() => setGuestVoucherApplied(null)}
        promoCode={guestPromoCode} setPromoCode={setGuestPromoCode}
        promoApplied={guestPromoApplied} promoError={guestPromoError}
        onApplyPromo={applyGuestPromo} onRemovePromo={() => setGuestPromoApplied(null)}
      />
      <ContactModal
        open={!!contactBooking} contactName={contactName} setContactName={setContactName}
        contactEmail={contactEmail} setContactEmail={setContactEmail}
        contactPhone={contactPhone} setContactPhone={setContactPhone}
        actionLoading={actionLoading} onClose={() => setContactBooking(null)} onSubmit={submitContactDetails}
      />
      <SpecialRequestModal
        open={!!requestBooking} specialRequest={specialRequest} setSpecialRequest={setSpecialRequest}
        actionLoading={actionLoading} onClose={() => setRequestBooking(null)} onSubmit={submitSpecialRequest}
      />
      <CancelModal
        booking={cancelTarget} actionLoading={actionLoading}
        onClose={() => setCancelTarget(null)} onCancelRefund={submitCancelRefund} onCancelVoucher={submitCancelVoucher}
      />
    </div>
  );
}
