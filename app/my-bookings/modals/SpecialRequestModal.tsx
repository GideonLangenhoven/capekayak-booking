import Modal from "../Modal";
import Button from "../../components/ui/Button";

interface SpecialRequestModalProps {
  open: boolean;
  specialRequest: string;
  setSpecialRequest: (v: string) => void;
  actionLoading: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

export default function SpecialRequestModal({
  open, specialRequest, setSpecialRequest, actionLoading, onClose, onSubmit,
}: SpecialRequestModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Special Request">
      <div>
        <p className="text-sm text-[color:var(--textMuted)] mb-3">Dietary needs, celebrations, accessibility, or anything else.</p>
        <textarea value={specialRequest} onChange={e => setSpecialRequest(e.target.value)}
          placeholder="E.g. birthday celebration, vegetarian, wheelchair access..."
          rows={3} maxLength={500}
          className="field !rounded-xl !p-3 resize-none" />
        <p className="text-[12px] text-[color:var(--textMuted)] text-right mb-4">{specialRequest.length}/500</p>
        <Button onClick={onSubmit} disabled={!specialRequest.trim() || actionLoading === "request"} fullWidth className="py-3">
          {actionLoading === "request" ? "Saving..." : "Save Request"}
        </Button>
      </div>
    </Modal>
  );
}
