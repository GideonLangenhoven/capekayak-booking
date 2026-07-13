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

            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-[color:var(--textMuted)]">WhatsApp</span>
              <span className="truncate text-sm font-semibold">{whatsapp}</span>
            </span>
          </a>
        )}

        {phone && (
          <a href={"tel:" + phone.replace(/\s/g, "")} className={rowClass}>

            <span className="flex min-w-0 flex-col">
              <span className="text-xs text-[color:var(--textMuted)]">Call us</span>
              <span className="truncate text-sm font-semibold">{phone}</span>
            </span>
          </a>
        )}

        {email && (
          <a href={"mailto:" + email} className={rowClass}>

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
