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
      data-shot="hold-timer"
      className={"flex items-center gap-3 px-5 py-3 rounded-2xl mb-6 " + (isUrgent ? "bg-red-50 text-red-900 border border-red-200" : "bg-amber-50 text-amber-900 border border-amber-200")}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight">
          Spots reserved for{" "}
          <span className="tabular-nums font-extrabold text-[15px]">{min}:{String(sec).padStart(2, "0")}</span>
        </p>
        <p className="text-[11px] font-medium mt-0.5 opacity-80">
          {isUrgent 
            ? "Hurry! Complete payment now to keep your reserved spots before they are released."
            : "Complete checkout to lock in your booking before these spots are released back to the public."}
        </p>
      </div>
    </div>
  );
}
