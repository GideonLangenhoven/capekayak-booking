import React from "react";

export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" role="presentation" onClick={onClose} />
      <div className="relative bg-[color:var(--surface)] rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="sticky top-0 bg-[color:var(--surface)] z-10 flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
          <h3 className="font-semibold text-[color:var(--text)]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[color:var(--surface2)] text-[color:var(--textMuted)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
