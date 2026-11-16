// Small settings only. Every key is prefixed 'mmg3_'; this module cannot touch legacy 'mmg_*' keys.
const P = 'mmg3_';
export function get(key, fallback = null) {
  try { const v = localStorage.getItem(P + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function set(key, value) {
  try { localStorage.setItem(P + key, JSON.stringify(value)); return true; } catch { return false; }
}
