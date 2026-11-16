import { h, clear } from '../core/dom.js';
import { mount } from './shell.js';
import { toast, report } from '../core/errors.js';
import * as legacy from '../storage/legacyReader.js';
import * as backup from '../storage/backup.js';

export function legacyScreen() {
  const out = h('div', { class: 'stack' });
  let scanned = null;

  async function doScan() {
    clear(out);
    try {
      const s = await legacy.scan();
      scanned = s;
      if (!s.found) return out.append(h('div', { class: 'card' }, h('p', null, 'No progress from the old site was found in this browser.'), h('p', { class: 'muted' }, 'If your progress is in another browser or phone, use the old site\'s backup, then Restore it here from Backup & Restore.')));
      const r = s.result, m = r.summary;
      out.append(h('div', { class: 'card stack' },
        h('h3', null, 'Found on this device'),
        h('table', { class: 'kv' },
          h('tr', null, h('th', null, 'Old counters (attempted / correct)'), h('td', null, m.legacyAttempted + ' / ' + m.legacyCorrect)),
          h('tr', null, h('th', null, 'Sessions to copy'), h('td', null, String(m.sessions))),
          h('tr', null, h('th', null, 'Question rows to copy'), h('td', null, String(m.questionRows))),
          h('tr', null, h('th', null, 'Counted but without detail'), h('td', null, m.counterOnlyAttempts + ' attempts')),
          h('tr', null, h('th', null, 'After copy (attempted / correct)'), h('td', null, m.importedAttempted + ' / ' + m.importedCorrect)),
          h('tr', null, h('th', null, 'Totals match old counters'), h('td', null, m.reconciled ? 'Yes' : 'No — see notes'))),
        r.warnings.map((w) => h('p', { class: 'muted' }, w)),
        s.archiveState === 'unverifiable' ? h('p', { class: 'muted' }, 'This browser cannot safely list the old archive, so archived per-question rows were skipped. Totals are still kept.') : null,
        h('button', { class: 'btn full', id: 'copyBtn', onclick: doCopy }, 'Copy into the new build')));
    } catch (e) { report(e, 'Scan failed'); }
  }

  async function doCopy() {
    const btn = document.getElementById('copyBtn');
    if (btn) btn.disabled = true;
    try {
      const before = await legacy.fingerprint();
      const r = scanned.result;
      const res = await backup.applyMerge({ sessions: r.sessions, attempts: r.attempts });
      const after = await legacy.fingerprint();
      const same = JSON.stringify(before) === JSON.stringify(after);
      toast('Copied ' + res.sessions.added + ' session(s) and ' + res.attempts.added + ' question row(s); ' + (res.sessions.skipped + res.attempts.skipped) + ' were already here.', 'ok');
      clear(out).append(h('div', { class: same ? 'card' : 'card bad', id: 'verifyBox' },
        h('h3', null, same ? 'Done — old data verified unchanged' : 'Warning — old data changed during the copy'),
        h('p', { class: 'muted' }, same ? 'A fingerprint of the old site\'s data was taken before and after. They are identical.' : 'The old data\'s fingerprint differs. This build never writes to it; another tab may have been practising. Check the old site.')));
    } catch (e) { report(e, 'Copy failed'); if (btn) btn.disabled = false; }
  }

  mount('Import from old site',
    h('a', { class: 'crumb', href: '#/more' }, '← More'),
    h('div', { class: 'card stack' },
      h('p', null, 'This only READS the progress saved by the current Mental Math Gym site in this browser. It never changes, moves or deletes it.'),
      h('p', { class: 'muted' }, 'Safe to run more than once: records already copied are skipped.'),
      h('button', { class: 'btn full', id: 'scanBtn', onclick: doScan }, 'Scan old data')),
    out);
}
