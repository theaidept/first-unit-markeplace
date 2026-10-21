import { PageHero, Stats, Stat, Panel, PanelHead, Empty, Tag, Btn, Face, Thumb, Switch, StatusPick, LoadMore } from "../components/AdminKit";
import { SAMPLE_VENDORS } from "../lib/sampleDesk";
import {
  Users, BadgeCheck, Package, Flag, Wallet, DollarSign, Store, Briefcase,
  Eye, ShieldQuestion, Receipt, Landmark, CreditCard, MapPin, Building2, Plus, UserCircle, ShieldAlert,
} from "lucide-react";

const RESPONDER_LABELS = {
  law_enforcement: "Law Enforcement",
  firefighter_career: "Firefighter (career)",
  firefighter_volunteer: "Firefighter (volunteer)",
  emt_paramedic: "EMT / Paramedic",
  dispatcher: "Dispatcher",
};
const LISTING_FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "flagged", label: "Flagged" },
  { key: "removed", label: "Removed" },
];
const DEMO_INVOICES = [
  { id: "di1", description: "7-Day Boost · Turnout Gear — Size L", kind: "boost", amount: 19, payment_status: "paid", created_at: "2026-10-12T14:20:00" },
  { id: "di2", description: "3-Day Boost · Duty Belt Set", kind: "boost", amount: 9, payment_status: "paid", created_at: "2026-10-10T09:02:00" },
  { id: "di3", description: "Until Sold · NV-2 Night Scope", kind: "boost", amount: 29, payment_status: "open", created_at: "2026-10-14T11:40:00" },
];
const DEMO_BOOSTS = [
  { id: "db1", title: "Turnout Gear — Size L", boost_name: "7-Day Boost", duration_days: 7, price: 19 },
  { id: "db2", title: "Duty Belt Set", boost_name: "3-Day Boost", duration_days: 3, price: 9 },
];

export function MembersTab({ loading, users, memberRows, memberShown, memberQ, setMemberQ, setHunt, setStatus, moderateUser, showMore }) {
  const approved = users.filter((u) => u.verification_status === "approved").length;
  const paypal = users.filter((u) => u.paypal_connected).length;
  const held = users.filter((u) => u.verification_status === "suspended").length;
  return (
    <div className="ap-page" data-testid="admin-members">
      <PageHero kicker="People" title="Members" copy="Verified first responders list free. Warn, suspend, or open a profile. A status change asks for a reason and is saved in the audit log." />
      <Stats>
        <Stat icon={Users} label="Roster" value={users.length} tone="navy" />
        <Stat icon={BadgeCheck} label="Approved" value={approved} tone="gold" />
        <Stat icon={Wallet} label="PayPal on" value={paypal} />
        <Stat icon={ShieldAlert} label="Suspended" value={held} tone="red" />
      </Stats>
      <Panel>
        <PanelHead title="Roster" sub={`${memberRows.length} matching`} extra={
          <input className="ap-search" placeholder="Search name, email or status" value={memberQ} onChange={(e) => { setMemberQ(e.target.value); setHunt(e.target.value); }} data-testid="admin-member-search" />
        } />
        {loading ? <p className="ap-muted">Loading…</p> : memberShown.map((u) => (
          <article className="ap-person" key={u.id} data-testid={`admin-user-row-${u.email}`}>
            <Face src={u.avatar} initials={u.initials} />
            <div className="ap-person-copy">
              <b>{u.display_handle || u.email}</b>
              <small>{u.email}{u.phone ? ` · ${u.phone}` : ""}{u.agency ? ` · ${u.agency}` : ""} · {u.role}</small>
            </div>
            <div className="ap-person-meta">
              {u.paypal_connected && <Tag tone="pay">PayPal</Tag>}
              <span className={`status-tag ${u.verification_status}`} data-testid={`admin-status-${u.email}`}>{String(u.verification_status || "").replace("_", " ")}</span>
            </div>
            <div className="ap-person-actions">
              <StatusPick value={u.verification_status} onChange={(e) => setStatus(u.id, e.target.value)} testid={`admin-status-select-${u.email}`} />
              <Btn to={`/members/${u.id}`}><Eye size={14} /> Profile</Btn>
              {u.role !== "admin" && <Btn onClick={() => moderateUser(u.id, "warn")}>Warn</Btn>}
              {u.verification_status !== "suspended"
                ? <Btn tone="danger" onClick={() => moderateUser(u.id, "suspend")}>Suspend</Btn>
                : <Btn tone="primary" onClick={() => moderateUser(u.id, "reinstate")}>Reinstate</Btn>}
            </div>
          </article>
        ))}
        <LoadMore id="members" total={memberRows.length} shown={memberShown.length} onMore={showMore} />
      </Panel>
    </div>
  );
}

