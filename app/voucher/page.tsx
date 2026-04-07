"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useTheme } from "../components/ThemeProvider";
import Button from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/Input";
import Card from "../components/ui/Card";
import VoucherSkeleton from "../components/skeletons/VoucherSkeleton";
import Toast from "../components/ui/Toast";
import { useToast } from "../hooks/useToast";

export default function VoucherPage() {
  const theme = useTheme();
  const [amount, setAmount] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [step, setStep] = useState<"amount" | "details" | "pay">("amount");
  const [submitting, setSubmitting] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast, showToast, dismissToast } = useToast();

  const presets = [250, 500, 750, 1000, 1500, 2000];
  const parsedAmount = Number(amount) || 0;

  useEffect(() => {
    if (theme.id) setLoading(false);
  }, [theme.id]);

  async function submitVoucher() {
    if (!parsedAmount || parsedAmount < 50 || !buyerName.trim() || !buyerEmail.trim() || !recipientName.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return;
    setSubmitting(true);
    const vcode = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
    const { data: voucher, error } = await supabase.from("vouchers").insert({
      business_id: theme.id, code: vcode, status: "PENDING", type: "MONETARY",
      value: parsedAmount, purchase_amount: parsedAmount,
      current_balance: parsedAmount,
      recipient_name: recipientName, gift_message: giftMessage || null,
      buyer_name: buyerName, buyer_email: buyerEmail.toLowerCase(),
      expires_at: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();
    if (error || !voucher) { showToast("Something went wrong.", "error"); setSubmitting(false); return; }
    const yocoRes = await supabase.functions.invoke("create-checkout", {
      body: { voucher_id: voucher.id, voucher_code: vcode, amount: parsedAmount, type: "GIFT_VOUCHER" },
    });
    if (yocoRes.data?.redirectUrl) { setPaymentUrl(yocoRes.data.redirectUrl); setStep("pay"); }
    else showToast("Payment link unavailable.", "error");
    setSubmitting(false);
  }

  if (loading) return <VoucherSkeleton />;

  return (
    <div className="app-container page-wrap max-w-lg">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-3xl">🎁</span></div>
        <h2 className="headline-lg">Give the Gift of Adventure</h2>
        <p className="mt-2">Purchase a gift voucher valid for any {theme.business_name || ""} adventure. Valid for 3 years.</p>
      </div>

      {step === "amount" && (
        <div className="space-y-5">
          <p className="field-label mb-2">Choose an amount</p>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((v) => (
              <button key={v} onClick={() => setAmount(String(v))}
                className={"rounded-xl border-2 py-3 text-center font-semibold transition-all " + (parsedAmount === v ? "border-[color:var(--accent)] bg-[color:var(--accentSoft)] text-[color:var(--accent)]" : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] hover:border-[color:var(--accent)]")}>
                R{v}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="custom-amount" className="field-label">Or enter a custom amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--textMuted)] font-semibold">R</span>
              <Input id="custom-amount" type="number" min="50" step="50" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 350" className="pl-9" />
            </div>
            {amount && parsedAmount < 50 && <p className="text-xs text-red-500 mt-1">Minimum voucher amount is R50</p>}
          </div>
          <Button onClick={() => setStep("details")} disabled={!parsedAmount || parsedAmount < 50} fullWidth className="py-3.5">
            Continue — R{parsedAmount || 0}
          </Button>
        </div>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <Button onClick={() => setStep("amount")} variant="ghost" className="px-0">← Back</Button>
          <Card muted className="p-4">
            <p className="font-semibold text-[color:var(--text)]">Gift Voucher</p>
            <p className="text-sm">Value: R{parsedAmount} · Valid 12 months · Any activity</p>
          </Card>
          <div>
            <label htmlFor="voucher-recipient" className="field-label">Recipient Name *</label>
            <Input id="voucher-recipient" type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient's name" />
          </div>
          <div>
            <label htmlFor="voucher-message" className="field-label">Personal Message (optional)</label>
            <Textarea id="voucher-message" value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} rows={3} placeholder="Happy Birthday! Enjoy the adventure..." className="resize-none" />
          </div>
          <div>
            <label htmlFor="voucher-buyer-name" className="field-label">Your Name *</label>
            <Input id="voucher-buyer-name" type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label htmlFor="voucher-buyer-email" className="field-label">Your Email *</label>
            <Input id="voucher-buyer-email" type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="We'll send the voucher here" />
          </div>
          <Card muted className="flex items-center justify-between p-4">
            <span className="font-medium">Total</span>
            <span className="text-2xl font-bold text-[color:var(--text)]">R{parsedAmount}</span>
          </Card>
          <Button onClick={submitVoucher} disabled={submitting || !recipientName.trim() || !buyerName.trim() || !buyerEmail.trim()} fullWidth className="py-3.5">
            {submitting ? "Processing..." : "Purchase Voucher — R" + parsedAmount}
          </Button>
        </div>
      )}

      {step === "pay" && (
        <div className="panel-enter py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accentSoft)]"><span className="text-3xl">💳</span></div>
          <h3 className="headline-md mb-2">Complete Secure Payment</h3>
          <p className="mb-6">After payment, the voucher will be emailed to {buyerEmail}.</p>
          <a href={paymentUrl} className="btn btn-primary px-10 py-4">
            Pay R{parsedAmount}
          </a>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
    </div>
  );
}
