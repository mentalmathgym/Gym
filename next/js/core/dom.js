// Safe DOM builder. Data is only ever inserted as text nodes; there is no HTML-string path.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = String(v);
    else if (k.startsWith('on')) {
      if (typeof v !== 'function') throw new Error('Handler must be a function: ' + k);
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'html' || k === 'style' || k === 'srcdoc') {
      throw new Error('Unsafe property not allowed: ' + k);
    } else {
      if ((k === 'href' || k === 'src') && /^\s*(javascript|data):/i.test(String(v))) throw new Error('Unsafe URL');
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const fmtDate = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleDateString() : 'date unknown');
