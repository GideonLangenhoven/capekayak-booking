"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useTheme } from "./ThemeProvider";

export default function Header() {
  const theme = useTheme();
  const name = theme.business_name || "Book Your Tour";
  const tagline = theme.business_tagline || "";
  const logoUrl = theme.logo_url;
  const voucherLabel = theme.nav_gift_voucher_label || "Gift Voucher";
  const bookingsLabel = theme.nav_my_bookings_label || "My Bookings";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="glass-nav sticky top-0 z-40">
      <div className="app-container flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-3 rounded-full px-2 py-1 transition-colors hover:bg-[color:var(--hover-overlay)]">
          {logoUrl ? (
            <Image src={logoUrl} alt={name} width={120} height={36} className="h-9 w-auto object-contain" />
          ) : (
            /* No logo configured → glass monogram chip from the business initial */
            <span
              aria-hidden="true"
              className="glass-chip flex h-9 w-9 shrink-0 items-center justify-center font-display text-base font-bold"
              style={{ color: "var(--accent-text)" }}
            >
              {name.trim().charAt(0).toUpperCase() || "B"}
            </span>
          )}
          <div>
            <h1 className="font-display text-base font-semibold leading-tight text-[color:var(--ink-nav)] sm:text-lg">{name}</h1>
            {tagline && <p className="glass-eyebrow normal-case tracking-normal">{tagline}</p>}
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm lg:flex">
          <Link href="/" className="btn btn-ghost px-3 py-2">Book Your Tour</Link>
          <Link href="/voucher" className="btn btn-ghost px-3 py-2">{voucherLabel}</Link>
          <Link href="/my-bookings" className="btn btn-primary px-4 py-2">{bookingsLabel}</Link>
        </nav>

        {/* Mobile/tablet hamburger (primary nav also lives in the bottom glass bar) */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="relative flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--ink-nav)] transition-colors hover:bg-[color:var(--hover-overlay)] lg:hidden"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            {menuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-[color:var(--glass-border)] lg:hidden">
          <nav className="app-container flex flex-col gap-1 py-3">
            <Link href="/voucher" onClick={() => setMenuOpen(false)} className="rounded-full px-4 py-3 text-sm font-medium text-[color:var(--ink-nav)] hover:bg-[color:var(--hover-overlay)]">
              {voucherLabel}
            </Link>
            <Link href="/my-bookings" onClick={() => setMenuOpen(false)} className="rounded-full px-4 py-3 text-sm font-medium text-[color:var(--ink-nav)] hover:bg-[color:var(--hover-overlay)]">
              {bookingsLabel}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
