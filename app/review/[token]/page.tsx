"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<{ tourName: string | null; businessName: string | null; reviewerName: string | null } | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch("/api/review-token/" + token)
      .then(async (res) => {
        if (res.status === 410) { setSubmitted(true); setLoading(false); return; }
        if (!res.ok) { setError("This review link is invalid or has expired."); setLoading(false); return; }
        const data = await res.json();
        setInfo(data);
        if (data.reviewerName) setName(data.reviewerName);
        setLoading(false);
      })
      .catch(() => { setError("Something went wrong. Please try again."); setLoading(false); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;
    setSaving(true);
    const res = await fetch("/api/review-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, rating, comment: comment.trim() || null, reviewerName: name.trim() || null }),
    });
    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to submit. Please try again.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto bg-emerald-50 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Thank You!</h1>
          <p className="text-slate-500 text-[15px]">Your review has been submitted and will appear once approved.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Oops</h1>
          <p className="text-slate-500 text-[15px]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="bg-white rounded-3xl p-8 shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-slate-800">How was your trip?</h1>
          {info?.tourName && <p className="text-slate-500 mt-1 text-[15px]">{info.tourName}</p>}
          {info?.businessName && <p className="text-slate-400 text-[13px]">with {info.businessName}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)}
                className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                aria-label={n + " star" + (n > 1 ? "s" : "")}>
                <span className={(hoverRating || rating) >= n ? "text-amber-400" : "text-slate-200"}>★</span>
              </button>
            ))}
          </div>
          {rating === 0 && <p className="text-center text-xs text-slate-400">Tap a star to rate</p>}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Your name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              placeholder="First name" maxLength={100} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Your review <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none"
              rows={4} placeholder="Tell others about your experience..." maxLength={2000} />
          </div>

          <button type="submit" disabled={rating === 0 || saving}
            className="w-full py-3.5 rounded-xl bg-teal-500 text-white font-bold text-[15px] hover:bg-teal-600 disabled:opacity-40 transition-colors shadow-sm">
            {saving ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}
