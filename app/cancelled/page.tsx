import Link from "next/link";

export default function CancelledPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">

      <h2 className="text-3xl font-bold mb-3 text-[color:var(--ink)]">Payment Cancelled</h2>
      <p className="text-[color:var(--ink-muted)] mb-8">No worries — your payment was not processed. Your held spots will be released shortly.</p>
      <div className="space-y-3">
        <Link href="/" className="btn btn-primary w-full">Try Again</Link>
      </div>
    </div>
  );
}
