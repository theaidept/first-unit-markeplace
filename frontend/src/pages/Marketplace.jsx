import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { MarketHeader } from "../components/MarketHeader";
import { ListingCard } from "../components/ListingCard";
import { StoryViewer } from "../components/StoryViewer";
import { CATEGORY_LABELS } from "../components/ListingCard";
import api, { fileUrl } from "../lib/api";
import { imgFallback } from "../lib/assets";
import { Sparkles, Play, Rocket, ChevronRight } from "lucide-react";

const CONDITIONS = ["Any", "Excellent", "Good", "Fair"];
const DISTANCES = [["10", "10 mi"], ["25", "25 mi"], ["50", "50 mi"], ["all", "Nationwide"]];
const CAT_ORDER = ["gear", "vehicles", "art"];
const PROMOS = [
  { t: "Founding Circle is open", s: "Verified responders — trade inside a network that already trusts you.", cta: "Verify & Join", to: "/verification" },
  { t: "Get seen faster", s: "Boost a listing to the top of the feed and the Featured Stories reel.", cta: "Sell an item", to: "/sell" },
  { t: "Department Job Board", s: "Agencies post open roles right alongside the marketplace.", cta: "Browse roles", to: "/dashboard?view=jobs" },
];
const isTest = (l) => /^test_/i.test(l.title || "");

