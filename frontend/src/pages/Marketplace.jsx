import { useEffect, useState } from "react";
import { AppNav } from "../components/AppNav";
import { ListingCard } from "../components/ListingCard";
import api from "../lib/api";
import { Link } from "react-router-dom";
import { Search, Plus, Sparkles, Video } from "lucide-react";

const CHIPS = [
  { key: "all", label: "All" },
  { key: "gear", label: "Gear & Equipment" },
  { key: "vehicles", label: "Vehicles" },
  { key: "art", label: "Art & Personal" },
  { key: "featured", label: "Featured" },
  { key: "near", label: "Near me" },
  { key: "video", label: "Has video", inert: true },
];

export default function Marketplace() {
  const [listings, setListings] = useState(null);
  const [chip, setChip] = useState("all");
  const [q, setQ] = useState("");

  const load = async (activeChip = chip, query = q) => {
    const params = {};
    if (["gear", "vehicles", "art"].includes(activeChip)) params.category = activeChip;
    if (activeChip === "featured") params.featured = true;
    if (query) params.q = query;
    const { data } = await api.get("/listings", { params });
    setListings(data.listings);
  };

  useEffect(() => {
    load("all", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectChip = (c) => {
    if (c.inert) return;
    setChip(c.key);
    load(c.key, q);
  };

  const onSearch = (e) => {
    e.preventDefault();
    load(chip, q);
  };

  return (
    <div className="fu-app" data-testid="marketplace-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 26 }}>
        <div className="feed-head">
          <div>
            <span className="eyebrow tick">Marketplace</span>
            <h1 className="oswald" style={{ fontSize: 30, color: "var(--navy)", margin: "8px 0 0" }}>
              The verified feed
            </h1>
          </div>
          <Link to="/sell" className="btn btn-primary" data-testid="sell-cta-btn">
            <Plus size={16} /> Sell an item
          </Link>
        </div>

        <form className="feed-search" onSubmit={onSearch}>
          <Search size={17} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search gear, vehicles, art…"
            data-testid="feed-search-input"
          />
          <button className="btn btn-steel" data-testid="feed-search-btn">Search</button>
        </form>

        <div className="filter-chips" data-testid="filter-chips">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              className={`chip ${chip === c.key ? "active" : ""} ${c.inert ? "inert" : ""}`}
              onClick={() => selectChip(c)}
              data-testid={`chip-${c.key}`}
              title={c.inert ? "Available when video launches" : undefined}
            >
              {c.key === "video" && <Video size={13} style={{ marginRight: 5 }} />}
              {c.label}
            </button>
          ))}
        </div>

        {/* Featured Stories placeholder (reel arrives in Phase 6) */}
        <div className="stories-placeholder" data-testid="featured-stories-placeholder">
          <div className="sp-head">
            <Sparkles size={15} /> Featured Stories
            <span>Shoppable video stories arrive soon</span>
          </div>
          <div className="sp-row">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="sp-dot" key={i} />
            ))}
          </div>
        </div>

        {listings === null ? (
          <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
        ) : listings.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", marginTop: 10 }} data-testid="feed-empty">
            No listings here yet. Be the first to <Link to="/sell" style={{ color: "var(--red)", fontWeight: 700 }}>list an item</Link>.
          </div>
        ) : (
          <div className="listings-grid" data-testid="listings-grid">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
