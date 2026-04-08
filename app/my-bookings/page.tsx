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
    <div className="app-container max-w-xl page-wrap py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[color:var(--text)]">{activeTab === "bookings" ? "My Bookings" : "My Vouchers"}</h2>
          <p className="text-xs text-[color:var(--textMuted)] mt-0.5">{email}</p>
        </div>
        <button onClick={() => { setLoggedIn(false); setBookings([]); setEmail(""); setDialCode("+27"); setPhoneDigits(""); setLoginError(""); setToast(null); sessionStorage.removeItem("mb_loggedIn"); sessionStorage.removeItem("mb_email"); sessionStorage.removeItem("mb_dialCode"); sessionStorage.removeItem("mb_phone"); }}
          className="text-xs text-[color:var(--textMuted)] hover:text-[color:var(--text)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[color:var(--surface2)]">
          Log out
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[color:var(--surface2)] rounded-xl p-1">
        <button onClick={() => setActiveTab("bookings")}
          className={"flex-1 py-2 text-sm font-medium rounded-lg transition-all " + (activeTab === "bookings" ? "bg-[color:var(--surface)] text-[color:var(--text)] shadow-sm" : "text-[color:var(--textMuted)] hover:text-[color:var(--text)]")}>
          Bookings
        </button>
        <button onClick={() => { setActiveTab("vouchers"); setVoucherResult(null); setVoucherError(""); }}
          className={"flex-1 py-2 text-sm font-medium rounded-lg transition-all " + (activeTab === "vouchers" ? "bg-[color:var(--surface)] text-[color:var(--text)] shadow-sm" : "text-[color:var(--textMuted)] hover:text-[color:var(--text)]")}>
          Vouchers
        </button>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* VOUCHERS TAB */}
      {activeTab === "vouchers" && (
        <VoucherCheckerModal
          voucherCode={voucherCode} setVoucherCode={setVoucherCode}
          voucherResult={voucherResult} voucherLoading={voucherLoading}
          voucherError={voucherError} setVoucherError={setVoucherError}
          checkVoucherBalance={checkVoucherBalance}
        />
      )}

      {/* BOOKINGS TAB */}
      {activeTab === "bookings" && (
        <>
          {bookings.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[color:var(--textMuted)] mb-4">No bookings found.</p>
              <Link href="/" className="btn btn-primary">Browse Tours</Link>
            </div>
          ) : (
            <div className="space-y-6">
              {upcoming.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-[color:var(--textMuted)] uppercase tracking-wider mb-3">Upcoming</h3>
                  <div className="space-y-3">{upcoming.map(b => <BookingCard key={b.id} b={b} {...cardProps} />)}</div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-[color:var(--textMuted)] uppercase tracking-wider mb-3">Past Trips</h3>
                  <div className="space-y-3">{past.map(b => <BookingCard key={b.id} b={b} {...cardProps} />)}</div>
                </section>
              )}
              {cancelled.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-[color:var(--textMuted)] uppercase tracking-wider mb-3">Cancelled</h3>
                  <div className="space-y-3">{cancelled.map(b => <BookingCard key={b.id} b={b} {...cardProps} />)}</div>
                </section>
              )}
            </div>
          )}
        </>
      )}

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