export default function Marketplace() {
  const [params] = useSearchParams();
  const [all, setAll] = useState(null);
  const [stories, setStories] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [promo, setPromo] = useState(0);
  const [recentIds, setRecentIds] = useState([]);

  // filters
  const [cat, setCat] = useState(params.get("cat") || "all");
  const [q, setQ] = useState(params.get("q") || "");
  const [pmin, setPmin] = useState("");
  const [pmax, setPmax] = useState("");
  const [cond, setCond] = useState("Any");
  const [dist, setDist] = useState("all");
  const [hasVideo, setHasVideo] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  useEffect(() => {
    api.get("/listings").then((r) => setAll(r.data.listings.filter((l) => !isTest(l)))).catch(() => setAll([]));
    api.get("/stories").then((r) => setStories(r.data.stories.filter((s) => !isTest(s)))).catch(() => {});
    try { setRecentIds(JSON.parse(localStorage.getItem("fu_recent") || "[]")); } catch { /* ignore */ }
    const t = setInterval(() => setPromo((p) => (p + 1) % PROMOS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(() => {
    const c = { all: (all || []).length };
    (all || []).forEach((l) => { c[l.category] = (c[l.category] || 0) + 1; });
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    let list = all || [];
    if (cat === "deals") list = [...list].sort((a, b) => a.price - b.price);
    else if (cat === "near") list = list.filter((l) => l.location);
    else if (cat === "video") list = list.filter((l) => l.has_video);
    else if (["gear", "vehicles", "art"].includes(cat)) list = list.filter((l) => l.category === cat);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((l) => (l.title || "").toLowerCase().includes(s) || (l.description || "").toLowerCase().includes(s));
    }
    if (pmin) list = list.filter((l) => Number(l.price) >= Number(pmin));
    if (pmax) list = list.filter((l) => Number(l.price) <= Number(pmax));
    if (cond !== "Any") list = list.filter((l) => l.condition === cond);
    if (dist !== "all") list = list.filter((l) => !!l.location);
    if (hasVideo) list = list.filter((l) => l.has_video);
    if (featuredOnly) list = list.filter((l) => l.featured);
    return list;
  }, [all, cat, q, pmin, pmax, cond, dist, hasVideo, featuredOnly]);

  const isFiltering = q.trim() || pmin || pmax || cond !== "Any" || dist !== "all" || hasVideo || featuredOnly ||
    ["gear", "vehicles", "art", "deals", "near", "video"].includes(cat);

  // shelves (only when not actively filtering)
  const live = all || [];
  const topCat = useMemo(() => CAT_ORDER.map((k) => [k, (all || []).filter((l) => l.category === k).length]).sort((a, b) => b[1] - a[1])[0]?.[0] || "gear", [all]);
  const shelf = (arr, n = 5) => arr.slice(0, n);
  const newToday = live.filter((l) => l.created_at && (Date.now() - new Date(l.created_at).getTime()) < 86400000);
  const recentViewed = recentIds.map((id) => live.find((l) => l.id === id)).filter(Boolean);
  const catTiles = CAT_ORDER.map((k) => {
    const items = live.filter((l) => l.category === k);
    const photo = items.find((l) => l.photos && l.photos[0])?.photos?.[0];
    return { key: k, label: CATEGORY_LABELS[k], count: items.length, photo };
  });

  const onSearch = (query, category) => { setQ(query || ""); if (category) setCat(category); };
  const onNav = (key) => { setCat(key); setQ(""); };

  const shelves = [
    { id: "picks", title: "Picks for You", items: shelf([...live].sort((a, b) => (b.featured === a.featured ? 0 : b.featured ? 1 : -1))) },
    { id: "trending", title: `Trending in ${CATEGORY_LABELS[topCat]}`, items: shelf(live.filter((l) => l.category === topCat)) },
  ];
  if (recentViewed.length) shelves.push({ id: "viewed", title: `Because you viewed ${recentViewed[0].title}`, items: shelf(recentViewed.concat(live.filter((l) => l.category === recentViewed[0].category && l.id !== recentViewed[0].id))) });
  shelves.push({ id: "near", title: `${CATEGORY_LABELS[topCat]} Near You`, items: shelf(live.filter((l) => l.category === topCat && l.location)) });
  shelves.push({ id: "new", title: "New Today", items: shelf(newToday.length ? newToday : live) });

  return (
    <div className="fu-app market-home" data-testid="marketplace-page">
      <MarketHeader onSearch={onSearch} onNav={onNav} activeNav={cat} />

      <div className="wrap market-body">
        {/* LEFT filters */}
        <aside className="filter-rail" data-testid="filter-rail">
          <div className="fr-block">
            <div className="fr-head">Categories</div>
            {[["all", "All Categories"], ["gear", "Gear & Equipment"], ["vehicles", "Vehicles"], ["art", "Art & Personal"]].map(([k, lbl]) => (
              <button key={k} className={`fr-cat ${cat === k ? "active" : ""}`} onClick={() => onNav(k)} data-testid={`filter-cat-${k}`}>
                <span>{lbl}</span><span className="fr-count">{counts[k] || 0}</span>
              </button>
            ))}
          </div>
          <div className="fr-block">
            <div className="fr-head">Price range</div>
            <div className="fr-price">
              <input type="number" min="0" placeholder="Min" value={pmin} onChange={(e) => setPmin(e.target.value)} data-testid="filter-price-min" />
              <span>–</span>
              <input type="number" min="0" placeholder="Max" value={pmax} onChange={(e) => setPmax(e.target.value)} data-testid="filter-price-max" />
            </div>
          </div>
          <div className="fr-block">
            <div className="fr-head">Condition</div>
            <select value={cond} onChange={(e) => setCond(e.target.value)} data-testid="filter-condition">
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="fr-block">
            <div className="fr-head">Distance</div>
            <select value={dist} onChange={(e) => setDist(e.target.value)} data-testid="filter-distance">
              {DISTANCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="fr-block">
            <div className="fr-head">Listing type</div>
            <label className="fr-check"><input type="checkbox" checked={hasVideo} onChange={(e) => setHasVideo(e.target.checked)} data-testid="filter-hasvideo" /> Has video</label>
            <label className="fr-check"><input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} data-testid="filter-featured" /> Featured only</label>
          </div>
        </aside>

        {/* RIGHT content */}
        <div className="market-main">
          {isFiltering ? (
            <>
              <h2 className="oswald shelf-h" data-testid="results-heading">{filtered.length} result{filtered.length === 1 ? "" : "s"}</h2>
              {filtered.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }} data-testid="feed-empty">No listings match these filters.</div>
              ) : (
                <div className="listings-grid" data-testid="listings-grid">{filtered.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
              )}
            </>
          ) : (
            <>
              {/* promo carousel */}
              <div className="promo-carousel" data-testid="promo-carousel">
                <div className="promo-slide">
                  <div>
                    <div className="promo-t oswald">{PROMOS[promo].t}</div>
                    <div className="promo-s">{PROMOS[promo].s}</div>
                  </div>
                  <Link to={PROMOS[promo].to} className="btn btn-primary" data-testid="promo-cta">{PROMOS[promo].cta}</Link>
                </div>
                <div className="promo-dots">{PROMOS.map((_, i) => <button key={i} className={i === promo ? "on" : ""} onClick={() => setPromo(i)} data-testid={`promo-dot-${i}`} />)}</div>
              </div>

              {/* shop by category */}
              <div className="shelf-h-row"><h2 className="oswald shelf-h">Shop by Category</h2></div>
              <div className="cat-tiles" data-testid="cat-tiles">
                {catTiles.map((c) => (
                  <button key={c.key} className="cat-tile" onClick={() => onNav(c.key)} data-testid={`cat-tile-${c.key}`}>
                    <span className="ct-img">{c.photo ? <img src={fileUrl(c.photo)} alt={c.label} onError={imgFallback} /> : <span className="ct-ph">First Unit</span>}</span>
                    <span className="ct-label">{c.label}</span>
                    <span className="ct-count">{c.count} listing{c.count === 1 ? "" : "s"}</span>
                  </button>
                ))}
                <Link to="/dashboard?view=jobs" className="cat-tile" data-testid="cat-tile-jobs">
                  <span className="ct-img"><span className="ct-ph">Jobs</span></span>
                  <span className="ct-label">Department Jobs</span>
                  <span className="ct-count">Open roles</span>
                </Link>
              </div>

              {/* featured stories rail */}
              {stories.length > 0 && (
                <>
                  <div className="shelf-h-row"><h2 className="oswald shelf-h"><Sparkles size={16} /> Featured Stories</h2></div>
                  <div className="reel" data-testid="stories-reel">
                    {stories.map((s, i) => (
                      <button className="story-card" key={s.id} onClick={() => setViewer(i)} data-testid={`story-card-${s.listing_id}`}>
                        <span className="sc-ring"><span className="sc-thumb" style={{ backgroundImage: s.photo ? `url(${fileUrl(s.photo)})` : undefined }}><span className="sc-play"><Play size={16} fill="currentColor" /></span></span></span>
                        <span className="sc-handle">{s.seller?.display_handle}</span>
                        <span className="sc-price">${Number(s.price).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* curated shelves */}
              {shelves.map((sh, idx) => (
                sh.items.length > 0 && (
                  <div key={sh.id}>
                    {idx === 2 && (
                      <Link to="/sell" className="boost-band" data-testid="boost-band">
                        <div><Rocket size={18} /> <b>Get your listing featured</b> — Boost a listing to reach the top of the feed.</div>
                        <span className="btn btn-gold">Boost a Listing</span>
                      </Link>
                    )}
                    <div className="shelf-h-row">
                      <h2 className="oswald shelf-h">{sh.title}</h2>
                      <button className="see-all" onClick={() => { setCat(sh.id === "trending" || sh.id === "near" ? topCat : "all"); }} data-testid={`see-all-${sh.id}`}>See all <ChevronRight size={14} /></button>
                    </div>
                    <div className="listings-grid shelf-grid" data-testid={`shelf-${sh.id}`}>{sh.items.map((l) => <ListingCard key={l.id} listing={l} />)}</div>
                  </div>
                )
              ))}
            </>
          )}
        </div>
      </div>

      {viewer !== null && <StoryViewer stories={stories} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />}

      {/* mega footer */}
      <footer className="mega-footer" data-testid="mega-footer">
        <div className="wrap mf-cols">
          <div><h4>Marketplace</h4><Link to="/marketplace">Browse all</Link><Link to="/sell">Sell an item</Link><Link to="/marketplace?cat=video">Video listings</Link><Link to="/marketplace?cat=deals">Deals</Link></div>
          <div><h4>Community</h4><Link to="/members">Members</Link><Link to="/dashboard?view=jobs">Job Board</Link><Link to="/messages">Messages</Link></div>
          <div><h4>Account</h4><Link to="/dashboard">Dashboard</Link><Link to="/profile">Profile</Link><Link to="/verification">Verification</Link><Link to="/transactions">Orders &amp; Offers</Link></div>
          <div><h4>Company</h4><Link to="/">About First Unit</Link><a href="mailto:support@firstunit.us">Help &amp; Support</a><Link to="/">Trust &amp; Safety</Link></div>
        </div>
        <div className="wrap mf-legal">© {new Date().getFullYear()} First Unit — Verified first responders only.</div>
      </footer>
    </div>
  );
}
