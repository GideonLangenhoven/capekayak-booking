"use client";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";

export default function Header() {
  var theme = useTheme();
  var name = theme.business_name || "Cape Kayak Adventures";
  var tagline = theme.business_tagline || "Cape Town\u2019s Original Since 1994";
  var logoUrl = theme.logo_url;

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
            <p className="text-xs text-[color:var(--textMuted)]">{tagline}</p>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/voucher" className="btn btn-ghost px-3 py-2">Gift Voucher</Link>
          <Link href="/my-bookings" className="btn btn-primary px-4 py-2">My Bookings</Link>
        </nav>
      </div>
    </header>
  );
}
