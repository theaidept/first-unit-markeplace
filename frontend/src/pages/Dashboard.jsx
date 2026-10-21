import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { ListingCard } from "../components/ListingCard";
import { MyListings } from "../components/MyListings";
import { StoryViewer } from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { PageHero, Stats, Stat, Panel, PanelHead, Empty, Tag, Btn } from "../components/AdminKit";
import { SAMPLE_OFFERS, SAMPLE_ORDERS } from "../lib/sampleDesk";
import api, { fileUrl } from "../lib/api";
import { readSaved } from "../lib/saved";
import { Play, Plus, Package, Handshake, ShoppingBag, Bookmark, Briefcase, MapPin } from "lucide-react";

const OFFER_LABEL = { pending: "Pending", accepted: "Accepted", declined: "Declined", countered: "Countered", withdrawn: "Withdrawn" };
const ORDER_LABEL = { agreed: "In progress", completed: "Completed", cancelled: "Cancelled" };

const recency = (iso) => {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today"; if (d < 7) return `${Math.floor(d)}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`; return `${Math.floor(d / 30)}mo ago`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const view = params.get("view") || "overview";
  const [me, setMe] = useState(null);
  const [mine, setMine] = useState(null);
  const [stories, setStories] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [saved, setSaved] = useState([]);
  const [jobs, setJobs] = useState(null);
  const [offers, setOffers] = useState(null);
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api.get("/profile/me").then((r) => setMe(r.data)).catch(() => {});
    api.get("/listings/mine").then((r) => setMine(r.data.listings)).catch(() => setMine([]));
    api.get("/stories").then((r) => setStories(r.data.stories)).catch(() => {});
    api.get("/jobs").then((r) => setJobs(r.data.jobs || [])).catch(() => setJobs([]));
  }, []);

  useEffect(() => {
    if (view !== "overview" || !user) return;
    api.get("/offers/mine").then((r) => setOffers(r.data.offers || [])).catch(() => setOffers([]));
    api.get("/transactions/mine").then((r) => setOrders(r.data.transactions || [])).catch(() => setOrders([]));
  }, [view, user]);

  useEffect(() => {
    if (view !== "saved") return;
    const pull = () => {
      const ids = readSaved();
      if (!ids.length) { setSaved([]); return; }
      api.get("/listings").then((r) => setSaved(r.data.listings.filter((l) => ids.includes(l.id)))).catch(() => setSaved([]));
    };
    pull();
    window.addEventListener("fu-saved", pull);
    return () => window.removeEventListener("fu-saved", pull);
  }, [view]);

  const myStories = useMemo(() => stories.filter((s) => s.seller?.user_id === user?.id), [stories, user]);
  const liveCount = (mine || []).filter((l) => l.status === "live").length;
  const soldCount = (mine || []).filter((l) => l.status === "sold").length;
  const active = view === "overview" ? "overview" : view === "listings" ? "listings" : view;
  const offerList = (offers || []).length ? offers : SAMPLE_OFFERS;
  const orderList = (orders || []).length ? orders : SAMPLE_ORDERS;
  const demoOffers = !(offers || []).length;
  const demoOrders = !(orders || []).length;

  return (
    <DashboardLayout active={active} testid="dashboard-page">
      {view === "listings" ? (
        <MyListings />
      ) : view === "saved" ? (
        <div className="ap-page">
          <PageHero kicker="Watchlist" title="Saved" copy="Bookmark a listing on the marketplace and it lands here." action={<Btn to="/marketplace" tone="ghost">Browse marketplace</Btn>} />
          {saved.length === 0 ? (
            <Panel><div data-testid="saved-empty"><Empty icon={Bookmark} title="Nothing saved yet" copy="Open any listing and save it. Your watchlist stays on this desk." /></div></Panel>
          ) : (
            <div className="listings-grid" data-testid="saved-grid">
              {saved.map((l) => <ListingCard key={l.id} listing={l} onUnsave={(id) => setSaved((cur) => cur.filter((x) => x.id !== id))} />)}
            </div>
          )}
        </div>
      ) : view === "jobs" ? (
        <div className="ap-page">
          <PageHero kicker="Community" title="Job board" copy="Department roles posted by the owner. Verified members see the same board." />
          <Stats>
            <Stat icon={Briefcase} label="Open roles" value={jobs === null ? "—" : jobs.length} tone="navy" />
          </Stats>
          <Panel>
            <PanelHead title="Open roles" extra={<span className="ap-count">{jobs?.length || 0}</span>} />
            {jobs === null ? <p className="ap-muted">Loading…</p> : jobs.length === 0 ? (
              <div data-testid="job-board-empty"><Empty icon={Briefcase} title="No open roles right now" copy="Agencies in the network post roles here." /></div>
            ) : (
              <div className="ap-stack" data-testid="dash-jobs">
                {jobs.map((j) => (
                  <article className="ap-job" key={j.id} data-testid={`dash-job-${j.id}`}>
                    <span className="ap-job-badge">{j.department}</span>
                    <b>{j.title}</b>
                    <small><MapPin size={12} /> {j.location} · {recency(j.posted_at)}</small>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <div className="ap-page dash-overview">
          <PageHero
            kicker="Your desk"
            title={`Welcome back${me?.display_handle ? `, ${me.display_handle}` : ""}`}
            copy="Listings, offers, and payouts in one place. Sample rows fill empty desks so you can see how a busy week reads."
            action={<Btn to="/sell" tone="ghost" testid="dash-sell-btn"><Plus size={15} /> Sell an item</Btn>}
          />
          <Stats>
            <Stat icon={Package} label="Live listings" value={liveCount} tone="navy" />
            <Stat icon={Package} label="Sold" value={soldCount} tone="gold" />
            <Stat icon={Handshake} label="Pending offers" value={offers ? offers.filter((o) => o.status === "pending").length : "—"} tone="red" />
            <Stat icon={ShoppingBag} label="Orders" value={orders ? orders.length : "—"} />
          </Stats>
          <div className="dash-stats" data-testid="dash-stats" hidden>
            <div className="dstat"><div className="dstat-n">{liveCount}</div><div className="dstat-l">Live listings</div></div>
            <div className="dstat"><div className="dstat-n">{soldCount}</div><div className="dstat-l">Sold</div></div>
            <div className="dstat"><div className="dstat-n">{offers ? offers.filter((o) => o.status === "pending").length : "—"}</div><div className="dstat-l">Pending offers</div></div>
            <div className="dstat"><div className="dstat-n">{orders ? orders.length : "—"}</div><div className="dstat-l">Orders</div></div>
          </div>

          <Panel>
            <PanelHead title="Offers" extra={demoOffers ? <span className="ap-pill">Sample</span> : <Btn to="/transactions">Open deals</Btn>} />
            {offers === null ? (
              <p className="ap-muted">Loading offers…</p>
            ) : offerList.length === 0 ? (
              <p className="dash-empty-line" data-testid="dash-offers-empty">No offers yet. Offers you send and receive show up here with their status.</p>
            ) : (
              <div className="deal-list" data-testid={demoOffers ? "dash-offers-empty" : "dash-offers"}>
                {offerList.map((o) => {
                  const person = o.direction === "received" ? o.buyer : o.listing?.seller;
                  const photo = o.listing?.photos?.[0] || o.listing?.photo;
                  return (
                    <article className="ap-listing" key={`${o.direction}-${o.id}`} data-testid={`dash-offer-${o.id}`}>
                      <div className="deal-photo">{photo ? <img src={fileUrl(photo)} alt="" /> : <span className="ap-wallet">FU</span>}</div>
                      <div className="ap-person-copy">
                        <b>{o.listing?.title}</b>
                        <small>{o.direction === "received" ? "Offer received" : "Offer sent"} · listed ${Number(o.listing?.price || 0).toLocaleString()}</small>
                        <small className="deal-who"><span>{person?.display_handle || "Member"}</span>{person?.verified_badge && <VerifiedBadge />}</small>
                      </div>
                      <strong className="deal-amt">${Number(o.amount).toLocaleString()}</strong>
                      <span className={`ml-status st-${o.status}`}>{OFFER_LABEL[o.status] || o.status}</span>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHead title="Orders" extra={demoOrders ? <span className="ap-pill">Sample</span> : <Btn to="/transactions">Open deals</Btn>} />
            {orders === null ? (
              <p className="ap-muted">Loading orders…</p>
            ) : orderList.length === 0 ? (
              <p className="dash-empty-line" data-testid="dash-orders-empty">No orders yet. A Buy Now or an accepted offer shows up here.</p>
            ) : (
              <div className="deal-list" data-testid={demoOrders ? "dash-orders-empty" : "dash-orders"}>
                {orderList.map((t) => (
                  <article className="ap-listing" key={t.id} data-testid={`dash-order-${t.id}`}>
                    <div className="deal-photo">{t.listing?.photo ? <img src={fileUrl(t.listing.photo)} alt="" /> : <span className="ap-wallet">FU</span>}</div>
                    <div className="ap-person-copy">
                      <b>{t.listing?.title}</b>
                      <small>{t.role === "buyer" ? "Buying from" : "Selling to"} {t.counterparty?.display_handle}</small>
                    </div>
                    <strong className="deal-amt">${Number(t.agreed_amount).toLocaleString()}</strong>
                    <span className={`ml-status st-${t.status}`}>{ORDER_LABEL[t.status] || t.status}</span>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          {myStories.length > 0 && (
            <Panel>
              <PanelHead title="Your stories" />
              <div className="reel" data-testid="dash-stories">
                {myStories.map((s) => {
                  const gi = stories.findIndex((x) => x.id === s.id);
                  return (
                    <button className="story-poster" key={s.id} onClick={() => setViewer(gi)} data-testid={`dash-story-${s.listing_id}`}>
                      <span className="story-poster-art" style={{ backgroundImage: s.photo ? `url(${fileUrl(s.photo)})` : undefined }}>
                        <span className="sc-play"><Play size={16} fill="currentColor" /></span>
                        <span className="story-poster-copy"><em>${Number(s.price).toLocaleString()}</em></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHead title="My listings" extra={<Link className="see-all" to="/dashboard?view=listings" data-testid="dash-all-listings">Manage listings</Link>} />
            <p className="dash-lede">You have {liveCount} live and {soldCount} sold. Open My Listings to edit, pause, or boost them.</p>
          </Panel>
        </div>
      )}
      {viewer !== null && <StoryViewer stories={stories} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />}
    </DashboardLayout>
  );
}
