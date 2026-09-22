import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { ShieldAlert, X } from "lucide-react";

export const REPORT_REASONS = [
  { code: "scam_fraud", label: "Scam or fraud" },
  { code: "prohibited_item", label: "Prohibited item" },
  { code: "harassment", label: "Harassment" },
  { code: "spam", label: "Spam" },
  { code: "other", label: "Other" },
];

// Reusable report dialog for listings and members.
// endpoint defaults to POST /reports { target_type, target_id, reason, note }.
export const ReportDialog = ({ open, onClose, targetType, targetId, title }) => {
  const [reason, setReason] = useState("scam_fraud");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/reports", {
        target_type: targetType,
        target_id: targetId,
        reason,
        note: note.trim() || undefined,
      });
      toast.success("Report submitted to Trust & Safety.");
      setNote("");
      onClose();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-modal" data-testid="report-modal" onClick={onClose}>
      <div className="report-card" onClick={(e) => e.stopPropagation()}>
        <button className="report-close" onClick={onClose} data-testid="report-close-btn"><X size={16} /></button>
        <div className="rc-head"><ShieldAlert size={18} color="var(--red)" /> {title || "Report"}</div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "6px 0 14px" }}>
          Reports go to First Unit Trust &amp; Safety for review. Misuse of reporting may affect your own account.
        </p>
        <div className="field">
          <label>Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} data-testid="report-reason-select">
            {REPORT_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Add a note (optional)</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that helps our team…" data-testid="report-note-input" />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose} data-testid="report-cancel-btn">Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy} data-testid="report-submit-btn">
            {busy ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
};
