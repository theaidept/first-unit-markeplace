import { Link } from "react-router-dom";
import { Users, Package, Handshake, ShoppingBag, Flag, BadgeCheck, Store, Megaphone, Wallet, Receipt, TrendingUp, ArrowUpRight, Eye } from "lucide-react";

const WEEK = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];

function shape(total, weights) {
  const t = Math.max(Number(total) || 0, 0);
  if (t <= 0) return weights.map((w) => Math.round(w * 40));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.max(1, Math.round((t * w) / sum)));
}

function Spark({ values, color }) {
  const max = Math.max(1, ...values);
  const w = 120;
  const h = 36;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="ov-spark" viewBox={`0 0 ${w} ${h}`} width="120" height="36" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2.2" points={pts} />
    </svg>
  );
}

function Bars({ series, labels }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div className="ov-bars" data-testid="overview-chart">
      {labels.map((lab, i) => (
        <div key={lab} className="ov-bar-col">
          <div className="ov-bar-stack">
            {series.map((s) => (
              <i key={s.name} style={{ height: `${Math.max(6, (s.values[i] / max) * 100)}%`, background: s.color }} title={`${s.name}: ${s.values[i]}`} />
            ))}
          </div>
          <em>{lab}</em>
        </div>
      ))}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone, spark, onClick, testid }) {
  return (
    <button type="button" className={`ov-kpi ${tone || ""}`} onClick={onClick} data-testid={testid}>
      <span className="ov-kpi-ico"><Icon size={18} /></span>
      <span className="ov-kpi-copy">
        <em>{label}</em>
        <b>{value}</b>
        {hint ? <small>{hint}</small> : null}
      </span>
      {spark ? <Spark values={spark} color="currentColor" /> : null}
    </button>
  );
}

const DEMO_OFFERS = [
  { id: "demo-o1", title: "Patrol Duty Bag 40L", amount: 110, price: 129, status: "pending", demo: true },
  { id: "demo-o2", title: "Turnout Gear — Size L", amount: 210, price: 240, status: "pending", demo: true },
  { id: "demo-o3", title: "NV-2 Night Scope", amount: 320, price: 349, status: "accepted", demo: true },
];
const DEMO_ORDERS = [
  { id: "demo-t1", title: "Tactical Duty Belt", amount: 64, status: "open", demo: true },
  { id: "demo-t2", title: "LED Patrol Flashlight", amount: 48, status: "paid", demo: true },
];

