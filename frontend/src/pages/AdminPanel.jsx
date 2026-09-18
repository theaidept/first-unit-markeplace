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
