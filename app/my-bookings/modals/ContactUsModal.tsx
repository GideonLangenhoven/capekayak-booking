import Modal from "../Modal";

interface ContactUsModalProps {
  open: boolean;
  businessName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  onClose: () => void;
}

const rowClass =
  "surface-muted !rounded-xl flex w-full items-center gap-3.5 px-4 py-3.5 text-[color:var(--text)] transition-colors hover:border-[color:var(--accent)]";
const chipStyle = { background: "var(--accentSoft)", color: "var(--accent)" } as const;

export default function ContactUsModal({ open, businessName, email, phone, whatsapp, onClose }: ContactUsModalProps) {
  // wa.me wants digits only (no +, spaces, or dashes).
  const waDigits = (whatsapp || "").replace(/\D/g, "");
  const hasAny = Boolean(email || phone || whatsapp);

  return (
    <Modal open={open} onClose={onClose} title="Contact us">
      <div className="space-y-3">
        <p className="text-sm text-[color:var(--textMuted)]">
          Get in touch with {businessName || "our team"} — we usually reply fast.
        </p>

        {whatsapp && waDigits && (
          <a href={"https://wa.me/" + waDigits} target="_blank" rel="noopener noreferrer" className={rowClass}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={chipStyle}>
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-[color:var(--textMuted)]">WhatsApp</span>
              <span className="truncate text-sm font-semibold">{whatsapp}</span>
            </span>
          </a>
        )}

        {phone && (
          <a href={"tel:" + phone.replace(/\s/g, "")} className={rowClass}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={chipStyle}>
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-[color:var(--textMuted)]">Call us</span>
              <span className="truncate text-sm font-semibold">{phone}</span>
            </span>
          </a>
        )}

        {email && (
          <a href={"mailto:" + email} className={rowClass}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={chipStyle}>
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-[color:var(--textMuted)]">Email</span>
              <span className="break-all text-sm font-semibold">{email}</span>
            </span>
          </a>
        )}

        {!hasAny && (
          <p className="text-sm text-[color:var(--textMuted)]">
            Contact details aren&apos;t available right now. Please reply to your booking confirmation email.
          </p>
        )}
      </div>
    </Modal>
  );
}
