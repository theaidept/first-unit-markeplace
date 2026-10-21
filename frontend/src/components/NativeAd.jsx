import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fileUrl } from "../lib/api";
import { imgFallback } from "../lib/assets";
import { formatMoney, openAd, trackView } from "../lib/ads";

const TYPE_LABEL = { product: "Product", event: "Event", service: "Service", brand: "Brand" };
const showCta = (ad) => ad?.show_cta === true;

export function FeedAd({ ad, compact }) {
  const navigate = useNavigate();
  useEffect(() => { trackView(ad); }, [ad]);
  const img = fileUrl(ad.image);
  const go = (e) => {
    e.preventDefault();
    openAd(ad, navigate);
  };
  return (
    <article className={`listing-card native-ad-card ${compact ? "compact" : ""}`} data-testid={`native-ad-${ad.id}`}>
      <button type="button" className="native-ad-hit" onClick={go}>
        <div className="lc-media native-ad-media">
          {img ? <img src={img} alt="" onError={imgFallback} /> : <div className="lc-noimg">{ad.headline}</div>}
          <span className="native-ad-badge">Sponsored</span>
        </div>
        <div className="lc-body">
          <div className="lc-title">{ad.headline}</div>
          {ad.price ? <div className="lc-price">{formatMoney(ad.price)}</div> : null}
          {ad.short_line ? <div className="native-ad-sub">{ad.short_line}</div> : null}
          {ad.location ? <div className="native-ad-sub">{ad.location}{ad.event_date ? ` · ${ad.event_date}` : ""}</div> : null}
          <div className="native-ad-meta">{ad.advertiser}</div>
          {showCta(ad) ? <span className="native-ad-cta">{ad.cta || "Shop now"}</span> : null}
        </div>
      </button>
    </article>
  );
}

export function StoryAdCard({ ad, onOpen }) {
  const navigate = useNavigate();
  useEffect(() => { trackView(ad); }, [ad]);
  const img = fileUrl(ad.image);
  return (
    <button
      type="button"
      className="story-poster story-ad-poster"
      onClick={() => (onOpen ? onOpen() : openAd(ad, navigate))}
      data-testid={`story-ad-${ad.id}`}
    >
      <span className="story-poster-art" style={img ? { backgroundImage: `url(${img})` } : undefined}>
        {ad.video ? <span className="story-ad-vid">Video</span> : null}
        <span className="native-ad-badge">Sponsored</span>
        <span className="story-poster-copy">
          <small>{ad.advertiser}</small>
          <b>{ad.headline}</b>
          {ad.price ? <em>{formatMoney(ad.price)}</em> : null}
          {showCta(ad) ? <i>{ad.cta || "Shop now"}</i> : null}
        </span>
      </span>
    </button>
  );
}

export function CategoryAdTile({ ad }) {
  const navigate = useNavigate();
  useEffect(() => { trackView(ad); }, [ad]);
  const img = fileUrl(ad.image);
  return (
    <button type="button" className="cat-tile cat-ad-tile" onClick={() => openAd(ad, navigate)} data-testid={`cat-ad-${ad.id}`}>
      <span className="ct-img">
        {img ? <img src={img} alt="" onError={imgFallback} /> : <span className="ct-ph">{ad.headline}</span>}
        <span className="native-ad-badge">Sponsored</span>
        <span className="ct-copy">
          <span className="ct-label">{ad.headline}</span>
          <span className="ct-count">{ad.advertiser}</span>
        </span>
      </span>
    </button>
  );
}

export function AdPhonePreview({ draft, placement }) {
  const isStory = placement === "story";
  const img = fileUrl(draft.image);
  const cta = { product: "Shop now", event: "Get tickets", service: "Learn more", brand: "Visit site" }[draft.ad_type] || "Shop now";
  return (
    <div className={`ads-phone ${isStory ? "story" : "tile"}`} data-testid="ad-live-preview">
      <div className="ads-phone-screen" style={img ? { backgroundImage: `url(${img})` } : undefined}>
        {draft.video ? <video className="ads-phone-vid" src={fileUrl(draft.video)} poster={img || undefined} muted playsInline loop autoPlay /> : null}
        {!img && !draft.video && <div className="ads-phone-ph">YOUR HEADLINE</div>}
        <div className="ads-phone-top">
          <span>{draft.advertiser || "Advertiser"}</span>
          <em>Sponsored</em>
        </div>
        <div className="ads-phone-bot">
          <strong>{draft.headline || "Your headline"}</strong>
          {draft.price ? <span>{formatMoney(draft.price)}</span> : null}
          {draft.show_cta ? <b>{cta}</b> : null}
        </div>
      </div>
    </div>
  );
}
