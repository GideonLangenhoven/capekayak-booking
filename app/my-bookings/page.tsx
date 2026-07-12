"use client";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createScopedSupabase, createTenantSupabase, createVoucherSupabase, supabase } from "../lib/supabase";
import Link from "next/link";
import { normalizePhone } from "../lib/phone";
import { useTheme } from "../components/ThemeProvider";
import { getTimeTier, getHrsBefore } from "./constants";
import type { Booking, Slot, BookingLog } from "../lib/types";

import LoginScreen from "./LoginScreen";
import RescheduleFlow from "./RescheduleFlow";
import BookingCard from "./BookingCard";
import ProfileTab from "./ProfileTab";
import EditGuestsModal from "./modals/EditGuestsModal";
import ContactModal from "./modals/ContactModal";
import ContactUsModal from "./modals/ContactUsModal";
import SpecialRequestModal from "./modals/SpecialRequestModal";
import CancelModal from "./modals/CancelModal";

/* ═══════════════════════════════════════════════════════
   TOAST — floating, token-themed, never shifts layout
   ═══════════════════════════════════════════════════════ */
function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
  if (!message) return null;
  const tone = type === "success" ? "var(--success)" : "var(--danger)";
  return (
    <div className="toast-enter fixed inset-x-4 top-4 z-[70] mx-auto max-w-md" role={type === "error" ? "alert" : "status"}>
      <div
        className="flex items-start gap-3 rounded-xl border px-4 py-3.5"
        style={{
          background: `color-mix(in srgb, ${tone} 8%, var(--surface))`,
          borderColor: `color-mix(in srgb, ${tone} 30%, transparent)`,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <svg className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tone }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {type === "success"
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
        </svg>
        <p className="flex-1 text-[13.5px] font-medium text-[color:var(--text)]">{message}</p>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-[color:var(--textMuted)] transition-colors hover:text-[color:var(--text)]">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--textMuted)]">{children}</h2>;
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function MyBookings() {
  const theme = useTheme();
  const tenantSupabase = useMemo(() => createTenantSupabase(theme.id), [theme.id]);
  // Login — restore from sessionStorage if available
  const [email, setEmail] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("mb_email") || "";
    return "";
  });
  const [dialCode, setDialCode] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("mb_dialCode") || "+27";
    return "+27";
  });
  const [phoneDigits, setPhoneDigits] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("mb_phone") || "";
    return "";
  });
  const [loggedIn, setLoggedIn] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [authSession, setAuthSession] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loginError, setLoginError] = useState("");

  // OTP verification
  const [otpStep, setOtpStep] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSentAt, setOtpSentAt] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reschedule
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [rescheduleQty, setRescheduleQty] = useState(1);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rebookConfirmSlot, setRebookConfirmSlot] = useState<Slot | null>(null);
  const [excessAction, setExcessAction] = useState("VOUCHER");
  const [reschedulePaymentUrl, setReschedulePaymentUrl] = useState("");
  const [reschedulePaymentDiff, setReschedulePaymentDiff] = useState(0);

  // Edit guests modal
  const [editGuestsBooking, setEditGuestsBooking] = useState<Booking | null>(null);
  const [guestQty, setGuestQty] = useState(1);
  const [guestExcessAction, setGuestExcessAction] = useState("VOUCHER");
  const [guestVoucherCode, setGuestVoucherCode] = useState("");
  const [guestVoucherApplied, setGuestVoucherApplied] = useState<{ code: string; balance: number } | null>(null);
  const [guestVoucherError, setGuestVoucherError] = useState("");
  const [guestPromoCode, setGuestPromoCode] = useState("");
  const [guestPromoApplied, setGuestPromoApplied] = useState<{ id: string; code: string; discount_type: string; discount_value: number } | null>(null);
  const [guestPromoError, setGuestPromoError] = useState("");
  const [guestPaymentUrl, setGuestPaymentUrl] = useState("");
  const [guestPaymentAmount, setGuestPaymentAmount] = useState(0);

  // Contact details modal
  const [contactBooking, setContactBooking] = useState<Booking | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Special request modal
  const [requestBooking, setRequestBooking] = useState<Booking | null>(null);
  const [specialRequest, setSpecialRequest] = useState("");

  // Contact Us modal
  const [contactUsOpen, setContactUsOpen] = useState(false);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [refundCalcs, setRefundCalcs] = useState<Record<string, { percent: number; amount: number }>>({});

  // C9: Countdown timer tick
  const [countdownTick, setCountdownTick] = useState(0);

  // C11: Voucher balance checker
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherResult, setVoucherResult] = useState<{ code: string; status: string; current_balance: number; expires_at?: string | null } | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState("");

  // C4: Trip photos
  const [tripPhotos, setTripPhotos] = useState<Record<string, string[]>>({});

  // C7: Booking logs / timeline
  const [bookingLogs, setBookingLogs] = useState<Record<string, BookingLog[]>>({});
  const [expandedTimeline, setExpandedTimeline] = useState<Record<string, boolean>>({});

  // C10: Meeting point / what to bring
  const [expandedWhatToBring, setExpandedWhatToBring] = useState<Record<string, boolean>>({});

  // Tab navigation
  const [activeTab, setActiveTab] = useState<"trips" | "profile">("trips");

  // Profile
  const [customer, setCustomer] = useState<any>(null);
  const [authUser, setAuthUser] = useState<any>(null);

  // C14: Payment polling
  const [paymentPending, setPaymentPending] = useState<string | null>(null);
  const paymentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ───── Check for active Supabase auth session ───── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setAuthSession(true);
      }
      setSessionChecked(true);
    });
  }, []);

  /* ───── Auto-resume from stored customer-session token (OTP path) ───── */
  // After a successful OTP login we store an HMAC-signed token in
  // localStorage. On every page load we replay it to my-bookings-lookup
  // so the customer doesn't have to re-OTP for 30 days.
  useEffect(() => {
    if (loggedIn) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem("mb_customer_session");
      const storedEmail = localStorage.getItem("mb_customer_email");
      const expRaw = localStorage.getItem("mb_customer_session_exp");
      if (!token || !storedEmail) return;
      const exp = Number(expRaw || 0);
      if (exp && exp < Date.now()) {
        localStorage.removeItem("mb_customer_session");
        localStorage.removeItem("mb_customer_email");
        localStorage.removeItem("mb_customer_session_exp");
        return;
      }
      try {
        // Send the phone tail proven at OTP time: the server's booking filter
        // drops phone-bearing bookings when the tail is missing, which made a
        // reload after an OTP login show "No bookings found".
        const storedTail = localStorage.getItem("mb_customer_phone_tail") || "";
        const resp = await supabase.functions.invoke("my-bookings-lookup", {
          body: {
            customer_session: token,
            email: storedEmail,
            business_id: theme.id,
            ...(storedTail ? { phone_tail: storedTail } : {}),
          },
        });
        if (cancelled) return;
        const respData = (resp.data || {}) as Record<string, unknown>;
        if (resp.error || !respData.success) {
          // Token rejected — drop it so the user falls through to the login form.
          localStorage.removeItem("mb_customer_session");
          localStorage.removeItem("mb_customer_email");
          localStorage.removeItem("mb_customer_session_exp");
          return;
        }
        setEmail(storedEmail);
        applyLookupResponse(respData, true);
        await loadBookingExtras((respData.bookings || []) as unknown as Booking[]);
      } catch { /* network blip — silent, user can still log in manually */ }
    })();
    return () => { cancelled = true; };
  }, [loggedIn, theme.id]);

  /* ───── Auto-login from session ───── */
  useEffect(() => {
    if (!sessionChecked || autoLoginAttempted || loggedIn) return;
    setAutoLoginAttempted(true);
    if (authSession && email) {
      lookupBookings(true);
      return;
    }
  }, [sessionChecked, autoLoginAttempted, loggedIn, email, phoneDigits, authSession]);

  /* ───── Fetch customer profile (auth-session users only) ───── */
  useEffect(() => {
    if (!authSession || !loggedIn || bookings.length === 0 || customer) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setAuthUser(session.user);
      const bizId = bookings[0]?.business_id;
      if (!bizId) return;
      const { data } = await tenantSupabase.from("customers")
        .select("id, email, name, phone, date_of_birth, marketing_consent, total_bookings, total_spent, first_booking_at, created_at")
        .eq("business_id", bizId)
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) setCustomer(data);
    })();
  }, [tenantSupabase, authSession, loggedIn, bookings, customer]);

  /* ───── C9: Countdown interval ───── */
  useEffect(() => {
    if (!loggedIn || bookings.length === 0) return;
    const interval = setInterval(() => setCountdownTick(t => t + 1), 60000);
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
    // rebook-booking requires proof of ownership: the OTP-issued customer
    // session token (magic-link users are covered by their Supabase Auth JWT,
    // which functions.invoke attaches automatically).
    let customerSession: string | null = null;
    try { customerSession = localStorage.getItem("mb_customer_session"); } catch { /* private mode */ }
    const payload = customerSession ? { customer_session: customerSession, ...body } : body;
    const resp = await supabase.functions.invoke("rebook-booking", { body: payload });
    if (resp.error) {
      let msg = "Something went wrong. Please try again.";
      try {
        if (resp.error && typeof (resp.error as Record<string, unknown>).context === "object") {
          const ctx = (resp.error as Record<string, unknown>).context as { json?: () => Promise<{ error?: string }> } | null;
          if (ctx && typeof ctx.json === "function") {
            const parsed = await ctx.json();
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
    const update = () => { const left = Math.max(0, 60 - Math.floor((Date.now() - otpSentAt) / 1000)); setResendCountdown(left); };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [otpSentAt]);

  /* ───── Send OTP ───── */
  const sendOtp = useCallback(async function () {
    if (!email.trim() || !phoneDigits.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Please enter a valid email"); return; }
    const cleanDigits = phoneDigits.replace(/\D/g, "");
    if (cleanDigits.length < 6 || cleanDigits.length > 12) { setPhoneError("Please enter a valid phone number"); return; }
    setEmailError(""); setPhoneError(""); setLoginError(""); setOtpError("");
    setOtpSending(true);
    const norm = normalizePhone(dialCode, phoneDigits);
    const phoneTail = norm.replace(/\D/g, "").slice(-9);
    try {
      const resp = await supabase.functions.invoke("send-otp", {
        body: { action: "send", email: email.toLowerCase(), phone_tail: phoneTail, business_id: theme.id },
      });
      if (resp.error || !(resp.data as Record<string, unknown>)?.success) {
        let errMsg = "Something went wrong. Please try again.";
        if (resp.data && typeof resp.data === "object" && (resp.data as Record<string, unknown>).error) {
          errMsg = (resp.data as Record<string, unknown>).error as string;
        } else if (resp.error && typeof (resp.error as Record<string, unknown>).context === "object") {
          // Non-2xx (e.g. 429 rate limit): supabase-js puts the body on error.context.
          const ctx = (resp.error as Record<string, unknown>).context as { json?: () => Promise<{ error?: string }> } | null;
          try {
            if (ctx && typeof ctx.json === "function") {
              const parsed = await ctx.json();
              if (parsed?.error) errMsg = parsed.error;
            }
          } catch { /* fall back to generic */ }
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
  }, [email, phoneDigits, dialCode, theme.id]);

  /* ───── Verify OTP then load bookings ───── */
  const verifyOtp = useCallback(async function () {
    if (!otpToken || !otpCode.trim()) return;
    setOtpError("");
    setOtpVerifying(true);
    try {
      const resp = await supabase.functions.invoke("my-bookings-lookup", {
        body: {
          token: otpToken,
          code: otpCode.trim(),
          email: email.toLowerCase(),
          business_id: theme.id,
        },
      });
      const respData = (resp.data || {}) as Record<string, unknown>;
      if (resp.error || !respData.success) {
        setOtpError(String(respData.error || "Invalid code. Please try again."));
        setOtpVerifying(false);
        return;
      }
      applyLookupResponse(respData, false);
      await loadBookingExtras((respData.bookings || []) as unknown as Booking[]);
    } catch {
      setOtpError("Verification failed. Please try again.");
    }
    setOtpVerifying(false);
  }, [otpToken, otpCode, email, theme.id]);

  function applyLookupResponse(respData: Record<string, unknown>, emailOnly?: boolean) {
    const data = Array.isArray(respData.bookings) ? respData.bookings : [];
    if (data.length === 0) {
      setLoginError(emailOnly ? "No bookings found for this email." : "No bookings found for this email and phone combination.");
      setLoading(false);
      return false;
    }
    setBookings(data as unknown as Booking[]);
    setLoggedIn(true);
    setLoading(false);
    // Keep last-tab inputs handy for resend flows etc.
    sessionStorage.setItem("mb_email", email.toLowerCase());
    sessionStorage.setItem("mb_dialCode", dialCode);
    sessionStorage.setItem("mb_phone", phoneDigits);
    // Persist a customer-session token to localStorage so reloading or
    // navigating away & back keeps the customer signed in for 30 days.
    if (typeof respData.customer_session === "string" && respData.customer_session) {
      try {
        localStorage.setItem("mb_customer_session", respData.customer_session as string);
        localStorage.setItem("mb_customer_email", email.toLowerCase());
        if (typeof respData.customer_session_expires_at === "number") {
          localStorage.setItem("mb_customer_session_exp", String(respData.customer_session_expires_at));
        }
        // Keep the OTP-verified phone tail with the token — the resume call
        // needs it or phone-bearing bookings are filtered out server-side.
        const tail = normalizePhone(dialCode, phoneDigits).replace(/\D/g, "").slice(-9);
        if (tail) localStorage.setItem("mb_customer_phone_tail", tail);
      } catch { /* localStorage may be disabled in some browsers */ }
    }
    return true;
  }

  async function loadBookingExtras(data: Booking[]) {
    // C4: Fetch trip photos for completed bookings
    const completedSlotIds = data
      .filter((b) => b.status === "COMPLETED" || (["PAID", "CONFIRMED"].includes(b.status) && getTimeTier(b) === "PAST"))
      .map((b) => b.slot_id)
      .filter(Boolean);
    if (completedSlotIds.length > 0) {
      const { data: photos } = await tenantSupabase.from("trip_photos")
        .select("id, photo_urls, slot_id")
        .in("slot_id", completedSlotIds);
      if (photos && photos.length > 0) {
        const photoMap: Record<string, string[]> = {};
        for (const p of photos) {
          if (p.slot_id && p.photo_urls) {
            if (!photoMap[p.slot_id]) photoMap[p.slot_id] = [];
            photoMap[p.slot_id] = photoMap[p.slot_id].concat(Array.isArray(p.photo_urls) ? p.photo_urls : [p.photo_urls]);
          }
        }
        setTripPhotos(photoMap);
      }
    }

    // C7: Fetch booking logs
    const bookingIds = data.map((b: Booking) => b.id);
    if (bookingIds.length > 0) {
      const { data: logs } = await tenantSupabase.from("logs")
        .select("id, booking_id, action, created_at, details")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: true });
      if (logs && logs.length > 0) {
        const logMap: Record<string, BookingLog[]> = {};
        for (const l of logs) {
          if (!logMap[l.booking_id]) logMap[l.booking_id] = [];
          logMap[l.booking_id].push(l);
        }
        setBookingLogs(logMap);
      }
    }

    // Fetch refund calculations for upcoming paid bookings
    const upcoming = data.filter(function (b) { return ["PAID", "CONFIRMED"].includes(b.status) && b.slots?.start_time && new Date(b.slots.start_time) > new Date(); });
    if (upcoming.length > 0) {
      const calcs: Record<string, { percent: number; amount: number }> = {};
      for (const ub of upcoming) {
        try {
          const { data: rc } = await tenantSupabase.rpc("calculate_booking_refund", { p_booking_id: ub.id });
          if (rc && !rc.error) calcs[ub.id] = { percent: rc.percent, amount: Number(rc.amount) };
        } catch { /* ignore */ }
      }
      setRefundCalcs(calcs);
    }
  }

  // ponytail: full reload after every completed action — the soft refresh
  // kept missing derived state (banners/badges), so reflect server truth the
  // blunt way. Session resumes from mb_customer_session, so login survives.
  // 1.5s delay lets the success toast register before the page swaps.
  function reloadAfterAction() {
    setTimeout(() => window.location.reload(), 1500);
  }

  /* ───── Lookup bookings (called after OTP verified or auth session) ───── */
  const lookupBookings = useCallback(async function (emailOnly?: boolean) {
    setLoading(true);
    // Post-login refreshes (after cancel/voucher/reschedule actions) must use
    // the customer session — the OTP is single-use and already consumed, so
    // re-sending it made every refresh fail and the page look stale.
    let customerSession: string | null = null;
    try { customerSession = localStorage.getItem("mb_customer_session"); } catch { /* private mode */ }
    const baseBody = {
      email: email.toLowerCase(),
      phone_tail: normalizePhone(dialCode, phoneDigits).replace(/\D/g, "").slice(-9),
      emailOnly: Boolean(emailOnly),
      business_id: theme.id,
    };
    const invoke = (auth: Record<string, string | undefined>) =>
      supabase.functions.invoke("my-bookings-lookup", { body: { ...auth, ...baseBody } });

    let resp = await invoke(customerSession
      ? { customer_session: customerSession }
      : { token: otpToken || undefined, code: otpCode.trim() || undefined });
    let respData = (resp.data || {}) as Record<string, unknown>;
    if ((resp.error || !respData.success) && customerSession && otpToken && otpCode.trim()) {
      // Stale stored session shadowing a fresh OTP login — drop it and retry.
      try { localStorage.removeItem("mb_customer_session"); localStorage.removeItem("mb_customer_session_exp"); } catch { /* ignore */ }
      resp = await invoke({ token: otpToken, code: otpCode.trim() });
      respData = (resp.data || {}) as Record<string, unknown>;
    }
    if (resp.error || !respData.success) {
      setLoginError(String(respData.error || "Please verify your email again."));
      setLoggedIn(false);
      setLoading(false);
      return;
    }
    const ok = applyLookupResponse(respData, emailOnly);
    if (ok) await loadBookingExtras((respData.bookings || []) as unknown as Booking[]);
  }, [email, phoneDigits, dialCode, otpToken, otpCode, theme.id]);

  /* ───── C11: Voucher balance check ───── */
  async function checkVoucherBalance() {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true);
    setVoucherError("");
    setVoucherResult(null);
    const voucherSupabase = createVoucherSupabase(voucherCode, theme.id);
    const { data, error } = await voucherSupabase.from("vouchers")
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
    let attempts = 0;
    if (paymentPollRef.current) clearInterval(paymentPollRef.current);
    paymentPollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 12) {
        if (paymentPollRef.current) clearInterval(paymentPollRef.current);
        setPaymentPending(null);
        return;
      }
      const statusSupabase = createScopedSupabase({ "x-booking-success-token": bookingId });
      const { data } = await statusSupabase.from("bookings")
        .select("status")
        .eq("id", bookingId)
        .maybeSingle();
      if (data && ["PAID", "CONFIRMED"].includes(data.status)) {
        if (paymentPollRef.current) clearInterval(paymentPollRef.current);
        setPaymentPending(null);
        showToast("Payment confirmed! Your booking is updated.");
        reloadAfterAction();
      }
    }, 10000);
  }

  /* ───── Admin review (locked bookings) ───── */
  async function requestAdminReview(b: Booking, action: string) {
    if (!confirm("Send a change request to our team? They'll get back to you shortly.")) return;
    setActionLoading(b.id);
    // Was a direct anon-key chat_messages insert, which RLS silently rejected
    // (no anon INSERT policy) while still showing "Request sent!" — so nothing
    // ever reached the operator. Route through rebook-booking (service role),
    // which lands it in the inbox, flips the conversation to HUMAN for the
    // sidebar badge, and emails the operator. Only claim success on real success.
    try {
      const res = await callRebook({ booking_id: b.id, action: "REQUEST_CHANGE", requested_action: action });
      if (res?.email_queued) {
        showToast("Request sent — our team has been notified by email and in their dashboard.");
      } else {
        showToast("Request sent! Our team will see it in their dashboard shortly.");
      }
      reloadAfterAction();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "We couldn't send your request. Please contact us directly.", "error");
    }
    setActionLoading(null);
  }

  /* ───── Reschedule ───── */
  async function startReschedule(b: Booking) {
    // Remediation reschedule (operator-cancelled booking): any tour qualifies
    // and the party size may shrink, so only require 1 open spot here — the
    // backend re-validates capacity for the chosen qty.
    const isRemediation = b.status === "CANCELLED";
    setRescheduling(b);
    setRescheduleQty(b.qty);
    setLoadingSlots(true);
    const now = new Date();
    const cutoff = new Date(Date.now() + 60 * 60 * 1000);
    const later = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    let query = tenantSupabase.from("slots").select("*, tours(name, base_price_per_person)")
      .eq("status", "OPEN")
      .gt("start_time", cutoff.toISOString()).lt("start_time", later.toISOString())
      .order("start_time", { ascending: true });
    if (!isRemediation) query = query.eq("tour_id", b.tour_id);
    const { data } = await query;
    const minSpots = isRemediation ? 1 : b.qty;
    setRescheduleSlots(((data || []) as unknown as Slot[]).filter((s) => s.capacity_total - s.booked - (s.held || 0) >= minSpots && s.id !== b.slot_id));
    setLoadingSlots(false);
  }

  async function submitReschedule() {
    if (!rescheduling || !rebookConfirmSlot) return;
    setActionLoading("reschedule");
    try {
      const result = await callRebook({
        booking_id: rescheduling.id,
        action: "RESCHEDULE",
        new_slot_id: rebookConfirmSlot.id,
        excess_action: excessAction,
        ...(rescheduling.status === "CANCELLED" && rescheduleQty !== rescheduling.qty ? { new_qty: rescheduleQty } : {}),
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
      reloadAfterAction();
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
    setGuestPaymentUrl(""); setGuestPaymentAmount(0);
  }

  async function applyGuestVoucher() {
    if (!guestVoucherCode.trim()) return;
    setGuestVoucherError("");
    const code = guestVoucherCode.toUpperCase().replace(/\s/g, "");
    if (code.length !== 8) { setGuestVoucherError("Codes are 8 characters"); return; }
    const voucherSupabase = createVoucherSupabase(code, theme.id);
    const { data } = await voucherSupabase.from("vouchers").select("*").eq("code", code).single();
    if (!data) { setGuestVoucherError("Code not found"); return; }
    if (data.status === "REDEEMED") { setGuestVoucherError("Already redeemed"); return; }
    if (data.status !== "ACTIVE") { setGuestVoucherError("Not valid"); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { setGuestVoucherError("Expired"); return; }
    const bal = Number(data.current_balance ?? data.value ?? data.purchase_amount ?? 0);
    if (bal <= 0) { setGuestVoucherError("No balance remaining"); return; }
    setGuestVoucherApplied({ code, balance: bal });
    setGuestVoucherCode("");
  }

  async function applyGuestPromo() {
    if (!guestPromoCode.trim() || !editGuestsBooking) return;
    setGuestPromoError("");
    const code = guestPromoCode.toUpperCase().trim();
    const { data: promo } = await tenantSupabase.from("promotions").select("*").eq("code", code).eq("business_id", editGuestsBooking.business_id).maybeSingle();
    if (!promo) { setGuestPromoError("Code not found"); return; }
    if (!promo.active) { setGuestPromoError("No longer active"); return; }
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) { setGuestPromoError("Expired"); return; }
    if (promo.max_uses != null && promo.used_count >= promo.max_uses) { setGuestPromoError("Usage limit reached"); return; }
    setGuestPromoApplied({ id: promo.id, code: promo.code, discount_type: promo.discount_type, discount_value: Number(promo.discount_value) });
    setGuestPromoCode("");
  }

  async function submitEditGuests() {
    if (!editGuestsBooking || guestQty === editGuestsBooking.qty) { setEditGuestsBooking(null); return; }
    const b = editGuestsBooking;
    setActionLoading("guests");
    try {
      if (guestQty > b.qty) {
        const result = await callRebook({ booking_id: b.id, action: "ADD_GUESTS", new_qty: guestQty });
        if (result.payment_url) {
          // Render the pay link in the modal (a direct-click anchor). window.open
          // after an await is blocked by popup blockers, which is why the link
          // never appeared before. Keep the modal open so the customer can pay.
          setGuestPaymentUrl(result.payment_url as string);
          setGuestPaymentAmount(Number(result.diff) || 0);
          startPaymentPolling(b.id);
          setActionLoading(null);
          return;
        }
        // A price increase always needs payment; no link means checkout failed.
        throw new Error("Couldn't create a payment link for the extra guest(s). Please try again.");
      } else {
        const result2 = await callRebook({ booking_id: b.id, action: "REMOVE_GUESTS", new_qty: guestQty, excess_action: guestExcessAction });
        if (result2.voucher_code) {
          showToast("Guests removed. Voucher " + result2.voucher_code + " for R" + result2.voucher_amount + " sent to you.");
        } else if (result2.refund_amount) {
          showToast("Guests removed. Refund of R" + Number(result2.refund_amount).toFixed(2) + " requested.");
        } else {
          showToast("Guests updated!");
        }
      }
      setEditGuestsBooking(null);
      reloadAfterAction();
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
      reloadAfterAction();
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
      reloadAfterAction();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Something went wrong", "error"); }
    setActionLoading(null);
  }

  /* ───── Cancel with refund ───── */
  async function submitCancelRefund() {
    if (!cancelTarget) return;
    setActionLoading("cancel");
    try {
      const result = await callRebook({ booking_id: cancelTarget.id, action: "CANCEL_REFUND" });
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
      reloadAfterAction();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Something went wrong", "error"); }
    setActionLoading(null);
  }

  /* ───── Cancel with voucher ───── */
  async function submitCancelVoucher() {
    if (!cancelTarget) return;
    setActionLoading("cancel");
    try {
      const result = await callRebook({ booking_id: cancelTarget.id, action: "CANCEL_VOUCHER" });
      showToast("Converted to voucher! Code: " + result.voucher_code + " (R" + result.voucher_amount + ")");
      setCancelTarget(null);
      reloadAfterAction();
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : "Something went wrong", "error"); }
    setActionLoading(null);
  }

  /* ───── Claim credit ───── */
  async function handleClaimCredit(b: Booking, creditAction: "VOUCHER" | "REFUND") {
    setActionLoading(b.id);
    try {
      const res = await callRebook({ booking_id: b.id, action: "CLAIM_CREDIT", credit_action: creditAction });
      if (creditAction === "VOUCHER") {
        showToast("Voucher issued! Code: " + (res.voucher_code || "Check your email") + " for R" + Number(b.refund_amount).toFixed(2));
      } else if (res.voucher_code) {
        // Voucher-paid booking — cash refunds aren't possible, the backend
        // issued a credit voucher instead.
        showToast("Your booking was paid with a voucher, so we've issued a new voucher instead: " + res.voucher_code + " (R" + Number(res.voucher_amount ?? b.refund_amount).toFixed(2) + ")");
      } else {
        showToast("Refund of R" + Number(res.refund_amount ?? b.refund_amount).toFixed(2) + " requested. Please allow 5-10 business days.");
      }
      reloadAfterAction();
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
        rescheduleQty={rescheduleQty}
        setRescheduleQty={setRescheduleQty}
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
  // A trip the OPERATOR cancelled (e.g. weather) where the customer still has to
  // choose reschedule / voucher / refund. These must be impossible to miss, so
  // they're pulled out of the buried "Cancelled" group and surfaced at the top.
  const needsAction = (b: Booking) =>
    b.status === "CANCELLED"
    && (b.refund_status === "ACTION_REQUIRED" || b.refund_status === "CREDIT_PENDING")
    && Number(b.refund_amount || 0) > 0
    && !b.converted_to_voucher_id;
  const actionNeeded = bookings.filter(needsAction);
  const upcoming = bookings.filter(b => ["PAID", "CONFIRMED", "HELD", "PENDING"].includes(b.status) && getTimeTier(b) !== "PAST");
  const past = bookings.filter(b => b.status === "COMPLETED" || b.status === "EXPIRED" || (["PAID", "CONFIRMED"].includes(b.status) && getTimeTier(b) === "PAST"));
  const cancelled = bookings.filter(b => b.status === "CANCELLED" && !needsAction(b));

  // Presentation ordering: the soonest upcoming trip is the hero; past trips
  // read most-recent-first.
  const FAR_FUTURE = 8.64e15;
  const upcomingSorted = [...upcoming].sort((a, z) =>
    new Date(a.slots?.start_time || FAR_FUTURE).getTime() - new Date(z.slots?.start_time || FAR_FUTURE).getTime());
  const nextTrip = upcomingSorted[0] || null;
  const laterUpcoming = upcomingSorted.slice(1);
  const pastSorted = [...past].sort((a, z) =>
    new Date(z.slots?.start_time || 0).getTime() - new Date(a.slots?.start_time || 0).getTime());
  const paidTrips = bookings.filter(b => ["PAID", "CONFIRMED", "COMPLETED"].includes(b.status));
  const tripCount = paidTrips.length;
  const firstName = ((paidTrips[0]?.customer_name || bookings[0]?.customer_name || email.split("@")[0] || "").split(" ")[0]) || "";

  const cardProps = {
    countdownTick, paymentPending, actionLoading, tripPhotos, bookingLogs,
    expandedTimeline, setExpandedTimeline, expandedWhatToBring, setExpandedWhatToBring,
    onReschedule: startReschedule, onEditGuests: openEditGuests,
    onContactDetails: openContactDetails, onSpecialRequest: openSpecialRequest,
    onCancel: setCancelTarget, onAdminReview: requestAdminReview,
    onContactUs: () => setContactUsOpen(true),
    onClaimCredit: handleClaimCredit,
  };

  const iconBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-[color:var(--surface)] text-[color:var(--textMuted)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] sm:h-10 sm:w-10";

  return (
    <div className="min-h-screen pb-16">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="app-container max-w-3xl px-4 pt-8 sm:pt-12">
        {/* Greeting */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent)]">
              {theme.business_name || "My bookings"}
            </p>
            <h1 className="font-display mt-1.5 text-[28px] font-semibold leading-[1.08] tracking-[-0.02em] text-[color:var(--text)] sm:text-[34px] sm:leading-none">
              Welcome back{firstName ? ", " + firstName : ""}
            </h1>
            {tripCount >= 2 && (
              <p className="mt-2 text-[13px] text-[color:var(--textMuted)]">
                {tripCount} trips together{tripCount >= 5 ? " — thanks for sticking with us" : ""}
              </p>
            )}
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Link href="/" className="btn btn-primary flex-1 !px-4 !py-2.5 !text-[13.5px] sm:flex-none sm:!py-2 sm:!text-[13px]">Book a trip</Link>
            {authSession && (
              <button onClick={() => setActiveTab("profile")} title="Profile & settings" aria-label="Profile & settings"
                className={iconBtn} style={{ borderColor: "var(--border)" }}>
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            )}
            <button onClick={async () => { if (authSession) { await supabase.auth.signOut(); setAuthSession(false); } setLoggedIn(false); setBookings([]); setEmail(""); setDialCode("+27"); setPhoneDigits(""); setLoginError(""); setToast(null); setAutoLoginAttempted(false); setSessionChecked(true); sessionStorage.removeItem("mb_loggedIn"); sessionStorage.removeItem("mb_email"); sessionStorage.removeItem("mb_dialCode"); sessionStorage.removeItem("mb_phone"); try { localStorage.removeItem("mb_customer_session"); localStorage.removeItem("mb_customer_email"); localStorage.removeItem("mb_customer_session_exp"); localStorage.removeItem("mb_customer_phone_tail"); } catch { /* */ } }}
              title="Sign out" aria-label="Sign out"
              className={iconBtn} style={{ borderColor: "var(--border)" }}>
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </header>

        {/* Tab strip (auth-session users only) */}
        {authSession && (
          <div className="mb-7 flex w-full rounded-xl border bg-[color:var(--surface)] p-1 sm:inline-flex sm:w-auto" style={{ borderColor: "var(--border)" }} role="tablist">
            {(["trips", "profile"] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} role="tab" aria-selected={activeTab === t}
                className={"flex-1 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors sm:flex-none sm:py-1.5 " +
                  (activeTab === t ? "bg-[color:var(--accent)] text-[color:var(--ink-on-main)]" : "text-[color:var(--textMuted)] hover:text-[color:var(--text)]")}>
                {t === "trips" ? "Your trips" : "Profile"}
              </button>
            ))}
          </div>
        )}

        {activeTab === "profile" && authSession && customer && authUser ? (
          <ProfileTab customer={customer} user={authUser} onUpdate={setCustomer} onSignOut={() => { window.location.href = "/"; }} />
        ) : (<>

        {/* Action needed — operator/weather cancellations awaiting a customer choice.
            Surfaced above everything so a cancelled trip is impossible to miss. */}
        {actionNeeded.length > 0 && (
          <section className="mb-9">
            <div className="mb-3 flex items-center gap-2">
              <svg className="h-4 w-4" style={{ color: "var(--danger)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--danger)" }}>Needs your attention</h2>
            </div>
            <div className="space-y-3">
              {actionNeeded.map(b => <BookingCard key={b.id} b={b} variant="card" {...cardProps} refundCalc={refundCalcs[b.id] || null} />)}
            </div>
          </section>
        )}

        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-14 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 60%, transparent)" }}>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "var(--accentSoft)", color: "var(--accent)" }}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5l-2 5-5 2 2-5 5-2z" /></svg>
            </span>
            <h3 className="font-display mt-4 text-[20px] font-semibold text-[color:var(--text)]">No trips yet</h3>
            <p className="mx-auto mt-1.5 max-w-xs text-[13.5px] text-[color:var(--textMuted)]">When you book, everything lives here — tickets, waivers, changes and photos.</p>
            <Link href="/" className="btn btn-primary mt-6">Browse tours</Link>
          </div>
        ) : (
          <>
            {nextTrip && (
              <section className="mb-9">
                <BookingCard b={nextTrip} variant="hero" {...cardProps} refundCalc={refundCalcs[nextTrip.id] || null} />
              </section>
            )}

            {laterUpcoming.length > 0 && (
              <section className="mb-9">
                <SectionLabel>Coming up</SectionLabel>
                <div className="space-y-3">
                  {laterUpcoming.map(b => <BookingCard key={b.id} b={b} variant="card" {...cardProps} refundCalc={refundCalcs[b.id] || null} />)}
                </div>
              </section>
            )}

            {/* Utilities */}
            <section className="mb-9 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-[color:var(--surface)] p-5" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accentSoft)", color: "var(--accent)" }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                  </span>
                  <h3 className="text-[14px] font-semibold text-[color:var(--text)]">Voucher balance</h3>
                </div>
                {!voucherResult ? (
                  <>
                    <p className="mt-2.5 text-[12.5px] text-[color:var(--textMuted)]">Have a gift voucher? Check what&apos;s left on it.</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={voucherCode}
                        onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherError(""); }}
                        onKeyDown={e => e.key === "Enter" && checkVoucherBalance()}
                        placeholder="CODE"
                        aria-label="Voucher code"
                        className="field !py-2.5 min-w-0 flex-1 font-mono !text-[16px] uppercase tracking-widest sm:!py-2 sm:!text-[13px]"
                      />
                      <button onClick={checkVoucherBalance} disabled={voucherLoading || !voucherCode.trim()}
                        className="inline-flex shrink-0 items-center self-stretch rounded-[10px] bg-[color:var(--accent)] px-4 text-[13px] font-semibold text-[color:var(--ink-on-main)] transition-colors hover:bg-[color:var(--accentHover)] disabled:opacity-40"
                      >
                        {voucherLoading ? "…" : "Check"}
                      </button>
                    </div>
                    {voucherError && <p role="alert" className="mt-2 text-[12px]" style={{ color: "var(--danger)" }}>{voucherError}</p>}
                  </>
                ) : (
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-display text-[30px] font-semibold leading-none text-[color:var(--text)]">R{voucherResult.current_balance}</p>
                      <p className="mt-2 text-[12px] text-[color:var(--textMuted)]">
                        <span className="font-mono font-semibold text-[color:var(--text)]">{voucherResult.code}</span>
                        {voucherResult.expires_at && <> · until {new Date(voucherResult.expires_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={voucherResult.status === "ACTIVE"
                          ? { color: "var(--success)", background: "color-mix(in srgb, var(--success) 10%, transparent)" }
                          : { color: "var(--textMuted)", background: "var(--surface2)" }}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {voucherResult.status === "ACTIVE" ? "Active" : voucherResult.status === "REDEEMED" ? "Fully used" : voucherResult.status}
                      </span>
                      <button onClick={() => { setVoucherResult(null); setVoucherCode(""); }} className="text-[12px] font-semibold text-[color:var(--accent)] hover:underline">
                        Check another
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setContactUsOpen(true)}
                className="group rounded-2xl border bg-[color:var(--surface)] p-5 text-left transition-colors hover:border-[color:var(--accent)]"
                style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accentSoft)", color: "var(--accent)" }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </span>
                  <h3 className="text-[14px] font-semibold text-[color:var(--text)]">Need a hand?</h3>
                </div>
                <p className="mt-2.5 text-[12.5px] text-[color:var(--textMuted)]">
                  Questions about a booking? WhatsApp, call or email {theme.business_name || "our team"} directly.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[color:var(--accent)]">
                  Contact us
                  <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </span>
              </button>
            </section>

            {pastSorted.length > 0 && (
              <section className="mb-9">
                <SectionLabel>Past trips</SectionLabel>
                <div className="space-y-2">
                  {pastSorted.map(b => <BookingCard key={b.id} b={b} variant="row" {...cardProps} />)}
                </div>
              </section>
            )}

            {cancelled.length > 0 && (
              <section className="mb-9">
                <SectionLabel>Cancelled</SectionLabel>
                <div className="space-y-2">
                  {cancelled.map(b => <BookingCard key={b.id} b={b} variant="row" {...cardProps} />)}
                </div>
              </section>
            )}
          </>
        )}

      </>)}
      </div>

      {/* MODALS */}
      <EditGuestsModal
        booking={editGuestsBooking} guestQty={guestQty} setGuestQty={setGuestQty}
        guestExcessAction={guestExcessAction} setGuestExcessAction={setGuestExcessAction}
        actionLoading={actionLoading} onClose={() => { setEditGuestsBooking(null); setGuestPaymentUrl(""); setGuestPaymentAmount(0); }} onSubmit={submitEditGuests}
        paymentUrl={guestPaymentUrl} paymentAmount={guestPaymentAmount}
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
        refundCalc={cancelTarget ? refundCalcs[cancelTarget.id] || null : null}
      />
      <ContactUsModal
        open={contactUsOpen} businessName={theme.business_name || ""}
        email={theme.public_email} phone={theme.public_phone} whatsapp={theme.public_whatsapp}
        onClose={() => setContactUsOpen(false)}
      />
    </div>
  );
}
