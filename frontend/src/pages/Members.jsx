import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { ProfileCard } from "../components/ProfileCard";
import api from "../lib/api";
import { Users } from "lucide-react";

export default function Members() {
  const [members, setMembers] = useState(null);

  useEffect(() => {
    api.get("/members").then((r) => setMembers(r.data.members)).catch(() => setMembers([]));
  }, []);

  return (
    <DashboardLayout active="members" testid="members-page">
      <span className="eyebrow tick">The circle</span>
      <h1 className="oswald dash-h">Verified members</h1>
      <p className="dash-lede">
        Everyone here is a verified active or retired first responder. Undercover members appear
        anonymously — still fully verified.
      </p>

      {members === null ? (
        <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
      ) : members.length === 0 ? (
        <div className="card" style={{ padding: 30, display: "flex", gap: 14, alignItems: "center", color: "var(--text-dim)" }}>
          <Users size={22} color="var(--navy)" /> No verified members yet.
        </div>
      ) : (
        <div className="members-grid" data-testid="members-grid">
          {members.map((m) => (
            <ProfileCard key={m.user_id} profile={m} to={`/members/${m.user_id}`} />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
