import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import CookieBanner from "./components/CookieBanner";
import ThemeProvider from "./components/ThemeProvider";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "Cape Kayak Adventures | Book Your Tour",
  description: "Book a kayak tour in Cape Town. Sea kayaking since 1994.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <Header />
          <main className="min-h-[calc(100dvh-12rem)]">{children}</main>
          <footer className="mt-14 border-t border-[color:var(--border)]">
            <div className="app-container py-8 text-center text-sm text-[color:var(--textMuted)]">
              <p>Cape Kayak Adventures · Three Anchor Bay, Sea Point, Cape Town</p>
              <p className="mt-1">Enterprise: 2025/796484/07 · Tax: 9301707270</p>
              <nav className="mt-4 flex justify-center gap-4">
                <a href="/terms" className="underline underline-offset-2 hover:text-[color:var(--text)]">Terms &amp; Conditions</a>
                <a href="/privacy" className="underline underline-offset-2 hover:text-[color:var(--text)]">Privacy Policy</a>
                <a href="/cookies" className="underline underline-offset-2 hover:text-[color:var(--text)]">Cookies Policy</a>
              </nav>
            </div>
          </footer>
          <CookieBanner />
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
