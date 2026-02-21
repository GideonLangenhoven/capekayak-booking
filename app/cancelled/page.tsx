import Link from "next/link";

export default function CancelledPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">❌</span></div>
      <h2 className="text-3xl font-bold mb-3">Payment Cancelled</h2>
      <p className="text-gray-500 mb-8">No worries — your payment was not processed. Your held spots will be released shortly.</p>
      <div className="space-y-3">
        <Link href="/" className="block bg-gray-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800">Try Again</Link>
      </div>
    </div>
  );
}
