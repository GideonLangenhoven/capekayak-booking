import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import ChatWidget from "./components/ChatWidget";

export const metadata: Metadata = {
  title: "Cape Kayak Adventures | Book Your Tour",
  description: "Book a kayak tour in Cape Town. Sea kayaking since 1994.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <header className="border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🛶</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Cape Kayak Adventures</h1>
                <p className="text-xs text-gray-500">Cape Town&apos;s Original Since 1994</p>
              </div>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">Tours</Link>
              <Link href="/voucher" className="text-gray-600 hover:text-gray-900 transition-colors">Gift Voucher</Link>
              <Link href="/my-bookings" className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">My Bookings</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-gray-100 mt-16">
          <div className="max-w-5xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
            <p>Cape Kayak Adventures · Three Anchor Bay, Sea Point, Cape Town</p>
            <p className="mt-1">Enterprise: 2025/796484/07 · Tax: 9301707270</p>
          </div>
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
