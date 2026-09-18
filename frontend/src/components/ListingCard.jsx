import { Link } from "react-router-dom";
import { VerifiedBadge } from "./VerifiedBadge";
import { AvatarRing } from "./AvatarRing";
import { fileUrl } from "../lib/api";

export const CATEGORY_LABELS = {
  gear: "Gear & Equipment",
  vehicles: "Vehicles",
  art: "Art & Personal Items",
};

export const ListingCard = ({ listing: l }) => {
  const photo = l.photos && l.photos[0] ? fileUrl(l.photos[0]) : null;
  const s = l.seller || {};
  const showPhoto = s.photo_visibility === "photo" && s.avatar;
  const showInitials = s.photo_visibility === "initials";
  return (
    <Link to={`/listing/${l.id}`} className="listing-card" data-testid={`listing-card-${l.id}`}>
      <div className="lc-media">
        {photo ? (
          <img src={photo} alt={l.title} />
        ) : (
          <div className="lc-noimg">No photo</div>
        )}
        <span className="lc-cat">{CATEGORY_LABELS[l.category] || l.category}</span>
      </div>
      <div className="lc-body">
        <div className="lc-price">${Number(l.price).toLocaleString()}</div>
        <div className="lc-title">{l.title}</div>
        <div className="lc-seller">
          <AvatarRing size="sm" src={showPhoto ? s.avatar : null} initials={showInitials ? s.initials : undefined} />
          <span className="lc-handle">{s.display_handle}</span>
          {s.verified_badge && <VerifiedBadge />}
        </div>
      </div>
    </Link>
  );
};
