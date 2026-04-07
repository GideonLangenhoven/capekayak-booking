import { useRef, useEffect } from "react";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { DIAL_CODES } from "../lib/phone";

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

export default function LoginScreen({
  email, setEmail, dialCode, setDialCode, phoneDigits, setPhoneDigits,
  emailError, setEmailError, phoneError, setPhoneError,
  loginError, setLoginError, loading,
  otpStep, otpCode, setOtpCode, otpError,
  otpSending, otpVerifying, resendCountdown,
  onSendOtp, onVerifyOtp, onResendOtp, onBackToEmail,
}: LoginScreenProps) {
  var otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otpStep && otpInputRef.current) otpInputRef.current.focus();
  }, [otpStep]);

  /* ── Mask email for display ── */
  function maskEmail(e: string) {
    var [local, domain] = e.split("@");
    if (!domain) return e;
    if (local.length <= 2) return local[0] + "***@" + domain;
    return local[0] + local[1] + "***@" + domain;
  }

  return (
    <div className="app-container max-w-sm py-16 px-4">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--accentSoft)]">
          <svg className="w-7 h-7 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <h2 className="text-xl font-bold text-[color:var(--text)]">My Bookings</h2>
        <p className="mt-2 text-sm text-[color:var(--textMuted)]">
          {otpStep ? "Enter the verification code we sent to your email." : "Enter the details you used when booking."}
        </p>
      </div>

      {!otpStep ? (
        /* ── Step 1: Email + Phone ── */
        <>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1.5">Email</label>
              <Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); setLoginError(""); }}
                onKeyDown={(e) => e.key === "Enter" && onSendOtp()} placeholder="your@email.com" className="py-3" />
              {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1.5">Phone</label>
              <div className="flex gap-2">
                <select value={dialCode} onChange={(e) => setDialCode(e.target.value)}
                  className="shrink-0 border-2 border-[color:var(--border)] rounded-xl px-2 py-3 text-sm bg-[color:var(--surface)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)] cursor-pointer"
                  style={{ minWidth: "100px" }}>
                  {DIAL_CODES.map((d, i) => <option key={d.country + i} value={d.code}>{d.flag} {d.code}</option>)}
                </select>
                <Input type="tel" value={phoneDigits}
                  onChange={(e) => { setPhoneDigits(e.target.value); setPhoneError(""); setLoginError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && onSendOtp()}
                  placeholder="81 234 5678" className="flex-1 py-3" />
              </div>
              {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
            </div>
          </div>

          {loginError && <p className="mt-3 text-sm text-red-600 text-center">{loginError}</p>}

          <Button onClick={onSendOtp} disabled={otpSending || loading || !email.trim() || !phoneDigits.trim()} fullWidth className="mt-5 py-3.5">
            {otpSending ? "Sending code..." : "Find My Bookings"}
          </Button>
        </>
      ) : (
        /* ── Step 2: OTP Verification ── */
        <>
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-[color:var(--accentSoft)] text-[color:var(--accent)] text-sm font-medium px-4 py-2 rounded-full mb-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Code sent to {maskEmail(email)}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-2 text-center">6-digit verification code</label>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && otpCode.length === 6 && onVerifyOtp()}
                className="w-full text-center text-3xl font-mono tracking-[0.4em] py-4 border-2 border-[color:var(--border)] rounded-xl bg-[color:var(--surface)] text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)] transition-colors placeholder:text-[color:var(--textMuted)] placeholder:text-xl placeholder:tracking-[0.3em]"
                placeholder="000000"
              />
            </div>

            {otpError && <p className="text-sm text-red-600 text-center">{otpError}</p>}

            <Button onClick={onVerifyOtp} disabled={otpVerifying || otpCode.length !== 6} fullWidth className="py-3.5">
              {otpVerifying ? "Verifying..." : "Verify"}
            </Button>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-[color:var(--textMuted)]">Code expires in 15 minutes</p>
            <button
              onClick={onResendOtp}
              disabled={otpSending || resendCountdown > 0}
              className="text-sm text-[color:var(--accent)] hover:underline disabled:opacity-50"
            >
              {otpSending ? "Sending..." : resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Resend code"}
            </button>
            <button
              onClick={onBackToEmail}
              className="text-sm text-[color:var(--textMuted)] hover:text-[color:var(--text)] transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Use a different email
            </button>
          </div>
        </>
      )}
    </div>
  );
}
