import { Link } from "react-router-dom";
import { fileUrl } from "../lib/api";
import { Image as ImageIcon } from "lucide-react";

const STATUSES = ["unverified", "pre_screen", "validating", "human_review", "approved", "rejected", "suspended"];

export function Face({ src, initials, size }) {
  return (
    <span className={`admin-face ${size || ""}`}>
      {src ? <img src={fileUrl(src)} alt="" /> : <span>{initials || "FU"}</span>}
    </span>
  );
}

export function Thumb({ src, story }) {
  return (
    <div className="admin-thumb ap-thumb">
      {src ? <img src={fileUrl(src)} alt="" /> : <ImageIcon size={16} />}
      {story ? <span className="admin-story">Story</span> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, testid, labelTestid, children }) {
  return (
    <label className="admin-switch" data-testid={labelTestid}>
      <input type="checkbox" checked={!!checked} onChange={onChange} data-testid={testid} />
      <i />
      <span>
        <b>{label}</b>
        {children ? <em>{children}</em> : null}
      </span>
    </label>
  );
}

export function StatusPick({ value, onChange, testid }) {
  return (
    <label className="admin-select">
      <select value={value} onChange={onChange} data-testid={testid}>
        {STATUSES.map((s) => (<option value={s} key={s}>{s.replace("_", " ")}</option>))}
      </select>
    </label>
  );
}

export function LoadMore({ id, total, shown, onMore }) {
  if (shown >= total) return null;
  return (
    <div className="admin-more-wrap">
      <button type="button" className="admin-more" onClick={() => onMore(id)} data-testid={`admin-more-${id}`}>
        Load more <span>{total - shown} left</span>
      </button>
    </div>
  );
}

export function PageHero({ kicker, title, copy, action }) {
  return (
    <div className="ap-hero">
      <div>
        {kicker ? <p className="ap-kicker">{kicker}</p> : null}
        <h2 className="oswald">{title}</h2>
        {copy ? <p>{copy}</p> : null}
      </div>
      {action || null}
    </div>
  );
}

export function Stats({ children }) {
  return <div className="ap-stats">{children}</div>;
}

export function Stat({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`ap-stat ${tone || ""}`}>
      {Icon ? <span className="ap-stat-ico"><Icon size={18} /></span> : null}
      <div>
        <em>{label}</em>
        <b>{value}</b>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

export function Panel({ children, className, testid }) {
  return <section className={`ap-panel ${className || ""}`} data-testid={testid}>{children}</section>;
}

export function PanelHead({ title, sub, extra }) {
  return (
    <div className="ap-panel-h">
      <div>
        <h3 className="oswald">{title}</h3>
        {sub ? <p>{sub}</p> : null}
      </div>
      {extra || null}
    </div>
  );
}

export function Empty({ icon: Icon, title, copy }) {
  return (
    <div className="ap-empty">
      {Icon ? <span className="ap-empty-ico"><Icon size={22} /></span> : null}
      <b>{title}</b>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

export function Tag({ children, tone }) {
  return <span className={`ap-tag ${tone || ""}`}>{children}</span>;
}

export function Btn({ children, onClick, to, tone, testid, type = "button", disabled }) {
  const cls = `ap-btn ${tone || ""}`;
  if (to) return <Link className={cls} to={to} data-testid={testid}>{children}</Link>;
  return <button type={type} className={cls} onClick={onClick} data-testid={testid} disabled={disabled}>{children}</button>;
}
