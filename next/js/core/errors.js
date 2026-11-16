import { h } from './dom.js';

export function toast(message, kind) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: 'toast ' + (kind || '') }, String(message));
  box.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 9000 : 4500);
}
export function report(err, context) {
  console.error('[MMG]', context || '', err);
  toast((context ? context + ': ' : '') + (err && err.message ? err.message : 'Something went wrong'), 'error');
}
export function installGlobalHandlers() {
  window.addEventListener('error', (e) => report(e.error || new Error(e.message), 'Unexpected error'));
  window.addEventListener('unhandledrejection', (e) => report(e.reason, 'Unexpected error'));
}
