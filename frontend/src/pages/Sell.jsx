import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNav } from "../components/AppNav";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Upload, X, Check, ImageIcon, Video } from "lucide-react";

const CONDITIONS = ["Excellent", "Good", "Fair"];
const STEPS = [
  { n: 1, t: "Details & Media" },
  { n: 2, t: "Pricing", soon: true },
  { n: 3, t: "Review & Publish" },
];

export default function Sell() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    condition: "Good",
    location: "",
    price: "",
    description: "",
    meetup_note: "",
    photos: [],
    video: "",
  });

  useEffect(() => {
    api.get("/categories").then((r) => {
      setCats(r.data.categories);
      if (r.data.categories[0]) setForm((f) => ({ ...f, category: r.data.categories[0].slug }));
    });
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

  const submit = async (publish) => {
    if (publish && form.photos.length === 0) {
      toast.error("Add at least one photo to publish");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, price: Number(form.price), publish };
      const { data } = await api.post("/listings", payload);
      if (data.status === "flagged") {
        toast.warning("Listing sent to Trust & Safety review (prohibited term detected).");
        navigate("/marketplace");
      } else if (publish) {
        toast.success("Listing published");
        navigate(`/listing/${data.id}`);
      } else {
        toast.success("Saved as draft");
        navigate("/marketplace");
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Could not save listing");
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
            <div
              key={s.n}
              className={`wstep ${step === s.n ? "active" : ""} ${s.soon ? "soon" : ""} ${step > s.n && !s.soon ? "done" : ""}`}
            >
              <span className="wn">{step > s.n && !s.soon ? <Check size={14} /> : s.n}</span>
              <span>{s.t}{s.soon && <em> · soon</em>}</span>
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
                  {cats.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
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
              <button className="btn btn-ghost" onClick={() => submit(false)} disabled={busy || !form.title.trim()} data-testid="save-draft-btn">
                Save as draft
              </button>
              <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!validStep1} data-testid="to-review-btn" title={!validStep1 ? "Add a title, category, price and at least one photo" : undefined}>
                Continue to review →
              </button>
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
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 12 }}>{form.photos.length} photo(s) attached</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} data-testid="back-to-details-btn">← Back to details</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => submit(false)} disabled={busy} data-testid="review-save-draft-btn">Save as draft</button>
                <button className="btn btn-primary" onClick={() => submit(true)} disabled={busy} data-testid="publish-btn">
                  {busy ? "Publishing…" : "Publish listing"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
