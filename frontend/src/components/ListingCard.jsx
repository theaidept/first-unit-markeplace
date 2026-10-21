import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { VerifiedBadge } from "./VerifiedBadge";
import { AvatarRing } from "./AvatarRing";
import { StarRating } from "./StarRating";
import { fileUrl } from "../lib/api";
import { imgFallback } from "../lib/assets";
import { ratingFor } from "../lib/ratings";
import { useCategoryLabel } from "../lib/categoryIcons";
import { readSaved, toggleSaved } from "../lib/saved";
import { Bookmark } from "lucide-react";

export const CATEGORY_LABELS = {
  gear: "Gear & Equipment",
  vehicles: "Vehicles",
  art: "Art & Personal Items",
};

export const ListingCard = ({ listing: l, onUnsave }) => {
  const photo = l.photos && l.photos[0] ? fileUrl(l.photos[0]) : null;
  const s = l.seller || {};
  const showPhoto = s.photo_visibility === "photo" && s.avatar;
  const showInitials = s.photo_visibility === "initials";
  const [saved, setSaved] = useState(() => readSaved().includes(l.id));
  const catLabel = useCategoryLabel(l.category);

  useEffect(() => {
    const sync = () => setSaved(readSaved().includes(l.id));
    window.addEventListener("fu-saved", sync);
    return () => window.removeEventListener("fu-saved", sync);
  }, [l.id]);

  const onSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleSaved(l.id);
    const nowSaved = next.includes(l.id);
    setSaved(nowSaved);
    if (!nowSaved && onUnsave) onUnsave(l.id);
  };

  return (
    <Link to={`/listing/${l.id}`} className="listing-card" data-testid={`listing-card-${l.id}`}>
        <button
          type="button"
          className={`lc-save ${saved ? "on" : ""}`}
          onClick={onSave}
          aria-label={saved ? "Remove from Saved" : "Save listing"}
          data-testid={`save-listing-${l.id}`}
        >
          <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
        </button>
        <div className="lc-media">
          {photo ? (
            <img src={photo} alt={l.title} onError={imgFallback} />
          ) : (
            <div className="lc-noimg">No photo</div>
          )}
          {l.featured && <span className="lc-featured" data-testid={`featured-tag-${l.id}`}>FEATURED</span>}
          <span className="lc-cat">{catLabel}</span>
        </div>
        <div className="lc-body">
          <div className="lc-price">${Number(l.price).toLocaleString()}</div>
          <div className="lc-title">{l.title}</div>
          <div className="lc-rating">{(() => { const r = ratingFor(l.id); return <StarRating value={r.value} count={r.count} size={13} />; })()}</div>
          <div className="lc-seller">
            <AvatarRing size="sm" src={showPhoto ? s.avatar : null} initials={showInitials ? s.initials : undefined} />
            <span className="lc-handle">{s.display_handle}</span>
            {s.verified_badge && <VerifiedBadge />}
          </div>
        </div>
    </Link>
  );
};
