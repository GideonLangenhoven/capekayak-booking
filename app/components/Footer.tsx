"use client";
import { useTheme } from "./ThemeProvider";
import { BrandMark, BrandWordmark } from "./BrandLogo";

export default function Footer() {
  const theme = useTheme();
  const name = theme.business_name || "Your Booking";
  const line1 = theme.footer_line_one || (name + (theme.business_tagline ? " \u00B7 " + theme.business_tagline : ""));
  const line2 = theme.footer_line_two || "";

  return (
    <footer className="mt-14 px-4 pb-24 lg:pb-6">
      <div className="glass-sheet app-container py-8 text-center text-sm text-[color:var(--ink-muted)]">
        <p className="max-w-none">{line1}</p>
        {line2 && <p className="mt-1 max-w-none">{line2}</p>}
        <p className="glass-chip mx-auto mt-4 inline-flex max-w-full items-center gap-2 px-4 py-2 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          <span>Secure checkout — payments processed by PCI DSS compliant providers &middot; card details never touch our servers &middot; TLS encrypted</span>
        </p>
        <nav className="mt-4 flex flex-wrap justify-center gap-4">
          <a href="/terms" className="underline underline-offset-2 hover:text-[color:var(--ink)]">Terms &amp; Conditions</a>
          <a href="/privacy" className="underline underline-offset-2 hover:text-[color:var(--ink)]">Privacy Policy</a>
          <a href="/cookies" className="underline underline-offset-2 hover:text-[color:var(--ink)]">Cookies Policy</a>
          {/* AK1: surface the POPIA data-subject request form alongside the
              other legal links so customers can find it without needing
              the direct URL. */}
          <a href="/popia" className="underline underline-offset-2 hover:text-[color:var(--ink)]">Privacy Request</a>
        </nav>
        <a
          href="https://bookingtours.co.za"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 opacity-70 transition-opacity hover:opacity-100"
          title="Powered by BookingTours"
        >
          <BrandMark size={16} />
          <span className="flex items-baseline gap-1.5 text-[color:var(--textMuted)]">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em]">Powered by</span>
            <BrandWordmark className="text-[13px]" />
          </span>
        </a>
      </div>
    </footer>
  );
}
