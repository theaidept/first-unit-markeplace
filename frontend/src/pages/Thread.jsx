import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppNav } from "../components/AppNav";
import { AvatarRing } from "../components/AvatarRing";
import { VerifiedBadge } from "../components/VerifiedBadge";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Send, ShieldAlert, Flag, ArrowLeft, ShieldCheck, X } from "lucide-react";

const REPORT_REASONS = [
  { code: "scam_fraud", label: "Scam or fraud" },
  { code: "prohibited_item", label: "Prohibited item" },
  { code: "harassment", label: "Harassment" },
  { code: "spam", label: "Spam" },
  { code: "other", label: "Other" },
];

export default function Thread() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState("scam_fraud");
  const [note, setNote] = useState("");
  const [reporting, setReporting] = useState(false);
  const endRef = useRef(null);
  const countRef = useRef(0);

  const scrollToEnd = (smooth = true) =>
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });

  const load = async (initial = false) => {
    try {
      const { data } = await api.get(`/threads/${threadId}`);
      setThread(data);
      if (data.messages.length !== countRef.current) {
        countRef.current = data.messages.length;
        setTimeout(() => scrollToEnd(!initial), 60);
      }
    } catch {
      setNotFound(true);
    }
  };

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(false), 4000); // poll conversation
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText("");
    try {
      await api.post(`/threads/${threadId}/messages`, { body });
      await load(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const submitReport = async () => {
    setReporting(true);
    try {
      await api.post(`/threads/${threadId}/report`, { reason, note: note.trim() || undefined });
      toast.success("Report submitted to Trust & Safety.");
      setShowReport(false);
      setNote("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setReporting(false);
    }
  };

  if (notFound) {
    return (
      <div className="fu-app" data-testid="thread-page">
        <AppNav />
        <div className="wrap" style={{ paddingTop: 40, maxWidth: 720 }}>
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            Conversation not found.
            <div style={{ marginTop: 14 }}><Link to="/messages" className="btn btn-primary">Back to messages</Link></div>
          </div>
        </div>
      </div>
    );
  }

  const other = thread?.other || {};
  const listing = thread?.listing || {};

  return (
    <div className="fu-app" data-testid="thread-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 20, maxWidth: 720 }}>
        <button className="btn btn-ghost" onClick={() => navigate("/messages")} data-testid="thread-back-btn" style={{ marginBottom: 12 }}>
          <ArrowLeft size={15} /> All messages
        </button>

        <div className="chat-shell card" data-testid="chat-shell">
          {/* Header */}
          <div className="chat-header">
            <AvatarRing size="md" src={other.avatar} initials={other.initials} />
            <div className="ch-who">
              <div className="ch-handle">
                {other.display_handle}
                {other.verified_badge && <VerifiedBadge />}
              </div>
              <Link to={`/listing/${listing.id}`} className="ch-listing" data-testid="chat-listing-link">
                {listing.photo && <img src={fileUrl(listing.photo)} alt="" />}
                <span>{listing.title}{listing.price != null ? ` · $${Number(listing.price).toLocaleString()}` : ""}</span>
              </Link>
            </div>
            <button className="chat-report-btn" onClick={() => setShowReport(true)} data-testid="report-open-btn" title="Report this conversation">
              <Flag size={15} /> Report
            </button>
          </div>

          {/* Conduct rules */}
          <div className="chat-conduct" data-testid="chat-conduct">
            <ShieldCheck size={14} />
            <span>Meet in a safe public place (a station lobby works well). Payments stay off-platform — never share passwords, badge or ID documents. Report anything suspicious.</span>
          </div>

          {/* Messages */}
          <div className="chat-body" data-testid="chat-body">
            {thread === null ? (
              <div style={{ color: "var(--text-faint)", padding: 20 }}>Loading…</div>
            ) : thread.messages.length === 0 ? (
              <div className="chat-empty" data-testid="chat-empty">
                Say hello — start the conversation about <b>{listing.title}</b>.
              </div>
            ) : (
              thread.messages.map((m) => (
                <div className={`bubble-row ${m.mine ? "mine" : "theirs"}`} key={m.id} data-testid={`message-${m.id}`}>
                  <div className="bubble">{m.body}</div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <form className="chat-composer" onSubmit={send} data-testid="chat-composer">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message…"
              data-testid="message-input"
              maxLength={4000}
            />
            <button className="btn btn-primary" disabled={sending || !text.trim()} data-testid="message-send-btn">
              <Send size={15} /> Send
            </button>
          </form>
        </div>
      </div>

      {/* Report modal */}
      {showReport && (
        <div className="report-modal" data-testid="report-modal" onClick={() => setShowReport(false)}>
          <div className="report-card" onClick={(e) => e.stopPropagation()}>
            <button className="report-close" onClick={() => setShowReport(false)} data-testid="report-close-btn"><X size={16} /></button>
            <div className="rc-head"><ShieldAlert size={18} color="var(--red)" /> Report conversation</div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "6px 0 14px" }}>
              This sends the full conversation, the other member and the listing to Trust &amp; Safety for review.
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
              <button className="btn btn-ghost" onClick={() => setShowReport(false)} data-testid="report-cancel-btn">Cancel</button>
              <button className="btn btn-primary" onClick={submitReport} disabled={reporting} data-testid="report-submit-btn">
                {reporting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
