import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { MarketHeader } from "../components/MarketHeader";
import { ListingCard } from "../components/ListingCard";
import { StoryViewer } from "../components/StoryViewer";
import { SlideRail } from "../components/SlideRail";
import { Footer } from "../components/Footer";
import { CategoryGlyph } from "../lib/categoryIcons";
import api, { fileUrl } from "../lib/api";
import { FeedAd, StoryAdCard, CategoryAdTile } from "../components/NativeAd";
import { injectFeed, prependAds, categoryAds, searchAds, mixStories, withSampleAds } from "../lib/ads";
import { SAMPLE_ADS } from "../lib/sampleDesk";
import { Sparkles, Play, Rocket, ChevronRight, Building2 } from "lucide-react";

const FALLBACK_CATS = [
  { slug: "gear", name: "Gear & Equipment", icon: "backpack", image: "" },
  { slug: "vehicles", name: "Vehicles", icon: "car", image: "" },
  { slug: "art", name: "Art & Personal Items", icon: "brush", image: "" },
];

const CONDITIONS = ["Any", "Excellent", "Good", "Fair"];
const DISTANCES = [["10", "10 mi"], ["25", "25 mi"], ["50", "50 mi"], ["all", "Nationwide"]];
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
  const [ads, setAds] = useState([]);
  const [shopCats, setShopCats] = useState(FALLBACK_CATS);

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
    api.get("/ads").then((r) => setAds(r.data.ads || [])).catch(() => {});
    api.get("/categories").then((r) => { if (r.data.categories?.length) setShopCats(r.data.categories); }).catch(() => {});
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
    else if (shopCats.some((c) => c.slug === cat)) list = list.filter((l) => l.category === cat);
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
  }, [all, cat, q, pmin, pmax, cond, dist, hasVideo, featuredOnly, shopCats]);

  const isFiltering = q.trim() || pmin || pmax || cond !== "Any" || dist !== "all" || hasVideo || featuredOnly ||
    [...shopCats.map((c) => c.slug), "deals", "near", "video"].includes(cat);

  // shelves (only when not actively filtering)
  const live = all || [];
  const topCat = useMemo(() => shopCats.map((c) => [c.slug, (all || []).filter((l) => l.category === c.slug).length]).sort((a, b) => b[1] - a[1])[0]?.[0] || shopCats[0]?.slug || "gear", [all, shopCats]);
  const shelf = (arr, n = 5) => arr.slice(0, n);
  const newToday = live.filter((l) => l.created_at && (Date.now() - new Date(l.created_at).getTime()) < 86400000);
  const recentViewed = recentIds.map((id) => live.find((l) => l.id === id)).filter(Boolean);
  const catTiles = shopCats.map((c) => {
    const items = live.filter((l) => l.category === c.slug);
    return { key: c.slug, label: c.name, count: items.length, icon: c.icon, image: c.image };
  });

  const onSearch = (query, category) => { setQ(query || ""); if (category) setCat(category); };
  const onNav = (key) => { setCat(key); setQ(""); };

  const allAds = useMemo(() => withSampleAds(ads, SAMPLE_ADS), [ads]);
  const feedAds = useMemo(() => allAds.filter((a) => a.placement === "feed"), [allAds]);
  const sponsoredAds = useMemo(() => feedAds.slice(0, 6), [feedAds]);
  const storyAds = useMemo(() => allAds.filter((a) => a.placement === "story"), [allAds]);
  const storyRow = useMemo(() => mixStories(stories, storyAds), [stories, storyAds]);
  const resultRows = useMemo(() => {
    if (q.trim()) return prependAds(filtered, searchAds(allAds, q));
    if (shopCats.some((c) => c.slug === cat)) return prependAds(filtered, categoryAds(allAds, cat));
    return injectFeed(filtered, feedAds);
  }, [filtered, allAds, feedAds, q, cat, shopCats]);
  const mixShelf = (items) => injectFeed(items, feedAds);
  const openStory = (i) => setViewer(i);
  const catRailAds = useMemo(() => {
    const seen = new Set();
    const out = [];
    shopCats.forEach((c) => {
      const k = c.slug;
      categoryAds(allAds, k).forEach((ad) => {
        if (!seen.has(ad.id)) { seen.add(ad.id); out.push(ad); }
      });
    });
    return out;
  }, [allAds, shopCats]);

  const shelves = [
    { id: "picks", title: "Picks for You", items: shelf([...live].sort((a, b) => (b.featured === a.featured ? 0 : b.featured ? 1 : -1))) },
    { id: "trending", title: `Trending in ${shopCats.find((c) => c.slug === topCat)?.name || topCat}`, items: shelf(live.filter((l) => l.category === topCat)) },
  ];
  if (recentViewed.length) shelves.push({ id: "viewed", title: `Because you viewed ${recentViewed[0].title}`, items: shelf(recentViewed.concat(live.filter((l) => l.category === recentViewed[0].category && l.id !== recentViewed[0].id))) });
  shelves.push({ id: "near", title: `${shopCats.find((c) => c.slug === topCat)?.name || topCat} Near You`, items: shelf(live.filter((l) => l.category === topCat && l.location)) });
  shelves.push({ id: "new", title: "New Today", items: shelf(newToday.length ? newToday : live) });

  return (
    <div className="fu-app market-home" data-testid="marketplace-page">
      <MarketHeader onSearch={onSearch} onNav={onNav} activeNav={cat} />

      <div className="wrap market-body">
        {/* LEFT filters */}
        <aside className="filter-rail" data-testid="filter-rail">
          <div className="fr-block">
            <div className="fr-head">Categories</div>
            {[{ slug: "all", name: "All Categories" }, ...shopCats].map((c) => (
              <button key={c.slug} className={`fr-cat ${cat === c.slug ? "active" : ""}`} onClick={() => onNav(c.slug)} data-testid={`filter-cat-${c.slug}`}>
                <span>{c.name}</span><span className="fr-count">{counts[c.slug] || 0}</span>
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
              {filtered.length === 0 && resultRows.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }} data-testid="feed-empty">No listings match these filters.</div>
              ) : (
                <div className="listings-grid" data-testid="listings-grid">
                  {resultRows.map((row, i) => row.kind === "ad"
                    ? <FeedAd key={`ad-${row.ad.id}-${i}`} ad={row.ad} />
                    : <ListingCard key={row.item.id} listing={row.item} />)}
                </div>
              )}
            </>
          ) : (
            <>
              {/* promo carousel */}
              <div className="promo-carousel" data-testid="promo-carousel">
                <div className="promo-slide">
                  <div className="promo-copy">
                    <div className="promo-t oswald">{PROMOS[promo].t}</div>
                    <div className="promo-s">{PROMOS[promo].s}</div>
                    <div className="promo-dots">{PROMOS.map((_, i) => <button key={i} className={i === promo ? "on" : ""} onClick={() => setPromo(i)} data-testid={`promo-dot-${i}`} />)}</div>
                  </div>
                  <Link to={PROMOS[promo].to} className="btn btn-primary" data-testid="promo-cta">{PROMOS[promo].cta}</Link>
                </div>
              </div>

              {/* shop by category */}
              <div className="shelf-h-row"><h2 className="oswald shelf-h">Shop by Category</h2></div>
              <SlideRail label="categories" speed={26} gap={16} className="cat-rail">
                {catRailAds.map((ad) => <CategoryAdTile key={ad.id} ad={ad} />)}
                {catTiles.map((c) => (
                  <button key={c.key} className={`cat-tile ${c.image ? "cat-tile-photo" : "cat-tile-icon"} cat-${c.key}`} onClick={() => onNav(c.key)} data-testid={`cat-tile-${c.key}`}>
                    <span className="ct-img">
                      {c.image
                        ? <img src={fileUrl(c.image)} alt="" />
                        : <span className="ct-icon"><span className="ct-icon-badge"><CategoryGlyph name={c.icon} size={28} /></span></span>}
                      <span className="ct-copy">
                        <span className="ct-label">{c.label}</span>
                        <span className="ct-count">{c.count.toLocaleString()} listing{c.count === 1 ? "" : "s"}</span>
                      </span>
                    </span>
                  </button>
                ))}
                <Link to="/dashboard?view=jobs" className="cat-tile cat-tile-icon cat-jobs" data-testid="cat-tile-jobs">
                  <span className="ct-img">
                    <span className="ct-icon"><span className="ct-icon-badge"><Building2 size={28} strokeWidth={1.75} /></span></span>
                    <span className="ct-copy">
                      <span className="ct-label">Department Jobs</span>
                      <span className="ct-count">Open roles</span>
                    </span>
                  </span>
                </Link>
              </SlideRail>

              {/* featured stories rail */}
              {storyRow.length > 0 && (
                <>
                  <div className="shelf-h-row"><h2 className="oswald shelf-h"><Sparkles size={16} /> Stories</h2></div>
                  <p className="market-slot-note">Seller stories and 9:16 sponsored posters share this reel. Ads lead, then drop in after every N stories.</p>
                  <SlideRail label="stories" speed={36} gap={16} className="story-rail story-poster-rail">
                    {storyRow.map((s, i) => (
                      s.ad ? (
                        <StoryAdCard key={s.id} ad={s.ad} onOpen={() => openStory(i)} />
                      ) : (
                        <button className="story-poster" key={s.id} onClick={() => openStory(i)} data-testid={`story-card-${s.listing_id}`}>
                          <span className="story-poster-art" style={{ backgroundImage: s.photo ? `url(${fileUrl(s.photo)})` : undefined }}>
                            <span className="sc-play"><Play size={16} fill="currentColor" /></span>
                            <span className="story-poster-copy">
                              <small>{s.seller?.display_handle}</small>
                              <b>{s.title}</b>
                              <em>${Number(s.price).toLocaleString()}</em>
                            </span>
                          </span>
                        </button>
                      )
                    ))}
                  </SlideRail>
                </>
              )}

              {sponsoredAds.length > 0 && (
                <>
                  <div className="shelf-h-row"><h2 className="oswald shelf-h">Sponsors</h2></div>
                  <p className="market-slot-note">Native ads from the admin desk. They also sit in the feed below after every N listings.</p>
                  <SlideRail label="sponsors" speed={28} gap={16} className="sponsor-rail">
                    {sponsoredAds.map((ad) => <FeedAd key={`ad-${ad.id}-sponsored`} ad={ad} />)}
                  </SlideRail>
                </>
              )}

              <div className="shelf-h-row"><h2 className="oswald shelf-h">Home feed</h2></div>
              <p className="market-slot-note">Feed ads drop in after every N posts, as set per ad. When two are due at once, they take turns.</p>
              <div className="listings-grid" data-testid="home-feed-grid">
                {mixShelf(live.slice(0, 20)).map((row, i) => row.kind === "ad"
                  ? <FeedAd key={`ad-${row.ad.id}-home-${i}`} ad={row.ad} />
                  : <ListingCard key={row.item.id} listing={row.item} />)}
              </div>

              {/* curated shelves */}
              {shelves.filter((sh) => sh.id !== "picks").map((sh, idx) => (
                sh.items.length > 0 && (
                  <div key={sh.id}>
                    {idx === 2 && (
                      <Link to="/sell" className="boost-band" data-testid="boost-band">
                        <div><Rocket size={18} /> <b>Get your listing featured</b> — Boost a listing to reach the top of the feed.</div>
                        <span className="btn btn-primary">Boost a Listing</span>
                      </Link>
                    )}
                    <div className="shelf-h-row">
                      <h2 className="oswald shelf-h">{sh.title}</h2>
                      <button className="see-all" onClick={() => { setCat(sh.id === "trending" || sh.id === "near" ? topCat : "all"); }} data-testid={`see-all-${sh.id}`}>See all <ChevronRight size={14} /></button>
                    </div>
                    <div className="listings-grid shelf-grid" data-testid={`shelf-${sh.id}`}>
                      {mixShelf(sh.items).map((row, i) => row.kind === "ad"
                        ? <FeedAd key={`ad-${row.ad.id}-${sh.id}-${i}`} ad={row.ad} />
                        : <ListingCard key={row.item.id} listing={row.item} />)}
                    </div>
                  </div>
                )
              ))}
            </>
          )}
        </div>
      </div>

      {viewer !== null && <StoryViewer stories={storyRow} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />}

      <Footer />
    </div>
  );
}
