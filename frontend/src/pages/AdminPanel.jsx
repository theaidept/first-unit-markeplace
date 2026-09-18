import { useEffect, useState } from "react";
import { AppNav } from "../components/AppNav";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";

const STATUSES = [
  "unverified",
  "pre_screen",
  "validating",
  "human_review",
  "approved",
  "rejected",
  "suspended",
];

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data.users);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (userId, verification_status) => {
    try {
      await api.post(`/admin/users/${userId}/verification-status`, { verification_status });
      toast.success(`Status set to ${verification_status.replace("_", " ")}`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, verification_status } : u))
      );
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
            <h1>Member verification control</h1>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-faint)" }}>
            {users.length} accounts
          </span>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 18 }}>
          Temporary internal control — manually set verification status so later phases can be
          tested before the ID.me integration lands. Not exposed to members.
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
                  <td>
                    <span className="role-tag">{u.role}</span>
                  </td>
                  <td>
                    <span
                      className={`status-tag ${u.verification_status}`}
                      data-testid={`admin-status-${u.email}`}
                    >
                      {u.verification_status.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <select
                      value={u.verification_status}
                      onChange={(e) => setStatus(u.id, e.target.value)}
                      data-testid={`admin-status-select-${u.email}`}
                      style={{
                        border: "1px solid var(--hairline)",
                        borderRadius: 2,
                        padding: "7px 10px",
                        fontSize: 13,
                        background: "#fff",
                      }}
                    >
                      {STATUSES.map((s) => (
                        <option value={s} key={s}>
                          {s.replace("_", " ")}
                        </option>
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
