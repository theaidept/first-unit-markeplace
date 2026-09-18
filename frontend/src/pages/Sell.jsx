import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNav } from "../components/AppNav";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Upload, X, Check, ImageIcon, Video, Rocket, Zap } from "lucide-react";

const CONDITIONS = ["Excellent", "Good", "Fair"];

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const boostLabel = (b) => (b.until_sold ? "Until sold" : `${b.duration_days}-day`);

export default function Sell() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [boostCfg, setBoostCfg] = useState({ feature_enabled: false, boost_types: [], listing_fee: { amount: 0, active: false } });
  const [selectedBoost, setSelectedBoost] = useState(null); // boost id or null (free)
  const [form, setForm] = useState({
    title: "", category: "", condition: "Good", location: "", price: "",
    description: "", meetup_note: "", photos: [], video: "",
  });

  const STEPS = [
    { n: 1, t: "Details & Media" },
    { n: 2, t: "Pricing" },
    { n: 3, t: "Review & Publish" },
  ];

  useEffect(() => {
    api.get("/categories").then((r) => {
      setCats(r.data.categories);
      if (r.data.categories[0]) setForm((f) => ({ ...f, category: r.data.categories[0].slug }));
    });
    api.get("/boost/options").then((r) => setBoostCfg(r.data)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        urls.push(data.url);
      }
      setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
      toast.success(`${urls.length} photo(s) added`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (u) => setForm((f) => ({ ...f, photos: f.photos.filter((p) => p !== u) }));

  const onVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload/video", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, video: data.url }));
      toast.success("Video added");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Video upload failed");
    } finally {
      setUploadingVideo(false);
    }
  };

  const validStep1 = form.title.trim() && form.category && form.price !== "" && form.photos.length > 0;

  const feeAmount = boostCfg.listing_fee?.active ? Number(boostCfg.listing_fee.amount || 0) : 0;
  const chosen = boostCfg.boost_types.find((b) => b.id === selectedBoost) || null;
  const boostAmount = chosen ? Number(chosen.price || 0) : 0;
  const totalToPublish = feeAmount + boostAmount;

  // Create the listing (live) first, then charge for the boost against the real listing.
  const publish = async () => {
    if (form.photos.length === 0) {
      toast.error("Add at least one photo to publish");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, price: Number(form.price), publish: true };
      const { data } = await api.post("/listings", payload);
      if (data.status === "flagged") {
        toast.warning("Listing sent to Trust & Safety review (prohibited term detected).");
        navigate("/marketplace");
        return;
      }
      if (chosen) {
        try {
          const { data: co } = await api.post(`/listings/${data.id}/boost/checkout`, {
            boost_type_id: chosen.id,
            origin_url: window.location.origin,
          });
          if (co.free) {
            toast.success("Listing published and featured");
            navigate(`/listing/${data.id}`);
          } else {
            window.location.href = co.checkout_url; // Stripe hosted checkout
          }
          return;
        } catch (err) {
          toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Boost checkout failed — listing is published without a boost.");
          navigate(`/listing/${data.id}`);
          return;
        }
      }
      toast.success("Listing published");
      navigate(`/listing/${data.id}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Could not save listing");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      const payload = { ...form, price: Number(form.price || 0), publish: false };
      await api.post("/listings", payload);
      toast.success("Saved as draft");
      navigate("/marketplace");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Could not save draft");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fu-app" data-testid="sell-page">
      <AppNav />
      <div className="wrap" style={{ paddingTop: 26, maxWidth: 900 }}>
        <span className="eyebrow tick">Sell an item</span>
        <h1 className="oswald" style={{ fontSize: 30, color: "var(--navy)", margin: "8px 0 20px" }}>
          List to the verified circle
        </h1>

        <div className="wizard-steps" data-testid="wizard-steps">
          {STEPS.map((s) => (
            <div key={s.n} className={`wstep ${step === s.n ? "active" : ""} ${step > s.n ? "done" : ""}`}>
              <span className="wn">{step > s.n ? <Check size={14} /> : s.n}</span>
              <span>{s.t}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="card" style={{ padding: 24 }} data-testid="sell-step-1">
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={set("title")} placeholder="e.g. Turnout Gear — Size L" data-testid="sell-title" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={set("category")} data-testid="sell-category">
                  {cats.map((c) => (<option key={c.slug} value={c.slug}>{c.name}</option>))}
                </select>
              </div>
              <div className="field">
                <label>Condition</label>
                <select value={form.condition} onChange={set("condition")} data-testid="sell-condition">
                  {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>Price (USD)</label>
                <input type="number" min="0" value={form.price} onChange={set("price")} placeholder="240" data-testid="sell-price" />
              </div>
              <div className="field">
                <label>Location</label>
                <input value={form.location} onChange={set("location")} placeholder="Austin, TX" data-testid="sell-location" />
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={4} value={form.description} onChange={set("description")} placeholder="Describe the item, its history and condition." data-testid="sell-description" />
            </div>
            <div className="field">
              <label>Meet-up note (optional)</label>
              <input value={form.meetup_note} onChange={set("meetup_note")} placeholder="e.g. Meet at Station 14 front lobby" data-testid="sell-meetup" />
            </div>

            <div className="field">
              <label>Photos</label>
              <div className="photo-grid" data-testid="photo-grid">
                {form.photos.map((u) => (
                  <div className="photo-thumb" key={u}>
                    <img src={fileUrl(u)} alt="" />
                    <button type="button" onClick={() => removePhoto(u)} data-testid="remove-photo"><X size={13} /></button>
                  </div>
                ))}
                <label className="photo-add" data-testid="photo-add">
                  {uploading ? <span className="mini">Uploading…</span> : <><Upload size={20} /><span className="mini">Add photos</span></>}
                  <input type="file" accept="image/*" multiple hidden onChange={onFiles} data-testid="photo-input" />
                </label>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                <ImageIcon size={13} /> JPG/PNG/WEBP, up to 8MB each.
              </div>
            </div>

            <div className="field">
              <label>Product video (optional)</label>
              {form.video ? (
                <div className="video-preview" data-testid="video-preview">
                  <video src={fileUrl(form.video)} controls className="sell-video" />
                  <button type="button" className="btn btn-ghost" onClick={() => setForm((f) => ({ ...f, video: "" }))} data-testid="remove-video">
                    Remove video
                  </button>
                </div>
              ) : (
                <label className="video-add" data-testid="video-add">
                  {uploadingVideo ? <span className="mini">Uploading video…</span> : <><Video size={22} /><span className="mini">Upload a walkaround video</span></>}
                  <input type="file" accept="video/*" hidden onChange={onVideo} data-testid="video-input" />
                </label>
              )}
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8 }}>
                Pre-recorded only. Your video powers a shoppable Story on the feed.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={saveDraft} disabled={busy || !form.title.trim()} data-testid="save-draft-btn">
                Save as draft
              </button>
              <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!validStep1} data-testid="to-pricing-btn" title={!validStep1 ? "Add a title, category, price and at least one photo" : undefined}>
                Continue to pricing →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card" style={{ padding: 24 }} data-testid="sell-step-2">
            <div className="sc-head" style={{ marginBottom: 4 }}>Feature your listing</div>
            {boostCfg.feature_enabled && boostCfg.boost_types.length > 0 ? (
              <>
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
                  A boost gives your listing a <b>FEATURED</b> tag in the feed and priority placement in the Featured Stories reel. Publishing without featuring is always free.
                </p>
                <div className="boost-tiers" data-testid="boost-tiers">
                  <button
                    type="button"
                    className={`boost-tier ${selectedBoost === null ? "sel" : ""}`}
                    onClick={() => setSelectedBoost(null)}
                    data-testid="boost-tier-none"
                  >
                    <div className="bt-top">
                      <span className="bt-name">Publish without featuring</span>
                      <span className="bt-price">Free</span>
                    </div>
                    <span className="bt-sub">Standard placement in the feed.</span>
                  </button>
                  {boostCfg.boost_types.map((b) => (
                    <button
                      type="button"
                      key={b.id}
                      className={`boost-tier ${selectedBoost === b.id ? "sel" : ""}`}
                      onClick={() => setSelectedBoost(b.id)}
                      data-testid={`boost-tier-${b.id}`}
                    >
                      <div className="bt-top">
                        <span className="bt-name"><Zap size={13} style={{ marginRight: 5 }} />{b.name}</span>
                        <span className="bt-price">{money(b.price)}</span>
                      </div>
                      <span className="bt-sub">Featured for <b>{boostLabel(b)}</b></span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 8 }} data-testid="boosts-unavailable">
                Featuring is currently unavailable — your listing will publish free with standard placement.
              </p>
            )}

            <div className="listing-summary" data-testid="listing-summary" style={{ marginTop: 20 }}>
              <div className="sc-head" style={{ marginBottom: 10 }}>Listing summary</div>
              <div className="ls-row"><span>Asking price</span><span data-testid="summary-asking">{money(form.price)}</span></div>
              <div className="ls-row"><span>Marketplace fee</span><span data-testid="summary-fee">{money(feeAmount)}</span></div>
              <div className="ls-row"><span>Boost{chosen ? ` · ${chosen.name}` : ""}</span><span data-testid="summary-boost">{money(boostAmount)}</span></div>
              <div className="ls-row ls-total"><span>Total to publish</span><span data-testid="summary-total">{money(totalToPublish)}</span></div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8 }}>
                The asking price is paid off-platform between members. Only platform charges are billed here.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} data-testid="back-to-details-btn">← Back to details</button>
              <button className="btn btn-primary" onClick={() => setStep(3)} data-testid="to-review-btn">Continue to review →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card" style={{ padding: 24 }} data-testid="sell-step-3">
            <div className="review-grid">
              <div className="rev-photo">
                {form.photos[0] ? <img src={fileUrl(form.photos[0])} alt="" /> : <div className="lc-noimg">No photo</div>}
              </div>
              <div>
                <div className="lc-price" style={{ fontSize: 26 }}>${Number(form.price || 0).toLocaleString()}</div>
                <h2 className="oswald" style={{ color: "var(--navy)", margin: "6px 0 10px" }}>{form.title || "Untitled"}</h2>
                <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                  {(cats.find((c) => c.slug === form.category) || {}).name} · {form.condition}
                  {form.location ? ` · ${form.location}` : ""}
                </div>
                <p style={{ marginTop: 12, color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6 }}>{form.description || "No description."}</p>
                {form.meetup_note && <div className="pe-note" style={{ marginTop: 12 }}>Meet-up: {form.meetup_note}</div>}
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12 }}>{form.photos.length} photo(s) attached{form.video ? " · video attached" : ""}</div>
              </div>
            </div>

            <div className="listing-summary" data-testid="review-summary" style={{ marginTop: 20 }}>
              <div className="ls-row"><span>Marketplace fee</span><span>{money(feeAmount)}</span></div>
              <div className="ls-row"><span>Boost{chosen ? ` · ${chosen.name} (${boostLabel(chosen)})` : " · none"}</span><span>{money(boostAmount)}</span></div>
              <div className="ls-row ls-total"><span>Total to publish</span><span data-testid="review-total">{money(totalToPublish)}</span></div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)} data-testid="back-to-pricing-btn">← Back to pricing</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" onClick={saveDraft} disabled={busy} data-testid="review-save-draft-btn">Save as draft</button>
                <button className="btn btn-primary" onClick={publish} disabled={busy} data-testid="publish-btn">
                  {busy ? "Working…" : chosen ? (<><Rocket size={15} style={{ marginRight: 6 }} />Pay {money(totalToPublish)} & publish</>) : "Publish listing"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
