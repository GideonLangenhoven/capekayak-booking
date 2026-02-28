import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import ChatWidget from "./components/ChatWidget";
import CookieBanner from "./components/CookieBanner";

export const metadata: Metadata = {
  title: "Cape Kayak Adventures | Book Your Tour",
  description: "Book a kayak tour in Cape Town. Sea kayaking since 1994.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)] backdrop-blur">
          <div className="app-container flex items-center justify-between py-4">
            <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-[color:var(--surface2)]">
              <span className="text-2xl" aria-hidden>🛶</span>
              <div>
                <h1 className="text-base font-semibold leading-tight text-[color:var(--text)] sm:text-lg">Cape Kayak Adventures</h1>
                <p className="text-xs text-[color:var(--textMuted)]">Cape Town&apos;s Original Since 1994</p>
              </div>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="btn btn-ghost px-3 py-2">Tours</Link>
              <Link href="/voucher" className="btn btn-ghost px-3 py-2">Gift Voucher</Link>
              <Link href="/my-bookings" className="btn btn-primary px-4 py-2">My Bookings</Link>
            </nav>
          </div>
        </header>
        <main className="min-h-[calc(100dvh-12rem)]">{children}</main>
        <footer className="mt-14 border-t border-[color:var(--border)]">
          <div className="app-container py-8 text-center text-sm text-[color:var(--textMuted)]">
            <p>Cape Kayak Adventures · Three Anchor Bay, Sea Point, Cape Town</p>
            <p className="mt-1">Enterprise: 2025/796484/07 · Tax: 9301707270</p>
          </div>
        </footer>
        <CookieBanner />
        <ChatWidget />
      </body>
    </html>
  );
}
