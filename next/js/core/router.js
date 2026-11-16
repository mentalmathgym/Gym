// Tiny hash router. Routes look like '/chapter/:id'.
const routes = [];
let notFound = () => {};
export function route(pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ rx, keys, handler, pattern });
}
export const currentPath = () => (location.hash.slice(1) || '/home');
export function go(path) { location.hash = '#' + path; }
export function resolve() {
  const path = currentPath();
  for (const r of routes) {
    const m = r.rx.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch { params[k] = m[i + 1]; } });
      return r.handler(params, path);
    }
  }
  return notFound(path);
}
export function start(onNotFound) {
  notFound = onNotFound;
  window.addEventListener('hashchange', resolve);
  resolve();
}
// Old QR / share links look like ?chapter=<id>. Keep them working: only IDs we know are accepted.
export function upgradeLegacyUrl(knownIds) {
  let id = null;
  try { id = new URLSearchParams(location.search).get('chapter'); } catch { /* ignore */ }
  if (id === null) return;
  const target = knownIds.includes(id) ? '#/chapter/' + encodeURIComponent(id) : '#/learn';
  history.replaceState(null, '', location.pathname + target);
}
