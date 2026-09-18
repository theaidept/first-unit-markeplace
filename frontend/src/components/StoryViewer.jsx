import { useNavigate } from "react-router-dom";
import { fileUrl } from "../lib/api";
import { VerifiedBadge } from "./VerifiedBadge";
import { AvatarRing } from "./AvatarRing";
import { X, ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";

export const StoryViewer = ({ stories, index, onClose, onIndex }) => {
  const navigate = useNavigate();
  const s = stories[index];
  if (!s) return null;
  const go = () => {
    onClose();
    navigate(`/listing/${s.listing_id}`);
  };
  const seller = s.seller || {};
  return (
    <div className="story-modal" data-testid="story-viewer" onClick={onClose}>
      <div className="story-stage" onClick={(e) => e.stopPropagation()}>
        <button className="story-close" onClick={onClose} data-testid="story-close"><X size={18} /></button>
        <video
          src={fileUrl(s.video)}
          controls
          autoPlay
          playsInline
          className="story-video"
          data-testid="story-video"
          poster={s.photo ? fileUrl(s.photo) : undefined}
        />
        <div className="story-overlay" data-testid="story-overlay">
          <div className="so-seller">
            <AvatarRing size="sm" />
            <span>{seller.display_handle}</span>
            {seller.verified_badge && <VerifiedBadge />}
          </div>
          <div className="so-buy">
            <div>
              <div className="so-title">{s.title}</div>
              <div className="so-price">${Number(s.price).toLocaleString()}</div>
            </div>
            <button className="btn btn-primary" onClick={go} data-testid="story-shop-btn">
              <ShoppingBag size={15} /> View &amp; Buy
            </button>
          </div>
        </div>
        {index > 0 && (
          <button className="story-nav left" onClick={() => onIndex(index - 1)} data-testid="story-prev"><ChevronLeft size={26} /></button>
        )}
        {index < stories.length - 1 && (
          <button className="story-nav right" onClick={() => onIndex(index + 1)} data-testid="story-next"><ChevronRight size={26} /></button>
        )}
      </div>
    </div>
  );
};
