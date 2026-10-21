const KEY = "fu_saved";

export function readSaved() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export function writeSaved(ids) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("fu-saved"));
}

export function toggleSaved(id) {
  const ids = readSaved();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
  writeSaved(next);
  return next;
}
