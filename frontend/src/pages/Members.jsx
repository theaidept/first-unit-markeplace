import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { ProfileCard } from "../components/ProfileCard";
import api from "../lib/api";
import { Users } from "lucide-react";
import { PageHero, Empty } from "../components/AdminKit";

export default function Members() {
  const [members, setMembers] = useState(null);

  useEffect(() => {
    api.get("/members").then((r) => setMembers(r.data.members)).catch(() => setMembers([]));
  }, []);

  return (
    <DashboardLayout active="members" testid="members-page">
      <div className="ap-page">
      <PageHero kicker="The circle" title="Verified members" copy="Everyone here is a verified active or retired first responder. Undercover members appear anonymously — still fully verified." />

      {members === null ? (
        <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
      ) : members.length === 0 ? (
        <Empty icon={Users} title="No verified members yet" />
      ) : (
        <div className="members-grid" data-testid="members-grid">
          {members.map((m) => (
            <ProfileCard key={m.user_id} profile={m} to={`/members/${m.user_id}`} />
          ))}
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
