"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "../components/ThemeProvider";

// AK1: customer-facing POPIA data-subject request form. The backend
// (admin /api/popia/request, mirrored on booking site) already accepts
// ACCESS / CORRECTION / DELETION. This is the missing operator-shipped
// surface that lets a data subject actually trigger the flow without
// emailing support.

type Status = "idle" | "sending" | "sent" | "error";

export default function PopiaPage() {
  const theme = useTheme();
  const [type, setType] = useState<"ACCESS" | "CORRECTION" | "DELETION">("ACCESS");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg("");
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setErrMsg("Please enter a valid email address.");
      return;
    }
    if (!theme.id) {
      setStatus("error");
      setErrMsg("This site isn't fully configured. Please contact us directly.");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/popia/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          business_id: theme.id,
          type,
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setErrMsg(data.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("sent");
    } catch (err: unknown) {
      setStatus("error");
      setErrMsg((err as Error)?.message || "Network error. Please try again.");
    }
  }

  return (
    <div className="app-container page-wrap max-w-2xl">
      <h1 className="headline-lg mb-2">Privacy Request</h1>
      <p className="text-sm text-[color:var(--textMuted)] mb-6">
        Under South Africa's POPIA (and GDPR for EU residents), you can ask us to:
      </p>
      <ul className="text-sm text-[color:var(--textMuted)] mb-6 list-disc pl-5 space-y-1">
        <li><strong>Access</strong> — receive a copy of all personal information we hold about you.</li>
        <li><strong>Correct</strong> — update incorrect or outdated details on your record.</li>
        <li><strong>Delete</strong> — anonymise your personal information. Financial records are preserved with anonymised identifiers as required by law.</li>
      </ul>

      {status === "sent" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-bold text-emerald-900 mb-1">Confirmation email sent</h2>
          <p className="text-sm text-emerald-800">
            We've emailed <strong>{email.trim().toLowerCase()}</strong> a confirmation link. Click it within
            24 hours to start your {type === "DELETION" ? "deletion" : type === "CORRECTION" ? "correction" : "access"} request.
            If you don't see it, check your spam folder.
          </p>
          {type === "DELETION" && (
            <p className="text-xs text-emerald-700 mt-3">
              Deletion requests have a 30-day cooling-off period after confirmation before they're fulfilled, in case
              you change your mind.
            </p>
          )}
          <p className="text-xs text-emerald-700 mt-3">
            Wrong email? <button type="button" onClick={() => { setStatus("idle"); setEmail(""); setReason(""); }} className="underline">Start over</button>.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Request type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["ACCESS", "CORRECTION", "DELETION"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={"rounded-xl border px-3 py-2 text-sm font-medium transition-colors " + (type === t ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300")}
                >
                  {t === "ACCESS" ? "Access my data" : t === "CORRECTION" ? "Correct my data" : "Delete my data"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="popia-email">Email address</label>
            <input
              id="popia-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
            />
            <p className="text-xs text-slate-500 mt-1">We'll match this against bookings on file and send a confirmation link.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="popia-reason">Anything we should know? (optional)</label>
            <textarea
              id="popia-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={type === "CORRECTION" ? "What needs to be corrected?" : "Optional context"}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
            />
          </div>

          {status === "error" && errMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errMsg}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {status === "sending" ? "Sending confirmation…" : "Send confirmation email"}
            </button>
            <Link href="/privacy" className="text-xs text-slate-500 hover:underline">
              Read our privacy policy
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
