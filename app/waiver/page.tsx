"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg",
  });
}

function WaiverContent() {
  const params = useSearchParams();
  const bookingId = params.get("booking") || "";
  const token = params.get("token") || "";

  const [booking, setBooking] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [signerName, setSignerName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptRisk, setAcceptRisk] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);

  useEffect(() => {
    if (!bookingId || !token) { setLoading(false); return; }
    (async () => {
      const { data: b } = await supabase.from("bookings")
        .select("id, business_id, customer_name, qty, waiver_status, waiver_token, waiver_signed_at, waiver_signed_name, waiver_payload, slots(start_time)")
        .eq("id", bookingId)
        .maybeSingle();

      if (!b || b.waiver_token !== token) {
        setError("This waiver link is invalid or has expired.");
        setLoading(false);
        return;
      }

      setBooking(b);
      setSignerName(b.customer_name || "");

      if (b.business_id) {
        const { data: biz } = await supabase.from("businesses")
          .select("id, name, business_name, timezone")
          .eq("id", b.business_id)
          .maybeSingle();
        setBusiness(biz);
      }
      setLoading(false);
    })();
  }, [bookingId, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signerName.trim()) { setError("Please enter your full name."); return; }
    if (!acceptRisk || !guardianConsent) { setError("Please accept all required confirmations."); return; }

    setSubmitting(true);
    setError("");
    const { error: updateErr } = await supabase.from("bookings").update({
      waiver_status: "SIGNED",
      waiver_signed_at: new Date().toISOString(),
      waiver_signed_name: signerName.trim(),
      waiver_payload: {
        notes: notes.trim() || null,
        id_number: idNumber.trim() || null,
        accept_risk: true,
        guardian_consent: true,
        user_agent: navigator.userAgent || null,
      },
    }).eq("id", bookingId).eq("waiver_token", token);

    if (updateErr) {
      setError("Failed to save waiver: " + updateErr.message);
      setSubmitting(false);
      return;
    }
    setSuccess(true);
    setSubmitting(false);
  }

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-[color:var(--textMuted)]">Loading waiver...</div>;
  }

  if (!bookingId || !token) {
    return (
      <div className="app-container py-12">
        <div className="max-w-xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 text-center">
          This waiver link is incomplete. Please open the link from your booking confirmation email.
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="app-container py-12">
        <div className="max-w-xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 text-center">{error}</div>
      </div>
    );
  }

  const brandName = business?.business_name || business?.name || "Your Operator";
  const ref = bookingId.substring(0, 8).toUpperCase();
  const alreadySigned = booking?.waiver_status === "SIGNED";

  if (success || alreadySigned) {
    return (
      <div className="app-container py-12">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden shadow-lg">
            <div className="bg-gradient-to-br from-[#0f172a] to-[#134e4a] text-white p-8">
              <h1 className="text-3xl font-bold mb-2">Waiver signed</h1>
              <p className="opacity-80">Thank you — your waiver has been recorded and attached to your booking.</p>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--textMuted)] font-semibold mb-1">Reference</div>
                  <div className="font-medium">{ref}</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--textMuted)] font-semibold mb-1">Signed by</div>
                  <div className="font-medium">{booking?.waiver_signed_name || signerName}</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--textMuted)] font-semibold mb-1">Guests</div>
                  <div className="font-medium">{booking?.qty || 1}</div>
                </div>
                {booking?.waiver_payload?.id_number && (
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
                    <div className="text-xs uppercase tracking-wider text-[color:var(--textMuted)] font-semibold mb-1">ID / Passport</div>
                    <div className="font-medium">{booking.waiver_payload.id_number}</div>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
                Waiver signed and recorded. You&apos;re all set for your trip with {brandName}!
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container py-12">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden shadow-lg">
          <div className="bg-gradient-to-br from-[#0f172a] to-[#134e4a] text-white p-8">
            <h1 className="text-3xl font-bold mb-2">Complete your waiver</h1>
            <p className="opacity-80">{brandName} needs a signed waiver before the trip starts. This form covers the booking contact and the guests attached to this reservation.</p>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
                <div className="text-xs uppercase tracking-wider text-[color:var(--textMuted)] font-semibold mb-1">Reference</div>
                <div className="font-medium">{ref}</div>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
                <div className="text-xs uppercase tracking-wider text-[color:var(--textMuted)] font-semibold mb-1">Guest</div>
                <div className="font-medium">{booking?.customer_name}</div>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
                <div className="text-xs uppercase tracking-wider text-[color:var(--textMuted)] font-semibold mb-1">Guests</div>
                <div className="font-medium">{booking?.qty || 1}</div>
              </div>
              {booking?.slots?.start_time && (
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--textMuted)] font-semibold mb-1">Trip time</div>
                  <div className="font-medium text-sm">{fmtDateTime(booking.slots.start_time)}</div>
                </div>
              )}
            </div>

            {/* Waiver terms */}
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-5 mb-6 max-h-80 overflow-y-auto text-sm leading-relaxed text-[color:var(--textMuted)]">
              <p className="font-bold text-base text-[color:var(--text)] mb-3">Indemnity, Assumption of Risk &amp; Release of Liability</p>
              <p className="mb-2"><strong>1. Nature of Activity &amp; Inherent Risks</strong><br/>
              I understand that adventure and outdoor activities — including but not limited to kayaking, paddling, hiking, water-based excursions, and associated transfers — involve inherent risks and dangers that cannot be eliminated. These include, without limitation: adverse or unpredictable weather and sea conditions; collision with vessels, rocks, or other obstacles; capsizing or falling into water; exhaustion; hypothermia; marine wildlife encounters; equipment failure; and the physical demands of the activity. I voluntarily and knowingly accept these risks.</p>
              <p className="mb-2"><strong>2. Assumption of Risk</strong><br/>
              I freely and voluntarily accept and assume all risks of injury, loss, damage, or death arising from my participation and the participation of the guests listed on this booking, whether caused by the negligence of the operator, its employees, guides, or agents, or by any other cause. I acknowledge that no assurance of safety has been given to me.</p>
              <p className="mb-2"><strong>3. Release and Indemnity</strong><br/>
              In consideration of being permitted to participate, I hereby release, indemnify and hold harmless the operator, its owners, directors, employees, guides, contractors and agents (collectively &quot;the Operator&quot;) from any and all claims, actions, damages, liability, costs and expenses — including legal fees — arising from or relating to my participation or the participation of any guest on this booking, even if such loss or damage arises from the Operator&apos;s negligence, to the fullest extent permitted by applicable law.</p>
              <p className="mb-2"><strong>4. Medical Fitness</strong><br/>
              I confirm that I and all guests on this booking are in good physical health and are not aware of any medical condition, disability, or impairment that would increase the risk of participation or endanger themselves or others. I accept full responsibility for disclosing any relevant medical information to the Operator&apos;s guides before the activity commences. I authorise the Operator to seek emergency medical treatment on my behalf or on behalf of any guest if deemed necessary, and I accept responsibility for any associated costs.</p>
              <p className="mb-2"><strong>5. Compliance with Instructions</strong><br/>
              I agree to follow all safety briefings and instructions given by the Operator&apos;s guides at all times. I understand that failure to comply may result in removal from the activity without refund.</p>
              <p className="mb-2"><strong>6. Personal Property</strong><br/>
              I acknowledge that the Operator accepts no liability for loss of or damage to personal property, including electronic devices, valuables, or vehicles, however caused.</p>
              <p className="mb-2"><strong>7. Photography &amp; Media</strong><br/>
              I consent to the Operator photographing or filming me and the guests on this booking during the activity and using such images for marketing, social media, or promotional purposes without compensation, unless I notify the Operator&apos;s guide in person before the activity begins.</p>
              <p className="mb-2"><strong>8. Governing Law</strong><br/>
              This waiver is governed by the laws of the Republic of South Africa. Any dispute shall be subject to the jurisdiction of the South African courts. This document constitutes the entire agreement between the parties regarding assumption of risk and release of liability and supersedes any prior representations.</p>
              <p className="text-xs text-[color:var(--textMuted)]">By submitting this form you confirm that you have read, understood and agreed to all of the above terms on behalf of yourself and all guests listed on this booking.</p>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-4 text-red-700 text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Full name of person signing</label>
                <input type="text" required value={signerName} onChange={e => setSignerName(e.target.value)}
                  placeholder="First and last name"
                  className="w-full rounded-2xl border border-[color:var(--border)] px-4 py-3 text-base bg-[color:var(--card)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  SA ID number or passport number <span className="font-normal text-[color:var(--textMuted)]">(optional — strengthens identity verification)</span>
                </label>
                <input type="text" value={idNumber} onChange={e => setIdNumber(e.target.value)}
                  placeholder="e.g. 8001015009087 or A12345678" autoComplete="off"
                  className="w-full rounded-2xl border border-[color:var(--border)] px-4 py-3 text-base bg-[color:var(--card)] outline-none focus:ring-2 focus:ring-[color:var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Medical or mobility notes for the team (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                  placeholder="Any medical conditions, injuries, mobility limitations, dietary requirements, or notes about any guest in this booking."
                  className="w-full rounded-2xl border border-[color:var(--border)] px-4 py-3 text-base bg-[color:var(--card)] outline-none resize-y focus:ring-2 focus:ring-[color:var(--accent)]" />
              </div>

              <label className="flex gap-3 items-start rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4 cursor-pointer">
                <input type="checkbox" checked={acceptRisk} onChange={e => setAcceptRisk(e.target.checked)}
                  className="mt-1 w-5 h-5 shrink-0" />
                <span className="text-sm text-[color:var(--textMuted)] leading-relaxed">
                  I have read the full Indemnity, Assumption of Risk &amp; Release of Liability above. I understand and accept all terms on behalf of myself and all guests on this booking, including the inherent risks of the activity and the release of the Operator from liability.
                </span>
              </label>

              <label className="flex gap-3 items-start rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-4 cursor-pointer">
                <input type="checkbox" checked={guardianConsent} onChange={e => setGuardianConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 shrink-0" />
                <span className="text-sm text-[color:var(--textMuted)] leading-relaxed">
                  If any participant in this booking is under 18 years of age, I confirm that I am their parent or legal guardian and I accept all terms on their behalf with full legal authority to do so.
                </span>
              </label>

              <button type="submit" disabled={submitting}
                className="w-full rounded-full py-4 text-base font-bold text-white bg-gradient-to-br from-[#0f766e] to-[#134e4a] hover:opacity-90 disabled:opacity-50 transition-opacity">
                {submitting ? "Saving..." : "Sign waiver"}
              </button>
            </form>

            <p className="mt-6 text-xs text-[color:var(--textMuted)] leading-relaxed">
              This record is timestamped and attached to your booking. If something looks wrong, reply to your booking confirmation email so the operator can help.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WaiverPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-[color:var(--textMuted)]">Loading...</div>}>
      <WaiverContent />
    </Suspense>
  );
}