export function VerificationTab({ queue, users, accountShown, loading, reasons, setReasons, decide, setStatus, showMore }) {
  return (
    <div className="ap-page" data-testid="admin-verification">
      <PageHero kicker="Trust & safety" title="Verification" copy="Ambiguous ID.me results wait here. Approve or reject with a note. Manual overrides on any account are audited." />
      <Stats>
        <Stat icon={BadgeCheck} label="In review" value={queue.length} tone="gold" hint="Needs a human" />
        <Stat icon={Users} label="Accounts" value={users.length} tone="navy" />
      </Stats>
      <Panel>
        <PanelHead title="Review queue" sub={queue.length ? `${queue.length} waiting` : "Queue is clear"} />
        {queue.length === 0 ? (
          <div data-testid="admin-queue-empty"><Empty icon={ShieldQuestion} title="No applicants waiting" copy="When ID.me cannot decide, the case lands here with the fields the member entered — never raw documents." /></div>
        ) : (
          <div className="ap-stack" data-testid="admin-review-queue">
            {queue.map((c) => (
              <article className="ap-case" key={c.user_id} data-testid={`review-case-${c.email}`}>
                <div className="ap-person">
                  <Face src={c.avatar} initials={c.initials} />
                  <div className="ap-person-copy">
                    <b>{c.display_handle || c.email}</b>
                    <small>{c.email} · {c.provider} · {c.phone || "No phone"}</small>
                  </div>
                  <Tag tone="warn">Human review</Tag>
                </div>
                <div className="ap-facts">
                  {[["Responder", RESPONDER_LABELS[c.prescreen?.responder_type] || "—"], ["Status", c.prescreen?.service_status || "—"], ["Agency", c.prescreen?.agency || "—"], ["Rank", c.prescreen?.rank || "—"], ["Years", c.prescreen?.years_of_service || "—"], ["Credential #", c.prescreen?.credential_number || "—"]].map(([k, v]) => (
                    <div key={k}><em>{k}</em><b>{v}</b></div>
                  ))}
                </div>
                <div className="ap-compose">
                  <input placeholder="Reviewer note" value={reasons[c.user_id] || ""} onChange={(e) => setReasons({ ...reasons, [c.user_id]: e.target.value })} data-testid={`review-reason-${c.email}`} />
                  <Btn tone="primary" onClick={() => decide(c.user_id, "approve")} testid={`review-approve-${c.email}`}>Approve</Btn>
                  <Btn tone="danger" onClick={() => decide(c.user_id, "reject")} testid={`review-reject-${c.email}`}>Reject</Btn>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <Panel>
        <PanelHead title="All accounts" sub="Manual override is audited. Use Members to warn or suspend." extra={<span className="ap-count">{users.length}</span>} />
        <div data-testid="admin-user-table">
        {loading ? <p className="ap-muted">Loading…</p> : accountShown.map((u) => (
          <article className="ap-person" key={u.id} data-testid={`admin-user-row-${u.email}`}>
            <Face src={u.avatar} initials={u.initials} />
            <div className="ap-person-copy">
              <b>{u.display_handle || u.email}</b>
              <small>{u.email} · {u.phone || "No phone"}</small>
            </div>
            <span className={`status-tag ${u.verification_status}`} data-testid={`admin-status-${u.email}`}>{u.verification_status.replace("_", " ")}</span>
            <div className="ap-person-actions">
              <StatusPick value={u.verification_status} onChange={(e) => setStatus(u.id, e.target.value)} testid={`admin-status-select-${u.email}`} />
              <Btn to={`/members/${u.id}`}><Eye size={14} /> Profile</Btn>
            </div>
          </article>
        ))}
        <LoadMore id="accounts" total={users.length} shown={accountShown.length} onMore={showMore} />
        </div>
      </Panel>
    </div>
  );
}

export function ListingsTab({ listingRows, listingShown, listingFilter, setListingFilter, setMore, PAGE, moderateListing, showMore }) {
  const live = listingRows.filter((l) => l.status === "live").length;
  return (
    <div className="ap-page" data-testid="admin-listings">
      <PageHero kicker="Marketplace" title="Listings" copy="Every live, flagged, or removed item. Open it, pull it, or put it back. Boosted listings stay marked." />
      <Stats>
        <Stat icon={Package} label="In this view" value={listingRows.length} tone="navy" />
        <Stat icon={Package} label="Live on shop" value={live} tone="gold" />
      </Stats>
      <Panel>
        <PanelHead title="Catalog" extra={
          <div className="ap-chips">
            {LISTING_FILTERS.map((f) => (
              <button key={f.key} type="button" className={`ap-chip ${listingFilter === f.key ? "on" : ""}`} onClick={() => { setListingFilter(f.key); setMore((m) => ({ ...m, listings: PAGE })); }}>{f.label}</button>
            ))}
          </div>
        } />
        <div data-testid="mod-listings">
          {listingShown.map((l) => (
            <article className="ap-listing" key={l.id} data-testid={`mod-listing-${l.id}`}>
              <Thumb src={l.photo} story={l.has_video} />
              <div className="ap-person-copy">
                <b>{l.title}</b>
                <small>{l.seller} · ${Number(l.price || 0).toLocaleString()}{l.category ? ` · ${l.category}` : ""}{l.location ? ` · ${l.location}` : ""}{l.photo_count > 1 ? ` · ${l.photo_count} photos` : ""}{l.featured ? " · Boosted" : ""}</small>
              </div>
              <div className="ap-person-meta">
                <span className={`status-tag ${l.status === "flagged" ? "human_review" : l.status === "removed" ? "rejected" : "approved"}`}>{l.status}</span>
                {l.open_reports > 0 && <Tag tone="warn">{l.open_reports} reports</Tag>}
              </div>
              <div className="ap-person-actions">
                <Btn to={`/listing/${l.id}`} testid={`listing-view-${l.id}`}><Eye size={14} /> View</Btn>
                {l.status !== "removed"
                  ? <Btn tone="danger" onClick={() => moderateListing(l.id, "remove")} testid={`listing-remove-${l.id}`}>Remove</Btn>
                  : <Btn tone="primary" onClick={() => moderateListing(l.id, "reinstate")} testid={`listing-reinstate-${l.id}`}>Reinstate</Btn>}
              </div>
            </article>
          ))}
          <LoadMore id="listings" total={listingRows.length} shown={listingShown.length} onMore={showMore} />
        </div>
      </Panel>
    </div>
  );
}

export function ReportsTab({ reports, reportShown, moderateListing, moderateUser, setReportStatus, showMore }) {
  const open = reports.filter((r) => r.status === "open").length;
  return (
    <div className="ap-page" data-testid="admin-moderation">
      <PageHero kicker="Trust & safety" title="Reports" copy="Members flag listings and people. Review, warn, suspend, or take the listing down from here." />
      <Stats>
        <Stat icon={Flag} label="Open" value={open} tone="red" hint="Waiting on you" />
        <Stat icon={Flag} label="All time" value={reports.length} />
      </Stats>
      <Panel>
        <PanelHead title="Moderation queue" />
        {reports.length === 0 ? (
          <div data-testid="reports-empty"><Empty icon={Flag} title="Quiet unit" copy="No reports. When someone flags a listing or a member, the case appears here with actions ready." /></div>
        ) : (
          <div className="ap-stack" data-testid="reports-queue">
            {reportShown.map((r) => (
              <article className="ap-case" key={r.id} data-testid={`report-row-${r.id}`}>
                <div className="ap-person">
                  <div className="ap-person-copy">
                    <b>{r.reason}</b>
                    <small>
                      {r.target_type.replace("_", " ")} · Reporter {r.reporter}
                      {r.reported_user_handle ? ` · ${r.reported_user_handle}` : ""}
                      {r.listing ? ` · ${r.listing.title}` : ""}
                    </small>
                    {r.note ? <small>“{r.note}”</small> : null}
                  </div>
                  <span className={`status-tag ${r.status === "open" ? "human_review" : r.status === "actioned" ? "approved" : ""}`} data-testid={`report-status-${r.id}`}>{r.status}</span>
                </div>
                <div className="ap-person-actions wrap">
                  {r.listing_id && <Btn to={`/listing/${r.listing_id}`}><Eye size={14} /> Listing</Btn>}
                  {r.reported_user && <Btn to={`/members/${r.reported_user}`}><Eye size={14} /> Member</Btn>}
                  {r.listing_id && r.listing?.status !== "removed" && <Btn tone="danger" onClick={() => moderateListing(r.listing_id, "remove")} testid={`report-remove-listing-${r.id}`}>Remove listing</Btn>}
                  {r.reported_user && r.reported_user_status !== "suspended" && <Btn tone="danger" onClick={() => moderateUser(r.reported_user, "suspend")} testid={`report-suspend-user-${r.id}`}>Suspend</Btn>}
                  {r.reported_user && <Btn onClick={() => moderateUser(r.reported_user, "warn")} testid={`report-warn-user-${r.id}`}>Warn</Btn>}
                  {r.status === "open" && <Btn tone="navy" onClick={() => setReportStatus(r.id, "reviewing")} testid={`report-review-${r.id}`}>Reviewing</Btn>}
                  {r.status !== "dismissed" && r.status !== "actioned" && <Btn onClick={() => setReportStatus(r.id, "dismissed")} testid={`report-dismiss-${r.id}`}>Dismiss</Btn>}
                </div>
              </article>
            ))}
          </div>
        )}
        <LoadMore id="reports" total={reports.length} shown={reportShown.length} onMore={showMore} />
      </Panel>
    </div>
  );
}

export function PaymentsTab({ money, showMore, invoiceShown, setTab }) {
  const paypal = money?.paypal_members || [];
  const invoices = (money?.invoices || []).length ? money.invoices : DEMO_INVOICES;
  const boosts = (money?.boosts || []).length ? money.boosts : DEMO_BOOSTS;
  const demoInv = !(money?.invoices || []).length;
  const demoBoost = !(money?.boosts || []).length;
  const shown = demoInv ? invoices : invoiceShown;
  const total = Number(money?.members_total || 0);
  const paypalN = Number(money?.paypal_connected ?? 0);
  const venmoN = Number(money?.venmo_connected ?? 0);
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const paidN = shown.filter((inv) => inv.payment_status === "paid").length;
  const openN = shown.filter((inv) => inv.payment_status !== "paid").length;
  return (
    <div className="ap-page" data-testid="admin-payments">
      <PageHero
        kicker="Money"
        title="Payments"
        copy="Who can take money today, and what Stripe has collected from boosts. Members stay free. Charging the listing fee is the next switch — this desk is ready for it."
        action={setTab ? <Btn tone="ghost" onClick={() => setTab("monetization")}>Open fees & boosts</Btn> : null}
      />
      <Stats>
        <Stat icon={Wallet} label="PayPal connected" value={paypalN} hint={`of ${total} members`} tone="navy" />
        <Stat icon={Landmark} label="Venmo connected" value={venmoN} tone="gold" />
        <Stat icon={CreditCard} label="Stripe paid" value={money?.stripe_paid ?? 0} />
        <Stat icon={DollarSign} label="Stripe volume" value={`$${Number(money?.stripe_volume || 0).toLocaleString()}`} tone="red" />
      </Stats>
      <div className="ap-split">
        <Panel>
          <PanelHead title="Wallet coverage" sub="Share of the roster ready to take payment." />
          <div className="ap-cover">
            <div>
              <span>PayPal</span>
              <i><b style={{ width: `${Math.max(pct(paypalN), paypalN ? 8 : 0)}%` }} /></i>
              <em>{pct(paypalN)}%</em>
            </div>
            <div>
              <span>Venmo</span>
              <i className="gold"><b style={{ width: `${Math.max(pct(venmoN), venmoN ? 8 : 0)}%` }} /></i>
              <em>{pct(venmoN)}%</em>
            </div>
          </div>
          <div className="ap-invoice-split">
            <div><em>Paid invoices</em><b>{paidN}</b></div>
            <div><em>Open</em><b>{openN}</b></div>
            <div><em>Boost sales</em><b>{boosts.length}</b></div>
          </div>
        </Panel>
        <Panel>
          <PanelHead title="How charging will work" sub="Nothing is billed until you turn the listing fee on under Fees & boosts." />
          <div className="ap-steps">
            <div><em>1</em><div><b>Wallets</b><small>Members connect PayPal or Venmo on their profile.</small></div></div>
            <div><em>2</em><div><b>Boosts</b><small>Optional Stripe checkout already records invoices here.</small></div></div>
            <div><em>3</em><div><b>Listing fee</b><small>When you switch it on, every new listing pays that amount.</small></div></div>
          </div>
        </Panel>
      </div>
      <Panel>
        <PanelHead title="Wallets on file" sub="Members who connected PayPal. Open a profile to see the shop." extra={<span className="ap-count">{paypal.length}</span>} />
        {!paypal.length ? <Empty icon={Wallet} title="No PayPal yet" copy="When a member connects PayPal, they show here with a link to their shop." /> : paypal.map((u) => (
          <article className="ap-person" key={u.id}>
            <span className="ap-wallet">PP</span>
            <div className="ap-person-copy">
              <b>{u.email}</b>
              <small>{u.paypal_me ? `PayPal.me/${u.paypal_me}` : u.paypal_email || "Linked"}</small>
            </div>
            <Tag tone="pay">PayPal</Tag>
            <Btn to={`/members/${u.id}`}><Eye size={14} /> Profile</Btn>
          </article>
        ))}
      </Panel>
      <Panel>
        <PanelHead title="Stripe invoices" sub={demoInv ? "Sample rows so you can see the desk. Live boosts replace them." : "Boost checkouts land here."} extra={demoInv ? <span className="ap-pill">Sample</span> : null} />
        {shown.map((inv) => (
          <article className="ap-invoice" key={inv.id || inv.session_id}>
            <span className="ap-stat-ico"><Receipt size={16} /></span>
            <div className="ap-person-copy">
              <b>{inv.description || inv.kind || "Invoice"}</b>
              <small>{inv.kind} · {inv.created_at ? String(inv.created_at).slice(0, 16).replace("T", " ") : ""}</small>
            </div>
            <strong>${Number(inv.amount || 0).toLocaleString()}</strong>
            <span className={`ml-status st-${inv.payment_status === "paid" ? "accepted" : "pending"}`}>{inv.payment_status || inv.status}</span>
          </article>
        ))}
        {!demoInv && <LoadMore id="invoices" total={(money?.invoices || []).length} shown={invoiceShown.length} onMore={showMore} />}
      </Panel>
      <Panel>
        <PanelHead title="Boost purchases" extra={demoBoost ? <span className="ap-pill">Sample</span> : null} />
        {!boosts.length ? <Empty icon={DollarSign} title="No boosts yet" /> : boosts.map((b) => (
          <article className="ap-invoice" key={b.id}>
            <div className="ap-person-copy">
              <b>{b.title}</b>
              <small>{b.boost_name} · {b.until_sold ? "Until sold" : `${b.duration_days || "—"} days`}</small>
            </div>
            <strong>${Number(b.price || 0).toLocaleString()}</strong>
          </article>
        ))}
      </Panel>
    </div>
  );
}

export function FeesTab({ fee, setFee, saveFee, boostFeature, toggleFeature, boosts, patchBoost, saveBoost, quickToggle, deleteBoost, draft, setDraft, createBoost }) {
  return (
    <div className="ap-page" data-testid="admin-monetization">
      <PageHero kicker="Money" title="Fees & boosts" copy="Members list free until you turn the listing fee on. Boosts are optional paid placement. Stripe charging of the listing fee is the next build — the controls are here." />
      <div className="ap-split">
        <Panel testid="listing-fee-panel">
          <PanelHead title="Member listing fee" sub="Off means every new listing is free." />
          <div className="ap-fee-hero">
            <em>USD</em>
            <input type="number" min="0" step="0.01" value={fee.amount} onChange={(e) => setFee({ ...fee, amount: e.target.value })} data-testid="fee-amount" />
          </div>
          <div className="ap-compose">
            <Switch checked={!!fee.active} onChange={(e) => setFee({ ...fee, active: e.target.checked })} label="Charge this fee" testid="fee-active" labelTestid="fee-active-toggle">
              Off at launch.
            </Switch>
            <Btn tone="primary" onClick={saveFee} testid="fee-save-btn">Save fee</Btn>
          </div>
        </Panel>
        <Panel>
          <PanelHead title="Boosts on the sell flow" />
          <Switch checked={!!boostFeature} onChange={(e) => toggleFeature(e.target.checked)} label="Show boost feature" testid="boost-feature-checkbox" labelTestid="boost-feature-toggle">
            Off = sellers can only publish free.
          </Switch>
        </Panel>
      </div>
      <Panel testid="boost-admin-panel">
        <PanelHead title="Boost tiers" sub="Price and duration sellers pick when they list." />
        <div className="ap-tiers" data-testid="boost-type-list">
          {boosts.map((b) => (
            <article className={`ap-tier ${b.active === false ? "dim" : ""}`} key={b.id} data-testid={`boost-row-${b.id}`}>
              <div className="ap-tier-price">${Number(b.price || 0).toLocaleString()}</div>
              <input value={b.name} onChange={(e) => patchBoost(b.id, { name: e.target.value })} data-testid={`boost-name-${b.id}`} />
              <div className="ap-tier-row">
                <label>Price<input type="number" min="0" step="0.01" value={b.price} onChange={(e) => patchBoost(b.id, { price: e.target.value })} data-testid={`boost-price-${b.id}`} /></label>
                <label>Days{b.until_sold ? <input value="Until sold" disabled data-testid={`boost-duration-${b.id}`} /> : <input type="number" min="1" value={b.duration_days || ""} onChange={(e) => patchBoost(b.id, { duration_days: e.target.value })} data-testid={`boost-duration-${b.id}`} />}</label>
              </div>
              <Switch checked={!!b.until_sold} onChange={(e) => patchBoost(b.id, { until_sold: e.target.checked })} label="Until sold" testid={`boost-untilsold-${b.id}`} />
              <div className="ap-person-actions wrap">
                <Btn tone="navy" onClick={() => saveBoost(b)} testid={`boost-save-${b.id}`}>Save</Btn>
                <Btn onClick={() => quickToggle(b, { hidden: !b.hidden })} testid={`boost-hide-${b.id}`}>{b.hidden ? "Show" : "Hide"}</Btn>
                <Btn onClick={() => quickToggle(b, { active: b.active === false })} testid={`boost-deactivate-${b.id}`}>{b.active === false ? "Reactivate" : "Deactivate"}</Btn>
                <Btn tone="danger" onClick={() => deleteBoost(b.id)} testid={`boost-delete-${b.id}`}>Delete</Btn>
              </div>
            </article>
          ))}
          <article className="ap-tier add" data-testid="boost-create-form">
            <div className="ap-tier-price"><Plus size={18} /></div>
            <b>New tier</b>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 14-Day Boost" data-testid="new-boost-name" />
            <div className="ap-tier-row">
              <label>Price<input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} data-testid="new-boost-price" /></label>
              <label>Days<input type="number" min="1" value={draft.until_sold ? "" : draft.duration_days} disabled={draft.until_sold} onChange={(e) => setDraft({ ...draft, duration_days: e.target.value })} data-testid="new-boost-duration" /></label>
            </div>
            <Switch checked={draft.until_sold} onChange={(e) => setDraft({ ...draft, until_sold: e.target.checked })} label="Until sold" testid="new-boost-untilsold" />
            <Btn tone="primary" onClick={createBoost} testid="new-boost-create-btn">Create tier</Btn>
          </article>
        </div>
      </Panel>
    </div>
  );
}

export function VendorsTab({ vendors, vendorDraft, setVendorDraft, createVendor, toggleVendor, deleteVendor }) {
  const demo = !vendors.length;
  const roster = demo ? SAMPLE_VENDORS : vendors;
  return (
    <div className="ap-page" data-testid="admin-vendors">
      <PageHero kicker="Money" title="Vendors" copy="Outside sellers you authorize — a dealership, a brand shop. They pay a listing fee. Their items sit in the marketplace, not as side ads." />
      <Stats>
        <Stat icon={Store} label="Authorized" value={(demo ? SAMPLE_VENDORS : vendors).filter((v) => v.active).length} tone="navy" />
        <Stat icon={Store} label="Paused" value={(demo ? SAMPLE_VENDORS : vendors).filter((v) => !v.active).length} />
      </Stats>
      <Panel>
        <PanelHead title="Authorize a vendor" />
        <div className="ap-compose">
          <input value={vendorDraft.name} onChange={(e) => setVendorDraft({ ...vendorDraft, name: e.target.value })} placeholder="Name, e.g. Ford dealer" data-testid="vendor-name" />
          <input value={vendorDraft.contact} onChange={(e) => setVendorDraft({ ...vendorDraft, contact: e.target.value })} placeholder="Email or phone" data-testid="vendor-contact" />
          <input type="number" min="0" step="0.01" value={vendorDraft.fee_amount} onChange={(e) => setVendorDraft({ ...vendorDraft, fee_amount: e.target.value })} placeholder="Fee USD" data-testid="vendor-fee" />
          <Btn tone="primary" onClick={createVendor} testid="vendor-add">Add vendor</Btn>
        </div>
      </Panel>
      <Panel>
        <PanelHead title="Roster" extra={demo ? <span className="ap-pill">Sample</span> : <span className="ap-count">{vendors.length}</span>} />
        {demo && <p className="ap-muted">Sample vendors so the desk looks live. Add one above to replace them.</p>}
        {roster.map((v) => (
          <article className="ap-person" key={v.id} data-testid={`vendor-row-${v.id}`}>
            <span className="ap-wallet">{(v.name || "V").slice(0, 1)}</span>
            <div className="ap-person-copy">
              <b>{v.name}</b>
              <small>{v.contact || "No contact"} · listing fee ${Number(v.fee_amount || 0).toLocaleString()}</small>
            </div>
            <Tag tone={v.active ? "pay" : ""}>{v.active ? "Authorized" : "Paused"}</Tag>
            {!v.sample && (
              <div className="ap-person-actions">
                <Btn onClick={() => toggleVendor(v)}>{v.active ? "Pause" : "Authorize"}</Btn>
                <Btn tone="danger" onClick={() => deleteVendor(v.id)}>Remove</Btn>
              </div>
            )}
          </article>
        ))}
      </Panel>
    </div>
  );
}

export function JobsTab({ jobs, jobShown, jobDraft, setJobDraft, createJob, editJob, setEditJob, saveJob, deleteJob, showMore }) {
  return (
    <div className="ap-page" data-testid="admin-jobs">
      <PageHero kicker="Community" title="Job board" copy="You post department roles. They show on every verified member’s Department Job Board. Departments do not self-serve in this release." />
      <Stats>
        <Stat icon={Briefcase} label="Live postings" value={jobs.length} tone="navy" />
      </Stats>
      <Panel testid="job-create-form">
        <PanelHead title="Post a role" />
        <div className="ap-compose">
          <input value={jobDraft.department} onChange={(e) => setJobDraft({ ...jobDraft, department: e.target.value })} placeholder="Department" data-testid="new-job-department" />
          <input value={jobDraft.title} onChange={(e) => setJobDraft({ ...jobDraft, title: e.target.value })} placeholder="Title" data-testid="new-job-title" />
          <input value={jobDraft.location} onChange={(e) => setJobDraft({ ...jobDraft, location: e.target.value })} placeholder="Location" data-testid="new-job-location" />
          <Btn tone="primary" onClick={createJob} testid="new-job-create-btn">Post role</Btn>
        </div>
      </Panel>
      <Panel>
        <PanelHead title="Postings" extra={<span className="ap-count">{jobs.length}</span>} />
        <div data-testid="admin-job-list">
          {jobs.length === 0 ? <Empty icon={Briefcase} title="No roles yet" /> : jobShown.map((j) => (
            <article className="ap-job" key={j.id} data-testid={`admin-job-${j.id}`}>
              {editJob?.id === j.id ? (
                <div className="ap-compose">
                  <input value={editJob.department} onChange={(e) => setEditJob({ ...editJob, department: e.target.value })} data-testid={`job-department-${j.id}`} />
                  <input value={editJob.title} onChange={(e) => setEditJob({ ...editJob, title: e.target.value })} data-testid={`job-title-${j.id}`} />
                  <input value={editJob.location} onChange={(e) => setEditJob({ ...editJob, location: e.target.value })} data-testid={`job-location-${j.id}`} />
                  <Btn tone="primary" onClick={() => saveJob(editJob)} testid={`job-save-${j.id}`}>Save</Btn>
                  <Btn onClick={() => setEditJob(null)} testid={`job-cancel-${j.id}`}>Cancel</Btn>
                </div>
              ) : (
                <>
                  <span className="ap-job-badge"><Building2 size={14} /> {j.department}</span>
                  <b>{j.title}</b>
                  <small><MapPin size={12} /> {j.location}</small>
                  <div className="ap-person-actions">
                    <Btn onClick={() => setEditJob({ ...j })} testid={`job-edit-${j.id}`}>Edit</Btn>
                    <Btn tone="danger" onClick={() => deleteJob(j.id)} testid={`job-delete-${j.id}`}>Remove</Btn>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
        <LoadMore id="jobs" total={jobs.length} shown={jobShown.length} onMore={showMore} />
      </Panel>
    </div>
  );
}

export function SettingsTab({ fee, setFee, saveFee, boostFeature, toggleFeature, me }) {
  return (
    <div className="ap-page" data-testid="admin-settings">
      <PageHero kicker="System" title="Settings" copy="Switches you control. Members list free until the listing fee is on. Boosts can be hidden from the sell flow." />
      <div className="ap-split">
        <Panel>
          <PanelHead title="Listing fee" />
          <div className="ap-fee-hero">
            <em>USD</em>
            <input type="number" min="0" step="0.01" value={fee.amount} onChange={(e) => setFee({ ...fee, amount: e.target.value })} />
          </div>
          <div className="ap-compose">
            <Switch checked={!!fee.active} onChange={(e) => setFee({ ...fee, active: e.target.checked })} label="Charge listing fee">Off at launch.</Switch>
            <Btn tone="primary" onClick={saveFee}>Save fee</Btn>
          </div>
        </Panel>
        <Panel>
          <PanelHead title="Boosts" />
          <Switch checked={!!boostFeature} onChange={(e) => toggleFeature(e.target.checked)} label="Show boost feature">Off = sellers publish free only.</Switch>
        </Panel>
      </div>
      <Panel>
        <PanelHead title="Signed in" />
        <article className="ap-person">
          <Face src={me?.avatar} initials={me?.initials} />
          <div className="ap-person-copy">
            <b>{me?.display_handle || "Owner"}</b>
            <small>Admin console</small>
          </div>
          <Btn to="/profile"><UserCircle size={14} /> Profile</Btn>
          <Btn to="/marketplace">Marketplace</Btn>
        </article>
      </Panel>
    </div>
  );
}