export default function AdminOverview({ health: H, money, fee, activity, setTab }) {
  const members = H?.signups?.members_total || 0;
  const live = H?.listings?.live || 0;
  const offers = H?.offers_pending ?? (activity?.offers || []).filter((o) => o.status === "pending").length;
  const orders = H?.orders_open ?? (activity?.orders || []).filter((o) => o.status !== "sold").length;
  const weekListings = shape(live || 18, [0.1, 0.12, 0.14, 0.11, 0.16, 0.2, 0.17]);
  const weekOffers = shape(Math.max(offers, 6), [0.08, 0.14, 0.1, 0.18, 0.12, 0.2, 0.18]);
  const weekMembers = shape(members || 8, [0.06, 0.1, 0.12, 0.14, 0.18, 0.2, 0.2]);
  const offerList = (activity?.offers || []).length ? activity.offers.slice(0, 5) : DEMO_OFFERS;
  const orderList = (activity?.orders || []).length ? activity.orders.slice(0, 5) : DEMO_ORDERS;
  const demo = !(activity?.offers || []).length || !(activity?.orders || []).length;
  const name = "Natasha";

  return (
    <div className="ov" data-testid="admin-overview">
      <div className="ov-hero">
        <div>
          <p className="ov-kicker">Command center</p>
          <h2 className="oswald">Good to have you back.</h2>
          <p>Live numbers from the unit. Sample week charts fill in until traffic is heavier, so you can see how this desk reads on a busy day.</p>
        </div>
        <Link to="/marketplace" className="ov-hero-btn" data-testid="overview-marketplace">
          View marketplace <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="ov-kpis">
        <Kpi icon={Users} label="Members" value={members} hint="Verified responders" tone="navy" spark={weekMembers} onClick={() => setTab("members")} testid="health-members-total" />
        <Kpi icon={Package} label="Live listings" value={live} hint="On the shop floor" tone="gold" spark={weekListings} onClick={() => setTab("listings")} testid="health-active-listings" />
        <Kpi icon={Handshake} label="Pending offers" value={offers} hint="Waiting on a seller" tone="red" spark={weekOffers} onClick={() => setTab("overview")} testid="health-offers" />
        <Kpi icon={ShoppingBag} label="Open orders" value={orders} hint="In progress" tone="navy" spark={weekListings} onClick={() => setTab("overview")} testid="health-orders" />
        <Kpi icon={Flag} label="Open reports" value={H?.reports?.open || 0} hint="Needs a look" onClick={() => setTab("moderation")} testid="health-open-reports" />
        <Kpi icon={BadgeCheck} label="Awaiting review" value={H?.verification?.human_review || 0} hint="ID queue" onClick={() => setTab("verification")} testid="health-human-review" />
        <Kpi icon={Megaphone} label="Live ads" value={H?.ads_live ?? 0} hint="Native placements" onClick={() => setTab("ads")} />
        <Kpi icon={Wallet} label="PayPal connected" value={H?.paypal_connected ?? money?.paypal_connected ?? 0} hint="Members ready to pay" onClick={() => setTab("payments")} />
      </div>

      <div className="ov-grid">
        <section className="ov-card">
          <div className="ov-card-h">
            <div>
              <h3 className="oswald">Marketplace this week</h3>
              <p>Listings posted vs offers received. Bars use live totals shaped across 7 days so the graph is readable while volume is still small.</p>
            </div>
            <span className="ov-pill"><TrendingUp size={12} /> Sample week</span>
          </div>
          <div className="ov-legend">
            <span><i style={{ background: "#0b1f42" }} /> Listings</span>
            <span><i style={{ background: "#a6192e" }} /> Offers</span>
          </div>
          <Bars
            labels={WEEK}
            series={[
              { name: "Listings", color: "#0b1f42", values: weekListings },
              { name: "Offers", color: "#a6192e", values: weekOffers },
            ]}
          />
        </section>

        <section className="ov-card">
          <div className="ov-card-h">
            <div>
              <h3 className="oswald">Money desk</h3>
              <p>Payments stay off until you turn charging on. These cards show where that work will land.</p>
            </div>
          </div>
          <div className="ov-money">
            <div>
              <Receipt size={16} />
              <em>Stripe paid</em>
              <b>{H?.stripe_paid ?? money?.stripe_paid ?? 0}</b>
            </div>
            <div>
              <Wallet size={16} />
              <em>Stripe pending</em>
              <b>{H?.stripe_pending ?? money?.stripe_pending ?? 0}</b>
            </div>
            <div>
              <Store size={16} />
              <em>Vendors</em>
              <b>{H?.vendors ?? 0}</b>
            </div>
            <div>
              <Package size={16} />
              <em>Listing fee</em>
              <b>{fee?.active ? `$${Number(fee.amount || 0).toLocaleString()}` : "Off"}</b>
            </div>
          </div>
          <button type="button" className="ov-link" onClick={() => setTab("payments")}>Open payments</button>
        </section>
      </div>

      <div className="ov-grid">
        <section className="ov-card">
          <div className="ov-card-h">
            <h3 className="oswald">Offers</h3>
            {demo && !(activity?.offers || []).length ? <span className="ov-pill">Sample</span> : null}
          </div>
          {offerList.map((o) => (
            <article className="ov-row" key={o.id}>
              <div>
                <b>{o.title}</b>
                <small>Listed ${Number(o.price || 0).toLocaleString()}</small>
              </div>
              <strong>${Number(o.amount || 0).toLocaleString()}</strong>
              <span className={`ml-status st-${o.status}`}>{o.status}</span>
              {o.listing_id ? <Link className="abtn" to={`/listing/${o.listing_id}`}><Eye size={14} /> View</Link> : <span className="ov-muted">Demo</span>}
            </article>
          ))}
        </section>
        <section className="ov-card">
          <div className="ov-card-h">
            <h3 className="oswald">Orders</h3>
            {demo && !(activity?.orders || []).length ? <span className="ov-pill">Sample</span> : null}
          </div>
          {orderList.map((t) => (
            <article className="ov-row" key={t.id}>
              <div>
                <b>{t.title}</b>
                <small>Order</small>
              </div>
              <strong>${Number(t.amount || 0).toLocaleString()}</strong>
              <span className={`ml-status st-${t.status}`}>{t.status}</span>
              {t.listing_id ? <Link className="abtn" to={`/listing/${t.listing_id}`}><Eye size={14} /> View</Link> : <span className="ov-muted">Demo</span>}
            </article>
          ))}
        </section>
      </div>

      <section className="ov-card">
        <div className="ov-card-h">
          <h3 className="oswald">Recent admin actions</h3>
        </div>
        {!(activity?.audit || []).length ? (
          <p className="ov-empty">Nothing logged yet. Status changes, removals, and ads you set live will show here.</p>
        ) : activity.audit.map((a) => (
          <div className="ov-act" key={a.id || a.timestamp}>{a.action} · {a.target_type || "item"} · {a.timestamp ? String(a.timestamp).slice(0, 16).replace("T", " ") : ""}</div>
        ))}
      </section>
      <p className="ov-foot">Hi {name} — ads you set live appear on the member marketplace, not in this console.</p>
    </div>
  );
}
