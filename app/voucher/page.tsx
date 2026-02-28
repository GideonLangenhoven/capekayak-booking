"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Button from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/Input";
import Card from "../components/ui/Card";

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

  if (loading) return <div className="app-loader"><div className="spinner" /></div>;

  return (
    <div className="app-container page-wrap max-w-lg">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-3xl">🎁</span></div>
        <h2 className="headline-lg">Share a Kayak Adventure</h2>
        <p className="mt-2">Purchase a gift voucher for someone special. Valid for 12 months.</p>
      </div>

      {step === "pick" && (
        <div className="space-y-3">
          <p className="field-label mb-2">Choose a Tour</p>
          {tours.map((t) => (
            <button key={t.id} onClick={() => { setSelectedTour(t); setStep("details"); }}
              className="surface w-full p-5 text-left hover:border-[color:var(--accent)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[color:var(--text)]">{t.name}</h3>
                  <p className="text-sm">{t.duration_minutes} min</p>
                </div>
                <span className="text-2xl font-bold text-[color:var(--text)]">R{t.base_price_per_person}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <Button onClick={() => setStep("pick")} variant="ghost" className="px-0">← Back to tours</Button>
          <Card muted className="p-4">
            <p className="font-semibold text-[color:var(--text)]">{selectedTour?.name} Voucher</p>
            <p className="text-sm">Value: R{selectedTour?.base_price_per_person} · Valid 12 months</p>
          </Card>
          <div>
            <label className="field-label">Recipient Name *</label>
            <Input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient's name" />
          </div>
          <div>
            <label className="field-label">Personal Message (optional)</label>
            <Textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} rows={3} placeholder="Happy Birthday! Enjoy the adventure..." className="resize-none" />
          </div>
          <div>
            <label className="field-label">Your Name *</label>
            <Input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="field-label">Your Email *</label>
            <Input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="We'll send the voucher here" />
          </div>
          <Card muted className="flex items-center justify-between p-4">
            <span className="font-medium">Total</span>
            <span className="text-2xl font-bold text-[color:var(--text)]">R{selectedTour?.base_price_per_person}</span>
          </Card>
          <Button onClick={submitVoucher} disabled={submitting || !recipientName.trim() || !buyerName.trim() || !buyerEmail.trim()} fullWidth className="py-3.5">
            {submitting ? "Processing..." : "Purchase Voucher — R" + selectedTour?.base_price_per_person}
          </Button>
        </div>
      )}

      {step === "pay" && (
        <div className="panel-enter py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-3xl">💳</span></div>
          <h3 className="headline-md mb-2">Complete Secure Payment</h3>
          <p className="mb-6">After payment, the voucher will be emailed to {buyerEmail}.</p>
          <a href={paymentUrl} className="btn btn-primary px-10 py-4">
            Pay R{selectedTour?.base_price_per_person}
          </a>
        </div>
      )}
    </div>
  );
}
