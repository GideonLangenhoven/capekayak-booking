"use client";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { DIAL_CODES } from "../lib/phone";
import { useTheme } from "../components/ThemeProvider";

interface LoginScreenProps {
  email: string;
  setEmail: (v: string) => void;
  dialCode: string;
  setDialCode: (v: string) => void;
  phoneDigits: string;
  setPhoneDigits: (v: string) => void;
  emailError: string;
  setEmailError: (v: string) => void;
  phoneError: string;
  setPhoneError: (v: string) => void;
  loginError: string;
  setLoginError: (v: string) => void;
  loading: boolean;
  otpStep: boolean;
  otpCode: string;
  setOtpCode: (v: string) => void;
  otpError: string;
  otpSending: boolean;
  otpVerifying: boolean;
  resendCountdown: number;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
  onResendOtp: () => void;
  onBackToEmail: () => void;
}

function MailBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium" style={{ background: "var(--accentSoft)", color: "var(--accent)" }}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      Check your email
    </div>
  );
}

function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
      <span className="text-xs text-[color:var(--textMuted)]">or</span>
      <div className="flex-1 border-t" style={{ borderColor: "var(--border)" }} />
    </div>
  );
}

/* Segmented one-time-code input: a real (invisible) input drives six rendered
   boxes, so paste + iOS code autofill keep working. */
