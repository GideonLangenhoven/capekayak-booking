"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// AK2: customer landing page hit by the confirmation link in the POPIA
// request email. Posts the {token, id} pair to /api/popia/confirm and
// renders the outcome — confirmed / expired / already-used / invalid.
// Without this page the email link was 404'ing on the booking site.

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "confirmed"; requestType: string; scheduledFor: string }
  | { kind: "error"; message: string; status: number };

function ConfirmInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const id = params.get("id") || "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token || !id) { setState({ kind: "missing" }); return; }
    (async () => {
      try {
        const res = await fetch("/api/popia/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, id }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setState({ kind: "confirmed", requestType: data.request_type || "ACCESS", scheduledFor: data.scheduled_for || "" });
        } else {
          setState({ kind: "error", message: data.error || "Could not confirm this request.", status: res.status });
        }
      } catch (err: unknown) {
        setState({ kind: "error", message: (err as Error)?.message || "Network error.", status: 0 });
      }
    })();
  }, [token, id]);

  if (state.kind === "loading") {
    return (
      <div className="app-container page-wrap max-w-xl text-center py-16">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-600">Confirming your request…</p>
      </div>
    );
  }

  if (state.kind === "missing") {
    return (
      <div className="app-container page-wrap max-w-xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-bold text-red-900 mb-1">Invalid link</h1>
          <p className="text-sm text-red-800">
            This confirmation link is missing required information. Open the link directly from the email we sent you.
          </p>
          <Link href="/popia" className="mt-4 inline-block text-sm font-semibold text-red-900 underline">Start a new request</Link>
        </div>
      </div>
    );
  }

  if (state.kind === "confirmed") {
    const isDeletion = state.requestType === "DELETION";
    const sched = state.scheduledFor ? new Date(state.scheduledFor).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "";
    return (
      <div className="app-container page-wrap max-w-xl">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h1 className="text-lg font-bold text-emerald-900 mb-1">Request confirmed</h1>
          <p className="text-sm text-emerald-800">
            Your {state.requestType === "ACCESS" ? "data access" : state.requestType === "CORRECTION" ? "correction" : "data deletion"} request
            has been confirmed and is now in our queue.
          </p>
          {isDeletion ? (
            <p className="text-sm text-emerald-800 mt-3">
              Per POPIA's cooling-off rules, deletion will be processed on or after <strong>{sched}</strong>. You can cancel
              the request before then by replying to the confirmation email.
            </p>
          ) : (
            <p className="text-sm text-emerald-800 mt-3">
              We'll email your data export to the address on file within 30 days. Most requests are handled in 1–3 business days.
            </p>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Need to reach a human? <Link href="/" className="underline">Back to home</Link>.
        </p>
      </div>
    );
  }

  // error
  const expired = state.status === 410;
  const alreadyDone = state.status === 400;
  return (
    <div className="app-container page-wrap max-w-xl">
      <div className={"rounded-2xl border p-6 " + (expired ? "border-amber-200 bg-amber-50" : alreadyDone ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50")}>
        <h1 className={"text-lg font-bold mb-1 " + (expired ? "text-amber-900" : alreadyDone ? "text-slate-900" : "text-red-900")}>
          {expired ? "Link expired" : alreadyDone ? "Already confirmed" : "Could not confirm"}
        </h1>
        <p className={"text-sm " + (expired ? "text-amber-800" : alreadyDone ? "text-slate-700" : "text-red-800")}>
          {state.message}
        </p>
        {(expired || state.status === 403 || state.status === 404) && (
          <Link href="/popia" className="mt-4 inline-block text-sm font-semibold underline">
            Submit a new request
          </Link>
        )}
      </div>
    </div>
  );
}

export default function PopiaConfirmPage() {
  return (
    <Suspense fallback={<div className="app-container page-wrap text-center py-16 text-sm text-slate-500">Loading…</div>}>
      <ConfirmInner />
    </Suspense>
  );
}
