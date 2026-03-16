import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import CookieBanner from "./components/CookieBanner";
import ThemeProvider from "./components/ThemeProvider";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "Kayaks Adventures | Book Your Tour",
  description: "Book a premium kayak tour. Sea kayaking experiences since 1994.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <Header />
          <main className="min-h-[calc(100dvh-12rem)]">{children}</main>
          <footer className="mt-14 border-t border-[color:var(--border)]">
            <div className="app-container py-8 text-center text-sm text-[color:var(--textMuted)]">
              <p className="max-w-none">Kayaks Adventures · Coastal Activity Centre</p>
              <p className="mt-1 max-w-none">Established: 1994 · ActivityHub Platform</p>
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
