import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppNav } from "../components/AppNav";
import { AvatarRing } from "../components/AvatarRing";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { CATEGORY_LABELS } from "../components/ListingCard";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { MessageSquare, MapPin, ShoppingBag, Tag, ShieldCheck } from "lucide-react";

const OFFER_PILL = { pending: "pending", accepted: "ok", declined: "review", withdrawn: "review" };

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [l, setL] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [active, setActive] = useState(0);
  const [offers, setOffers] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [offerAmt, setOfferAmt] = useState("");
  const [showOffer, setShowOffer] = useState(false);
  const [meetup, setMeetup] = useState("");
  const [busy, setBusy] = useState(false);

  const loadOffers = async () => {
    try {
      const { data } = await api.get(`/listings/${id}/offers`);
      setOffers(data.offers);
      setIsOwner(data.is_owner);
    } catch {
      /* ignore */
    }
  };

  const load = async () => {
    try {
      const { data } = await api.get(`/listings/${id}`);
      setL(data);
      setMeetup(data.meetup_note || "");
      await loadOffers();
    } catch {
      setNotFound(true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const buyNow = async () => {
    setBusy(true);
    try {
      await api.post(`/listings/${id}/buy-now`);
      toast.success("Buy-now agreed. Complete payment off-platform with the seller.");
      navigate("/transactions");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const submitOffer = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/listings/${id}/offers`, { amount: Number(offerAmt) });
      toast.success("Offer sent to the seller");
      setShowOffer(false);
      setOfferAmt("");
      loadOffers();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const actOffer = async (offerId, action) => {
    try {
      const { data } = await api.post(`/offers/${offerId}/${action}`);
      toast.success(`Offer ${action}${action.endsWith("e") ? "d" : "ed"}`);
      if (action === "accept" && data.transaction_id) {
        toast.info("Transaction created — coordinate the off-platform payment.");
        navigate("/transactions");
        return;
      }
      loadOffers();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const saveMeetup = async () => {
    try {
      await api.put(`/listings/${id}`, {
        title: l.title, category: l.category, condition: l.condition,
        location: l.location || "", description: l.description || "",
        price: l.price, photos: l.photos, meetup_note: meetup, publish: false,
      });
      toast.success("Meet-up guidance saved");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  if (notFound)
    return (
      <div className="fu-app"><AppNav />
        <div className="wrap" style={{ padding: 40, color: "var(--text-dim)" }}>Listing not found.</div>
      </div>
    );
  if (!l)
    return (
      <div className="fu-app"><AppNav />
        <div className="wrap" style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
      </div>
    );

  const s = l.seller || {};
  const showPhoto = s.photo_visibility === "photo" && s.avatar;
  const showInitials = s.photo_visibility === "initials";
  const photos = l.photos || [];

  return (
    <div className="fu-app" data-testid="listing-detail-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 24 }}>
        <div className="detail-grid">
          {/* Gallery */}
          <div>
            {l.video && (
              <video src={fileUrl(l.video)} controls playsInline className="detail-video"
                data-testid="detail-video" poster={photos[0] ? fileUrl(photos[0]) : undefined} />
            )}
            <div className="gallery-main">
              {photos[active] ? <img src={fileUrl(photos[active])} alt={l.title} /> : <div className="lc-noimg">No photo</div>}
              <span className="lc-cat">{CATEGORY_LABELS[l.category] || l.category}</span>
            </div>
            {photos.length > 1 && (
              <div className="gallery-thumbs">
                {photos.map((p, i) => (
                  <button key={p} className={`gt ${i === active ? "on" : ""}`} onClick={() => setActive(i)} data-testid={`thumb-${i}`}>
                    <img src={fileUrl(p)} alt="" />
                  </button>
                ))}
              </div>
            )}

            <div className="detail-section">
              <h3 className="ds-title">Description</h3>
              <p style={{ color: "var(--text-dim)", lineHeight: 1.7 }}>{l.description || "No description provided."}</p>
            </div>

            <div className="meetup-block" data-testid="meetup-block">
              <div className="mb-head"><MapPin size={16} /> Meet-up Guidance</div>
              {isOwner ? (
                <div>
                  <p className="mb-note">Suggest a station-adjacent exchange location buyers will recognize.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input value={meetup} onChange={(e) => setMeetup(e.target.value)} placeholder="e.g. Fire Station 14 front lobby, weekdays" data-testid="meetup-input"
                      style={{ flex: 1, border: "1px solid var(--hairline)", borderRadius: 2, padding: "9px 12px", fontSize: 13 }} />
                    <button className="btn btn-steel" onClick={saveMeetup} data-testid="meetup-save">Save</button>
                  </div>
                </div>
              ) : (
                <p className="mb-note" data-testid="meetup-text">
                  {l.meetup_note || "The seller suggests meeting at a staffed, station-adjacent public location for a safe exchange."}
                </p>
              )}
            </div>
          </div>

          {/* Buy panel */}
          <div>
            <div className="buy-card card" data-testid="buy-card">
              <div className="lc-price" style={{ fontSize: 30 }}>${Number(l.price).toLocaleString()}</div>
              <h1 className="oswald" style={{ color: "var(--navy)", fontSize: 24, margin: "6px 0 10px" }}>{l.title}</h1>
              <div className="detail-meta">
                <span><Tag size={13} /> {CATEGORY_LABELS[l.category] || l.category}</span>
                <span>{l.condition}</span>
                {l.location && <span><MapPin size={13} /> {l.location}</span>}
              </div>

              {!isOwner && (
                <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                  <button className="btn btn-primary btn-block" onClick={buyNow} disabled={busy} data-testid="buy-now-btn">
                    <ShoppingBag size={16} /> Buy Now
                  </button>
                  <button className="btn btn-ghost btn-block" onClick={() => setShowOffer((v) => !v)} data-testid="make-offer-btn">
                    Make an Offer
                  </button>
                  {showOffer && (
                    <form onSubmit={submitOffer} style={{ display: "flex", gap: 8 }} data-testid="offer-form">
                      <input type="number" min="1" value={offerAmt} onChange={(e) => setOfferAmt(e.target.value)} placeholder="Your offer ($)" required
                        style={{ flex: 1, border: "1px solid var(--hairline)", borderRadius: 2, padding: "10px 12px" }} data-testid="offer-amount-input" />
                      <button className="btn btn-steel" disabled={busy} data-testid="offer-submit-btn">Send</button>
                    </form>
                  )}
                  <div className="payment-note">
                    <ShieldCheck size={13} /> Payment happens off-platform, member-to-member (PayPal/Venmo). First Unit never holds funds.
                  </div>
                </div>
              )}
            </div>

            {/* Seller card */}
            <div className="seller-card card" data-testid="seller-card">
              <div className="sc-head">Seller</div>
              <div className="sc-body">
                <AvatarRing size="lg" src={showPhoto ? s.avatar : null} initials={showInitials ? s.initials : undefined} />
                <div>
                  <div className="sc-handle">{s.display_handle}</div>
                  {s.verified_badge && <VerifiedBadge />}
                  {s.agency && <div className="sc-agency">{s.agency}</div>}
                </div>
              </div>
              <button className="btn btn-ghost btn-block" disabled title="Messaging launches in a later phase" data-testid="message-btn">
                <MessageSquare size={15} /> Message (coming soon)
              </button>
            </div>

            {/* Offers */}
            {(isOwner || offers.length > 0) && (
              <div className="offers-card card" data-testid="offers-card">
                <div className="sc-head">{isOwner ? "Offers received" : "Your offers"}</div>
                {offers.length === 0 ? (
                  <div className="mb-note" style={{ padding: "8px 0" }}>No offers yet.</div>
                ) : (
                  offers.map((o) => (
                    <div className="offer-row" key={o.id} data-testid={`offer-row-${o.id}`}>
                      <div>
                        <b>${Number(o.amount).toLocaleString()}</b>
                        {o.is_buy_now && <span className="mini-tag">Buy now</span>}
                        {isOwner && o.buyer && <div className="offer-buyer">{o.buyer.display_handle}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`pill ${OFFER_PILL[o.status]}`}>{o.status}</span>
                        {isOwner && o.status === "pending" && (
                          <>
                            <button className="btn btn-primary" style={{ padding: "6px 12px" }} onClick={() => actOffer(o.id, "accept")} data-testid={`accept-${o.id}`}>Accept</button>
                            <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => actOffer(o.id, "decline")} data-testid={`decline-${o.id}`}>Decline</button>
                          </>
                        )}
                        {!isOwner && o.status === "pending" && (
                          <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => actOffer(o.id, "withdraw")} data-testid={`withdraw-${o.id}`}>Withdraw</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
