import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { MapPin, ExternalLink, ShieldCheck, CheckCircle2, XCircle, Handshake, ShoppingBag } from "lucide-react";
import { PageHero, Stats, Stat, Panel, PanelHead, Empty, Btn } from "../components/AdminKit";
import { SAMPLE_OFFERS, SAMPLE_ORDERS } from "../lib/sampleDesk";

const STATUS_PILL = { agreed: "pending", completed: "ok", cancelled: "review" };
const ORDER_LABEL = { agreed: "In progress", completed: "Completed", cancelled: "Cancelled" };
const OFFER_LABEL = { pending: "Pending", accepted: "Accepted", declined: "Declined", countered: "Countered", withdrawn: "Withdrawn" };

const isTest = (title) => /^test_/i.test(title || "");

export default function Transactions() {
  const { user } = useAuth();
  const [tab, setTab] = useState("offers");
  const [txs, setTxs] = useState(null);
  const [offers, setOffers] = useState(null);
  const [counter, setCounter] = useState(null);
  const [counterAmt, setCounterAmt] = useState("");

  const loadOrders = async () => {
    try {
      const { data } = await api.get("/transactions/mine");
      setTxs(data.transactions);
    } catch {
      setTxs([]);
    }
  };

  const loadOffers = async () => {
    try {
      const [mineRes, feedRes] = await Promise.all([api.get("/listings/mine"), api.get("/listings")]);
      const mine = (mineRes.data.listings || []).filter((l) => !isTest(l.title));
      const feed = (feedRes.data.listings || []).filter((l) => l.seller_id !== user?.id && !isTest(l.title));
      const received = (await Promise.all(mine.map(async (l) => {
        const { data } = await api.get(`/listings/${l.id}/offers`);
        return (data.offers || []).map((o) => ({ ...o, listing: l, direction: "received" }));
      }))).flat();
      const sent = (await Promise.all(feed.map(async (l) => {
        try {
          const { data } = await api.get(`/listings/${l.id}/offers`);
          return (data.offers || []).map((o) => ({ ...o, listing: l, direction: "sent" }));
        } catch {
          return [];
        }
      }))).flat();
      const all = [...received, ...sent].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setOffers(all);
    } catch {
      setOffers([]);
    }
  };

  useEffect(() => { loadOrders(); }, []);
  useEffect(() => { if (user) loadOffers(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id, action) => {
    try {
      await api.post(`/transactions/${id}/${action}`);
      toast.success(action === "complete" ? "Marked complete on your side" : "Transaction cancelled");
      loadOrders();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const actOffer = async (offer, action, amount) => {
    try {
      await api.post(`/offers/${offer.id}/${action}`, amount != null ? { amount: Number(amount) } : undefined);
      toast.success(action === "accept" ? "Offer accepted" : action === "decline" ? "Offer declined" : "Counter sent");
      setCounter(null);
      setCounterAmt("");
      loadOffers();
      if (action === "accept") loadOrders();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const offerRows = (offers || []).length ? offers : SAMPLE_OFFERS;
  const orderRows = (txs || []).length ? txs : SAMPLE_ORDERS;
  const demoOffers = offers !== null && !offers.length;
  const demoOrders = txs !== null && !txs.length;

  return (
    <DashboardLayout active="orders" testid="transactions-page">
      <div className="ap-page">
      <PageHero kicker="Deals" title="Offers & orders" copy="Accept, counter, or collect. Sample rows fill an empty desk so you can see the flow before the first real deal." />
      <Stats>
        <Stat icon={Handshake} label="Offers" value={offers === null ? "—" : offers.length} tone="navy" />
        <Stat icon={ShoppingBag} label="Orders" value={txs === null ? "—" : txs.length} tone="gold" />
      </Stats>
      <div className="dash-tabs" data-testid="deals-tabs">
        <button type="button" className={tab === "offers" ? "on" : ""} onClick={() => setTab("offers")} data-testid="deals-tab-offers">Offers</button>
        <button type="button" className={tab === "orders" ? "on" : ""} onClick={() => setTab("orders")} data-testid="deals-tab-orders">Orders</button>
      </div>

      {tab === "offers" ? (
        offers === null ? (
          <p className="ap-muted">Loading…</p>
        ) : offerRows.length === 0 ? (
          <div className="dash-empty card" data-testid="offers-empty">
            <Empty icon={Handshake} title="No offers yet" copy="Offers you receive on your listings, and offers you send, show up here." />
          </div>
        ) : (
          <Panel>
          <PanelHead title="Offers" extra={demoOffers ? <span className="ap-pill">Sample</span> : null} />
          <div className="deal-list" data-testid={demoOffers ? "offers-empty" : "offers-list"}>
            {offerRows.map((o) => {
              const person = o.direction === "received" ? o.buyer : o.listing?.seller;
              const photo = o.listing?.photos?.[0] || o.listing?.photo;
              return (
                <article className="deal-row card" key={`${o.direction}-${o.id}`} data-testid={`offer-${o.id}`}>
                  <div className="deal-photo">{photo ? <img src={fileUrl(photo)} alt="" /> : null}</div>
                  <div className="deal-main">
                    <div className="deal-title">{o.listing?.title}</div>
                    <div className="deal-sub">
                      {o.direction === "received" ? "Offer received" : "Offer sent"} · listed ${Number(o.listing?.price || 0).toLocaleString()}
                    </div>
                    <div className="deal-who">
                      <span>{person?.display_handle || "Member"}</span>
                      {person?.verified_badge && <VerifiedBadge />}
                    </div>
                  </div>
                  <div className="deal-amt">${Number(o.amount).toLocaleString()}</div>
                  <span className={`ml-status st-${o.status}`}>{OFFER_LABEL[o.status] || o.status}</span>
                  <div className="deal-actions">
                    {o.sample ? <span className="ap-muted">Sample</span> : null}
                    {!o.sample && o.direction === "received" && o.status === "pending" && (
                      <>
                        <button type="button" className="btn btn-primary" onClick={() => actOffer(o, "accept")} data-testid={`offer-accept-${o.id}`}>Accept</button>
                        <button type="button" className="btn btn-ghost" onClick={() => actOffer(o, "decline")} data-testid={`offer-decline-${o.id}`}>Decline</button>
                        <button type="button" className="btn btn-ghost" onClick={() => { setCounter(o); setCounterAmt(String(o.amount)); }} data-testid={`offer-counter-${o.id}`}>Counter</button>
                      </>
                    )}
                    {!o.sample && o.direction === "sent" && o.status === "pending" && (
                      <button type="button" className="btn btn-ghost" onClick={() => actOffer(o, "withdraw")} data-testid={`offer-withdraw-${o.id}`}>Withdraw</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          </Panel>
        )
      ) : txs === null ? (
        <p className="ap-muted">Loading…</p>
      ) : orderRows.length === 0 ? (
        <div className="dash-empty card" data-testid="tx-empty">
          <Empty icon={ShoppingBag} title="No orders yet" copy="Buy Now or an accepted offer will appear here. Money still moves directly between members." />
        </div>
      ) : (
        <Panel>
        <PanelHead title="Orders" extra={demoOrders ? <span className="ap-pill">Sample</span> : null} />
        <div className="ap-stack" data-testid={demoOrders ? "tx-empty" : "tx-list"}>
          {orderRows.map((t) => (
            <div className="card tx-card" style={{ padding: 20 }} key={t.id} data-testid={`tx-${t.id}`}>
              <div className="tx-top">
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="tx-thumb">{t.listing.photo ? <img src={fileUrl(t.listing.photo)} alt="" /> : null}</div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--navy)" }}>{t.listing.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                      {t.role === "buyer" ? "Buying from" : "Selling to"} <b>{t.counterparty.display_handle}</b>
                      {t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="lc-price" style={{ fontSize: 22 }}>${Number(t.agreed_amount).toLocaleString()}</div>
                  <span className={`pill ${STATUS_PILL[t.status] || ""}`}>{ORDER_LABEL[t.status] || t.status}</span>
                </div>
              </div>

              {!t.sample && t.role === "buyer" && t.status === "agreed" && (
                <div className="tx-pay" data-testid={`tx-pay-${t.id}`}>
                  <div className="tx-pay-label">Pay {t.counterparty.display_handle} directly:</div>
                  {(t.pay_targets || []).length === 0 ? (
                    <div className="mb-note">This seller hasn't linked a payment account yet.</div>
                  ) : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {t.pay_targets.map((pt) => (
                        <a key={pt.method} className="btn btn-primary" href={pt.url} target="_blank" rel="noreferrer"
                           onClick={() => api.post(`/transactions/${t.id}/method`, { payment_method: pt.method }).catch(() => {})}
                           data-testid={`pay-${pt.method}-${t.id}`}>
                          {pt.label} {pt.handle} <ExternalLink size={14} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {t.meetup_note && (
                <div className="tx-meetup"><MapPin size={14} /> {t.meetup_note}</div>
              )}

              <div className="tx-actions">
                <span className="tx-flags">
                  {t.buyer_completed && <span><CheckCircle2 size={13} /> Buyer confirmed</span>}
                  {t.seller_completed && <span><CheckCircle2 size={13} /> Seller confirmed</span>}
                </span>
                {!t.sample && t.status === "agreed" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => act(t.id, "cancel")} data-testid={`tx-cancel-${t.id}`}>
                      <XCircle size={14} /> Cancel
                    </button>
                    <button className="btn btn-primary" onClick={() => act(t.id, "complete")} data-testid={`tx-complete-${t.id}`}>
                      <ShieldCheck size={14} /> Mark complete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        </Panel>
      )}

      {counter && (
        <div className="report-modal" onClick={() => setCounter(null)}>
          <form className="report-card" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); actOffer(counter, "counter", counterAmt); }} data-testid="offer-counter-form">
            <h2 className="oswald" style={{ color: "var(--navy)", marginTop: 0 }}>Counter offer</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 13 }}>{counter.listing?.title} is listed at ${Number(counter.listing?.price || 0).toLocaleString()}.</p>
            <div className="field">
              <label>Your counter</label>
              <input type="number" min="1" step="1" value={counterAmt} onChange={(e) => setCounterAmt(e.target.value)} required data-testid="offer-counter-amount" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setCounter(null)}>Cancel</button>
              <button className="btn btn-primary" data-testid="offer-counter-send">Send counter</button>
            </div>
          </form>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
