import * as idb from './idb.js';
import { DATA_STORES, STORES } from './idb.js';
import { validateDump, SCHEMA_VERSION, MAX_FILE_BYTES } from './schema.js';
import { isLegacyBackup, legacyBackupToRecords } from './legacyReader.js';
import * as local from './local.js';

export const FORMAT = 'MMG-JSON-V3';
const MAX_SNAPSHOTS = 5;

// Stable JSON (sorted keys) so the checksum does not depend on key order.
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
export async function checksum(stores) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(stores)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const countsOf = (stores) => Object.fromEntries(DATA_STORES.map((s) => [s, (stores[s] || []).length]));
const totalOf = (stores) => DATA_STORES.reduce((n, s) => n + (stores[s] || []).length, 0);

export async function buildBackup() {
  const stores = await idb.dumpAll();
  return { app: 'The Mental Math Gym', format: FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), counts: countsOf(stores), checksum: await checksum(stores), stores };
}

// Returns {ok:true, kind, stores, counts, warnings} or {ok:false, error}. Never writes anything.
export async function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'The file is too large to be a backup.' };
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, error: 'This is not a valid JSON file.' }; }
  if (isLegacyBackup(obj)) {
    const r = legacyBackupToRecords(obj);
    const stores = { sessions: r.sessions, attempts: r.attempts };
    const v = validateDump(stores);
    if (!v.ok) return { ok: false, error: 'Old-format backup could not be read safely: ' + v.errors.join('; ') };
    return { ok: true, kind: 'legacy', stores, counts: v.counts, warnings: r.warnings, summary: r.summary };
  }
  if (!obj || obj.format !== FORMAT) return { ok: false, error: 'This is not a Mental Math Gym backup file.' };
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'This backup was made by a newer version of the app. Update the app first.' };
  const v = validateDump(obj.stores);
  if (!v.ok) return { ok: false, error: 'Backup failed validation: ' + v.errors.join('; ') };
  if (typeof obj.checksum !== 'string' || (await checksum(obj.stores)) !== obj.checksum) return { ok: false, error: 'Checksum mismatch: the file was changed or damaged. Nothing was imported.' };
  return { ok: true, kind: 'v3', stores: obj.stores, counts: v.counts, warnings: [] };
}

export async function previewMerge(stores) {
  const out = {};
  for (const s of DATA_STORES) {
    const have = new Set((await idb.getAll(s)).map((r) => r[STORES[s].keyPath]));
    const incoming = stores[s] || [];
    const fresh = incoming.filter((r) => !have.has(r[STORES[s].keyPath])).length;
    out[s] = { incoming: incoming.length, new: fresh, existing: incoming.length - fresh };
  }
  return out;
}

export async function snapshot(reason) {
  const stores = await idb.dumpAll();
  if (totalOf(stores) === 0) return null; // nothing worth keeping
  const rec = { id: 'snap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), reason, createdAt: Date.now(), counts: countsOf(stores), stores };
  await idb.put('snapshots', rec);
  const all = (await idb.getAll('snapshots')).sort((a, b) => b.createdAt - a.createdAt);
  for (const old of all.slice(MAX_SNAPSHOTS)) await idb.remove('snapshots', old.id);
  return rec.id;
}
export async function listSnapshots() {
  return (await idb.getAll('snapshots')).sort((a, b) => b.createdAt - a.createdAt).map(({ id, reason, createdAt, counts }) => ({ id, reason, createdAt, counts }));
}

// Add what is missing, never overwrite. A snapshot is taken first.
export async function applyMerge(stores) {
  await snapshot('before-import');
  const res = {};
  for (const s of DATA_STORES) res[s] = await idb.addMany(s, stores[s] || []);
  return res;
}
// Replace everything with the backup in ONE transaction (all-or-nothing). A snapshot is taken first.
export async function applyReplace(stores) {
  await snapshot('before-replace');
  await idb.replaceAll(stores);
}
export async function restoreSnapshot(id) {
  const snap = await idb.get('snapshots', id);
  if (!snap) throw new Error('That snapshot no longer exists.');
  await snapshot('before-restore');
  await idb.replaceAll(snap.stores);
}
// Wipes learner data only (snapshots stay, so this can be undone). The caller must confirm with the user first.
export async function resetAll() {
  const id = await snapshot('before-reset');
  await idb.replaceAll({});
  return id;
}

export async function downloadBackup() {
  const b = await buildBackup();
  const name = 'mental-math-gym-v3-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([JSON.stringify(b)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  local.set('lastBackupAt', Date.now());
  return { name, counts: b.counts, bytes: blob.size };
}
