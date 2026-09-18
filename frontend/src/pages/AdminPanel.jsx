import { useEffect, useState } from "react";
import { AppNav } from "../components/AppNav";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { ShieldQuestion } from "lucide-react";

const STATUSES = ["unverified", "pre_screen", "validating", "human_review", "approved", "rejected", "suspended"];

const RESPONDER_LABELS = {
  law_enforcement: "Law Enforcement",
  firefighter_career: "Firefighter (career)",
  firefighter_volunteer: "Firefighter (volunteer)",
  emt_paramedic: "EMT / Paramedic",
  dispatcher: "Dispatcher",
};

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [fee, setFee] = useState({ amount: 0, active: false });
  const [boosts, setBoosts] = useState([]);
  const [boostFeature, setBoostFeature] = useState(true);
  const [draft, setDraft] = useState({ name: "", price: "", until_sold: false, duration_days: 3 });

  const loadBoosts = async () => {
    try {
      const { data } = await api.get("/admin/boost-types");
      setBoosts(data.boost_types);
      setBoostFeature(data.feature_enabled);
    } catch { /* ignore */ }
  };
  const toggleFeature = async (enabled) => {
    try {
      await api.put("/admin/boost-feature", { enabled });
      setBoostFeature(enabled);
      toast.success(enabled ? "Boost feature shown to sellers" : "Boost feature hidden entirely");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const boostPayload = (b) => ({
    name: b.name, price: Number(b.price), until_sold: !!b.until_sold,
    duration_days: b.until_sold ? null : Number(b.duration_days) || null,
    hidden: !!b.hidden, active: b.active !== false,
  });
  const createBoost = async () => {
    if (!draft.name.trim()) { toast.error("Name the boost tier"); return; }
    try {
      await api.post("/admin/boost-types", boostPayload({ ...draft, hidden: false, active: true }));
      setDraft({ name: "", price: "", until_sold: false, duration_days: 3 });
      toast.success("Boost tier created");
      loadBoosts();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const saveBoost = async (b) => {
    try {
      await api.put(`/admin/boost-types/${b.id}`, boostPayload(b));
      toast.success("Boost tier saved");
      loadBoosts();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const patchBoost = (id, patch) => setBoosts((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const quickToggle = async (b, patch) => { patchBoost(b.id, patch); await saveBoost({ ...b, ...patch }); };
  const deleteBoost = async (id) => {
    try {
      await api.delete(`/admin/boost-types/${id}`);
      toast.success("Boost tier removed");
      loadBoosts();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const loadFee = async () => {
    try { const { data } = await api.get("/admin/listing-fee"); setFee(data); } catch { /* ignore */ }
  };
  const saveFee = async () => {
    try {
      const { data } = await api.put("/admin/listing-fee", { amount: Number(fee.amount), active: !!fee.active });
      setFee(data);
      toast.success("Listing fee saved");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [u, q] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/verification-queue"),
      ]);
      setUsers(u.data.users);
      setQueue(q.data.queue);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadFee();
    loadBoosts();
  }, []);

  const decide = async (userId, decision) => {
    try {
      await api.post(`/admin/verification/${userId}/decision`, {
        decision,
        reason: reasons[userId] || "",
      });
      toast.success(`Applicant ${decision === "approve" ? "approved" : "rejected"}`);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const setStatus = async (userId, verification_status) => {
    try {
      await api.post(`/admin/users/${userId}/verification-status`, { verification_status });
      toast.success(`Status set to ${verification_status.replace("_", " ")}`);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, verification_status } : u)));
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  return (
    <div className="fu-app" data-testid="admin-page">
      <AppNav />
      <div className="wrap">
        <div className="card" style={{ padding: 20, margin: "24px 0 6px" }} data-testid="listing-fee-panel">
          <div className="sc-head">Listing fee configuration · Lane B (not charged at launch)</div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Fee amount (USD)</label>
              <input type="number" min="0" step="0.01" value={fee.amount}
                onChange={(e) => setFee({ ...fee, amount: e.target.value })} data-testid="fee-amount" style={{ width: 160 }} />
            </div>
            <label className="undercover-toggle" style={{ margin: 0, background: "#fff" }} data-testid="fee-active-toggle">
              <input type="checkbox" checked={!!fee.active} onChange={(e) => setFee({ ...fee, active: e.target.checked })} data-testid="fee-active" />
              <div><b>Active</b><span>Off at launch — listings are free.</span></div>
            </label>
            <button className="btn btn-primary" onClick={saveFee} data-testid="fee-save-btn">Save fee</button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 10 }}>
            Not wired to Stripe and never charged now. This control lets a listing fee be introduced later.
          </div>
        </div>

        <div className="card" style={{ padding: 20, margin: "0 0 6px" }} data-testid="boost-admin-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div className="sc-head" style={{ margin: 0 }}>Boost management · Lane B (Stripe — platform services)</div>
            <label className="undercover-toggle" style={{ margin: 0, background: "#fff" }} data-testid="boost-feature-toggle">
              <input type="checkbox" checked={!!boostFeature} onChange={(e) => toggleFeature(e.target.checked)} data-testid="boost-feature-checkbox" />
              <div><b>Show boost feature</b><span>Off = sellers can only publish free.</span></div>
            </label>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }} data-testid="boost-type-list">
            {boosts.length === 0 && <div style={{ fontSize: 13, color: "var(--text-faint)" }}>No boost tiers yet. Create one below.</div>}
            {boosts.map((b) => (
              <div key={b.id} className="boost-admin-row" data-testid={`boost-row-${b.id}`}
                style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", padding: 12, border: "1px solid var(--hairline)", borderRadius: 2, background: b.active === false ? "#f6f7f9" : "#fff" }}>
                <div className="field" style={{ margin: 0, flex: "1 1 160px" }}>
                  <label>Name</label>
                  <input value={b.name} onChange={(e) => patchBoost(b.id, { name: e.target.value })} data-testid={`boost-name-${b.id}`} />
                </div>
                <div className="field" style={{ margin: 0, width: 110 }}>
                  <label>Price (USD)</label>
                  <input type="number" min="0" step="0.01" value={b.price} onChange={(e) => patchBoost(b.id, { price: e.target.value })} data-testid={`boost-price-${b.id}`} />
                </div>
                <div className="field" style={{ margin: 0, width: 130 }}>
                  <label>Duration</label>
                  {b.until_sold ? (
                    <input value="Until sold" disabled data-testid={`boost-duration-${b.id}`} />
                  ) : (
                    <input type="number" min="1" value={b.duration_days || ""} onChange={(e) => patchBoost(b.id, { duration_days: e.target.value })} placeholder="days" data-testid={`boost-duration-${b.id}`} />
                  )}
                </div>
                <label className="undercover-toggle" style={{ margin: 0, background: "transparent", border: "none", padding: "0 4px" }}>
                  <input type="checkbox" checked={!!b.until_sold} onChange={(e) => patchBoost(b.id, { until_sold: e.target.checked })} data-testid={`boost-untilsold-${b.id}`} />
                  <div><b>Until sold</b></div>
                </label>
                <button className="btn btn-steel" onClick={() => saveBoost(b)} data-testid={`boost-save-${b.id}`}>Save</button>
                <button className="btn btn-ghost" onClick={() => quickToggle(b, { hidden: !b.hidden })} data-testid={`boost-hide-${b.id}`}>
                  {b.hidden ? "Show" : "Hide"}
                </button>
                <button className="btn btn-ghost" onClick={() => quickToggle(b, { active: b.active === false })} data-testid={`boost-deactivate-${b.id}`}>
                  {b.active === false ? "Reactivate" : "Deactivate"}
                </button>
                <button className="btn btn-ghost" onClick={() => deleteBoost(b.id)} data-testid={`boost-delete-${b.id}`} style={{ color: "var(--red)" }}>Delete</button>
                <div style={{ fontSize: 11, color: "var(--text-faint)", width: "100%" }}>
                  {b.hidden ? "Hidden from sellers · " : "Visible to sellers · "}{b.active === false ? "inactive" : "active"}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--hairline)" }} data-testid="boost-create-form">
            <div className="field" style={{ margin: 0, flex: "1 1 160px" }}>
              <label>New tier name</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 14-Day Boost" data-testid="new-boost-name" />
            </div>
            <div className="field" style={{ margin: 0, width: 110 }}>
              <label>Price (USD)</label>
              <input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="0.00" data-testid="new-boost-price" />
            </div>
            <div className="field" style={{ margin: 0, width: 130 }}>
              <label>Duration (days)</label>
              <input type="number" min="1" value={draft.until_sold ? "" : draft.duration_days} disabled={draft.until_sold} onChange={(e) => setDraft({ ...draft, duration_days: e.target.value })} data-testid="new-boost-duration" />
            </div>
            <label className="undercover-toggle" style={{ margin: 0, background: "transparent", border: "none", padding: "0 4px" }}>
              <input type="checkbox" checked={draft.until_sold} onChange={(e) => setDraft({ ...draft, until_sold: e.target.checked })} data-testid="new-boost-untilsold" />
              <div><b>Until sold</b></div>
            </label>
            <button className="btn btn-primary" onClick={createBoost} data-testid="new-boost-create-btn">Create tier</button>
          </div>
        </div>

        <div className="admin-head">
          <div>
            <span className="eyebrow">Trust & Safety</span>
            <h1>Verification review queue</h1>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-faint)" }}>
            {queue.length} pending human review
          </span>
        </div>

        {queue.length === 0 ? (
          <div
            className="card"
            style={{ padding: 28, display: "flex", gap: 14, alignItems: "center", color: "var(--text-dim)" }}
            data-testid="admin-queue-empty"
          >
            <ShieldQuestion size={22} color="var(--navy)" />
            No applicants awaiting review. Ambiguous ID.me results appear here.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }} data-testid="admin-review-queue">
            {queue.map((c) => (
              <div className="card" style={{ padding: 22 }} key={c.user_id} data-testid={`review-case-${c.email}`}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "Oswald", textTransform: "uppercase", fontSize: 16, color: "var(--navy)" }}>
                      {c.email}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>
                      Provider: {c.provider} · ref {c.provider_reference} · phone {c.phone || "—"}
                    </div>
                  </div>
                  <span className="status-tag human_review">human review</span>
                </div>

                <div
                  style={{
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
                    margin: "16px 0", fontSize: 13,
                  }}
                >
                  {[
                    ["Responder type", RESPONDER_LABELS[c.prescreen?.responder_type] || "—"],
                    ["Service status", c.prescreen?.service_status || "—"],
                    ["Agency", c.prescreen?.agency || "—"],
                    ["Rank", c.prescreen?.rank || "—"],
                    ["Years of service", c.prescreen?.years_of_service || "—"],
                    ["Credential # (entered)", c.prescreen?.credential_number || "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-faint)", letterSpacing: ".04em" }}>{k}</div>
                      <div style={{ color: "var(--text)", fontWeight: 600, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12 }}>
                  Showing member-entered fields + provider outcome only. No raw credential documents are available to reviewers.
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    placeholder="Reason (optional for approve, recommended for reject)"
                    value={reasons[c.user_id] || ""}
                    onChange={(e) => setReasons({ ...reasons, [c.user_id]: e.target.value })}
                    data-testid={`review-reason-${c.email}`}
                    style={{ flex: 1, minWidth: 220, border: "1px solid var(--hairline)", borderRadius: 2, padding: "9px 12px", fontSize: 13 }}
                  />
                  <button className="btn btn-primary" onClick={() => decide(c.user_id, "approve")} data-testid={`review-approve-${c.email}`}>
                    Approve
                  </button>
                  <button className="btn btn-ghost" onClick={() => decide(c.user_id, "reject")} data-testid={`review-reject-${c.email}`}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="admin-head" style={{ marginTop: 40 }}>
          <div>
            <span className="eyebrow">Fallback control</span>
            <h1>All accounts</h1>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-faint)" }}>{users.length} accounts</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 18 }}>
          Manual status override — retained as an admin fallback. The real flow is now ID.me-driven.
        </p>

        {loading ? (
          <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
        ) : (
          <table className="user-table" data-testid="admin-user-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Set status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} data-testid={`admin-user-row-${u.email}`}>
                  <td style={{ color: "var(--text)", fontWeight: 600 }}>{u.email}</td>
                  <td>{u.phone || "—"}</td>
                  <td><span className="role-tag">{u.role}</span></td>
                  <td>
                    <span className={`status-tag ${u.verification_status}`} data-testid={`admin-status-${u.email}`}>
                      {u.verification_status.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <select
                      value={u.verification_status}
                      onChange={(e) => setStatus(u.id, e.target.value)}
                      data-testid={`admin-status-select-${u.email}`}
                      style={{ border: "1px solid var(--hairline)", borderRadius: 2, padding: "7px 10px", fontSize: 13, background: "#fff" }}
                    >
                      {STATUSES.map((s) => (
                        <option value={s} key={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
