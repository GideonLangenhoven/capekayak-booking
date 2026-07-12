import Link from "next/link";

export default function CancelledPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[color:var(--danger)] rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M9 9l6 6M15 9l-6 6" /></svg>
      </div>
      <h2 className="text-3xl font-bold mb-3 text-[color:var(--ink)]">Payment Cancelled</h2>
      <p className="text-[color:var(--ink-muted)] mb-8">No worries — your payment was not processed. Your held spots will be released shortly.</p>
      <div className="space-y-3">
        <Link href="/" className="btn btn-primary w-full">Try Again</Link>
      </div>
    </div>
  );
}
