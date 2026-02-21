"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

function VoucherConfirmedContent() {
  var params = useSearchParams();
  var code = params.get("code");
  var [voucher, setVoucher] = useState<any>(null);
  var [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) { setLoading(false); return; }
    (async () => {
      var { data } = await supabase.from("vouchers").select("*").eq("code", code).single();
      setVoucher(data);
      setLoading(false);
    })();
  }, [code]);

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" /></div>;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-4xl">🎁</span></div>
        <h2 className="text-3xl font-bold mb-2">Voucher Purchased!</h2>
        <p className="text-gray-500">The perfect gift for an adventure lover</p>
      </div>

      {voucher && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-5">
            <p className="text-xs uppercase tracking-wider opacity-80">Gift Voucher</p>
            <p className="text-xl font-bold mt-1">{voucher.tour_name}</p>
            <p className="text-3xl font-bold mt-2">R{voucher.value}</p>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">For</p>
              <p className="font-semibold">{voucher.recipient_name}</p>
            </div>
            {voucher.gift_message && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Message</p>
                <p className="text-gray-600 italic">&ldquo;{voucher.gift_message}&rdquo;</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Voucher Code</p>
              <p className="font-mono text-2xl font-bold tracking-widest text-gray-900 mt-1">{voucher.code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Valid Until</p>
              <p className="font-semibold">{voucher.expires_at ? new Date(voucher.expires_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "12 months"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">From</p>
              <p className="font-semibold">{voucher.buyer_name}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-800 font-medium">📧 Voucher details emailed to {voucher?.buyer_email}</p>
        <p className="text-xs text-blue-600 mt-1">Share the code with the recipient — they can use it when booking online or via WhatsApp.</p>
      </div>

      <div className="space-y-3">
        <Link href="/voucher" className="block bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold text-center hover:bg-gray-800">Buy Another Voucher</Link>
        <Link href="/" className="block text-center text-gray-500 text-sm hover:text-gray-900">Back to Home</Link>
      </div>
    </div>
  );
}

export default function VoucherConfirmedPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" /></div>}><VoucherConfirmedContent /></Suspense>;
}
