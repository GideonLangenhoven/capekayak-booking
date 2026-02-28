"use client";

import { useState, useSyncExternalStore } from "react";

const COOKIE_CONSENT_KEY = "cookie-consent-accepted";
const noopSubscribe = () => () => {};

export default function CookieBanner() {
  const [dismissed, setDismissed] = useState(false);
  const needsConsent = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return localStorage.getItem(COOKIE_CONSENT_KEY) !== "true";
      } catch {
        return true;
      }
    },
    () => false
  );

  const acceptCookies = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, "true");
    } catch {
      // Ignore storage errors and still dismiss in-session.
    }
    setDismissed(true);
  };

  if (!needsConsent || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="app-container">
        <div className="surface mx-auto flex max-w-3xl flex-col items-start justify-between gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center">
          <p className="max-w-none text-sm text-[color:var(--textMuted)]">
            We do collect cookies to improve your browsing experience.
          </p>
          <button type="button" onClick={acceptCookies} className="btn btn-primary px-5 py-2">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
