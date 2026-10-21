import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { AdPhonePreview, FeedAd, StoryAdCard, CategoryAdTile } from "../components/NativeAd";
import { AdMediaPicker } from "../components/AdMediaPicker";
import { placeLabel } from "../lib/ads";
import { ArrowUpRight, Megaphone, Eye, MousePointerClick, Percent } from "lucide-react";
import { PageHero, Stats, Stat } from "../components/AdminKit";

const PLACES = [
  { key: "feed", label: "Home feed tile", ratio: "1:1", spec: "Image: 1080 × 1080 square", diagram: "feed",
    blurb: "Shows between posts in the main feed. You pick how often: after every 2, 3, 4, 5 or 6 posts.",
    freqs: [2, 3, 4, 5, 6], unit: "posts" },
  { key: "story", label: "Story ad", ratio: "9:16", spec: "Image or video: 1080 × 1920 vertical", diagram: "story",
    blurb: "Full-height vertical ad in the Stories row. You pick how often: after every 2, 3, 4, 5 or 6 stories.",
    freqs: [2, 3, 4, 5, 6, 8], unit: "stories" },
  { key: "category", label: "Category page tile", ratio: "1:1", spec: "Image: 1080 × 1080 square", diagram: "category",
    blurb: "First tile on one category page, e.g. Duty Gear. Shown to people browsing that category.",
    freqs: null, unit: null },
  { key: "search", label: "Search results tile", ratio: "1:1", spec: "Image: 1080 × 1080 square", diagram: "search",
    blurb: "First result when someone searches one of your keywords, e.g. boots.",
    freqs: null, unit: null },
];
const TYPES = [
  { key: "product", label: "Product" },
  { key: "event", label: "Event" },
  { key: "service", label: "Service" },
  { key: "brand", label: "Brand" },
];

