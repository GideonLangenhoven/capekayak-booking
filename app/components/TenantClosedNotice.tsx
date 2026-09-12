"use client";
import { useTheme } from "./ThemeProvider";

// Storefront page state for an operator who is not currently trading (Fix 3a).
//
// This is presentation only. The authoritative gate is server-side in the
// create-checkout / create-paysafe-checkout edge functions, which reject a
// non-trading tenant regardless of what the browser renders.
//
// Two things this must never do:
//  - name the reason. A suspended operator's billing problem is not their
//    customers' business, so PAUSED gets a warm seasonal message and
//    everything else gets a neutral one. Neither mentions billing.
//  - render while the tenant is still loading. subscription_status is null
//    until ThemeProvider resolves, and flashing "closed" on every page load
//    would be worse than the gap it covers. Unknown means render nothing.

const TRADING = new Set(["ACTIVE", "TRIAL", "PAST_DUE"]);

export function useTenantTrading(): boolean {
  const theme = useTheme();
  const status = String(theme.subscription_status || "").toUpperCase();
  // No status yet (still loading, or a deployment that predates the column)
  // means trade normally — the server gate is the one that counts.
  return !status || TRADING.has(status);
}

export default function TenantClosedNotice() {
  const theme = useTheme();
  const status = String(theme.subscription_status || "").toUpperCase();
  if (!status || TRADING.has(status)) return null;

  const paused = status === "PAUSED";
  const brand = theme.business_name || "This operator";
  const email = theme.public_email || "";
  const phone = theme.public_phone || theme.public_whatsapp || "";

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h2 className="text-3xl font-bold mb-3 text-[color:var(--ink)]">
        {paused ? "Taking a seasonal break" : "Bookings temporarily unavailable"}
      </h2>
      <p className="text-[color:var(--ink-muted)] mb-8">
        {paused
          ? brand + " is not running trips at the moment and will be back soon."
          : brand + " is not taking online bookings at the moment."}
      </p>
      {(email || phone) && (
        <p className="text-[color:var(--ink-muted)]">
          Already booked, or want to get in touch?
          {email && (
            <>
              {" "}
              <a className="underline" href={"mailto:" + email}>{email}</a>
            </>
          )}
          {email && phone ? " ·" : ""}
          {phone && (
            <>
              {" "}
              <a className="underline" href={"tel:" + phone.replace(/[^\d+]/g, "")}>{phone}</a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
