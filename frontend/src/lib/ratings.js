// Deterministic, stable display rating derived from a listing id.
// Read-only display data — there is no review-submission backend.
export const ratingFor = (id) => {
  const s = String(id || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = h >>> 0;
  const value = Math.round((3.9 + (h % 11) / 10) * 10) / 10; // 3.9 – 4.9
  const count = 3 + (h % 58); // 3 – 60
  return { value, count };
};
