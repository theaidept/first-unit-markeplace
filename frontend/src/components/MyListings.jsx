import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Plus, Rocket, Package } from "lucide-react";
import { PageHero, Stats, Stat, Panel, PanelHead, Empty, Btn } from "./AdminKit";
import { SAMPLE_LISTINGS } from "../lib/sampleDesk";

const TABS = [
  ["all", "All"],
  ["live", "Live"],
  ["sold", "Sold"],
  ["paused", "Paused"],
  ["draft", "Draft"],
];

const STATUS_LABEL = {
  live: "Live",
  sold: "Sold",
  paused: "Paused",
  draft: "Draft",
  flagged: "In review",
};

const posted = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const isTest = (l) => /^test_/i.test(l.title || "");

export function MyListings() {
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState("all");
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [edit, setEdit] = useState(null);
  const [boost, setBoost] = useState(null);
  const [tiers, setTiers] = useState([]);

  const load = async () => {
    try {
      const { data } = await api.get("/listings/mine");
      setRows((data.listings || []).filter((l) => !isTest(l)));
    } catch {
      setRows([]);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const list = rows || [];
    if (tab === "all") return list.filter((l) => l.status !== "removed");
    return list.filter((l) => l.status === tab);
  }, [rows, tab]);

  const counts = useMemo(() => {
    const c = { all: 0, live: 0, sold: 0, paused: 0, draft: 0 };
    (rows || []).forEach((l) => {
      if (l.status === "removed") return;
      c.all += 1;
      if (c[l.status] != null) c[l.status] += 1;
    });
    return c;
  }, [rows]);

  const runStatus = async (l, action) => {
    setBusy(l.id);
    try {
      await api.post(`/listings/${l.id}/status`, { action });
      toast.success(action === "delete" ? "Listing deleted" : action === "pause" ? "Listing paused" : "Listing is live again");
      setConfirmId(null);
      await load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Could not update that listing");
    } finally {
      setBusy(null);
    }
  };

  const openBoost = async (l) => {
    setBusy(l.id);
    try {
      const { data } = await api.get("/boost/options");
      const types = (data.boost_types || []).filter((b) => b.active !== false && !b.hidden);
      if (!data.feature_enabled || !types.length) {
        toast.error("Boosts are currently unavailable");
        return;
      }
      setTiers(types);
      setBoost(l);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Boosts are currently unavailable");
    } finally {
      setBusy(null);
    }
  };

  const checkoutBoost = async (tier) => {
    if (!boost) return;
    setBusy(boost.id);
    try {
      const { data } = await api.post(`/listings/${boost.id}/boost/checkout`, {
        boost_type_id: tier.id,
        origin_url: window.location.origin,
      });
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
        return;
      }
      toast.success("Listing boosted");
      setBoost(null);
      await load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Boost checkout failed");
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!edit) return;
    setBusy(edit.id);
    try {
      await api.put(`/listings/${edit.id}`, {
        title: edit.title.trim(),
        category: edit.category,
        condition: edit.condition || "Good",
        location: edit.location || "",
        description: edit.description || "",
        price: Number(edit.price),
        photos: edit.photos || [],
        video: edit.video || null,
        meetup_note: edit.meetup_note || null,
        publish: edit.status === "live",
      });
      toast.success("Listing updated");
      setEdit(null);
      await load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Could not save the listing");
    } finally {
      setBusy(null);
    }
  };

  const shown = visible.length ? visible : (tab === "all" ? SAMPLE_LISTINGS : []);
  const demo = rows !== null && visible.length === 0 && tab === "all";

  return (
    <div className="ap-page" data-testid="my-listings-page">
      <PageHero
        kicker="Selling"
        title="My listings"
        copy="Edit, pause, boost, or pull an item. Sample rows show how a working shop reads until you list your own gear."
        action={<Btn to="/sell" tone="ghost" testid="mylistings-create"><Plus size={15} /> Create a listing</Btn>}
      />
      <Stats>
        <Stat icon={Package} label="All" value={counts.all} tone="navy" />
        <Stat icon={Package} label="Live" value={counts.live} tone="gold" />
        <Stat icon={Package} label="Sold" value={counts.sold} />
      </Stats>

      <Panel>
        <PanelHead title="Catalog" extra={demo ? <span className="ap-pill">Sample</span> : null} />
        <div className="dash-tabs" data-testid="mylistings-tabs">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={`mylistings-tab-${k}`}>
              {label} <span>{counts[k] || 0}</span>
            </button>
          ))}
        </div>

        {rows === null ? (
          <p className="ap-muted">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="dash-empty" data-testid="mylistings-empty">
            <Empty icon={Package} title={`No ${STATUS_LABEL[tab] || tab} listings`} copy="Nothing in this tab right now." />
          </div>
        ) : (
          <div className="ml-list" data-testid={demo ? "mylistings-empty" : "mylistings-list"}>
            {demo && <p className="ap-muted">Sample desk — create a listing to replace these.</p>}
            {shown.map((l) => {
              const photo = l.photos && l.photos[0] ? fileUrl(l.photos[0]) : null;
              return (
                <article className="ap-listing" key={l.id} data-testid={`mylisting-${l.id}`}>
                  <div className="ml-photo">{photo ? <img src={photo} alt="" /> : <span>No photo</span>}</div>
                  <div className="ap-person-copy">
                    <b>{l.title}</b>
                    <small>Posted {posted(l.created_at)} · {l.views != null ? `${l.views} views` : "— views"}{l.location ? ` · ${l.location}` : ""}</small>
                  </div>
                  <strong>${Number(l.price).toLocaleString()}</strong>
                  <span className={`ml-status st-${l.status}`}>{STATUS_LABEL[l.status] || l.status}</span>
                  {!l.sample && (
                    <div className="ap-person-actions wrap">
                      <Btn onClick={() => setEdit({ ...l })} testid={`mylisting-edit-${l.id}`}>Edit</Btn>
                      {l.status === "live" && (
                        <Btn onClick={() => runStatus(l, "pause")} testid={`mylisting-pause-${l.id}`}>Pause</Btn>
                      )}
                      {l.status === "paused" && (
                        <Btn onClick={() => runStatus(l, "reactivate")} testid={`mylisting-reactivate-${l.id}`}>Reactivate</Btn>
                      )}
                      {l.status === "live" && (
                        <Btn onClick={() => openBoost(l)} testid={`mylisting-boost-${l.id}`}><Rocket size={14} /> Boost</Btn>
                      )}
                      {l.status !== "sold" && (
                        confirmId === l.id ? (
                          <span className="ml-confirm">
                            Delete?
                            <Btn tone="primary" onClick={() => runStatus(l, "delete")} testid={`mylisting-delete-yes-${l.id}`}>Yes</Btn>
                            <Btn onClick={() => setConfirmId(null)}>No</Btn>
                          </span>
                        ) : (
                          <Btn tone="danger" onClick={() => setConfirmId(l.id)} testid={`mylisting-delete-${l.id}`}>Delete</Btn>
                        )
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {demo && <Link to="/sell" className="ap-btn primary" data-testid="mylistings-first">Create your first listing</Link>}
          </div>
        )}
      </Panel>

      {edit && (
        <div className="report-modal" onClick={() => setEdit(null)}>
          <form className="report-card" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit} data-testid="mylisting-edit-form">
            <h2 className="oswald" style={{ color: "var(--navy)", marginTop: 0 }}>Edit listing</h2>
            <div className="field"><label>Title</label><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required data-testid="mylisting-edit-title" /></div>
            <div className="field"><label>Price</label><input type="number" min="0" step="1" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} required data-testid="mylisting-edit-price" /></div>
            <div className="field"><label>Description</label><textarea rows={4} value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} data-testid="mylisting-edit-description" /></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy === edit.id} data-testid="mylisting-edit-save">{busy === edit.id ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      )}

      {boost && (
        <div className="report-modal" onClick={() => setBoost(null)}>
          <div className="report-card" onClick={(e) => e.stopPropagation()} data-testid="mylisting-boost-picker">
            <h2 className="oswald" style={{ color: "var(--navy)", marginTop: 0 }}>Boost this listing</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Featured placement uses the existing boost checkout.</p>
            <div className="boost-pick">
              {tiers.map((t) => (
                <button type="button" key={t.id} className="btn btn-ghost" disabled={busy === boost.id} onClick={() => checkoutBoost(t)} data-testid={`mylisting-boost-tier-${t.id}`}>
                  {t.name} · ${Number(t.price).toLocaleString()}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14, textAlign: "right" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setBoost(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
