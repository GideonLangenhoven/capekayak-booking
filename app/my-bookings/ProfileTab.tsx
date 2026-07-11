"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Input";

type Props = {
  customer: any;
  user: any;
  onUpdate: (next: any) => void;
  onSignOut: () => void;
};

const cardCls = "rounded-2xl border p-5";
const cardStyle = { background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" } as const;

export default function ProfileTab({ customer, user, onUpdate, onSignOut }: Props) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [dob, setDob] = useState(customer?.date_of_birth ?? "");
  const [marketingConsent, setMarketingConsent] = useState(!!customer?.marketing_consent);
  const [emailDraft, setEmailDraft] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const cleanPhone = phone.replace(/[\s\-()]/g, "");
      const { error: err } = await supabase
        .from("customers")
        .update({
          name: (name || "").trim() || null,
          phone: cleanPhone || null,
          date_of_birth: dob || null,
          marketing_consent: marketingConsent,
        })
        .eq("id", customer.id);
      if (err) throw err;
      onUpdate({ ...customer, name: (name || "").trim(), phone: cleanPhone, date_of_birth: dob, marketing_consent: marketingConsent });
      setSavedAt(Date.now());
    } catch (err: any) {
      setError(err?.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    setEmailMsg(null);
    setError(null);
    const trimmed = emailDraft.trim().toLowerCase();
    if (!trimmed || trimmed === user.email) {
      setEmailMsg("That's already your current email.");
      return;
    }
    const { error: err } = await supabase.auth.updateUser({ email: trimmed });
    if (err) {
      setError(err.message);
      return;
    }
    setEmailMsg("Confirmation link sent to " + trimmed + ". Click it to finish the change.");
  }

  async function signOutEverywhere() {
    if (!confirm("Sign out of every device? You'll need a fresh magic link to sign back in.")) return;
    await supabase.auth.signOut({ scope: "global" });
    onSignOut();
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cardCls} style={cardStyle}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--textMuted)]">Trips</p>
          <p className="font-display mt-2 text-[32px] font-semibold leading-none text-[color:var(--text)]">{customer?.total_bookings ?? 0}</p>
        </div>
        <div className={cardCls} style={cardStyle}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--textMuted)]">Member since</p>
          <p className="font-display mt-2 text-[22px] font-semibold leading-none text-[color:var(--text)]">
            {customer?.created_at
              ? new Date(customer.created_at).toLocaleDateString("en-ZA", { month: "short", year: "numeric" })
              : "—"}
          </p>
        </div>
      </div>

      {/* Details form */}
      <form onSubmit={saveProfile} className={cardCls + " space-y-4"} style={cardStyle}>
        <h2 className="text-[14px] font-semibold text-[color:var(--text)]">Your details</h2>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[color:var(--textMuted)]">Name</span>
          <Input value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="py-2.5" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[color:var(--textMuted)]">Phone</span>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="27821234567" autoComplete="tel" className="py-2.5" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[color:var(--textMuted)]">Date of birth</span>
          <Input type="date" value={dob || ""} onChange={e => setDob(e.target.value)} className="py-2.5" />
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 pt-1">
          <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)}
            className="h-4 w-4 rounded" style={{ accentColor: "var(--accent)" }} />
          <span className="text-sm text-[color:var(--text)]">Send me booking updates and promotions</span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={saving} className="!text-[13px]">
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {savedAt && <span className="text-xs font-semibold" style={{ color: "var(--success)" }}>Saved</span>}
          {error && <span role="alert" className="text-xs font-semibold" style={{ color: "var(--danger)" }}>{error}</span>}
        </div>
      </form>

      {/* Email */}
      <div className={cardCls + " space-y-3"} style={cardStyle}>
        <h2 className="text-[14px] font-semibold text-[color:var(--text)]">Email</h2>
        <p className="text-xs leading-relaxed text-[color:var(--textMuted)]">
          We email you confirmations and sign-in links. The new address must confirm before it takes effect.
        </p>
        <Input type="email" value={emailDraft} onChange={e => setEmailDraft(e.target.value)} autoComplete="email" className="py-2.5" />
        <Button onClick={changeEmail} variant="secondary" className="!text-[13px]">
          Send confirmation
        </Button>
        {emailMsg && <p className="text-xs font-semibold" style={{ color: "var(--success)" }}>{emailMsg}</p>}
      </div>

      {/* Security */}
      <div className={cardCls + " space-y-3"} style={cardStyle}>
        <h2 className="text-[14px] font-semibold text-[color:var(--text)]">Security</h2>
        <p className="text-xs leading-relaxed text-[color:var(--textMuted)]">
          Sign out of every device where you&apos;re currently signed in. Useful if you&apos;ve used a shared or public device.
        </p>
        <Button onClick={signOutEverywhere} variant="destructive" className="!text-[13px]">
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
