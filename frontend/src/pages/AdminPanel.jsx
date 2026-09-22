import { useEffect, useState } from "react";
import { AppNav } from "../components/AppNav";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { ShieldQuestion, LayoutDashboard, BadgeCheck, Flag, DollarSign, Users, Package, AlertOctagon, TrendingUp, Briefcase } from "lucide-react";

const STATUSES = ["unverified", "pre_screen", "validating", "human_review", "approved", "rejected", "suspended"];
const RESPONDER_LABELS = {
  law_enforcement: "Law Enforcement",
  firefighter_career: "Firefighter (career)",
  firefighter_volunteer: "Firefighter (volunteer)",
  emt_paramedic: "EMT / Paramedic",
  dispatcher: "Dispatcher",
};
const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "verification", label: "Verification", icon: BadgeCheck },
  { key: "moderation", label: "Moderation", icon: Flag },
  { key: "monetization", label: "Monetization", icon: DollarSign },
  { key: "jobs", label: "Job Board", icon: Briefcase },
];

export default function AdminPanel() {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [fee, setFee] = useState({ amount: 0, active: false });
  const [boosts, setBoosts] = useState([]);
  const [boostFeature, setBoostFeature] = useState(true);
  const [draft, setDraft] = useState({ name: "", price: "", until_sold: false, duration_days: 3 });
  const [health, setHealth] = useState(null);
  const [reports, setReports] = useState([]);
  const [modListings, setModListings] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobDraft, setJobDraft] = useState({ department: "", title: "", location: "" });
  const [editJob, setEditJob] = useState(null);

  // ---- loaders ----
  const loadHealth = async () => { try { const { data } = await api.get("/admin/health"); setHealth(data); } catch { /* ignore */ } };
  const loadReports = async () => { try { const { data } = await api.get("/admin/reports"); setReports(data.reports); } catch { /* ignore */ } };
  const loadModListings = async () => { try { const { data } = await api.get("/admin/listings"); setModListings(data.listings); } catch { /* ignore */ } };
  const loadJobs = async () => { try { const { data } = await api.get("/admin/jobs"); setJobs(data.jobs); } catch { /* ignore */ } };
  const loadBoosts = async () => {
    try { const { data } = await api.get("/admin/boost-types"); setBoosts(data.boost_types); setBoostFeature(data.feature_enabled); } catch { /* ignore */ }
  };
  const loadFee = async () => { try { const { data } = await api.get("/admin/listing-fee"); setFee(data); } catch { /* ignore */ } };
  const load = async () => {
    setLoading(true);
    try {
      const [u, q] = await Promise.all([api.get("/admin/users"), api.get("/admin/verification-queue")]);
      setUsers(u.data.users);
      setQueue(q.data.queue);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load(); loadFee(); loadBoosts(); loadHealth(); loadReports(); loadModListings(); loadJobs();
  }, []);

  const refreshTrust = () => { load(); loadHealth(); loadReports(); loadModListings(); };

  // ---- verification ----
  const decide = async (userId, decision) => {
    try {
      await api.post(`/admin/verification/${userId}/decision`, { decision, reason: reasons[userId] || "" });
      toast.success(`Applicant ${decision === "approve" ? "approved" : "rejected"}`);
      refreshTrust();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const setStatus = async (userId, verification_status) => {
    const note = window.prompt("Manual override requires a reason (audited):", "");
    if (note === null) return;
    if (!note.trim()) { toast.error("A reason is required for an override"); return; }
    try {
      await api.post(`/admin/users/${userId}/verification-status`, { verification_status, note });
      toast.success(`Status set to ${verification_status.replace("_", " ")}`);
      refreshTrust();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  // ---- moderation ----
  const moderateUser = async (userId, action) => {
    let reason = "";
    if (action !== "reinstate") {
      reason = window.prompt(`Reason for ${action} (optional, audited):`, "") || "";
    }
    try {
      await api.post(`/admin/users/${userId}/moderate`, { action, reason });
      toast.success(`Member ${action === "warn" ? "warned" : action === "suspend" ? "suspended" : "reinstated"}`);
      refreshTrust();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const moderateListing = async (listingId, action) => {
    let reason = "";
    if (action === "remove") reason = window.prompt("Reason for removal (audited):", "") || "";
    try {
      await api.post(`/admin/listings/${listingId}/moderate`, { action, reason });
      toast.success(`Listing ${action === "remove" ? "removed" : "reinstated"}`);
      loadModListings(); loadHealth(); loadReports();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const setReportStatus = async (reportId, status) => {
    try {
      await api.post(`/admin/reports/${reportId}/status`, { status });
      toast.success(`Report ${status}`);
      loadReports(); loadHealth();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  // ---- monetization ----
  const saveFee = async () => {
    try { const { data } = await api.put("/admin/listing-fee", { amount: Number(fee.amount), active: !!fee.active }); setFee(data); toast.success("Listing fee saved"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const toggleFeature = async (enabled) => {
    try { await api.put("/admin/boost-feature", { enabled }); setBoostFeature(enabled); toast.success(enabled ? "Boost feature shown to sellers" : "Boost feature hidden entirely"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const boostPayload = (b) => ({ name: b.name, price: Number(b.price), until_sold: !!b.until_sold, duration_days: b.until_sold ? null : Number(b.duration_days) || null, hidden: !!b.hidden, active: b.active !== false });
  const createBoost = async () => {
    if (!draft.name.trim()) { toast.error("Name the boost tier"); return; }
    try { await api.post("/admin/boost-types", boostPayload({ ...draft, hidden: false, active: true })); setDraft({ name: "", price: "", until_sold: false, duration_days: 3 }); toast.success("Boost tier created"); loadBoosts(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const saveBoost = async (b) => { try { await api.put(`/admin/boost-types/${b.id}`, boostPayload(b)); toast.success("Boost tier saved"); loadBoosts(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } };
  const patchBoost = (id, patch) => setBoosts((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const quickToggle = async (b, patch) => { patchBoost(b.id, patch); await saveBoost({ ...b, ...patch }); };
  const deleteBoost = async (id) => { try { await api.delete(`/admin/boost-types/${id}`); toast.success("Boost tier removed"); loadBoosts(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } };

  // ---- jobs ----
  const createJob = async () => {
    if (!jobDraft.department.trim() || !jobDraft.title.trim() || !jobDraft.location.trim()) {
      toast.error("Department, title and location are required"); return;
    }
    try {
      await api.post("/admin/jobs", { ...jobDraft, active: true });
      setJobDraft({ department: "", title: "", location: "" });
      toast.success("Job posting created");
      loadJobs(); loadHealth();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const saveJob = async (j) => {
    try {
      await api.put(`/admin/jobs/${j.id}`, { department: j.department, title: j.title, location: j.location, active: j.active !== false });
      toast.success("Job posting saved");
      setEditJob(null); loadJobs();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const deleteJob = async (id) => {
    try { await api.delete(`/admin/jobs/${id}`); toast.success("Job posting removed"); loadJobs(); loadHealth(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const H = health;

  return (
    <div className="fu-app" data-testid="admin-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 22 }}>
        <span className="eyebrow tick">Admin console</span>
        <h1 className="oswald" style={{ fontSize: 30, color: "var(--navy)", margin: "6px 0 16px" }}>Trust &amp; Safety</h1>

        <div className="admin-tabs" data-testid="admin-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`admin-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)} data-testid={`admin-tab-${t.key}`}>
              <t.icon size={15} /> {t.label}
              {t.key === "moderation" && H?.reports?.open > 0 && <span className="tab-badge">{H.reports.open}</span>}
            </button>
          ))}
        </div>

        {/* ===================== OVERVIEW ===================== */}
        {tab === "overview" && (
          <div data-testid="admin-overview">
            {!H ? <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div> : (
              <>
                <div className="health-grid" data-testid="health-grid">
                  <div className="health-card" data-testid="health-open-reports"><AlertOctagon size={18} color="var(--red)" /><div className="hc-num">{H.reports.open}</div><div className="hc-lbl">Open reports</div></div>
                  <div className="health-card" data-testid="health-human-review"><ShieldQuestion size={18} color="var(--navy)" /><div className="hc-num">{H.verification.human_review}</div><div className="hc-lbl">Awaiting review</div></div>
                  <div className="health-card" data-testid="health-active-listings"><Package size={18} color="var(--navy)" /><div className="hc-num">{H.listings.live}</div><div className="hc-lbl">Active listings</div></div>
                  <div className="health-card" data-testid="health-throughput"><TrendingUp size={18} color="#1b8a4b" /><div className="hc-num">{H.verification_throughput_7d}</div><div className="hc-lbl">Approved · 7d</div></div>
                  <div className="health-card" data-testid="health-signups"><Users size={18} color="var(--navy)" /><div className="hc-num">{H.signups.members_7d}</div><div className="hc-lbl">Sign-ups · 7d</div></div>
                  <div className="health-card" data-testid="health-listing-activity"><Package size={18} color="var(--steel,#5b6b82)" /><div className="hc-num">{H.listing_activity_7d}</div><div className="hc-lbl">New listings · 7d</div></div>
                  <div className="health-card" data-testid="health-suspended"><AlertOctagon size={18} color="var(--text-faint)" /><div className="hc-num">{H.verification.suspended}</div><div className="hc-lbl">Suspended</div></div>
                  <div className="health-card" data-testid="health-members-total"><Users size={18} color="var(--gold,#c8a13a)" /><div className="hc-num">{H.signups.members_total}</div><div className="hc-lbl">Total members</div></div>
                </div>
                <div className="card" style={{ padding: 18, marginTop: 14 }}>
                  <div className="sc-head" style={{ marginBottom: 10 }}>Verification breakdown</div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, color: "var(--text-dim)" }}>
                    <span><b>{H.verification.approved}</b> approved</span>
                    <span><b>{H.verification.pending}</b> pending</span>
                    <span><b>{H.verification.human_review}</b> in review</span>
                    <span><b>{H.verification.rejected}</b> rejected</span>
                    <span><b>{H.verification.suspended}</b> suspended</span>
                  </div>
                  <div className="sc-head" style={{ margin: "16px 0 10px" }}>Listing breakdown</div>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13, color: "var(--text-dim)" }}>
                    <span><b>{H.listings.live}</b> live</span>
                    <span><b>{H.listings.flagged}</b> flagged</span>
                    <span><b>{H.listings.removed}</b> removed</span>
                    <span><b>{H.listings.sold}</b> sold</span>
                    <span><b>{H.listings.draft}</b> draft</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================== VERIFICATION ===================== */}
        {tab === "verification" && (
          <div data-testid="admin-verification">
            <div className="admin-head"><div><span className="eyebrow">Trust &amp; Safety</span><h1>Verification review queue</h1></div>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{queue.length} pending human review</span></div>
            {queue.length === 0 ? (
              <div className="card" style={{ padding: 28, display: "flex", gap: 14, alignItems: "center", color: "var(--text-dim)" }} data-testid="admin-queue-empty">
                <ShieldQuestion size={22} color="var(--navy)" /> No applicants awaiting review. Ambiguous ID.me results appear here.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }} data-testid="admin-review-queue">
                {queue.map((c) => (
                  <div className="card" style={{ padding: 22 }} key={c.user_id} data-testid={`review-case-${c.email}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: "Oswald", textTransform: "uppercase", fontSize: 16, color: "var(--navy)" }}>{c.email}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>Provider: {c.provider} · ref {c.provider_reference} · phone {c.phone || "—"}</div>
                      </div>
                      <span className="status-tag human_review">human review</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "16px 0", fontSize: 13 }}>
                      {[["Responder type", RESPONDER_LABELS[c.prescreen?.responder_type] || "—"], ["Service status", c.prescreen?.service_status || "—"], ["Agency", c.prescreen?.agency || "—"], ["Rank", c.prescreen?.rank || "—"], ["Years of service", c.prescreen?.years_of_service || "—"], ["Credential # (entered)", c.prescreen?.credential_number || "—"]].map(([k, v]) => (
                        <div key={k}><div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-faint)", letterSpacing: ".04em" }}>{k}</div><div style={{ color: "var(--text)", fontWeight: 600, marginTop: 2 }}>{v}</div></div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12 }}>Showing member-entered fields + provider outcome only. No raw credential documents are available to reviewers.</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <input placeholder="Reason (optional for approve, recommended for reject)" value={reasons[c.user_id] || ""} onChange={(e) => setReasons({ ...reasons, [c.user_id]: e.target.value })} data-testid={`review-reason-${c.email}`} style={{ flex: 1, minWidth: 220, border: "1px solid var(--hairline)", borderRadius: 2, padding: "9px 12px", fontSize: 13 }} />
                      <button className="btn btn-primary" onClick={() => decide(c.user_id, "approve")} data-testid={`review-approve-${c.email}`}>Approve</button>
                      <button className="btn btn-ghost" onClick={() => decide(c.user_id, "reject")} data-testid={`review-reject-${c.email}`}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-head" style={{ marginTop: 40 }}><div><span className="eyebrow">Manual override · audited</span><h1>All accounts</h1></div>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{users.length} accounts</span></div>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 18 }}>
              A manual status change is a deliberate, audited override (a reason is required) — not an open control. Use Moderation to warn/suspend members.
            </p>
            {loading ? <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div> : (
              <table className="user-table" data-testid="admin-user-table">
                <thead><tr><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Override</th></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} data-testid={`admin-user-row-${u.email}`}>
                      <td style={{ color: "var(--text)", fontWeight: 600 }}>{u.email}</td>
                      <td>{u.phone || "—"}</td>
                      <td><span className="role-tag">{u.role}</span></td>
                      <td><span className={`status-tag ${u.verification_status}`} data-testid={`admin-status-${u.email}`}>{u.verification_status.replace("_", " ")}</span></td>
                      <td>
                        <select value={u.verification_status} onChange={(e) => setStatus(u.id, e.target.value)} data-testid={`admin-status-select-${u.email}`} style={{ border: "1px solid var(--hairline)", borderRadius: 2, padding: "7px 10px", fontSize: 13, background: "#fff" }}>
                          {STATUSES.map((s) => (<option value={s} key={s}>{s.replace("_", " ")}</option>))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ===================== MODERATION ===================== */}
        {tab === "moderation" && (
          <div data-testid="admin-moderation">
            <div className="admin-head"><div><span className="eyebrow">Reports</span><h1>Moderation queue</h1></div>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{reports.filter((r) => r.status === "open").length} open</span></div>

            {reports.length === 0 ? (
              <div className="card" style={{ padding: 28, color: "var(--text-dim)" }} data-testid="reports-empty">No reports. A quiet community is a healthy one.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }} data-testid="reports-queue">
                {reports.map((r) => (
                  <div className="card report-card-row" style={{ padding: 16 }} key={r.id} data-testid={`report-row-${r.id}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span className="report-type-tag">{r.target_type.replace("_", " ")}</span>
                          <b style={{ color: "var(--navy)" }}>{r.reason}</b>
                          <span className={`report-status ${r.status}`} data-testid={`report-status-${r.id}`}>{r.status}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6 }}>
                          Reporter: <b>{r.reporter}</b>
                          {r.reported_user_handle && <> · Reported member: <b>{r.reported_user_handle}</b> ({r.reported_user_status})</>}
                        </div>
                        {r.listing && <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>Listing: <b>{r.listing.title}</b> · {r.listing.status}</div>}
                        {r.note && <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 4, fontStyle: "italic" }}>“{r.note}”</div>}
                        {r.has_snapshot && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>Conversation snapshot: {r.snapshot_count} message(s) captured</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                        {r.listing_id && r.listing?.status !== "removed" && (
                          <button className="btn btn-ghost" onClick={() => moderateListing(r.listing_id, "remove")} data-testid={`report-remove-listing-${r.id}`} style={{ color: "var(--red)" }}>Remove listing</button>
                        )}
                        {r.reported_user && r.reported_user_status !== "suspended" && (
                          <button className="btn btn-ghost" onClick={() => moderateUser(r.reported_user, "suspend")} data-testid={`report-suspend-user-${r.id}`} style={{ color: "var(--red)" }}>Suspend member</button>
                        )}
                        {r.reported_user && (
                          <button className="btn btn-ghost" onClick={() => moderateUser(r.reported_user, "warn")} data-testid={`report-warn-user-${r.id}`}>Warn member</button>
                        )}
                        {r.status === "open" && <button className="btn btn-steel" onClick={() => setReportStatus(r.id, "reviewing")} data-testid={`report-review-${r.id}`}>Mark reviewing</button>}
                        {r.status !== "dismissed" && r.status !== "actioned" && <button className="btn btn-ghost" onClick={() => setReportStatus(r.id, "dismissed")} data-testid={`report-dismiss-${r.id}`}>Dismiss</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-head" style={{ marginTop: 36 }}><div><span className="eyebrow">Listings</span><h1>Listing moderation</h1></div>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{modListings.length} listings</span></div>
            <div style={{ display: "grid", gap: 8 }} data-testid="mod-listings">
              {modListings.map((l) => (
                <div className="card mod-listing-row" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }} key={l.id} data-testid={`mod-listing-${l.id}`}>
                  <div className="mod-thumb" style={{ backgroundImage: l.photo ? `url(${fileUrl(l.photo)})` : undefined }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 14 }}>{l.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{l.seller} · ${Number(l.price || 0).toLocaleString()}{l.open_reports > 0 && <span className="report-count-tag">{l.open_reports} report(s)</span>}</div>
                  </div>
                  <span className={`status-tag ${l.status === "flagged" ? "human_review" : l.status === "removed" ? "rejected" : "approved"}`}>{l.status}</span>
                  {l.status !== "removed" ? (
                    <button className="btn btn-ghost" onClick={() => moderateListing(l.id, "remove")} data-testid={`listing-remove-${l.id}`} style={{ color: "var(--red)" }}>Remove</button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => moderateListing(l.id, "reinstate")} data-testid={`listing-reinstate-${l.id}`}>Reinstate</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== MONETIZATION ===================== */}
        {tab === "monetization" && (
          <div data-testid="admin-monetization">
            <div className="card" style={{ padding: 20, margin: "0 0 14px" }} data-testid="listing-fee-panel">
              <div className="sc-head">Listing fee configuration · Lane B (not charged at launch)</div>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="field" style={{ margin: 0 }}><label>Fee amount (USD)</label>
                  <input type="number" min="0" step="0.01" value={fee.amount} onChange={(e) => setFee({ ...fee, amount: e.target.value })} data-testid="fee-amount" style={{ width: 160 }} /></div>
                <label className="undercover-toggle" style={{ margin: 0, background: "#fff" }} data-testid="fee-active-toggle">
                  <input type="checkbox" checked={!!fee.active} onChange={(e) => setFee({ ...fee, active: e.target.checked })} data-testid="fee-active" />
                  <div><b>Active</b><span>Off at launch — listings are free.</span></div></label>
                <button className="btn btn-primary" onClick={saveFee} data-testid="fee-save-btn">Save fee</button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 10 }}>When activated later, this bills through the same Stripe layer as boosts — no rebuild.</div>
            </div>

            <div className="card" style={{ padding: 20 }} data-testid="boost-admin-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div className="sc-head" style={{ margin: 0 }}>Boost management · Lane B (Stripe — platform services)</div>
                <label className="undercover-toggle" style={{ margin: 0, background: "#fff" }} data-testid="boost-feature-toggle">
                  <input type="checkbox" checked={!!boostFeature} onChange={(e) => toggleFeature(e.target.checked)} data-testid="boost-feature-checkbox" />
                  <div><b>Show boost feature</b><span>Off = sellers can only publish free.</span></div></label>
              </div>
              <div style={{ display: "grid", gap: 10, marginTop: 14 }} data-testid="boost-type-list">
                {boosts.length === 0 && <div style={{ fontSize: 13, color: "var(--text-faint)" }}>No boost tiers yet. Create one below.</div>}
                {boosts.map((b) => (
                  <div key={b.id} className="boost-admin-row" data-testid={`boost-row-${b.id}`} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", padding: 12, border: "1px solid var(--hairline)", borderRadius: 2, background: b.active === false ? "#f6f7f9" : "#fff" }}>
                    <div className="field" style={{ margin: 0, flex: "1 1 160px" }}><label>Name</label><input value={b.name} onChange={(e) => patchBoost(b.id, { name: e.target.value })} data-testid={`boost-name-${b.id}`} /></div>
                    <div className="field" style={{ margin: 0, width: 110 }}><label>Price (USD)</label><input type="number" min="0" step="0.01" value={b.price} onChange={(e) => patchBoost(b.id, { price: e.target.value })} data-testid={`boost-price-${b.id}`} /></div>
                    <div className="field" style={{ margin: 0, width: 130 }}><label>Duration</label>
                      {b.until_sold ? <input value="Until sold" disabled data-testid={`boost-duration-${b.id}`} /> : <input type="number" min="1" value={b.duration_days || ""} onChange={(e) => patchBoost(b.id, { duration_days: e.target.value })} placeholder="days" data-testid={`boost-duration-${b.id}`} />}</div>
                    <label className="undercover-toggle" style={{ margin: 0, background: "transparent", border: "none", padding: "0 4px" }}>
                      <input type="checkbox" checked={!!b.until_sold} onChange={(e) => patchBoost(b.id, { until_sold: e.target.checked })} data-testid={`boost-untilsold-${b.id}`} /><div><b>Until sold</b></div></label>
                    <button className="btn btn-steel" onClick={() => saveBoost(b)} data-testid={`boost-save-${b.id}`}>Save</button>
                    <button className="btn btn-ghost" onClick={() => quickToggle(b, { hidden: !b.hidden })} data-testid={`boost-hide-${b.id}`}>{b.hidden ? "Show" : "Hide"}</button>
                    <button className="btn btn-ghost" onClick={() => quickToggle(b, { active: b.active === false })} data-testid={`boost-deactivate-${b.id}`}>{b.active === false ? "Reactivate" : "Deactivate"}</button>
                    <button className="btn btn-ghost" onClick={() => deleteBoost(b.id)} data-testid={`boost-delete-${b.id}`} style={{ color: "var(--red)" }}>Delete</button>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", width: "100%" }}>{b.hidden ? "Hidden from sellers · " : "Visible to sellers · "}{b.active === false ? "inactive" : "active"}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--hairline)" }} data-testid="boost-create-form">
                <div className="field" style={{ margin: 0, flex: "1 1 160px" }}><label>New tier name</label><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 14-Day Boost" data-testid="new-boost-name" /></div>
                <div className="field" style={{ margin: 0, width: 110 }}><label>Price (USD)</label><input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="0.00" data-testid="new-boost-price" /></div>
                <div className="field" style={{ margin: 0, width: 130 }}><label>Duration (days)</label><input type="number" min="1" value={draft.until_sold ? "" : draft.duration_days} disabled={draft.until_sold} onChange={(e) => setDraft({ ...draft, duration_days: e.target.value })} data-testid="new-boost-duration" /></div>
                <label className="undercover-toggle" style={{ margin: 0, background: "transparent", border: "none", padding: "0 4px" }}><input type="checkbox" checked={draft.until_sold} onChange={(e) => setDraft({ ...draft, until_sold: e.target.checked })} data-testid="new-boost-untilsold" /><div><b>Until sold</b></div></label>
                <button className="btn btn-primary" onClick={createBoost} data-testid="new-boost-create-btn">Create tier</button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== JOB BOARD ===================== */}
        {tab === "jobs" && (
          <div data-testid="admin-jobs">
            <div className="card" style={{ padding: 20, marginBottom: 14 }} data-testid="job-create-form">
              <div className="sc-head">Post a department role</div>
              <p style={{ fontSize: 12.5, color: "var(--text-faint)", margin: "0 0 14px" }}>
                Admin-managed postings appear in every verified member's Department Job Board. No department self-service in this release.
              </p>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="field" style={{ margin: 0, flex: "1 1 180px" }}><label>Department</label>
                  <input value={jobDraft.department} onChange={(e) => setJobDraft({ ...jobDraft, department: e.target.value })} placeholder="e.g. Austin Fire Department" data-testid="new-job-department" /></div>
                <div className="field" style={{ margin: 0, flex: "1 1 180px" }}><label>Title</label>
                  <input value={jobDraft.title} onChange={(e) => setJobDraft({ ...jobDraft, title: e.target.value })} placeholder="e.g. Firefighter / EMT" data-testid="new-job-title" /></div>
                <div className="field" style={{ margin: 0, flex: "1 1 160px" }}><label>Location</label>
                  <input value={jobDraft.location} onChange={(e) => setJobDraft({ ...jobDraft, location: e.target.value })} placeholder="e.g. Austin, TX" data-testid="new-job-location" /></div>
                <button className="btn btn-primary" onClick={createJob} data-testid="new-job-create-btn">Post role</button>
              </div>
            </div>

            <div className="admin-head"><div><span className="eyebrow">Postings</span><h1>Job board</h1></div>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{jobs.length} postings</span></div>
            <div style={{ display: "grid", gap: 8 }} data-testid="admin-job-list">
              {jobs.length === 0 && <div className="card" style={{ padding: 24, color: "var(--text-faint)" }}>No postings yet.</div>}
              {jobs.map((j) => (
                <div className="card" style={{ padding: 14, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }} key={j.id} data-testid={`admin-job-${j.id}`}>
                  {editJob?.id === j.id ? (
                    <>
                      <div className="field" style={{ margin: 0, flex: "1 1 160px" }}><label>Department</label>
                        <input value={editJob.department} onChange={(e) => setEditJob({ ...editJob, department: e.target.value })} data-testid={`job-department-${j.id}`} /></div>
                      <div className="field" style={{ margin: 0, flex: "1 1 160px" }}><label>Title</label>
                        <input value={editJob.title} onChange={(e) => setEditJob({ ...editJob, title: e.target.value })} data-testid={`job-title-${j.id}`} /></div>
                      <div className="field" style={{ margin: 0, flex: "1 1 140px" }}><label>Location</label>
                        <input value={editJob.location} onChange={(e) => setEditJob({ ...editJob, location: e.target.value })} data-testid={`job-location-${j.id}`} /></div>
                      <button className="btn btn-primary" onClick={() => saveJob(editJob)} data-testid={`job-save-${j.id}`}>Save</button>
                      <button className="btn btn-ghost" onClick={() => setEditJob(null)} data-testid={`job-cancel-${j.id}`}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 14 }}>{j.title}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{j.department} · {j.location}</div>
                      </div>
                      <button className="btn btn-ghost" onClick={() => setEditJob({ ...j })} data-testid={`job-edit-${j.id}`}>Edit</button>
                      <button className="btn btn-ghost" onClick={() => deleteJob(j.id)} data-testid={`job-delete-${j.id}`} style={{ color: "var(--red)" }}>Remove</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
