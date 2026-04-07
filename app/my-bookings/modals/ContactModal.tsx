import Modal from "../Modal";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

interface ContactModalProps {
  open: boolean;
  contactName: string;
  setContactName: (v: string) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  actionLoading: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

export default function ContactModal({
  open, contactName, setContactName, contactEmail, setContactEmail,
  contactPhone, setContactPhone, actionLoading, onClose, onSubmit,
}: ContactModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Contact Details">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1">Name</label>
          <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" className="py-2.5" />
        </div>
        <div>
          <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1">Email</label>
          <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="your@email.com" className="py-2.5" />
        </div>
        <div>
          <label className="text-xs font-medium text-[color:var(--textMuted)] block mb-1">Phone</label>
          <Input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="27812345678" className="py-2.5" />
          <p className="text-[10px] text-[color:var(--textMuted)] mt-1">Full number with country code, no + or spaces</p>
        </div>
        <Button onClick={onSubmit} disabled={actionLoading === "contact"} fullWidth className="py-3 mt-2">
          {actionLoading === "contact" ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </Modal>
  );
}
