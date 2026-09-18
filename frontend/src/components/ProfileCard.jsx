import { Link } from "react-router-dom";
import { AvatarRing } from "./AvatarRing";
import { VerifiedBadge } from "./VerifiedBadge";
import { EyeOff } from "lucide-react";

const RESPONDER_LABELS = {
  law_enforcement: "Law Enforcement",
  firefighter_career: "Firefighter — Career",
  firefighter_volunteer: "Firefighter — Volunteer",
  emt_paramedic: "EMT / Paramedic",
  dispatcher: "Dispatcher",
};

function Avatar({ p, size = "lg" }) {
  const showPhoto = p.photo_visibility === "photo" && p.avatar;
  const showInitials = p.photo_visibility === "initials";
  return (
    <AvatarRing
      size={size}
      src={showPhoto ? p.avatar : null}
      initials={showInitials ? p.initials : undefined}
    />
  );
}

export const ProfileCard = ({ profile: p, to }) => {
  const responder = RESPONDER_LABELS[p.responder_type];
  const body = (
    <div className="profile-card" data-testid={`profile-card-${p.display_handle}`}>
      {p.undercover && (
        <span className="undercover-tag" data-testid="undercover-tag">
          <EyeOff size={11} /> Undercover
        </span>
      )}
      <Avatar p={p} />
      <div className="pc-handle">{p.display_handle}</div>
      {p.verified_badge && <VerifiedBadge />}
      <div className="pc-meta">
        {p.agency && <div className="pc-agency">{p.agency}</div>}
        <div className="pc-sub">
          {[p.rank, responder, p.service_status ? p.service_status : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {p.years_of_service && <div className="pc-years">{p.years_of_service} yrs of service</div>}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="pc-link">
      {body}
    </Link>
  ) : (
    body
  );
};
