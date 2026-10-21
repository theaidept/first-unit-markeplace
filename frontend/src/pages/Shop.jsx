import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MarketHeader } from "../components/MarketHeader";
import { ListingCard } from "../components/ListingCard";
import { Footer } from "../components/Footer";
import { AvatarRing } from "../components/AvatarRing";
import { VerifiedBadge } from "../components/VerifiedBadge";
import api from "../lib/api";

export default function Shop() {
  const { sellerId } = useParams();
  const [seller, setSeller] = useState(null);
  const [listings, setListings] = useState(null);

  useEffect(() => {
    setListings(null);
    api.get(`/shop/${sellerId}`).then((r) => {
      setSeller(r.data.seller);
      setListings(r.data.listings || []);
    }).catch(() => setListings([]));
  }, [sellerId]);

  const handle = seller?.display_handle || "Shop";
  const showPhoto = seller?.photo_visibility === "photo" && seller?.avatar;

  return (
    <div className="fu-app market-home" data-testid="shop-page">
      <MarketHeader />
      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <Link to="/marketplace" className="btn btn-ghost" style={{ marginBottom: 16 }}>← Marketplace</Link>
        <div className="shop-hero card" data-testid="shop-hero">
          <AvatarRing size="lg" src={showPhoto ? seller.avatar : null} initials={seller?.initials} />
          <div>
            <h1 className="oswald dash-h" style={{ margin: 0 }}>{handle}</h1>
            <p className="dash-empty-line" style={{ margin: "6px 0 0" }}>
              {seller?.verified_badge ? <><VerifiedBadge /> Verified seller</> : "Seller shop"}
              {listings ? ` · ${listings.length} listing${listings.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        {listings == null ? (
          <p className="dash-empty-line">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="dash-empty-line">No live listings in this shop yet.</p>
        ) : (
          <div className="listings-grid" data-testid="shop-grid">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
