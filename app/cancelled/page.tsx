"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "../components/ThemeProvider";

export default function CancelledPage() {
  const theme = useTheme();
  const [checkout, setCheckout] = useState<{ url: string; ref: string } | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("bt-checkout-" + theme.id) || "null");
      if (!saved || !Number.isFinite(Date.parse(saved.expiresAt)) || Date.parse(saved.expiresAt) <= Date.now()) return;
      const url = new URL(saved.url);
      if (url.protocol === "https:" && (url.hostname === "c.yoco.com" || url.hostname === "payments.yoco.com")) setCheckout(saved);
    } catch { /* Show the booking lookup if this browser has no saved checkout. */ }
  }, [theme.id]);
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">

      <h2 className="text-3xl font-bold mb-3 text-[color:var(--ink)]">Payment unfinished</h2>
      <p className="text-[color:var(--ink-muted)] mb-8">If you stopped before paying, you can resume your checkout while the reservation is held. If you already paid, check My Bookings before making another payment.</p>
      <div className="space-y-3">
        {checkout && <a href={checkout.url} className="btn btn-primary w-full">Resume payment · {checkout.ref}</a>}
        <Link href="/my-bookings" className="btn btn-secondary w-full">Check My Bookings</Link>
        <Link href="/" className="btn btn-secondary w-full">Browse departures</Link>
      </div>
    </div>
  );
}