const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const blank = () => ({
  placement: "", ad_type: "product", advertiser: "", headline: "", price: "", link_url: "",
  listing_id: "", seller_id: "", event_date: "", location: "", short_line: "",
  category_slug: "", keywords: "", start_date: iso(new Date()), expiry_date: plusDays(30),
  frequency: 4, image: "", video: "", show_cta: false,
});
const md = (v) => {
  if (!v) return "—";
  const d = new Date(`${v}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function PlaceDiagram({ kind }) {
  if (kind === "story") {
    return (
      <div className="ads-diag story">
        {Array.from({ length: 5 }, (_, i) => <i key={i} className={i === 3 ? "hot" : ""} />)}
      </div>
    );
  }
  const cells = 8;
  const hot = kind === "feed" ? [2, 6] : kind === "category" ? [0] : [1];
  return (
    <div className={`ads-diag ${kind}`}>
      {Array.from({ length: cells }, (_, i) => <i key={i} className={hot.includes(i) ? "hot" : ""} />)}
    </div>
  );
}

function FreqBar({ every, unit }) {
  const cells = Array.from({ length: 12 }, (_, i) => (i + 1) % every === 0);
  const pct = Math.round(100 / every);
  return (
    <div className="ads-freq">
      <div className="ads-freq-bar">
        {cells.map((ad, i) => <i key={i} className={ad ? "ad" : ""}>{ad ? "AD" : ""}</i>)}
      </div>
      <p>Ad shows after every {every} {unit}, about {pct}% of the {unit === "stories" ? "Stories row" : "feed"}. Fewer {unit} between = more views.</p>
    </div>
  );
}

function last7(daily) {
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = daily?.[key] || {};
    out.push({
      key,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      views: Number(row.views) || 0,
      clicks: Number(row.clicks) || 0,
    });
  }
  return out;
}

const BAR_PX = 84;
function barPx(value, max) {
  const n = Number(value) || 0;
  const top = Math.max(1, Number(max) || 1);
  return Math.max(4, Math.round((n / top) * BAR_PX));
}

function BarChart({ rows, field, tone, testid }) {
  const max = Math.max(1, ...rows.map((d) => Number(d[field]) || 0));
  return (
    <div className={`ads-bars ${tone || ""}`} data-testid={testid}>
      {rows.map((d) => (
        <div key={`${field}-${d.key}`} title={`${d.label}: ${Number(d[field] || 0).toLocaleString()}`}>
          <i style={{ height: barPx(d[field], max) }} />
          <em>{d.label}</em>
        </div>
      ))}
    </div>
  );
}

function AdThumb({ ad, onBroken }) {
  const initial = (ad.advertiser || ad.headline || "?").trim().charAt(0).toUpperCase() || "?";
  const [bad, setBad] = useState(!ad.image);
  useEffect(() => { setBad(!ad.image); }, [ad.id, ad.image]);
  return (
    <div className="ads-thumb" aria-hidden>
      {!bad ? (
        <img
          src={fileUrl(ad.image)}
          alt=""
          onError={() => { setBad(true); onBroken?.(ad.id); }}
        />
      ) : (
        <span className="ads-thumb-ph">{initial}</span>
      )}
    </div>
  );
}

function flightOf(ad) {
  const start = new Date(`${(ad.start_date || "").slice(0, 10)}T00:00:00`);
  const end = new Date(`${(ad.expiry_date || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { day: 0, total: 1, pct: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const total = Math.max(1, Math.round((end - start) / 86400000));
  const day = Math.min(total, Math.max(0, Math.round((today - start) / 86400000)));
  return { day, total, pct: Math.min(100, Math.round((day / total) * 100)) };
}

function adPayload(a) {
  return {
    advertiser: a.advertiser, headline: a.headline, ad_type: a.ad_type, placement: a.placement,
    link_url: a.link_url || "", listing_id: a.listing_id || "", seller_id: a.seller_id || "",
    price: a.price || "", event_date: a.event_date || "", location: a.location || "",
    short_line: a.short_line || "", category_slug: a.category_slug || "", keywords: a.keywords || "",
    start_date: a.start_date || "", expiry_date: a.expiry_date || "", frequency: Number(a.frequency) || 4,
    image: a.image || "", video: a.video || "", days: a.days || 30, active: a.active !== false, show_cta: !!a.show_cta,
  };
}

export default function AdsAdmin({ listings = [], onChanged }) {
  const [ads, setAds] = useState([]);
  const [stats, setStats] = useState({ live: 0, views: 0, clicks: 0, ctr: 0 });
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [previewAd, setPreviewAd] = useState(null);
  const [previewPlace, setPreviewPlace] = useState("feed");
  const [busy, setBusy] = useState(false);
  const [liveNote, setLiveNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("all");
  const [placeTab, setPlaceTab] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("views");
  const [menuId, setMenuId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [broken, setBroken] = useState({});
  const [catOptions, setCatOptions] = useState([]);
  const dialogRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/ads");
      const list = data.ads || [];
      setAds(list);
      setStats(data.stats || { live: 0, views: 0, clicks: 0, ctr: 0 });
      return list;
    } catch { return []; }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get("/categories").then((r) => setCatOptions(r.data.categories || [])).catch(() => {});
  }, []);

  const place = PLACES.find((p) => p.key === draft.placement);
  const liveListings = listings.filter((l) => l.status === "live");
  const sellers = useMemo(() => {
    const map = new Map();
    liveListings.forEach((l) => {
      if (l.seller_id && !map.has(l.seller_id)) map.set(l.seller_id, { id: l.seller_id, name: l.seller || "Member" });
    });
    return [...map.values()];
  }, [liveListings]);
  const reportAd = ads.find((a) => a.id === reportId) || ads[0] || null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const goLive = async () => {
    if (!draft.placement) { toast.error("Choose a placement"); return; }
    if (!draft.advertiser.trim() || !draft.headline.trim()) { toast.error("Advertiser and headline are required"); return; }
    if (!draft.image) { toast.error("Add an ad image (or a story video)"); return; }
    setBusy(true);
    const body = { ...draft, days: 30, active: true, frequency: Number(draft.frequency) || 4 };
    try {
      if (editingId) await api.put(`/admin/ads/${editingId}`, body);
      else await api.post("/admin/ads", body);
      const text = editingId ? "Ad updated" : "The ad is live";
      setLiveNote(text);
      toast.success(text, { duration: 5000 });
      setDraft(blank());
      setEditingId(null);
      await load();
      onChanged?.();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const openAnalytics = (a) => {
    setMenuId(null);
    setPreviewPlace(a.placement || "feed");
    setPreviewAd(a);
  };

  const duplicate = async (a) => {
    setMenuId(null);
    try {
      await api.post("/admin/ads", { ...adPayload(a), headline: `${a.headline} copy`, active: true });
      toast.success("Ad duplicated");
      await load();
      onChanged?.();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const editAd = (a) => {
    setMenuId(null);
    setEditingId(a.id);
    setDraft({ ...blank(), ...adPayload(a) });
    setPreviewAd(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pause = async (a) => {
    try {
      await api.put(`/admin/ads/${a.id}`, { ...a, active: !a.active });
      const list = await load();
      if (previewAd?.id === a.id) setPreviewAd(list.find((x) => x.id === a.id) || null);
      onChanged?.();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const remove = async (a) => {
    const snap = adPayload(a);
    setConfirmId(null);
    setMenuId(null);
    try {
      await api.delete(`/admin/ads/${a.id}`);
      if (previewAd?.id === a.id) setPreviewAd(null);
      await load();
      onChanged?.();
      toast("Ad removed", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await api.post("/admin/ads", snap);
              await load();
              onChanged?.();
              toast.success("Ad restored");
            } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
          },
        },
      });
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const headlineLabel = draft.ad_type === "product" ? "Product name" : draft.ad_type === "event" ? "Event name" : "Headline";
  const chart = last7(reportAd?.daily);
  const detailChart = last7(previewAd?.daily);
  const stageAd = useMemo(
    () => (previewAd ? { ...previewAd, placement: previewPlace } : null),
    [previewAd, previewPlace],
  );
  const avgCtr = ads.length ? ads.reduce((sum, a) => sum + Number(a.ctr || 0), 0) / ads.length : 0;
  const topId = ads.reduce((best, a) => (!best || Number(a.ctr || 0) > Number(best.ctr || 0) ? a : best), null)?.id;
  const pausedCount = ads.filter((a) => a.status === "paused").length;
  const pendingCount = ads.filter((a) => a.status === "pending").length;

  const decide = async (a, approval) => {
    setMenuId(null);
    try {
      await api.put(`/admin/ads/${a.id}`, { ...adPayload(a), active: approval === "approved", approval });
      const list = await load();
      if (previewAd?.id === a.id) setPreviewAd(list.find((x) => x.id === a.id) || null);
      toast.success(approval === "approved" ? "Ad approved and live" : "Ad rejected");
      onChanged?.();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const filtered = ads
    .filter((a) => {
      if (statusTab === "live" && a.status !== "live") return false;
      if (statusTab === "paused" && a.status !== "paused") return false;
      if (statusTab === "pending" && a.status !== "pending") return false;
      if (placeTab === "feed" && a.placement !== "feed") return false;
      if (placeTab === "story" && a.placement !== "story") return false;
      if (placeTab === "category" && a.placement !== "category") return false;
      if (placeTab === "search" && a.placement !== "search") return false;
      if (placeTab === "sponsors" && a.placement !== "feed") return false;
      const needle = query.trim().toLowerCase();
      if (needle && !`${a.headline} ${a.advertiser}`.toLowerCase().includes(needle)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "ctr") return Number(b.ctr || 0) - Number(a.ctr || 0);
      if (sortKey === "end") return String(a.expiry_date || "").localeCompare(String(b.expiry_date || ""));
      return Number(b.views || 0) - Number(a.views || 0);
    });

  useEffect(() => {
    if (!previewAd) return undefined;
    const root = dialogRef.current;
    const previous = document.activeElement;
    const focusables = () => [...(root?.querySelectorAll("button, a[href], input, select, textarea") || [])].filter((el) => !el.disabled);
    focusables()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { setPreviewAd(null); return; }
      if (e.key !== "Tab" || !root) return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [previewAd]);

  useEffect(() => {
    if (!menuId) return undefined;
    const close = (e) => {
      if (e.target.closest?.(".ads-menu")) return;
      setMenuId(null);
      setConfirmId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuId]);

  return (
    <div className="ap-page" data-testid="admin-ads">
      <PageHero
        kicker="Money"
        title="Ads"
        copy="You build the ad here. Members see it on the marketplace — stories, home feed, a category page, or search. Advertisers do not get a login."
        action={<Link className="ap-btn ghost" to="/marketplace" data-testid="ads-open-marketplace">Open marketplace <ArrowUpRight size={14} /></Link>}
      />
      <Stats>
        <Stat icon={Megaphone} label="Live ads" value={stats.live} tone="navy" />
        <Stat icon={Eye} label="Display views" value={Number(stats.views || 0).toLocaleString()} />
        <Stat icon={MousePointerClick} label="URL clicks" value={Number(stats.clicks || 0).toLocaleString()} tone="gold" />
        <Stat icon={Percent} label="Avg. CTR" value={`${stats.ctr || 0}%`} />
      </Stats>

      <section className="dash-panel">
        <h2 className="oswald shelf-h">Step 1 · Choose placement</h2>
        <p className="dash-empty-line">The placement decides where the ad shows on the site and what image it needs.</p>
        <div className="ads-places">
          {PLACES.map((p) => (
            <button
              type="button"
              key={p.key}
              className={`ads-place ${draft.placement === p.key ? "on" : ""}`}
              onClick={() => set({ placement: p.key, frequency: p.freqs ? (p.key === "story" ? 3 : 4) : 1, video: p.key === "story" ? draft.video : "" })}
              data-testid={`ad-place-${p.key}`}
            >
              <PlaceDiagram kind={p.diagram} />
              <strong>{p.label} <span>{p.ratio}</span></strong>
              <p>{p.blurb}</p>
              <em>{p.spec}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="dash-panel">
        <h2 className="oswald shelf-h">Step 2 · Ad details</h2>
        {!place ? (
          <p className="dash-empty-line">Choose a placement above to fill in the details.</p>
        ) : (
          <div className="ads-details">
            <div className="ads-form">
              <div className="field" style={{ margin: 0 }}>
                <label>What are you promoting?</label>
                <div className="ads-types">
                  {TYPES.map((t) => (
                    <button type="button" key={t.key} className={draft.ad_type === t.key ? "on" : ""} onClick={() => set({ ad_type: t.key })} data-testid={`ad-type-${t.key}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div className="ads-grid">
                <div className="field" style={{ margin: 0 }}><label>Advertiser / brand</label>
                  <input value={draft.advertiser} onChange={(e) => set({ advertiser: e.target.value })} placeholder="e.g. Police Bags" data-testid="ad-advertiser" /></div>
                <div className="field" style={{ margin: 0 }}><label>{headlineLabel}</label>
                  <input value={draft.headline} onChange={(e) => set({ headline: e.target.value })} placeholder={draft.ad_type === "product" ? "e.g. Patrol Duty Bag 40L" : "Headline"} data-testid="ad-headline" /></div>
                {draft.ad_type === "product" && (
                  <div className="field" style={{ margin: 0 }}><label>Price (optional)</label>
                    <input value={draft.price} onChange={(e) => set({ price: e.target.value })} placeholder="$129.00" data-testid="ad-price" /></div>
                )}
                {draft.ad_type === "event" && (
                  <>
                    <div className="field" style={{ margin: 0 }}><label>Event date</label>
                      <input type="date" value={draft.event_date} onChange={(e) => set({ event_date: e.target.value })} data-testid="ad-event-date" /></div>
                    <div className="field" style={{ margin: 0 }}><label>Location</label>
                      <input value={draft.location} onChange={(e) => set({ location: e.target.value })} placeholder="City, State or Online" data-testid="ad-location" /></div>
                  </>
                )}
                {(draft.ad_type === "service" || draft.ad_type === "brand") && (
                  <div className="field" style={{ margin: 0 }}><label>Short line (optional)</label>
                    <input value={draft.short_line} onChange={(e) => set({ short_line: e.target.value })} placeholder="e.g. Free quotes for agencies" data-testid="ad-short" /></div>
                )}
                <div className="field" style={{ margin: 0 }}><label>Link URL</label>
                  <input value={draft.link_url} onChange={(e) => set({ link_url: e.target.value })} placeholder="https://" data-testid="ad-link" /></div>
                <div className="field" style={{ margin: 0 }}><label>Start date</label>
                  <input type="date" value={draft.start_date} onChange={(e) => set({ start_date: e.target.value })} data-testid="ad-start" /></div>
                <div className="field" style={{ margin: 0 }}><label>Expiry date</label>
                  <input type="date" value={draft.expiry_date} onChange={(e) => set({ expiry_date: e.target.value })} data-testid="ad-expiry" /></div>
              </div>

              {draft.ad_type === "product" && (
                <div className="field" style={{ margin: "10px 0 0" }}>
                  <label>Link to a marketplace product (substore)</label>
                  <select value={draft.listing_id} onChange={(e) => {
                    const id = e.target.value;
                    const l = liveListings.find((x) => x.id === id);
                    set({ listing_id: id, seller_id: l?.seller_id || "", headline: draft.headline || l?.title || "", price: draft.price || (l?.price != null ? `$${l.price}` : "") });
                  }} data-testid="ad-listing">
                    <option value="">External link only</option>
                    {liveListings.map((l) => <option key={l.id} value={l.id}>{l.title} · {l.seller}</option>)}
                  </select>
                </div>
              )}
              {draft.ad_type === "brand" && (
                <div className="field" style={{ margin: "10px 0 0" }}>
                  <label>Link to a seller shop (all of their products)</label>
                  <select value={draft.seller_id} onChange={(e) => set({ seller_id: e.target.value, listing_id: "" })} data-testid="ad-seller">
                    <option value="">External link only</option>
                    {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {draft.placement === "category" && (
                <div className="field" style={{ margin: "10px 0 0" }}>
                  <label>Category page</label>
                  <select value={draft.category_slug} onChange={(e) => set({ category_slug: e.target.value })} data-testid="ad-category">
                    <option value="">All categories</option>
                    {catOptions.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {draft.placement === "search" && (
                <div className="field" style={{ margin: "10px 0 0" }}>
                  <label>Keywords (comma separated)</label>
                  <input value={draft.keywords} onChange={(e) => set({ keywords: e.target.value })} placeholder="boots, footwear, shoes" data-testid="ad-keywords" />
                </div>
              )}

              {place.freqs && (
                <div className="field" style={{ margin: "12px 0 0" }}>
                  <label>Show after every</label>
                  <select value={draft.frequency} onChange={(e) => set({ frequency: Number(e.target.value) })} data-testid="ad-frequency">
                    {place.freqs.map((n) => <option key={n} value={n}>{n} {place.unit}</option>)}
                  </select>
                  <FreqBar every={Number(draft.frequency) || place.freqs[1]} unit={place.unit} />
                </div>
              )}

              <div className="field" style={{ margin: "12px 0 0" }}>
                <AdMediaPicker
                  placeKey={place.key}
                  image={draft.image}
                  video={draft.video}
                  onChange={(patch) => set(patch)}
                />
              </div>
              <label className="fr-check" style={{ marginTop: 12 }}>
                <input type="checkbox" checked={!!draft.show_cta} onChange={(e) => set({ show_cta: e.target.checked })} data-testid="ad-show-cta" />
                Show Shop now / CTA button (off by default so the ad stays native)
              </label>
              {liveNote ? <div className="ads-upload-note ok ads-live-note" role="status" aria-live="polite">{liveNote}</div> : null}
              <button type="button" className="abtn primary" onClick={goLive} disabled={busy} data-testid="ad-add">{busy ? "Saving…" : editingId ? "Save changes" : "Set ad live"}</button>
              {editingId ? <button type="button" className="ap-btn" style={{ marginLeft: 8 }} onClick={() => { setEditingId(null); setDraft(blank()); }}>Cancel edit</button> : null}
            </div>
            <aside className="ads-aside">
              <div className="ads-aside-h">Live preview</div>
              <AdPhonePreview draft={draft} placement={draft.placement} />
              <div className="ads-spec">
                <b>{place.key === "story" ? "Story · 9:16 image or video" : "Tile · 1:1 image"}</b>
                <ul>
                  {place.key === "story" ? (
                    <>
                      <li>Vertical 9:16, 1080 × 1920. Wrong-size photos open a crop box. Videos that are not 9:16 are rejected.</li>
                      <li>Keep text and faces out of the top 250 px and bottom 340 px.</li>
                    </>
                  ) : (
                    <>
                      <li>Square 1:1, 1080 × 1080. Drag a photo in — we crop if it is not square.</li>
                      <li>Keep text out of the top 80 px so the Sponsored label can sit there.</li>
                    </>
                  )}
                  <li>JPG, PNG or WebP up to 8 MB. Story video: MP4 / MOV / WEBM up to 80 MB.</li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </section>

      <div className="ads-kpi" data-testid="ads-kpi">
        <div><em>Total views</em><b>{Number(stats.views || 0).toLocaleString()}</b></div>
        <div><em>Total clicks</em><b>{Number(stats.clicks || 0).toLocaleString()}</b></div>
        <div><em>Average CTR</em><b>{Number(stats.ctr || avgCtr || 0).toFixed(2)}%</b></div>
        <div><em>Live</em><b>{stats.live || 0}</b></div>
        <div><em>Paused</em><b>{pausedCount}</b></div>
        <div><em>Pending</em><b>{pendingCount}</b></div>
      </div>

      <div className="ads-bottom">
        <section className="ap-panel ads-table-wrap">
          <div className="ap-panel-h">
            <div>
              <h3 className="oswald">All ads</h3>
              <p>Filter the flight, then open analytics for the full report.</p>
            </div>
            <span className="ap-count">{filtered.length}</span>
          </div>
          <div className="ads-filters">
            <div className="ads-tabs" role="tablist" aria-label="Ad status">
              {[
                ["all", "All"],
                ["live", "Live"],
                ["paused", "Paused"],
                ["pending", pendingCount ? `Pending (${pendingCount})` : "Pending"],
              ].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={statusTab === id} className={statusTab === id ? "on" : ""} onClick={() => setStatusTab(id)}>{label}</button>
              ))}
            </div>
            <div className="ads-chips" role="group" aria-label="Placement">
              {[
                ["all", "All placements"],
                ["feed", "Home Feed"],
                ["story", "Stories"],
                ["category", "Category"],
                ["search", "Search"],
                ["sponsors", "Sponsors"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={placeTab === id ? "on" : ""} aria-pressed={placeTab === id} onClick={() => setPlaceTab(id)}>{label}</button>
              ))}
            </div>
            <div className="ads-filter-row">
              <input className="ap-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or brand" aria-label="Search ads by title or brand" />
              <label className="ads-sort">
                Sort
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} aria-label="Sort ads">
                  <option value="views">Views</option>
                  <option value="ctr">CTR</option>
                  <option value="end">End date</option>
                </select>
              </label>
            </div>
          </div>
          {loading ? (
            <div className="ads-skel" aria-busy="true" aria-label="Loading ads">
              {[0, 1, 2, 3].map((n) => <div key={n} className="ads-skel-row" />)}
            </div>
          ) : filtered.length === 0 ? <p className="ap-muted">No ads match these filters.</p> : (
            <div data-testid="ads-table">
              {filtered.map((a) => {
                const spark = last7(a.daily);
                const sparkMax = Math.max(1, ...spark.map((d) => d.views));
                const flight = flightOf(a);
                const ctr = Number(a.ctr || 0);
                const dates = `${md(a.start_date)} – ${md(a.expiry_date)}`;
                return (
                  <article className="ads-row-v2" key={a.id} data-testid={`ad-row-${a.id}`}>
                    <AdThumb ad={a} onBroken={(id) => setBroken((prev) => ({ ...prev, [id]: true }))} />
                    <div className="ads-row-copy">
                      <b>{a.headline}</b>
                      <small>{a.advertiser} · {placeLabel(a.placement)}{a.frequency && (a.placement === "feed" || a.placement === "story") ? ` · every ${a.frequency}` : ""}</small>
                      {(!a.image || broken[a.id]) ? <span className="ads-miss">Image missing</span> : null}
                      {a.id === topId && ctr > 0 ? <span className="ads-top">Top performer</span> : null}
                    </div>
                    <div className="ads-dates ads-hide-sm" title={dates}>{dates}</div>
                    <div className={`ads-status st-${a.status || "live"}`}>
                      <i />
                      <span>{a.status || "live"}</span>
                    </div>
                    <div className="ads-spark ads-hide-sm" aria-hidden title="Views, last 7 days">
                      {spark.map((d) => <i key={d.key} style={{ height: Math.max(3, Math.round(barPx(d.views, sparkMax) / 3.6)) }} />)}
                    </div>
                    <div className={`ads-ctr ${ctr >= avgCtr ? "up" : "down"}`} title={ctr >= avgCtr ? "At or above average CTR" : "Below average CTR"}>{ctr}% CTR</div>
                    <div className="ads-flight ads-hide-sm">
                      <span>Day {flight.day} of {flight.total}</span>
                      <i><b style={{ width: `${flight.pct}%` }} /></i>
                    </div>
                    <div className="ads-row-actions">
                      <button type="button" className="ap-btn primary-lite" onClick={() => openAnalytics(a)} aria-label={`Analytics for ${a.headline}`}>Analytics</button>
                      <div className="ads-menu">
                        <button type="button" className="ap-btn" aria-label={`More actions for ${a.headline}`} aria-expanded={menuId === a.id} onClick={() => { setMenuId(menuId === a.id ? null : a.id); setConfirmId(null); }}>…</button>
                        {menuId === a.id ? (
                          <div className="ads-menu-pop" role="menu">
                            {a.status === "pending" ? (
                              <>
                                <button type="button" role="menuitem" onClick={() => decide(a, "approved")}>Approve</button>
                                <button type="button" role="menuitem" onClick={() => decide(a, "rejected")}>Reject</button>
                              </>
                            ) : (
                              <button type="button" role="menuitem" onClick={() => { setMenuId(null); pause(a); }}>{a.active ? "Pause" : "Resume"}</button>
                            )}
                            <button type="button" role="menuitem" onClick={() => duplicate(a)}>Duplicate</button>
                            {confirmId === a.id ? (
                              <div className="ads-confirm">
                                <span>Remove this ad?</span>
                                <button type="button" onClick={() => remove(a)}>Remove</button>
                                <button type="button" onClick={() => setConfirmId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button type="button" role="menuitem" className="danger" onClick={() => setConfirmId(a.id)}>Remove</button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="dash-panel ads-report">
          <h2 className="oswald shelf-h">Ad report</h2>
          {!reportAd ? <p className="dash-empty-line">Ads will show a 7-day view chart here.</p> : (
            <div data-testid="ad-report">
              <div className="ads-report-h">
                <b>{reportAd.headline}</b>
                <em>{reportAd.status === "live" ? "Live" : reportAd.status} · {placeLabel(reportAd.placement)}</em>
              </div>
              <div className="ads-report-nums">
                <div><em>Views</em><b>{Number(reportAd.views || 0).toLocaleString()}</b></div>
                <div><em>Clicks</em><b>{Number(reportAd.clicks || 0).toLocaleString()}</b></div>
                <div><em>CTR</em><b>{reportAd.ctr}%</b></div>
              </div>
              <BarChart rows={chart} field="views" testid="ad-report-chart" />
              <p className="dash-empty-line">Views, last 7 days</p>
              <p className="dash-empty-line">Runs {md(reportAd.start_date)} – {md(reportAd.expiry_date)}</p>
            </div>
          )}
        </section>
      </div>

      {previewAd ? (
        <div className="ads-preview-scrim" onClick={() => setPreviewAd(null)} data-testid="ad-preview-modal">
          <div
            className="ads-detail-card"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ad-analytics-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ads-preview-h">
              <div>
                <b id="ad-analytics-title">{previewAd.headline}</b>
                <small>{previewAd.advertiser} · {previewAd.status}{previewAd.frequency && (previewAd.placement === "feed" || previewAd.placement === "story") ? ` · after every ${previewAd.frequency}` : ""}</small>
              </div>
              <button type="button" className="ap-btn" onClick={() => setPreviewAd(null)} aria-label="Close analytics">Close</button>
            </div>
            <div className="ads-place-tabs" role="tablist" aria-label="Preview placement">
              {[
                ["feed", "Home Feed"],
                ["story", "Story"],
                ["category", "Category"],
                ["search", "Search"],
              ].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={previewPlace === id} className={previewPlace === id ? "on" : ""} onClick={() => setPreviewPlace(id)}>{label}</button>
              ))}
            </div>
            <div className="ads-detail-grid">
              <div className={`ads-preview-stage ${previewPlace}`}>
                <p className="ads-detail-kicker">How it looks · {placeLabel(previewPlace === "feed" ? "feed" : previewPlace)}</p>
                {previewPlace === "story" ? (
                  <div className="ads-phone-frame">
                    <StoryAdCard ad={stageAd} onOpen={() => {}} />
                  </div>
                ) : previewPlace === "category" ? (
                  <div className="market-home" style={{ width: 250, height: 196 }}>
                    <CategoryAdTile ad={stageAd} />
                  </div>
                ) : (
                  <div style={{ maxWidth: 280 }}><FeedAd ad={stageAd} /></div>
                )}
              </div>
              <div className="ads-detail-stats" data-testid="ad-analytics">
                <div className="ads-report-nums">
                  <div><em>Views</em><b>{Number(previewAd.views || 0).toLocaleString()}</b></div>
                  <div><em>Clicks</em><b>{Number(previewAd.clicks || 0).toLocaleString()}</b></div>
                  <div><em>CTR</em><b>{previewAd.ctr}%</b></div>
                </div>
                <p className="ads-detail-kicker">Views · last 7 days</p>
                <BarChart rows={detailChart} field="views" testid="ad-modal-views" />
                <p className="ads-detail-kicker">Clicks · last 7 days</p>
                <BarChart rows={detailChart} field="clicks" tone="ads-bars-gold" testid="ad-modal-clicks" />
                <dl className="ads-detail-meta">
                  <div><dt>Status</dt><dd>{previewAd.status}</dd></div>
                  <div><dt>Booked as</dt><dd>{placeLabel(previewAd.placement)}</dd></div>
                  <div><dt>Type</dt><dd>{previewAd.ad_type}</dd></div>
                  <div><dt>Runs</dt><dd>{md(previewAd.start_date)} – {md(previewAd.expiry_date)}</dd></div>
                  {previewAd.destination ? (
                    <div>
                      <dt>Destination</dt>
                      <dd className="ads-dest">
                        <a href={previewAd.destination} target="_blank" rel="noreferrer">{previewAd.destination}</a>
                        <button type="button" aria-label="Copy destination link" onClick={() => navigator.clipboard.writeText(previewAd.destination).then(() => toast.success("Link copied")).catch(() => toast.error("Could not copy the link"))}>Copy</button>
                      </dd>
                    </div>
                  ) : null}
                  {previewAd.video ? <div><dt>Creative</dt><dd>9:16 video</dd></div> : null}
                </dl>
                <div className="ads-detail-actions">
                  <button type="button" className="ap-btn" onClick={() => editAd(previewAd)}>Edit</button>
                  <button type="button" className="ap-btn" onClick={() => duplicate(previewAd)}>Duplicate</button>
                  {previewAd.status === "pending" ? (
                    <>
                      <button type="button" className="ap-btn" onClick={() => decide(previewAd, "approved")}>Approve</button>
                      <button type="button" className="ap-btn" onClick={() => decide(previewAd, "rejected")}>Reject</button>
                    </>
                  ) : (
                    <button type="button" className="ap-btn" onClick={() => pause(previewAd)}>{previewAd.active ? "Pause ad" : "Turn on"}</button>
                  )}
                  {confirmId === previewAd.id ? (
                    <>
                      <button type="button" className="ap-btn danger" onClick={() => remove(previewAd)}>Confirm remove</button>
                      <button type="button" className="ap-btn" onClick={() => setConfirmId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="ap-btn danger" onClick={() => setConfirmId(previewAd.id)}>Remove</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
