import { h, clear, fmtDate } from '../core/dom.js';
import { mount } from './shell.js';
import { toast, report } from '../core/errors.js';
import * as backup from '../storage/backup.js';
import * as local from '../storage/local.js';
import { MAX_FILE_BYTES } from '../storage/schema.js';

const sum = (c) => Object.values(c || {}).reduce((n, v) => n + (Number.isFinite(v) ? v : 0), 0);

export async function backupScreen() {
  const status = h('div', { 'aria-live': 'polite' });
  const importBox = h('div', { class: 'stack' });
  const snapBox = h('div');
  const resetBox = h('div', { class: 'stack' });
  let pending = null;

  async function refreshSnaps() {
    clear(snapBox);
    try {
      const snaps = await backup.listSnapshots();
      snapBox.append(h('h3', null, 'Automatic safety copies'), snaps.length ? h('ul', { class: 'list' }, snaps.map((s) => h('li', { class: 'row' },
        h('span', null, fmtDate(s.createdAt) + ' · ' + s.reason + ' · ' + sum(s.counts) + ' records'),
        h('button', { class: 'btn secondary', onclick: async () => {
          if (!confirm('Restore this safety copy? Your current data is saved as another safety copy first.')) return;
          try { await backup.restoreSnapshot(s.id); toast('Safety copy restored.', 'ok'); refreshSnaps(); } catch (e) { report(e, 'Restore failed'); }
        } }, 'Restore')))) : h('p', { class: 'muted' }, 'None yet. One is created automatically before every import, restore or reset.'));
    } catch (e) { report(e, 'Could not list safety copies'); }
  }

  async function onFile(ev) {
    clear(importBox); pending = null;
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) return importBox.append(h('div', { class: 'card bad' }, 'That file is too large to be a backup.'));
    try {
      const res = await backup.parseBackup(await f.text());
      if (!res.ok) return importBox.append(h('div', { class: 'card bad' }, res.error, h('p', { class: 'muted' }, 'Nothing was changed.')));
      const prev = await backup.previewMerge(res.stores);
      pending = res;
      importBox.append(h('div', { class: 'card' },
        h('h3', null, res.kind === 'legacy' ? 'Old-format backup recognised' : 'Backup verified'),
        h('table', { class: 'kv' }, Object.entries(prev).filter(([, v]) => v.incoming).map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, v.incoming + ' in file · ' + v.new + ' new · ' + v.existing + ' already here')))),
        (res.warnings || []).map((w) => h('p', { class: 'muted' }, w)),
        h('div', { class: 'stack' },
          h('button', { class: 'btn full', onclick: doMerge }, 'Add missing records (safe)'),
          res.kind === 'v3' ? h('button', { class: 'btn danger full', onclick: doReplace }, 'Replace everything with this file') : null)));
    } catch (e) { report(e, 'Could not read file'); }
  }
  async function doMerge() {
    try { const r = await backup.applyMerge(pending.stores); const added = Object.values(r).reduce((n, x) => n + x.added, 0); toast('Done. ' + added + ' record(s) added; existing records were kept.', 'ok'); clear(importBox); refreshSnaps(); } catch (e) { report(e, 'Import failed'); }
  }
  async function doReplace() {
    if (!confirm('Replace ALL current data with this backup? A safety copy is made first.')) return;
    try { await backup.applyReplace(pending.stores); toast('Data replaced from backup.', 'ok'); clear(importBox); refreshSnaps(); } catch (e) { report(e, 'Replace failed'); }
  }

  function buildReset() {
    clear(resetBox);
    const input = h('input', { type: 'text', id: 'resetConfirm', autocomplete: 'off', 'aria-label': 'Type DELETE to confirm' });
    const btn = h('button', { class: 'btn danger full', id: 'resetBtn', disabled: true, onclick: async () => {
      try { await backup.downloadBackup(); const id = await backup.resetAll(); toast(id ? 'All data cleared. A backup was downloaded and a safety copy kept.' : 'Nothing to clear.', 'ok'); input.value = ''; btn.disabled = true; refreshSnaps(); } catch (e) { report(e, 'Reset failed'); }
    } }, 'Delete all my data');
    input.addEventListener('input', () => { btn.disabled = input.value.trim() !== 'DELETE'; });
    resetBox.append(h('h3', null, 'Delete all data'), h('p', { class: 'muted' }, 'Clears progress stored by this new build only. A backup file is downloaded and a safety copy is kept so this can be undone. The old site\'s data is never touched.'), h('label', { for: 'resetConfirm' }, 'Type DELETE to enable the button'), input, btn);
  }

  const last = local.get('lastBackupAt');
  mount('Backup & Restore',
    h('a', { class: 'crumb', href: '#/more' }, '← More'),
    h('div', { class: 'card stack' }, h('h3', null, 'Save a backup'),
      h('p', { class: 'muted' }, last ? 'Last backup from this device: ' + fmtDate(last) : 'You have not made a backup from this device yet.'),
      h('button', { class: 'btn full', id: 'exportBtn', onclick: async () => {
        try { const r = await backup.downloadBackup(); clear(status).append(h('p', null, 'Saved ' + r.name + ' (' + Math.round(r.bytes / 1024) + ' KB, ' + sum(r.counts) + ' records).')); } catch (e) { report(e, 'Backup failed'); }
      } }, 'Download backup file'), status),
    h('div', { class: 'card stack' }, h('h3', null, 'Restore from a file'),
      h('p', { class: 'muted' }, 'The file is checked first. Nothing is changed until you choose an option.'),
      h('label', { for: 'importFile' }, 'Choose a backup (.json)'),
      h('input', { type: 'file', id: 'importFile', accept: '.json,application/json', onchange: onFile }), importBox),
    h('div', { class: 'card' }, snapBox),
    h('div', { class: 'card bad' }, resetBox));
  buildReset();
  refreshSnaps();
}
