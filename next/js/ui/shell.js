import { h, clear } from '../core/dom.js';
import { currentPath } from '../core/router.js';

export const TABS = [
  { path: '/home', label: 'Home', icon: '⌂' },
  { path: '/learn', label: 'Learn', icon: '▤' },
  { path: '/practice', label: 'Practice', icon: '◷' },
  { path: '/progress', label: 'Progress', icon: '△' },
  { path: '/more', label: 'More', icon: '☰' },
];

export function renderNav() {
  const nav = clear(document.getElementById('nav'));
  const here = currentPath();
  for (const t of TABS) {
    const active = here === t.path || here.startsWith(t.path + '/') || (t.path === '/learn' && here.startsWith('/chapter/'));
    nav.append(h('a', { href: '#' + t.path, 'aria-current': active ? 'page' : null }, h('span', { class: 'ico', 'aria-hidden': 'true' }, t.icon), t.label));
  }
}
export function setHeader(title) {
  clear(document.getElementById('top')).append(h('h1', null, title));
  document.title = title + ' — Mental Math Gym (Dev)';
}
export function mount(title, ...nodes) {
  setHeader(title);
  renderNav();
  const app = clear(document.getElementById('app'));
  app.append(...nodes);
  window.scrollTo(0, 0);
}
