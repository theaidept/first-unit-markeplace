import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

export const BACKEND = BASE;
export const fileUrl = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${BASE}${p}`);

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
});

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
