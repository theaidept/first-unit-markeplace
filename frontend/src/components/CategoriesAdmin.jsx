import { useEffect, useState } from "react";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { CATEGORY_ICONS, CategoryGlyph } from "../lib/categoryIcons";
import { PageHero, Panel, PanelHead } from "./AdminKit";

const blank = () => ({ id: "", name: "", icon: "backpack", image: "", active: true });

export default function CategoriesAdmin() {
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState("");

  const load = () => {
    api.get("/admin/categories").then((r) => setRows(r.data.categories || [])).catch(() => setRows([]));
  };
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    setBusy(true);
    try {
      const { data } = await api.post("/upload", body);
      setDraft((d) => ({ ...d, image: data.url || "" }));
      toast.success("Picture upload successful");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Image upload failed");
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!draft.name.trim()) { toast.error("Name the category"); return; }
    setBusy(true);
    try {
      if (draft.id) await api.put(`/admin/categories/${draft.id}`, draft);
      else await api.post("/admin/categories", draft);
      toast.success(draft.id ? "Category updated" : "Category added");
      setDraft(blank());
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const hide = async (row) => {
    try {
      await api.put(`/admin/categories/${row.id}`, { ...row, active: !row.active });
      toast.success(row.active ? "Category hidden on the marketplace" : "Category is visible again");
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const remove = async (row) => {
    try {
      await api.delete(`/admin/categories/${row.id}`);
      toast.success("Category deleted");
      setConfirmId("");
      if (draft.id === row.id) setDraft(blank());
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <div className="ap-page" data-testid="admin-categories">
      <PageHero
        kicker="Marketplace"
        title="Categories"
        copy="These tiles run Shop by Category, the filters, the header, and the sell form. Swap the icon, or drop a picture on top of it."
      />
      <Panel>
        <PanelHead title={draft.id ? "Edit category" : "Add a category"} />
        <div className="cat-admin-form">
          <label className="vendor-field">Name
            <input className="ap-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Duty gear" />
          </label>
          <div>
            <div className="vendor-field">Icon</div>
            <div className="cat-icon-pick" role="listbox" aria-label="Category icon">
              {Object.keys(CATEGORY_ICONS).map((key) => (
                <button key={key} type="button" className={draft.icon === key ? "on" : ""} aria-pressed={draft.icon === key} aria-label={key} onClick={() => setDraft({ ...draft, icon: key })}>
                  <CategoryGlyph name={key} size={22} />
                </button>
              ))}
            </div>
          </div>
          <div className="cat-admin-photo">
            <div className="cat-admin-preview">
              {draft.image
                ? <img src={fileUrl(draft.image)} alt="" />
                : <span className="ct-icon-badge"><CategoryGlyph name={draft.icon} size={28} /></span>}
            </div>
            <div>
              <label className="ap-btn">
                {busy ? "Uploading…" : draft.image ? "Replace picture" : "Use a picture instead"}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {draft.image ? <button type="button" className="ap-btn" onClick={() => setDraft({ ...draft, image: "" })}>Use the icon</button> : null}
              <p className="ap-muted">A picture replaces the icon on the marketplace. Clear it to go back to the icon.</p>
            </div>
          </div>
          <div className="ads-detail-actions">
            <button type="button" className="abtn primary" onClick={save} disabled={busy}>{draft.id ? "Save category" : "Add category"}</button>
            {draft.id ? <button type="button" className="ap-btn" onClick={() => setDraft(blank())}>Cancel</button> : null}
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelHead title="On the marketplace" extra={<span className="ap-count">{rows?.length || 0}</span>} />
        {rows === null ? <p className="ap-muted">Loading…</p> : rows.length === 0 ? <p className="ap-muted">No categories yet.</p> : (
          <div className="vendor-ad-list">
            {rows.map((row) => (
              <article key={row.id} className="cat-admin-row">
                <span className="cat-admin-preview sm">
                  {row.image ? <img src={fileUrl(row.image)} alt="" /> : <CategoryGlyph name={row.icon} size={22} />}
                </span>
                <div>
                  <b>{row.name}</b>
                  <small>{row.active ? "Visible" : "Hidden"} · {row.slug}</small>
                </div>
                <div className="ads-row-actions">
                  <button type="button" className="ap-btn" onClick={() => { setDraft(row); setConfirmId(""); }}>Edit</button>
                  <button type="button" className="ap-btn" onClick={() => hide(row)}>{row.active ? "Hide" : "Show"}</button>
                  {confirmId === row.id ? (
                    <>
                      <button type="button" className="ap-btn danger" onClick={() => remove(row)}>Confirm delete</button>
                      <button type="button" className="ap-btn" onClick={() => setConfirmId("")}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="ap-btn danger" onClick={() => setConfirmId(row.id)}>Delete</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
