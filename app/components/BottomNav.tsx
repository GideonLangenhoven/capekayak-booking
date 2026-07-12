"use client";

// Floating mobile glass nav (spec §3): Home / Voucher / My Bookings, active
// item in a filled accent circle. Hidden ≥1024px (desktop uses the top nav)
// and inside the embed widget (embed/layout.tsx hides .glass-bottom-nav).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./ThemeProvider";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function HomeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...STROKE}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
}
function GiftIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...STROKE}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" /><path d="M12 8v13" /><path d="M12 8c-2.5 0-4.5-1.2-4.5-2.9C7.5 3.9 8.6 3 9.9 3 11.6 3 12 5.2 12 8Zm0 0c2.5 0 4.5-1.2 4.5-2.9C16.5 3.9 15.4 3 14.1 3 12.4 3 12 5.2 12 8Z" /></svg>;
}
function TicketIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" {...STROKE}><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z" /><path d="M13 5v2m0 4v2m0 4v2" /></svg>;
}

export default function BottomNav() {
  const theme = useTheme();
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/embed")) return null;

  const items = [
    { href: "/", label: "Book", icon: <HomeIcon /> },
    { href: "/voucher", label: theme.nav_gift_voucher_label || "Voucher", icon: <GiftIcon /> },
    { href: "/my-bookings", label: theme.nav_my_bookings_label || "Bookings", icon: <TicketIcon /> },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/book") : pathname.startsWith(href));

  return (
    <nav
      aria-label="Primary"
      className="glass-bottom-nav glass-nav fixed inset-x-4 bottom-3 z-40 flex items-center justify-around rounded-full px-2 py-2 lg:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex min-h-[44px] min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
              style={active
                ? { background: "var(--accent)", color: "var(--ink-on-main)" }
                : { color: "var(--ink-muted)" }}
            >
              {item.icon}
            </span>
            <span className="text-[11px] font-semibold" style={{ color: active ? "var(--ink)" : "var(--ink-muted)" }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
