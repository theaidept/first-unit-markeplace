import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import api, { formatApiErrorDetail } from "../lib/api";
import { IMG } from "../lib/assets";
import { LogOut, RefreshCw, Upload, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const RESPONDER_OPTIONS = [
  ["law_enforcement", "Law enforcement — sworn officer"],
  ["firefighter_career", "Firefighter — career"],
  ["firefighter_volunteer", "Firefighter — volunteer"],
  ["emt_paramedic", "EMT / Paramedic"],
  ["dispatcher", "Dispatcher"],
];

const STATUS_COPY = {
  unverified: { label: "Verification not started", sub: "Complete your service details to begin.", tone: "" },
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
const PILL = { Received: "ok", Matched: "ok", Approved: "ok", "In review": "pending", Pending: "review", Rejected: "review" };

export default function VerificationPending() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    responder_type: "law_enforcement",
    service_status: "active",
    agency: "",
    credential_number: "",
    rank: "",
    years_of_service: "",
  });
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async ({ bounceIfApproved = false } = {}) => {
    try {
      const res = await api.get("/verification/me");
      setData(res.data);
      const fresh = await refreshUser();
      // Stay on this page when an already-verified member opens it from the
      // dashboard. Only bounce after a fresh approval from submit.
      if (bounceIfApproved && fresh && fresh.verification_status === "approved") navigate("/marketplace");
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
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.agency.trim()) {
      setError("Agency / department is required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: res } = await api.post("/verification/submit", form);
      if (res.mode === "redirect" && res.authorize_url) {
        window.location.href = res.authorize_url;
        return;
      }
      const map = {
        approved: "Verified! Unlocking the marketplace…",
        human_review: "Submitted — routed to manual review.",
        rejected: "Verification was not approved.",
      };
      toast.success(map[res.verification_status] || "Submitted");
      await load({ bounceIfApproved: res.verification_status === "approved" });
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const showForm = status === "unverified";

  return (
    <div className="verify-page" data-testid="verification-page">
      <div className="verify-side" style={{ backgroundImage: `url(${IMG.verifySide})` }}>
        <div>
          <Brand light />
          <div className="progress-track">
            {PROGRESS.map((p) => {
              const idx = ORDER.indexOf(p.key);
              const done = currentIdx > idx || status === "approved";
              const now = status === p.key || (showForm && p.key === "pre_screen");
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
          <span className="eyebrow">{showForm ? "Step 1 of 4" : "Your verification status"}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={load} data-testid="verification-refresh-btn">
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="btn btn-ghost" onClick={handleLogout} data-testid="verification-logout-btn">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>

        {showForm ? (
          <>
            <h1>Confirm your service</h1>
            <p style={{ color: "var(--text-dim)", maxWidth: 560, lineHeight: 1.6 }}>
              This information is checked against authoritative records via ID.me. We never
              store your raw credential documents — they are handled by the provider only.
            </p>
            {error && <div className="form-error" data-testid="verification-form-error">{error}</div>}
            <form onSubmit={submit} style={{ marginTop: 18 }} data-testid="verification-form">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="field">
                  <label>First responder type</label>
                  <select value={form.responder_type} onChange={set("responder_type")} data-testid="vf-responder-type">
                    {RESPONDER_OPTIONS.map(([v, l]) => (
                      <option value={v} key={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={form.service_status} onChange={set("service_status")} data-testid="vf-service-status">
                    <option value="active">Active</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
                <div className="field">
                  <label>Agency / Department</label>
                  <input value={form.agency} onChange={set("agency")} placeholder="e.g. Austin Fire Department" data-testid="vf-agency" />
                </div>
                <div className="field">
                  <label>Badge / credential #</label>
                  <input value={form.credential_number} onChange={set("credential_number")} placeholder="—" data-testid="vf-credential" />
                </div>
                <div className="field">
                  <label>Rank</label>
                  <input value={form.rank} onChange={set("rank")} placeholder="e.g. Lieutenant" data-testid="vf-rank" />
                </div>
                <div className="field">
                  <label>Years of service</label>
                  <input value={form.years_of_service} onChange={set("years_of_service")} placeholder="e.g. 8" data-testid="vf-years" />
                </div>
              </div>

              <label
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  border: "1px dashed var(--hairline)", borderRadius: 2, padding: "22px",
                  textAlign: "center", cursor: "pointer", marginTop: 6,
                }}
                data-testid="vf-upload-box"
              >
                <Upload size={22} color="var(--navy)" />
                <b style={{ fontSize: 13 }}>{fileName || "Upload credential or ID photo"}</b>
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  Sent to the verification provider only — never stored by First Unit.
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
                  data-testid="vf-file-input"
                />
              </label>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-faint)" }}>
                  <ShieldCheck size={14} /> Encrypted & reviewed under ID.me's compliance standard
                </div>
                <button className="btn btn-primary" disabled={submitting} data-testid="verification-submit-btn">
                  {submitting ? "Submitting…" : "Continue →"}
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 14 }}>
                Sandbox tip: a credential # starting with <b>REVIEW</b> routes to manual review;{" "}
                <b>FAIL</b> is declined; anything else auto-approves.
              </p>
            </form>
          </>
        ) : (
          <>
            <h1>Verification {status === "approved" ? "complete" : "in progress"}</h1>
            <p style={{ color: "var(--text-dim)", maxWidth: 560, lineHeight: 1.6 }}>
              The marketplace, members, and listings stay locked until your account is verified —
              enforced server-side for the safety of the whole community.
            </p>
            <div className={`status-banner ${copy.tone}`} data-testid="verification-status-banner">
              <div>
                <div className="st-label" data-testid="verification-status-label">{copy.label}</div>
                <div className="st-sub">{copy.sub}</div>
              </div>
            </div>
            {status === "approved" && (
              <div style={{ marginTop: 18 }}>
                <Link to="/marketplace" className="btn btn-primary" data-testid="verification-marketplace-btn">
                  Open marketplace
                </Link>
              </div>
            )}
          </>
        )}

        <div className="log-panel" style={{ marginTop: 30 }}>
          <div className="log-head">
            <h4>My Verification & Approval Log</h4>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{data?.events?.length || 0} events</span>
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
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-faint)" }}>No events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
