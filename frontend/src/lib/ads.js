import api from "./api";

const seenViews = new Set();

export function withSampleAds(live, samples) {
  const have = live || [];
  const extra = (samples || []).filter((s) =>
    !have.some((a) => a.id === s.id || (a.advertiser === s.advertiser && a.headline === s.headline && a.placement === s.placement))
  );
  return have.concat(extra);
}

export function injectFeed(items, ads) {
  if (!ads?.length) return (items || []).map((item) => ({ kind: "item", item }));
  if (!items?.length) return ads.map((ad) => ({ kind: "ad", ad }));
  const out = [];
  let turn = 0;
  items.forEach((item, i) => {
    out.push({ kind: "item", item });
    const due = ads.filter((a) => (i + 1) % Math.max(1, Number(a.frequency) || 4) === 0);
    if (due.length) {
      out.push({ kind: "ad", ad: due[turn % due.length] });
      turn += 1;
    }
  });
  return out;
}

export function prependAds(items, ads) {
  const head = (ads || []).map((ad) => ({ kind: "ad", ad }));
  return head.concat((items || []).map((item) => ({ kind: "item", item })));
}

export function categoryAds(ads, cat) {
  return (ads || []).filter((a) => {
    if (a.placement !== "category") return false;
    const slug = (a.category_slug || "").trim();
    return !slug || slug === cat;
  });
}

export function searchAds(ads, q) {
  const s = (q || "").trim().toLowerCase();
  if (!s) return [];
  return (ads || []).filter((a) => {
    if (a.placement !== "search") return false;
    const kws = (a.keywords || "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    return !kws.length || kws.some((k) => s.includes(k) || k.includes(s));
  });
}

export function storyFromAd(ad) {
  const raw = String(ad.price || "").replace(/[^0-9.]/g, "");
  return {
    id: `ad-${ad.id}`,
    kind: "ad",
    ad,
    photo: ad.image,
    video: ad.video || "",
    title: ad.headline,
    price: raw ? Number(raw) : 0,
    listing_id: ad.listing_id || "",
    seller: { display_handle: ad.advertiser },
  };
}

export function mixStories(stories, ads) {
  const items = stories || [];
  const adList = ads || [];
  if (!adList.length) return items;
  const mixed = injectFeed(items, adList).map((row) => (row.kind === "ad" ? storyFromAd(row.ad) : row.item));
  if (!items.length) return mixed;
  const lead = storyFromAd(adList[0]);
  if (mixed.some((s) => s.id === lead.id)) return mixed;
  return [lead, ...mixed];
}

export function trackView(ad) {
  if (!ad?.id || ad.sample || String(ad.id).startsWith("sample-") || seenViews.has(ad.id)) return;
  seenViews.add(ad.id);
  api.post(`/ads/${ad.id}/view`).catch(() => {});
}

export async function openAd(ad, navigate) {
  if (!ad) return;
  const isSample = ad.sample || String(ad.id).startsWith("sample-");
  if (isSample) {
    const url = ad.destination || ad.link_url || "";
    if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  let url = ad.destination || "";
  try {
    const { data } = await api.post(`/ads/${ad.id}/click`);
    url = data.url || url;
    if (!url && data.listing_id) url = `/listing/${data.listing_id}`;
    if (!url && data.seller_id) url = `/shop/${data.seller_id}`;
  } catch {
    /* still try local destination */
  }
  if (!url) return;
  if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
  else navigate(url);
}

export function placeLabel(placement) {
  return {
    feed: "Home feed · 1:1",
    story: "Stories · 9:16",
    category: "Category page · 1:1",
    search: "Search results · 1:1",
  }[placement] || placement;
}

export function formatMoney(v) {
  if (v == null || v === "") return "";
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  if (!n) return String(v);
  return `$${n.toLocaleString()}`;
}
