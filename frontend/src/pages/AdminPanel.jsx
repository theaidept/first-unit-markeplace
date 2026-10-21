import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import logo from "../assets/logo.png";
import AdsAdmin from "./AdsAdmin";
import CategoriesAdmin from "../components/CategoriesAdmin";
import AdminOverview from "./AdminOverview";
import {
  MembersTab, VerificationTab, ListingsTab, ReportsTab, PaymentsTab,
  FeesTab, VendorsTab, JobsTab, SettingsTab,
} from "./AdminTabs";
import { Face } from "../components/AdminKit";
import { LayoutDashboard, BadgeCheck, Flag, DollarSign, Users, Package, Briefcase, Store, Megaphone, LogOut, Search, Bell, Settings, Wallet, UserCircle, LayoutGrid } from "lucide-react";

const NAV = [
  { group: "Command", items: [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
  ]},
  { group: "People", items: [
    { key: "members", label: "Members", icon: Users },
    { key: "verification", label: "Verification", icon: BadgeCheck },
  ]},
  { group: "Marketplace", items: [
    { key: "listings", label: "Listings", icon: Package },
    { key: "categories", label: "Categories", icon: LayoutGrid },
    { key: "moderation", label: "Reports", icon: Flag },
  ]},
  { group: "Money", items: [
    { key: "payments", label: "Payments", icon: Wallet },
    { key: "monetization", label: "Fees & boosts", icon: DollarSign },
    { key: "vendors", label: "Vendors", icon: Store },
    { key: "ads", label: "Ads", icon: Megaphone },
  ]},
  { group: "Community", items: [
    { key: "jobs", label: "Job board", icon: Briefcase },
  ]},
  { group: "System", items: [
    { key: "settings", label: "Settings", icon: Settings },
  ]},
];
const PAGE = 8;

