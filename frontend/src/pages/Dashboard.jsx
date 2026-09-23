import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { ListingCard } from "../components/ListingCard";
import { StoryViewer } from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";
import api, { fileUrl } from "../lib/api";
import { Play, Plus } from "lucide-react";

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
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    api.get("/profile/me").then((r) => setMe(r.data)).catch(() => {});
    api.get("/listings/mine").then((r) => setMine(r.data.listings)).catch(() => setMine([]));
    api.get("/stories").then((r) => setStories(r.data.stories)).catch(() => {});
    api.get("/jobs").then((r) => setJobs(r.data.jobs)).catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "saved") return;
    let ids = []; try { ids = JSON.parse(localStorage.getItem("fu_saved") || "[]"); } catch { /* ignore */ }
    if (!ids.length) { setSaved([]); return; }
    api.get("/listings").then((r) => setSaved(r.data.listings.filter((l) => ids.includes(l.id)))).catch(() => setSaved([]));
  }, [view]);

  const myStories = useMemo(() => stories.filter((s) => s.seller?.user_id === user?.id), [stories, user]);
  const liveCount = (mine || []).filter((l) => l.status === "live").length;
  const soldCount = (mine || []).filter((l) => l.status === "sold").length;
  const active = view === "overview" ? "listings" : view;

  return (
    <DashboardLayout active={active} testid="dashboard-page">
      {view === "saved" ? (
        <>
          <h1 className="oswald dash-h">Saved items</h1>
          {saved.length === 0
            ? <div className="card" style={{ padding: 36, color: "var(--text-dim)" }} data-testid="saved-empty">No saved items yet. Tap the bookmark on any listing to save it.</div>
            : <div className="listings-grid" data-testid="saved-grid">{saved.map((l) => <ListingCard key={l.id} listing={l} />)}</div>}
        </>
      ) : view === "jobs" ? (
        <>
          <h1 className="oswald dash-h">Department Job Board</h1>
          <div className="dash-jobs" data-testid="dash-jobs">
            {jobs.map((j) => (
              <div className="dj-row card" key={j.id} data-testid={`dash-job-${j.id}`}>
                <div><div className="dj-title">{j.title}</div><div className="dj-dept">{j.department} · {j.location}</div></div>
                <span className="jb-recency">{recency(j.posted_at)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="dash-head-row">
            <div><span className="eyebrow tick">Dashboard</span><h1 className="oswald dash-h">Welcome back{me?.display_handle ? `, ${me.display_handle}` : ""}</h1></div>
            <Link to="/sell" className="btn btn-primary" data-testid="dash-sell-btn"><Plus size={15} /> Sell an item</Link>
          </div>

          <div className="dash-stats" data-testid="dash-stats">
            <div className="dstat"><div className="dstat-n">{liveCount}</div><div className="dstat-l">Live listings</div></div>
            <div className="dstat"><div className="dstat-n">{soldCount}</div><div className="dstat-l">Sold</div></div>
            <div className="dstat"><Link to="/transactions" data-testid="dash-to-orders">Orders &amp; Offers →</Link></div>
            <div className="dstat"><Link to="/messages" data-testid="dash-to-messages">Messages →</Link></div>
          </div>

          {myStories.length > 0 && (
            <>
              <h2 className="oswald shelf-h">Your Stories</h2>
              <div className="reel" data-testid="dash-stories">
                {myStories.map((s) => {
                  const gi = stories.findIndex((x) => x.id === s.id);
                  return (
                    <button className="story-card" key={s.id} onClick={() => setViewer(gi)} data-testid={`dash-story-${s.listing_id}`}>
                      <span className="sc-ring"><span className="sc-thumb" style={{ backgroundImage: s.photo ? `url(${fileUrl(s.photo)})` : undefined }}><span className="sc-play"><Play size={16} fill="currentColor" /></span></span></span>
                      <span className="sc-price">${Number(s.price).toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <h2 className="oswald shelf-h">My Listings</h2>
          {mine === null ? <div style={{ padding: 30, color: "var(--text-faint)" }}>Loading…</div>
            : mine.length === 0 ? <div className="card" style={{ padding: 36, color: "var(--text-dim)" }} data-testid="mylistings-empty">You haven't listed anything yet. <Link to="/sell" style={{ color: "var(--red)", fontWeight: 700 }}>List an item</Link>.</div>
            : <div className="listings-grid" data-testid="my-listings-grid">{mine.map((l) => <ListingCard key={l.id} listing={l} />)}</div>}
        </>
      )}
      {viewer !== null && <StoryViewer stories={stories} index={viewer} onClose={() => setViewer(null)} onIndex={setViewer} />}
    </DashboardLayout>
  );
}
