"use client";
import { useTheme } from "./ThemeProvider";

export default function Footer() {
  var theme = useTheme();
  var name = theme.business_name || "Your Booking";
  var line1 = theme.footer_line_one || (name + (theme.business_tagline ? " \u00B7 " + theme.business_tagline : ""));
  var line2 = theme.footer_line_two || "";

  return (
    <footer className="mt-14 border-t border-[color:var(--border)]">
      <div className="app-container py-8 text-center text-sm text-[color:var(--textMuted)]">
        <p className="max-w-none">{line1}</p>
        {line2 && <p className="mt-1 max-w-none">{line2}</p>}
        <nav className="mt-4 flex justify-center gap-4">
          <a href="/terms" className="underline underline-offset-2 hover:text-[color:var(--text)]">Terms &amp; Conditions</a>
          <a href="/privacy" className="underline underline-offset-2 hover:text-[color:var(--text)]">Privacy Policy</a>
          <a href="/cookies" className="underline underline-offset-2 hover:text-[color:var(--text)]">Cookies Policy</a>
        </nav>
      </div>
    </footer>
  );
}
