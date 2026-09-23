import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { AvatarRing } from "../components/AvatarRing";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { ReportDialog } from "../components/ReportDialog";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { ArrowLeft, EyeOff, Flag } from "lucide-react";

const RESPONDER_LABELS = {
  law_enforcement: "Law Enforcement",
  firefighter_career: "Firefighter — Career",
  firefighter_volunteer: "Firefighter — Volunteer",
  emt_paramedic: "EMT / Paramedic",
  dispatcher: "Dispatcher",
};

export default function MemberProfile() {
  const { userId } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    api.get(`/profiles/${userId}`).then((r) => setP(r.data)).catch(() => setNotFound(true));
  }, [userId]);

  const showPhoto = p && p.photo_visibility === "photo" && p.avatar;
  const showInitials = p && p.photo_visibility === "initials";

  return (
    <DashboardLayout active="members" testid="member-profile-page">
      <Link to="/members" className="btn btn-ghost" data-testid="back-to-members">
        <ArrowLeft size={15} /> All members
      </Link>

      {notFound ? (
        <div className="card" style={{ padding: 30, marginTop: 20, color: "var(--text-dim)" }}>
          Member not found.
        </div>
      ) : !p ? (
        <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
      ) : (
        <div className="member-hero card" style={{ marginTop: 20 }} data-testid="member-hero">
          <div className="member-hero-top">
            <AvatarRing size="lg" src={showPhoto ? p.avatar : null} initials={showInitials ? p.initials : undefined} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h1 className="oswald" style={{ fontSize: 30, color: "var(--navy)", margin: 0 }}>
                  {p.display_handle}
                </h1>
                {p.verified_badge && <VerifiedBadge />}
                {p.undercover && (
                  <span className="undercover-tag static" data-testid="undercover-tag">
                    <EyeOff size={11} /> Undercover
                  </span>
                )}
              </div>
              <div style={{ color: "var(--text-dim)", marginTop: 6, fontSize: 14 }}>
                {[RESPONDER_LABELS[p.responder_type], p.service_status].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>

          <div className="member-facts">
            {[
              ["Agency / Department", p.agency || "—"],
              ["Rank", p.rank || "—"],
              ["Years of service", p.years_of_service ? `${p.years_of_service} yrs` : "—"],
              ["Status", p.service_status || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="mf-k">{k}</div>
                <div className="mf-v">{v}</div>
              </div>
            ))}
          </div>

          <div className="pe-note" style={{ marginTop: 4 }}>
            Real name and credential references are part of this member's private verified identity
            and are never shown — even here.
          </div>

          {user?.id !== p.user_id && (
            <button className="listing-report-link" onClick={() => setShowReport(true)} data-testid="report-user-btn" style={{ marginTop: 14 }}>
              <Flag size={12} /> Report this member
            </button>
          )}
        </div>
      )}
      {p && (
        <ReportDialog
          open={showReport}
          onClose={() => setShowReport(false)}
          targetType="user"
          targetId={p.user_id}
          title="Report this member"
        />
      )}
    </DashboardLayout>
  );
}