function AdminBar({ hunt, onHunt, onSearch, notes = [], onNote, me, onSettings, onSignOut }) {
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBell(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const unread = notes.reduce((n, x) => n + (x.count || 0), 0);
  const name = me?.display_handle || me?.email?.split("@")[0] || "Owner";
  return (
    <header className="admin-top" data-testid="admin-top">
      <Link to="/admin" className="admin-brand">
        <img src={logo} alt="First Unit USA" />
        <span>Admin console</span>
      </Link>
      <form className="admin-hunt" onSubmit={onSearch} data-testid="admin-global-search">
        <Search size={16} />
        <input value={hunt} onChange={(e) => onHunt(e.target.value)} placeholder="Search members, listings, jobs…" />
      </form>
      <div className="admin-top-actions">
        <div className="admin-pop" ref={bellRef}>
          <button type="button" className="admin-icon" onClick={() => { setBell((v) => !v); setMenu(false); }} data-testid="admin-bell" aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && <em>{unread > 9 ? "9+" : unread}</em>}
          </button>
          {bell && (
            <div className="admin-pop-menu" data-testid="admin-bell-menu">
              {notes.every((n) => !n.count) ? <p>No alerts. Queue is clear.</p> : notes.filter((n) => n.count).map((n) => (
                <button type="button" key={n.tab} onClick={() => { onNote(n.tab); setBell(false); }}>{n.label} · {n.count}</button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="admin-icon" onClick={onSettings} data-testid="admin-settings" aria-label="Settings"><Settings size={18} /></button>
        <div className="admin-pop" ref={menuRef}>
          <button type="button" className="admin-avatar-btn" onClick={() => { setMenu((v) => !v); setBell(false); }} data-testid="admin-profile" aria-label="Account">
            <Face src={me?.avatar} initials={me?.initials} size="sm" />
          </button>
          {menu && (
            <div className="admin-pop-menu right" data-testid="admin-profile-menu">
              <div className="admin-pop-name">{name}</div>
              <button type="button" onClick={() => { onSettings(); setMenu(false); }}><Settings size={14} /> Settings</button>
              <Link to="/profile" onClick={() => setMenu(false)}><UserCircle size={14} /> Profile</Link>
              <Link to="/marketplace" onClick={() => setMenu(false)}>View marketplace</Link>
              <button type="button" onClick={onSignOut} data-testid="admin-signout"><LogOut size={14} /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [queue, setQueue] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [fee, setFee] = useState({ amount: 0, active: false });
  const [boosts, setBoosts] = useState([]);
  const [boostFeature, setBoostFeature] = useState(true);
  const [draft, setDraft] = useState({ name: "", price: "", until_sold: false, duration_days: 3 });
  const [health, setHealth] = useState(null);
  const [reports, setReports] = useState([]);
  const [modListings, setModListings] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobDraft, setJobDraft] = useState({ department: "", title: "", location: "" });
  const [editJob, setEditJob] = useState(null);
  const [activity, setActivity] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [memberQ, setMemberQ] = useState("");
  const [listingFilter, setListingFilter] = useState("all");
  const [vendorDraft, setVendorDraft] = useState({ name: "", contact: "", fee_amount: "", notes: "" });
  const [more, setMore] = useState({});
  const [money, setMoney] = useState(null);
  const [me, setMe] = useState(null);
  const [hunt, setHunt] = useState("");
  const { logout } = useAuth();
  const navigate = useNavigate();

  const loadHealth = async () => { try { const { data } = await api.get("/admin/health"); setHealth(data); } catch { /* ignore */ } };
  const loadReports = async () => { try { const { data } = await api.get("/admin/reports"); setReports(data.reports); } catch { /* ignore */ } };
  const loadModListings = async () => { try { const { data } = await api.get("/admin/listings"); setModListings(data.listings); } catch { /* ignore */ } };
  const loadJobs = async () => { try { const { data } = await api.get("/admin/jobs"); setJobs(data.jobs); } catch { /* ignore */ } };
  const loadBoosts = async () => {
    try { const { data } = await api.get("/admin/boost-types"); setBoosts(data.boost_types); setBoostFeature(data.feature_enabled); } catch { /* ignore */ }
  };
  const loadFee = async () => { try { const { data } = await api.get("/admin/listing-fee"); setFee(data); } catch { /* ignore */ } };
  const loadActivity = async () => { try { const { data } = await api.get("/admin/activity"); setActivity(data); } catch { /* ignore */ } };
  const loadVendors = async () => { try { const { data } = await api.get("/admin/vendors"); setVendors(data.vendors || []); } catch { /* ignore */ } };
  const loadMoney = async () => { try { const { data } = await api.get("/admin/money"); setMoney(data); } catch { /* ignore */ } };
  const load = async () => {
    setLoading(true);
    try {
      const [u, q] = await Promise.all([api.get("/admin/users"), api.get("/admin/verification-queue")]);
      setUsers(u.data.users);
      setQueue(q.data.queue);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load(); loadFee(); loadBoosts(); loadHealth(); loadReports(); loadModListings(); loadJobs(); loadActivity(); loadVendors(); loadMoney();
    api.get("/profile/me").then((r) => setMe(r.data)).catch(() => {});
  }, []);

  const refreshTrust = () => { load(); loadHealth(); loadReports(); loadModListings(); };

  const decide = async (userId, decision) => {
    try {
      await api.post(`/admin/verification/${userId}/decision`, { decision, reason: reasons[userId] || "" });
      toast.success(`Applicant ${decision === "approve" ? "approved" : "rejected"}`);
      refreshTrust();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const setStatus = async (userId, verification_status) => {
    const note = window.prompt("Manual override requires a reason (audited):", "");
    if (note === null) return;
    if (!note.trim()) { toast.error("A reason is required for an override"); return; }
    try {
      await api.post(`/admin/users/${userId}/verification-status`, { verification_status, note });
      toast.success(`Status set to ${verification_status.replace("_", " ")}`);
      refreshTrust();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const moderateUser = async (userId, action) => {
    let reason = "";
    if (action !== "reinstate") {
      reason = window.prompt(`Reason for ${action} (optional, audited):`, "") || "";
    }
    try {
      await api.post(`/admin/users/${userId}/moderate`, { action, reason });
      toast.success(`Member ${action === "warn" ? "warned" : action === "suspend" ? "suspended" : "reinstated"}`);
      refreshTrust();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const moderateListing = async (listingId, action) => {
    let reason = "";
    if (action === "remove") reason = window.prompt("Reason for removal (audited):", "") || "";
    try {
      await api.post(`/admin/listings/${listingId}/moderate`, { action, reason });
      toast.success(`Listing ${action === "remove" ? "removed" : "reinstated"}`);
      loadModListings(); loadHealth(); loadReports();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const setReportStatus = async (reportId, status) => {
    try {
      await api.post(`/admin/reports/${reportId}/status`, { status });
      toast.success(`Report ${status}`);
      loadReports(); loadHealth();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const saveFee = async () => {
    try { const { data } = await api.put("/admin/listing-fee", { amount: Number(fee.amount), active: !!fee.active }); setFee(data); toast.success("Listing fee saved"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const toggleFeature = async (enabled) => {
    try { await api.put("/admin/boost-feature", { enabled }); setBoostFeature(enabled); toast.success(enabled ? "Boost feature shown to sellers" : "Boost feature hidden entirely"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const boostPayload = (b) => ({ name: b.name, price: Number(b.price), until_sold: !!b.until_sold, duration_days: b.until_sold ? null : Number(b.duration_days) || null, hidden: !!b.hidden, active: b.active !== false });
  const createBoost = async () => {
    if (!draft.name.trim()) { toast.error("Name the boost tier"); return; }
    try { await api.post("/admin/boost-types", boostPayload({ ...draft, hidden: false, active: true })); setDraft({ name: "", price: "", until_sold: false, duration_days: 3 }); toast.success("Boost tier created"); loadBoosts(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const saveBoost = async (b) => { try { await api.put(`/admin/boost-types/${b.id}`, boostPayload(b)); toast.success("Boost tier saved"); loadBoosts(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } };
  const patchBoost = (id, patch) => setBoosts((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const quickToggle = async (b, patch) => { patchBoost(b.id, patch); await saveBoost({ ...b, ...patch }); };
  const deleteBoost = async (id) => { try { await api.delete(`/admin/boost-types/${id}`); toast.success("Boost tier removed"); loadBoosts(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } };

  const createJob = async () => {
    if (!jobDraft.department.trim() || !jobDraft.title.trim() || !jobDraft.location.trim()) {
      toast.error("Department, title and location are required"); return;
    }
    try {
      await api.post("/admin/jobs", { ...jobDraft, active: true });
      setJobDraft({ department: "", title: "", location: "" });
      toast.success("Job posting created");
      loadJobs(); loadHealth();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const saveJob = async (j) => {
    try {
      await api.put(`/admin/jobs/${j.id}`, { department: j.department, title: j.title, location: j.location, active: j.active !== false });
      toast.success("Job posting saved");
      setEditJob(null); loadJobs();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const deleteJob = async (id) => {
    try { await api.delete(`/admin/jobs/${id}`); toast.success("Job posting removed"); loadJobs(); loadHealth(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const createVendor = async () => {
    if (!vendorDraft.name.trim()) { toast.error("Name the vendor"); return; }
    try {
      await api.post("/admin/vendors", { ...vendorDraft, fee_amount: Number(vendorDraft.fee_amount) || 0, active: true });
      setVendorDraft({ name: "", contact: "", fee_amount: "", notes: "" });
      toast.success("Vendor added");
      loadVendors(); loadHealth();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const toggleVendor = async (v) => {
    try {
      await api.put(`/admin/vendors/${v.id}`, { ...v, active: !v.active });
      loadVendors();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const deleteVendor = async (id) => {
    try { await api.delete(`/admin/vendors/${id}`); toast.success("Vendor removed"); loadVendors(); loadHealth(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const H = health;
  const take = (key, rows) => rows.slice(0, more[key] || PAGE);
  const showMore = (key) => setMore((m) => ({ ...m, [key]: (m[key] || PAGE) + PAGE }));
  const memberRows = users.filter((u) => {
    const q = (memberQ || hunt).trim().toLowerCase();
    if (!q) return true;
    return [u.email, u.display_handle, u.role, u.verification_status, u.phone].some((v) => String(v || "").toLowerCase().includes(q));
  });
  const listingRows = modListings.filter((l) => {
    if (listingFilter !== "all" && l.status !== listingFilter) return false;
    const q = hunt.trim().toLowerCase();
    if (!q) return true;
    return [l.title, l.seller, l.location, l.category].some((v) => String(v || "").toLowerCase().includes(q));
  });
  const jobRows = jobs.filter((j) => {
    const q = hunt.trim().toLowerCase();
    if (!q) return true;
    return [j.title, j.department, j.location].some((v) => String(v || "").toLowerCase().includes(q));
  });
  const memberShown = take("members", memberRows);
  const listingShown = take("listings", listingRows);
  const reportShown = take("reports", reports);
  const accountShown = take("accounts", users);
  const jobShown = take("jobs", jobRows);
  const invoiceShown = take("invoices", money?.invoices || []);
  const notes = [
    { tab: "verification", label: "Awaiting verification", count: H?.verification?.human_review || queue.length },
    { tab: "moderation", label: "Open reports", count: H?.reports?.open || 0 },
    { tab: "payments", label: "Pending Stripe invoices", count: H?.stripe_pending || money?.stripe_pending || 0 },
  ];
  const runHunt = (e) => {
    e.preventDefault();
    const q = hunt.trim().toLowerCase();
    if (!q) return;
    if (modListings.some((l) => (l.title || "").toLowerCase().includes(q))) setTab("listings");
    else if (jobs.some((j) => `${j.title} ${j.department} ${j.location}`.toLowerCase().includes(q))) setTab("jobs");
    else setTab("members");
  };
  const signOut = async () => { await logout(); navigate("/login"); };

  return (
    <div className="fu-app dash admin-shell" data-testid="admin-page">
      <AdminBar
        hunt={hunt}
        onHunt={(v) => { setHunt(v); setMemberQ(v); }}
        onSearch={runHunt}
        notes={notes}
        onNote={setTab}
        me={me}
        onSettings={() => setTab("settings")}
        onSignOut={signOut}
      />
      <div className="dash-layout">
        <aside className="dash-side" data-testid="admin-sidebar">
          {NAV.map((g) => (
            <div className="ds-group" key={g.group}>
              <div className="ds-group-h">{g.group}</div>
              {g.items.map((t) => (
                <button key={t.key} type="button" className={`ds-link ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)} data-testid={`admin-tab-${t.key}`}>
                  <t.icon size={16} /> {t.label}
                  {t.key === "moderation" && H?.reports?.open > 0 && <span className="tab-badge">{H.reports.open}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="ds-mini-wrap">
            <button type="button" className="ds-mini" onClick={() => setTab("settings")} data-testid="admin-side-profile">
              <Face src={me?.avatar} initials={me?.initials} size="sm" />
              <span className="ds-mini-copy">
                <span className="ds-mini-name">{me?.display_handle || "Owner"}</span>
                <span className="ds-mini-role">Owner</span>
              </span>
            </button>
          </div>
        </aside>
        <main className="dash-main dash-overview">
          {tab === "overview" && (
            H ? <AdminOverview health={H} money={money} fee={fee} activity={activity} setTab={setTab} /> : <p className="dash-empty-line">Loading…</p>
          )}
          {tab === "members" && (
            <MembersTab
              loading={loading} users={users} memberRows={memberRows} memberShown={memberShown}
              memberQ={memberQ} setMemberQ={setMemberQ} setHunt={setHunt}
              setStatus={setStatus} moderateUser={moderateUser} showMore={showMore}
            />
          )}
          {tab === "verification" && (
            <VerificationTab
              queue={queue} users={users} accountShown={accountShown} loading={loading}
              reasons={reasons} setReasons={setReasons} decide={decide} setStatus={setStatus} showMore={showMore}
            />
          )}
          {tab === "categories" && <CategoriesAdmin />}
          {tab === "listings" && (
            <ListingsTab
              listingRows={listingRows} listingShown={listingShown} listingFilter={listingFilter}
              setListingFilter={setListingFilter} setMore={setMore} PAGE={PAGE}
              moderateListing={moderateListing} showMore={showMore}
            />
          )}
          {tab === "moderation" && (
            <ReportsTab
              reports={reports} reportShown={reportShown}
              moderateListing={moderateListing} moderateUser={moderateUser}
              setReportStatus={setReportStatus} showMore={showMore}
            />
          )}
          {tab === "payments" && (
            <PaymentsTab money={money} showMore={showMore} invoiceShown={invoiceShown} setTab={setTab} />
          )}
          {tab === "monetization" && (
            <FeesTab
              fee={fee} setFee={setFee} saveFee={saveFee} boostFeature={boostFeature}
              toggleFeature={toggleFeature} boosts={boosts} patchBoost={patchBoost}
              saveBoost={saveBoost} quickToggle={quickToggle} deleteBoost={deleteBoost}
              draft={draft} setDraft={setDraft} createBoost={createBoost}
            />
          )}
          {tab === "vendors" && (
            <VendorsTab
              vendors={vendors} vendorDraft={vendorDraft} setVendorDraft={setVendorDraft}
              createVendor={createVendor} toggleVendor={toggleVendor} deleteVendor={deleteVendor}
            />
          )}
          {tab === "ads" && <AdsAdmin listings={modListings} onChanged={loadHealth} />}
          {tab === "jobs" && (
            <JobsTab
              jobs={jobRows} jobShown={jobShown} jobDraft={jobDraft} setJobDraft={setJobDraft}
              createJob={createJob} editJob={editJob} setEditJob={setEditJob}
              saveJob={saveJob} deleteJob={deleteJob} showMore={showMore}
            />
          )}
          {tab === "settings" && (
            <SettingsTab fee={fee} setFee={setFee} saveFee={saveFee} boostFeature={boostFeature} toggleFeature={toggleFeature} me={me} />
          )}
        </main>
      </div>
    </div>
  );
}
