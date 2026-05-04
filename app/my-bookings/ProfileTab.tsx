"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  customer: any;
  user: any;
  onUpdate: (next: any) => void;
  onSignOut: () => void;
};

export default function ProfileTab({ customer, user, onUpdate, onSignOut }: Props) {
  var [name, setName] = useState(customer?.name ?? "");
  var [phone, setPhone] = useState(customer?.phone ?? "");
  var [dob, setDob] = useState(customer?.date_of_birth ?? "");
  var [marketingConsent, setMarketingConsent] = useState(!!customer?.marketing_consent);
  var [emailDraft, setEmailDraft] = useState(user?.email ?? "");
  var [saving, setSaving] = useState(false);
  var [savedAt, setSavedAt] = useState<number | null>(null);
  var [emailMsg, setEmailMsg] = useState<string | null>(null);
  var [error, setError] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      var cleanPhone = phone.replace(/[\s\-()]/g, "");
      var { error: err } = await supabase
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
    var trimmed = emailDraft.trim().toLowerCase();
    if (!trimmed || trimmed === user.email) {
      setEmailMsg("That's already your current email.");
      return;
    }
    var { error: err } = await supabase.auth.updateUser({ email: trimmed });
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
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500">Trips</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">{customer?.total_bookings ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500">Member since</p>
          <p className="text-lg font-bold text-slate-900 mt-2">
            {customer?.created_at
              ? new Date(customer.created_at).toLocaleDateString("en-ZA", { month: "short", year: "numeric" })
              : "\u2014"}
          </p>
        </div>
      </div>

      {/* Details form */}
      <form onSubmit={saveProfile} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
        <h2 className="text-sm font-bold text-slate-800">Your details</h2>

        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Name</span>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500 transition-colors bg-white" />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Phone</span>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="27821234567"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500 transition-colors bg-white" />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Date of birth</span>
          <input type="date" value={dob || ""} onChange={e => setDob(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500 transition-colors bg-white" />
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer pt-1">
          <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
          <span className="text-sm text-slate-700">Send me booking updates and promotions</span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--cta, #14b8a6)" }}>
            {saving ? "Saving\u2026" : "Save changes"}
          </button>
          {savedAt && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
          {error && <span className="text-xs text-red-600 font-medium">{error}</span>}
        </div>
      </form>

      {/* Email */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
        <h2 className="text-sm font-bold text-slate-800">Email</h2>
        <p className="text-xs text-slate-500">
          We email you confirmations and magic-link sign-ins. The new address must confirm before it takes effect.
        </p>
        <input type="email" value={emailDraft} onChange={e => setEmailDraft(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500 transition-colors bg-white" />
        <button onClick={changeEmail}
          className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold shadow-sm hover:bg-amber-600 transition-colors">
          Send confirmation
        </button>
        {emailMsg && <p className="text-xs text-emerald-600 font-medium">{emailMsg}</p>}
      </div>

      {/* Security */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
        <h2 className="text-sm font-bold text-slate-800">Security</h2>
        <p className="text-xs text-slate-500">
          Sign out of every device where you're currently signed in. Useful if you've used a shared or public device.
        </p>
        <button onClick={signOutEverywhere}
          className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold shadow-sm hover:bg-slate-900 transition-colors">
          Sign out everywhere
        </button>
      </div>
    </div>
  );
}