function OtpBoxes({ value, inputRef, onChange, onEnter }: {
  value: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const activeIdx = Math.min(value.length, 5);
  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => e.key === "Enter" && value.length === 6 && onEnter()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="6-digit verification code"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="flex justify-center gap-2" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => {
          const isActive = focused && i === activeIdx;
          return (
            <div
              key={i}
              className="flex h-13 w-10 items-center justify-center rounded-xl border-[1.5px] text-[22px] font-semibold tabular-nums text-[color:var(--text)] transition-colors sm:w-11"
              style={{
                height: "3.25rem",
                background: "color-mix(in srgb, var(--glass-solid-card) 60%, transparent)",
                borderColor: isActive ? "var(--focusRing)" : "var(--glass-border)",
                boxShadow: isActive ? "0 0 0 4px color-mix(in srgb, var(--focusRing), transparent 82%)" : undefined,
              }}
            >
              {value[i] ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LoginScreen({
  email, setEmail, dialCode, setDialCode, phoneDigits, setPhoneDigits,
  emailError, setEmailError, phoneError, setPhoneError,
  loginError, setLoginError, loading,
  otpStep, otpCode, setOtpCode, otpError,
  otpSending, otpVerifying, resendCountdown,
  onSendOtp, onVerifyOtp, onResendOtp, onBackToEmail,
}: LoginScreenProps) {
  const theme = useTheme();
  const otpInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"magic" | "otp">("magic");
  const [magicSent, setMagicSent] = useState(false);
  const [magicSending, setMagicSending] = useState(false);
  const [magicError, setMagicError] = useState("");

  useEffect(() => {
    if (otpStep && otpInputRef.current) otpInputRef.current.focus();
  }, [otpStep]);

  function maskEmail(e: string) {
    const [local, domain] = e.split("@");
    if (!domain) return e;
    if (local.length <= 2) return local[0] + "***@" + domain;
    return local[0] + local[1] + "***@" + domain;
  }

  async function sendMagicLink() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email");
      return;
    }
    setMagicSending(true);
    setMagicError("");
    setLoginError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: { emailRedirectTo: window.location.origin + "/auth/callback" },
    });
    if (error) {
      const raw = (error.message || "").toLowerCase();
      // Translate Supabase technical errors into customer-friendly copy.
      const friendly = raw.includes("rate limit")
        ? "Too many requests. Please wait a few minutes before trying again."
        : raw.includes("invalid")
          ? "That email doesn't look right. Please double-check it."
          : "We couldn't send the link right now. Please try again in a moment.";
      setMagicError(friendly);
      setMagicSending(false);
      return;
    }
    setMagicSent(true);
    setMagicSending(false);
  }

  function switchToOtp() {
    setMode("otp");
    setMagicSent(false);
    setMagicError("");
  }

  function switchToMagic() {
    setMode("magic");
    setMagicSent(false);
    setMagicError("");
    onBackToEmail();
  }

  const subtitle = mode === "magic"
    ? (magicSent
      ? "If we found your account, a sign-in link is on its way."
      : "Get a sign-in link by email — no password needed.")
    : (otpStep
      ? "Enter the 6-digit code we emailed you."
      : "Use the email and phone number from your booking.");

  return (
    <div className="app-container max-w-[420px] px-4 py-10 sm:py-16">
      {/* One glass sheet wraps brand + form: the heading never sits on raw
          imagery, and the whole moment reads as a single frosted panel. */}
      <div className="glass-sheet glass-sheet-enter p-6 sm:p-8">
      {/* Brand moment */}
      <div className="mb-7 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--accentSoft)", color: "var(--accent)" }}>
          {/* dotted trail — echoes the brand mark */}
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 19c4.5-1.5 5-6 8-8.5 2.2-1.8 5-2 7-4.5" strokeWidth={1.9} strokeLinecap="round" strokeDasharray="0.2 3.4" />
            <circle cx="19.5" cy="5.5" r="1.9" strokeWidth={1.6} />
            <circle cx="4" cy="19" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <h1 className="font-display text-[27px] font-semibold tracking-[-0.02em] text-[color:var(--text)]">Your trips</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-sm text-[color:var(--textMuted)]">{subtitle}</p>
      </div>

      <div>
        {mode === "magic" ? (
          magicSent ? (
            /* ── Magic link sent ── */
            <div className="text-center">
              <MailBadge />
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--textMuted)]">
                If a booking exists with this email, a sign-in link is on its way to{" "}
                <span className="font-semibold text-[color:var(--text)]">{maskEmail(email)}</span>.
                Don&apos;t forget the spam folder — you can close this page after clicking the link.
              </p>
              <button onClick={() => { setMagicSent(false); }} className="mt-5 py-2 text-sm font-semibold text-[color:var(--accent)] hover:underline">
                Resend link
              </button>
              <OrDivider />
              <button onClick={switchToOtp} className="w-full py-2 text-sm text-[color:var(--textMuted)] transition-colors hover:text-[color:var(--text)]">
                Sign in with a 6-digit code instead
              </button>
            </div>
          ) : (
            /* ── Magic link input ── */
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[color:var(--textMuted)]">Email</label>
                <Input type="email" value={email} autoComplete="email"
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); setMagicError(""); setLoginError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && sendMagicLink()} placeholder="your@email.com" className="py-3" />
                {emailError && <p role="alert" className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>{emailError}</p>}
              </div>

              {(magicError || loginError) && <p role="alert" className="mt-3 text-center text-sm" style={{ color: "var(--danger)" }}>{magicError || loginError}</p>}

              <Button onClick={sendMagicLink} disabled={magicSending || loading || !email.trim()} fullWidth className="mt-5 py-3.5">
                {magicSending ? "Sending link…" : "Email me a sign-in link"}
              </Button>

              <OrDivider />

              <button onClick={switchToOtp} className="w-full py-2 text-center text-sm text-[color:var(--textMuted)] transition-colors hover:text-[color:var(--text)]">
                Use phone verification instead
              </button>
            </>
          )
        ) : !otpStep ? (
          /* ── OTP Step 1: Email + Phone ── */
          <>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[color:var(--textMuted)]">Email</label>
                <Input type="email" value={email} autoComplete="email"
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); setLoginError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && onSendOtp()} placeholder="your@email.com" className="py-3" />
                {emailError && <p role="alert" className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>{emailError}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[color:var(--textMuted)]">Phone</label>
                <div className="flex gap-2">
                  <select value={dialCode} onChange={(e) => setDialCode(e.target.value)} aria-label="Country dial code"
                    className="field !w-auto shrink-0 cursor-pointer !px-2.5 py-3 text-[16px] sm:text-sm"
                    style={{ minWidth: "96px" }}>
                    {DIAL_CODES.map((d, i) => <option key={d.country + i} value={d.code}>{d.flag} {d.code}</option>)}
                  </select>
                  <Input type="tel" value={phoneDigits} autoComplete="tel-national"
                    onChange={(e) => { setPhoneDigits(e.target.value); setPhoneError(""); setLoginError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && onSendOtp()}
                    placeholder="81 234 5678" className="min-w-0 flex-1 py-3" />
                </div>
                {phoneError && <p role="alert" className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>{phoneError}</p>}
              </div>
            </div>

            {loginError && <p role="alert" className="mt-3 text-center text-sm" style={{ color: "var(--danger)" }}>{loginError}</p>}

            <Button onClick={onSendOtp} disabled={otpSending || loading || !email.trim() || !phoneDigits.trim()} fullWidth className="mt-5 py-3.5">
              {otpSending ? "Sending code…" : "Find my bookings"}
            </Button>

            <OrDivider />

            <button onClick={switchToMagic} className="w-full py-2 text-center text-sm text-[color:var(--textMuted)] transition-colors hover:text-[color:var(--text)]">
              Use a sign-in link instead
            </button>
          </>
        ) : (
          /* ── OTP Step 2: Verification ── */
          <>
            <div className="mb-6 text-center">
              <MailBadge />
              <p className="mt-3 text-xs leading-relaxed text-[color:var(--textMuted)]">
                If your email + phone match a booking, a 6-digit code is on its way to{" "}
                <span className="font-semibold text-[color:var(--text)]">{maskEmail(email)}</span>. Check inbox + spam.
              </p>
            </div>

            <OtpBoxes value={otpCode} inputRef={otpInputRef} onChange={setOtpCode} onEnter={onVerifyOtp} />

            {otpError && <p role="alert" className="mt-3 text-center text-sm" style={{ color: "var(--danger)" }}>{otpError}</p>}

            <Button onClick={onVerifyOtp} disabled={otpVerifying || otpCode.length !== 6} fullWidth className="mt-5 py-3.5">
              {otpVerifying ? "Verifying…" : "Verify"}
            </Button>

            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="text-xs text-[color:var(--textMuted)]">Code expires in 15 minutes</p>
              <button
                onClick={onResendOtp}
                disabled={otpSending || resendCountdown > 0}
                className="py-1.5 text-sm font-semibold text-[color:var(--accent)] hover:underline disabled:opacity-50"
              >
                {otpSending ? "Sending…" : resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Resend code"}
              </button>
              <button
                onClick={onBackToEmail}
                className="flex items-center gap-1 py-1.5 text-sm text-[color:var(--textMuted)] transition-colors hover:text-[color:var(--text)]"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Use a different email
              </button>
            </div>
          </>
        )}
      </div>
      </div>

      <p className="glass-chip mx-auto mt-5 flex w-fit max-w-full items-center justify-center gap-1.5 px-4 py-2 text-center text-xs" style={{ color: "var(--ink)" }}>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        Secure one-time sign-in for {theme.business_name || "your"} bookings — no passwords.
      </p>
    </div>
  );
}
