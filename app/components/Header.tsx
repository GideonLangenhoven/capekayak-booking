"use client";
import Link from "next/link";
import { useState } from "react";
import { useTheme } from "./ThemeProvider";

export default function Header() {
  var theme = useTheme();
  var name = theme.business_name || "Book Your Tour";
  var tagline = theme.business_tagline || "";
  var logoUrl = theme.logo_url;
  var voucherLabel = theme.nav_gift_voucher_label || "Gift Voucher";
  var bookingsLabel = theme.nav_my_bookings_label || "My Bookings";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)] backdrop-blur">
      <div className="app-container flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-[color:var(--surface2)]">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="h-9 w-auto object-contain" />
          ) : (
            <span className="text-2xl" aria-hidden>🛶</span>
          )}
          <div>
            <h1 className="text-base font-semibold leading-tight text-[color:var(--text)] sm:text-lg">{name}</h1>
            {tagline && <p className="text-xs text-[color:var(--textMuted)]">{tagline}</p>}
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          <Link href="/voucher" className="btn btn-ghost px-3 py-2">{voucherLabel}</Link>
          <Link href="/my-bookings" className="btn btn-primary px-4 py-2">{bookingsLabel}</Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--text)] hover:bg-[color:var(--surface2)] sm:hidden"
          aria-label="Menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <div className="border-t border-[color:var(--border)] bg-[color:var(--surface)] sm:hidden">
          <nav className="app-container flex flex-col gap-1 py-3">
            <Link href="/voucher" onClick={() => setMenuOpen(false)} className="rounded-lg px-4 py-3 text-sm font-medium text-[color:var(--text)] hover:bg-[color:var(--surface2)]">
              {voucherLabel}
            </Link>
            <Link href="/my-bookings" onClick={() => setMenuOpen(false)} className="rounded-lg px-4 py-3 text-sm font-medium text-[color:var(--text)] hover:bg-[color:var(--surface2)]">
              {bookingsLabel}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
