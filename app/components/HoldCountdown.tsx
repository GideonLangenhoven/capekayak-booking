"use client";
import { useEffect, useState, useRef } from "react";

export type HoldCountdownProps = {
  expiresAt: Date | string;
  onExpire: () => void;
};

export function HoldCountdown({ expiresAt, onExpire }: HoldCountdownProps) {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = expiry.getTime() - now;

  useEffect(() => {
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire();
    }
  }, [remainingMs, onExpire]);

  if (remainingMs <= 0) return null;

  const totalSec = Math.floor(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const isUrgent = remainingMs < 2 * 60 * 1000;

  return (
    <div
      role="status"
      aria-live="polite"
      className={"flex items-center gap-3 px-5 py-3 rounded-2xl mb-6 " + (isUrgent ? "bg-red-50 text-red-900 border border-red-200" : "bg-amber-50 text-amber-900 border border-amber-200")}
    >
      <div className={"w-9 h-9 rounded-full flex items-center justify-center shrink-0 " + (isUrgent ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600")}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight">
          Holding your seat for{" "}
          <span className="tabular-nums font-extrabold text-[15px]">{min}:{String(sec).padStart(2, "0")}</span>
        </p>
        {isUrgent && <p className="text-[11px] font-medium mt-0.5 opacity-80">Complete payment soon to keep this slot</p>}
      </div>
    </div>
  );
}
