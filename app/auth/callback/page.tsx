"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          setError("Sign-in link expired. Please try again.");
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try { await supabase.rpc("link_customer_user"); } catch (_) { void _; }
        if (session.user?.email) {
          try { await supabase.from("customers").update({ email: session.user.email }).eq("user_id", session.user.id); } catch (_) { void _; }
        }
        router.replace("/my-bookings");
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
        if (event === "SIGNED_IN" && sess) {
          try { await supabase.rpc("link_customer_user"); } catch (_) { void _; }
          if (sess.user?.email) {
            try { await supabase.from("customers").update({ email: sess.user.email }).eq("user_id", sess.user.id); } catch (_) { void _; }
          }
          subscription.unsubscribe();
          router.replace("/my-bookings");
        }
      });

      setTimeout(() => {
        subscription.unsubscribe();
        setError("Sign-in failed. Please try again.");
      }, 10000);
    }
    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="app-container max-w-sm py-16 px-4 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <a href="/my-bookings" className="text-sm text-[color:var(--accent)] hover:underline">Back to login</a>
      </div>
    );
  }

  return (
    <div className="app-container max-w-sm py-16 px-4 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--accentSoft)]">
        <svg className="w-7 h-7 text-[color:var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <p className="text-sm text-[color:var(--textMuted)]">Signing you in...</p>
    </div>
  );
}
