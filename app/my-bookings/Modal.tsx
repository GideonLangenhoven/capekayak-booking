"use client";
import React, { useEffect } from "react";

export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  // Lock the page behind the sheet — otherwise iOS scrolls the background instead of the modal
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" role="presentation" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass-sheet glass-sheet-enter relative max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain !rounded-b-none pb-[max(env(safe-area-inset-bottom),0px)] sm:max-h-[90dvh] sm:!rounded-b-[var(--radius-xl)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4" style={{ background: "var(--glass-solid-sheet)", borderColor: "var(--glass-border)" }}>
          <h3 className="text-[15px] font-semibold text-[color:var(--text)]">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="-mr-1.5 flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--textMuted)] transition-colors hover:bg-[color:var(--hover-overlay)] hover:text-[color:var(--text)]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
