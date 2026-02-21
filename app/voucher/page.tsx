"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function VoucherPage() {
  const [tours, setTours] = useState<any[]>([]);
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [recipientName, setRecipientName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [step, setStep] = useState<"pick" | "details" | "pay">("pick");
  const [submitting, setSubmitting] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tours").select("*").order("base_price_per_person");
      setTours(data || []);
      setLoading(false);
    })();
  }, []);

  async function submitVoucher() {
    if (!buyerName.trim() || !buyerEmail.trim() || !recipientName.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return;
    setSubmitting(true);
    const vcode = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
    const { data: voucher, error } = await supabase.from("vouchers").insert({
      business_id: selectedTour.business_id, code: vcode, status: "PENDING", type: "FREE_TRIP",
      value: selectedTour.base_price_per_person, purchase_amount: selectedTour.base_price_per_person,
      recipient_name: recipientName, gift_message: giftMessage || null,
      buyer_name: buyerName, buyer_email: buyerEmail.toLowerCase(), tour_name: selectedTour.name,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();
    if (error || !voucher) { alert("Something went wrong."); setSubmitting(false); return; }
    const yocoRes = await supabase.functions.invoke("create-checkout", {
      body: { voucher_id: voucher.id, voucher_code: vcode, amount: selectedTour.base_price_per_person, type: "GIFT_VOUCHER" },
    });
    console.log("VOUCHER_CHECKOUT:", JSON.stringify(yocoRes.data));
    if (yocoRes.data?.redirectUrl) { setPaymentUrl(yocoRes.data.redirectUrl); setStep("pay"); }
    else alert("Payment link unavailable.");
    setSubmitting(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>;

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">🎁</span></div>
        <h2 className="text-3xl font-bold">Gift a Kayak Adventure</h2>
        <p className="text-gray-500 mt-2">The perfect gift for someone special. Valid for 12 months.</p>
      </div>

      {step === "pick" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-2">Choose a tour</p>
          {tours.map((t) => (
            <button key={t.id} onClick={() => { setSelectedTour(t); setStep("details"); }}
              className="w-full text-left border-2 border-gray-200 rounded-2xl p-5 hover:border-gray-900 transition-colors">
              <div className="flex justify-between items-center">
                <div><h3 className="font-semibold text-lg">{t.name}</h3><p className="text-sm text-gray-500">{t.duration_minutes} min</p></div>
                <span className="text-2xl font-bold">R{t.base_price_per_person}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <button onClick={() => setStep("pick")} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="font-semibold">{selectedTour?.name} Voucher</p>
            <p className="text-sm text-amber-700">Value: R{selectedTour?.base_price_per_person} · Valid 12 months</p>
          </div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-1">Who is this for? *</label>
            <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient's name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-1">Personal Message (optional)</label>
            <textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} rows={3} placeholder="Happy Birthday! Enjoy the adventure..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 resize-none" /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-1">Your Name *</label>
            <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Your name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-1">Your Email *</label>
            <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="We'll send the voucher here"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900" /></div>
          <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
            <span className="text-gray-600 font-medium">Total</span>
            <span className="text-2xl font-bold">R{selectedTour?.base_price_per_person}</span>
          </div>
          <button onClick={submitVoucher} disabled={submitting || !recipientName.trim() || !buyerName.trim() || !buyerEmail.trim()}
            className="w-full bg-gray-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 shadow-md">
            {submitting ? "Processing..." : "Purchase Voucher — R" + selectedTour?.base_price_per_person}
          </button>
        </div>
      )}

      {step === "pay" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">💳</span></div>
          <h3 className="text-2xl font-bold mb-2">Complete Payment</h3>
          <p className="text-gray-500 mb-6">After payment, the voucher will be emailed to {buyerEmail}</p>
          <a href={paymentUrl} className="inline-block bg-gray-900 text-white px-10 py-4 rounded-xl text-sm font-semibold hover:bg-gray-800 shadow-md">
            Pay R{selectedTour?.base_price_per_person} →
          </a>
        </div>
      )}
    </div>
  );
}
