import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { IMG } from "../lib/assets";
import { LogOut, RefreshCw } from "lucide-react";

const STATUS_COPY = {
  unverified: {
    label: "Verification not started",
    sub: "Complete your service details to begin verification.",
    tone: "",
  },
  pre_screen: { label: "Pre-screening", sub: "We're reviewing your submitted details.", tone: "" },
  validating: { label: "Validating credentials", sub: "Checking your service against authoritative records via ID.me.", tone: "" },
  human_review: { label: "In human review", sub: "A Trust & Safety reviewer is confirming your details.", tone: "" },
  approved: { label: "Approved", sub: "You're verified. Welcome to the marketplace.", tone: "approved" },
  rejected: { label: "Not approved", sub: "We couldn't verify your service. Contact support to appeal.", tone: "rejected" },
  suspended: { label: "Suspended", sub: "Your access is currently suspended.", tone: "rejected" },
};

const PROGRESS = [
  { key: "pre_screen", b: "Pre-screening", s: "Identity & agency details" },
  { key: "validating", b: "Credential validation", s: "ID.me database check" },
  { key: "human_review", b: "Agency confirmation", s: "Human review" },
  { key: "approved", b: "Account activation", s: "Instant on approval" },
];

const ORDER = ["unverified", "pre_screen", "validating", "human_review", "approved"];

const PILL = {
  Received: "ok",
  Matched: "ok",
  "In review": "pending",
  Pending: "review",
};

export default function VerificationPending() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = async () => {
    try {
      const res = await api.get("/verification/me");
      setData(res.data);
      const fresh = await refreshUser();
      if (fresh && fresh.verification_status === "approved") navigate("/marketplace");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = user?.verification_status || "unverified";
  const copy = STATUS_COPY[status] || STATUS_COPY.unverified;
  const currentIdx = ORDER.indexOf(status);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="verify-page" data-testid="verification-page">
      <div className="verify-side" style={{ backgroundImage: `url(${IMG.verifySide})` }}>
        <div>
          <Brand light />
          <div className="progress-track">
            {PROGRESS.map((p) => {
              const idx = ORDER.indexOf(p.key);
              const done = currentIdx > idx || status === "approved";
              const now = status === p.key;
              return (
                <div className={`p-step ${done ? "done" : ""} ${now ? "now" : ""}`} key={p.key}>
                  <div className="p-dot">{done ? "✓" : idx}</div>
                  <div>
                    <b>{p.b}</b>
                    <span>{p.s}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="quote">
          "You wear the badge, First Unit checks the badge."
          <small>Verification is the entire foundation of the platform.</small>
        </div>
      </div>

      <div className="verify-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="eyebrow">Your verification status</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={load} data-testid="verification-refresh-btn">
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="btn btn-ghost" onClick={handleLogout} data-testid="verification-logout-btn">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
        <h1>Verification pending</h1>
        <p style={{ color: "var(--text-dim)", maxWidth: 560, lineHeight: 1.6 }}>
          The marketplace, members, and listings stay locked until your account is verified.
          This is enforced for the safety of the whole community — not just hidden from view.
        </p>

        <div className={`status-banner ${copy.tone}`} data-testid="verification-status-banner">
          <div>
            <div className="st-label" data-testid="verification-status-label">{copy.label}</div>
            <div className="st-sub">{copy.sub}</div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 24 }}>
          Note: raw credential and ID documents are never stored by First Unit — they are
          checked by the verification provider only.
        </p>

        <div className="log-panel">
          <div className="log-head">
            <h4>My Verification & Approval Log</h4>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {data?.events?.length || 0} events
            </span>
          </div>
          <table className="log">
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Reviewer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody data-testid="verification-log">
              {(data?.events || []).map((ev) => (
                <tr key={ev.id}>
                  <td>{new Date(ev.timestamp).toLocaleString()}</td>
                  <td>{ev.event}</td>
                  <td>{ev.reviewer}</td>
                  <td>
                    <span className={`pill ${PILL[ev.status] || "review"}`}>{ev.status}</span>
                  </td>
                </tr>
              ))}
              {(!data || data.events?.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-faint)" }}>
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
