"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

function VoucherConfirmedContent() {
  const params = useSearchParams();
  const code = params.get("code");
  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("vouchers").select("*").eq("code", code).single();
      setVoucher(data);
      setLoading(false);
    })();
  }, [code]);

  if (loading) return <div className="app-loader min-h-screen"><div className="spinner" /></div>;

  return (
    <div className="app-container max-w-md page-wrap">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-4xl">🎁</span></div>
        <h2 className="headline-lg mb-2">Voucher Purchase Confirmed</h2>
        <p>Your gift voucher is ready to share.</p>
      </div>

      {voucher && (
        <div className="surface mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accentHover)] p-5 text-white">
            <p className="text-xs uppercase tracking-wider text-white/75">Gift Voucher</p>
            <p className="mt-1 text-xl font-bold">{voucher.tour_name}</p>
            <p className="mt-2 text-3xl font-bold">R{voucher.value}</p>
          </div>
          <div className="space-y-3 p-5">
            <div>
              <p className="text-xs uppercase tracking-wider">For</p>
              <p className="font-semibold text-[color:var(--text)]">{voucher.recipient_name}</p>
            </div>
            {voucher.gift_message && (
              <div>
                <p className="text-xs uppercase tracking-wider">Message</p>
                <p className="italic">&ldquo;{voucher.gift_message}&rdquo;</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider">Voucher Code</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-[color:var(--text)]">{voucher.code}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider">Valid Until</p>
              <p className="font-semibold text-[color:var(--text)]">{voucher.expires_at ? new Date(voucher.expires_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "12 months"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider">From</p>
              <p className="font-semibold text-[color:var(--text)]">{voucher.buyer_name}</p>
            </div>
          </div>
        </div>
      )}

      <div className="surface-muted mb-6 p-4 toast-enter">
        <p className="text-sm font-medium text-[color:var(--text)]">📧 Voucher details emailed to {voucher?.buyer_email}</p>
        <p className="mt-1 text-xs">Share this code with the recipient to use during online or WhatsApp booking.</p>
      </div>

      <div className="space-y-3">
        <Link href="/voucher" className="btn btn-primary w-full py-3 text-center">Buy Another Voucher</Link>
        <Link href="/" className="btn btn-ghost w-full text-center">Back to Tours</Link>
      </div>
    </div>
  );
}

export default function VoucherConfirmedPage() {
  return <Suspense fallback={<div className="app-loader min-h-screen"><div className="spinner" /></div>}><VoucherConfirmedContent /></Suspense>;
}
