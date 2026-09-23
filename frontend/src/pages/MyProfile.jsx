import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { ProfileCard } from "../components/ProfileCard";
import { PaymentSettings } from "../components/PaymentSettings";
import { AvatarRing } from "../components/AvatarRing";
import { VerifiedBadge } from "../components/VerifiedBadge";
import api, { formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { EyeOff, Image, Hash, ShieldCheck } from "lucide-react";

const RESPONDER_LABELS = {
  law_enforcement: "Law Enforcement",
  firefighter_career: "Firefighter — Career",
  firefighter_volunteer: "Firefighter — Volunteer",
  emt_paramedic: "EMT / Paramedic",
  dispatcher: "Dispatcher",
};

const VIS_OPTIONS = [
  { v: "avatar", icon: ShieldCheck, t: "Avatar ring", d: "No photo. Privacy-safe default." },
  { v: "initials", icon: Hash, t: "Initials", d: "Show your handle initials." },
  { v: "photo", icon: Image, t: "Photo", d: "Show your uploaded photo." },
];

export default function MyProfile() {
  const { refreshUser } = useAuth();
  const [p, setP] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/profile/me");
    setP(data);
    setForm({
      display_handle: data.display_handle || "",
      agency: data.agency || "",
      rank: data.rank || "",
      years_of_service: data.years_of_service || "",
      photo_visibility: data.photo_visibility || "avatar",
      undercover: !!data.undercover,
      avatar: data.avatar_raw || "",
    });
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/profile/me", form);
      setP(data);
      await refreshUser();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (!p || !form) {
    return (
      <DashboardLayout active="profile" testid="my-profile-page">
        <div style={{ padding: 40, color: "var(--text-faint)" }}>Loading…</div>
      </DashboardLayout>
    );
  }

  // live preview reflecting current form choices
  const preview = {
    ...p,
    display_handle: form.display_handle,
    agency: form.agency,
    rank: form.rank,
    years_of_service: form.years_of_service,
    photo_visibility: form.photo_visibility,
    undercover: form.undercover,
    avatar: form.avatar,
    initials: (form.display_handle || "FU")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase(),
  };

  return (
    <DashboardLayout active="profile" testid="my-profile-page">
      <span className="eyebrow tick">Your identity</span>
      <h1 className="oswald dash-h">Public profile</h1>
      <p className="dash-lede">
        This is what other verified members see. Your real name and credential references stay
        private in your verified identity — they are never shown here, even to other members.
      </p>

      <div className="profile-edit-grid">
          {/* Preview */}
          <div>
            <div className="pe-label">Live preview</div>
            <ProfileCard profile={preview} />
            <div className="pe-note">
              <ShieldCheck size={14} />
              Verification is confirmed privately. Your Verified badge shows regardless of what you
              display publicly.
            </div>
          </div>

          {/* Edit form */}
          <form onSubmit={save} className="card" style={{ padding: 24 }} data-testid="profile-edit-form">
            <div className="field">
              <label>Display handle</label>
              <input
                value={form.display_handle}
                onChange={set("display_handle")}
                placeholder="e.g. Engine 14, PD Unit 22, Station 9 EMS"
                data-testid="pf-handle"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Agency / Department</label>
                <input value={form.agency} onChange={set("agency")} data-testid="pf-agency" />
              </div>
              <div className="field">
                <label>Rank</label>
                <input value={form.rank} onChange={set("rank")} data-testid="pf-rank" />
              </div>
            </div>
            <div className="field">
              <label>Years of service</label>
              <input value={form.years_of_service} onChange={set("years_of_service")} data-testid="pf-years" />
            </div>

            <div className="field">
              <label>How you appear</label>
              <div className="vis-options" data-testid="pf-visibility">
                {VIS_OPTIONS.map((o) => (
                  <button
                    type="button"
                    key={o.v}
                    className={`vis-opt ${form.photo_visibility === o.v ? "active" : ""}`}
                    onClick={() => setForm({ ...form, photo_visibility: o.v })}
                    data-testid={`pf-vis-${o.v}`}
                  >
                    <o.icon size={16} />
                    <b>{o.t}</b>
                    <span>{o.d}</span>
                  </button>
                ))}
              </div>
            </div>

            {form.photo_visibility === "photo" && (
              <div className="field">
                <label>Photo URL (optional)</label>
                <input
                  value={form.avatar}
                  onChange={set("avatar")}
                  placeholder="https://…"
                  data-testid="pf-avatar"
                />
              </div>
            )}

            <label className="undercover-toggle" data-testid="pf-undercover">
              <input
                type="checkbox"
                checked={form.undercover}
                onChange={(e) => setForm({ ...form, undercover: e.target.checked })}
                data-testid="pf-undercover-checkbox"
              />
              <div>
                <b>
                  <EyeOff size={13} /> Undercover mode
                </b>
                <span>
                  Hide your real name and any photo. You stay visually anonymous while remaining a
                  Verified member.
                </span>
              </div>
            </label>

            <button className="btn btn-primary btn-block" disabled={saving} data-testid="pf-save-btn">
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </div>

        <PaymentSettings />
    </DashboardLayout>
  );
}
