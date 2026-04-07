"use client";
import { useEffect } from "react";

type ToastType = "success" | "error";

export default function Toast({ message, type, onDismiss }: { message: string; type: ToastType; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] toast-enter" role="alert" aria-live="assertive">
      <div className={"flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border text-sm font-medium " +
        (type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800")}>
        <span>{type === "success" ? "\u2705" : "\u274C"}</span>
        <p className="flex-1">{message}</p>
        <button onClick={onDismiss} aria-label="Dismiss notification" className="shrink-0 opacity-60 hover:opacity-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}
