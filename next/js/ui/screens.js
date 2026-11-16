import { h } from '../core/dom.js';
import { mount } from './shell.js';
import { CHAPTERS, getChapter, PROVISIONAL_LABEL } from '../content/registry.js';
import * as stats from '../storage/stats.js';
import { report } from '../core/errors.js';

const statBox = (value, label) => h('div', { class: 'stat' }, h('b', null, value), h('small', null, label));
const provisionalTag = () => h('span', { class: 'tag' }, PROVISIONAL_LABEL);
const comingSoon = (what, phase) => h('div', { class: 'card' }, h('p', null, what), h('p', { class: 'muted' }, 'Not built yet — planned for ' + phase + '. This screen is a placeholder, not a working feature.'));

async function totalsCard(t) {
  return h('div', { class: 'card' },
    h('div', { class: 'grid3' }, statBox(t.attempted, 'Attempted'), statBox(t.correct, 'Correct'), statBox(t.accuracy == null ? '—' : t.accuracy + '%', 'Accuracy')),
    h('p', { class: 'muted' }, t.sessions ? 'Calculated from ' + t.sessions + ' saved session(s) on this device.' : 'No saved sessions yet. Numbers appear here only after real practice or an import.'));
}

export async function home() {
  try {
    const t = await stats.totals();
    mount('Mental Math Gym',
      await totalsCard(t),
      h('div', { class: 'card' }, h('h2', null, 'Welcome'), h('p', null, 'Everything here is free for everyone. There is no login or account. Your progress is saved on this device only.'),
        h('p', { class: 'muted' }, 'Use More → Backup & Restore to keep a copy of your progress or move it to another phone.')),
      h('a', { class: 'btn full', href: '#/learn' }, 'Browse chapters'));
  } catch (e) { report(e, 'Could not load home'); mount('Mental Math Gym', h('div', { class: 'card bad' }, 'Storage is unavailable in this browser session.')); }
}

export function learn() {
  mount('Learn', h('div', { class: 'card warn' }, provisionalTag(), h('p', { class: 'muted' }, 'Chapter titles come from the current site data. They are a working reference until the final book manuscript is supplied.')),
    h('ul', { class: 'list card' }, CHAPTERS.map((c) => h('li', null, h('a', { href: '#/chapter/' + encodeURIComponent(c.id) }, 'Chapter ' + c.num + ': ' + c.title)))));
}

export async function chapter({ id }) {
  const c = getChapter(id);
  if (!c) return mount('Chapter not found', h('div', { class: 'card' }, h('p', null, 'That chapter does not exist.')), h('a', { class: 'btn', href: '#/learn' }, 'All chapters'));
  let mine = null;
  try { mine = (await stats.totals()).byChapter[c.id] || null; } catch (e) { report(e, 'Could not load chapter stats'); }
  mount('Chapter ' + c.num,
    h('a', { class: 'crumb', href: '#/learn' }, '← All chapters'),
    h('div', { class: 'card warn' }, h('h2', null, c.title), provisionalTag(), h('p', { class: 'muted' }, 'Chapter ID: ' + c.id)),
    h('div', { class: 'card' }, h('h3', null, 'Your saved results'),
      mine ? h('p', null, mine.correct + ' correct of ' + mine.attempted + ' attempted in ' + mine.sessions + ' session(s).') : h('p', { class: 'muted' }, 'No saved results for this chapter yet.')),
    comingSoon('The interactive flipbook, practice and assessment for this chapter.', c.num === 1 ? 'Phase 3b (Chapter 01 prototype)' : 'Phase 4'));
}

export function practice() { mount('Practice', comingSoon('Practice, timed drills, speed trainer and challenges.', 'Phase 3b and later')); }

export async function progress() {
  try {
    const t = await stats.totals();
    mount('Progress', await totalsCard(t),
      comingSoon('Topic-wise mastery, streaks, speed trends and mistake patterns.', 'Phase 3b / Phase 5'));
  } catch (e) { report(e, 'Could not load progress'); mount('Progress', h('div', { class: 'card bad' }, 'Storage is unavailable.')); }
}

export function more() {
  mount('More',
    h('ul', { class: 'list card' },
      h('li', null, h('a', { href: '#/more/backup' }, 'Backup & Restore')),
      h('li', null, h('a', { href: '#/more/import-old' }, 'Import from the old site (read-only)')),
      h('li', null, h('a', { href: '#/more/about' }, 'About this build'))));
}

export function about() {
  mount('About this build',
    h('a', { class: 'crumb', href: '#/more' }, '← More'),
    h('div', { class: 'card stack' },
      h('p', null, 'Phase 3a — Foundation. Dev build, kept separate from the production site.'),
      h('table', { class: 'kv' },
        h('tr', null, h('th', null, 'Storage'), h('td', null, 'This device only (IndexedDB "mmg3")')),
        h('tr', null, h('th', null, 'Accounts / login'), h('td', null, 'None')),
        h('tr', null, h('th', null, 'Network calls'), h('td', null, 'None (no Firebase, no external scripts)')),
        h('tr', null, h('th', null, 'Old site data'), h('td', null, 'Read-only; never modified')),
        h('tr', null, h('th', null, 'Chapter content'), h('td', null, PROVISIONAL_LABEL)))));
}
