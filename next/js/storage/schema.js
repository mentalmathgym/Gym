import { DATA_STORES, STORES } from './idb.js';

export const SCHEMA_VERSION = 1;
export const SESSION_SOURCES = ['native', 'legacy-book', 'legacy-practice', 'legacy-counter'];
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_RECORDS = 400000;

const isStr = (v, max = 2000) => typeof v === 'string' && v.length > 0 && v.length <= max;
const optStr = (v, max = 2000) => v == null || (typeof v === 'string' && v.length <= max);
const optNum = (v) => v == null || (typeof v === 'number' && Number.isFinite(v));
const cnt = (v) => Number.isInteger(v) && v >= 0;

export function validateRecord(store, r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'not an object';
  if (!isStr(r[STORES[store].keyPath], 300)) return 'missing key ' + STORES[store].keyPath;
  if (store === 'session' || store === 'sessions') {
    if (!cnt(r.attempted) || !cnt(r.correct) || r.correct > r.attempted) return 'bad attempted/correct';
    if (!SESSION_SOURCES.includes(r.source)) return 'bad source';
    if (!optNum(r.startedAt) || !optStr(r.chapterId, 100) || !optStr(r.mode, 100)) return 'bad session fields';
  }
  if (store === 'attempts') {
    if (!isStr(r.sessionId, 300) || typeof r.correct !== 'boolean' || !optNum(r.ts) || !optNum(r.timeMs)) return 'bad attempt fields';
    if (!optStr(r.given) || !optStr(r.expected) || !optStr(r.prompt, 4000) || !optStr(r.chapterId, 100)) return 'bad attempt text';
  }
  return null;
}

// stores = { attempts:[], sessions:[], ... }. Returns {ok, errors, counts}.
export function validateDump(stores) {
  const errors = [];
  const counts = {};
  if (!stores || typeof stores !== 'object' || Array.isArray(stores)) return { ok: false, errors: ['stores missing'], counts };
  let total = 0;
  for (const name of Object.keys(stores)) {
    if (!DATA_STORES.includes(name)) { errors.push('unknown store: ' + String(name).slice(0, 40)); continue; }
    const arr = stores[name];
    if (!Array.isArray(arr)) { errors.push(name + ' is not a list'); continue; }
    counts[name] = arr.length;
    total += arr.length;
    if (total > MAX_RECORDS) { errors.push('too many records'); break; }
    const ids = new Set();
    for (let i = 0; i < arr.length && errors.length < 10; i++) {
      const bad = validateRecord(name, arr[i]);
      if (bad) { errors.push(name + '[' + i + ']: ' + bad); continue; }
      const k = arr[i][STORES[name].keyPath];
      if (ids.has(k)) errors.push(name + '[' + i + ']: duplicate key');
      ids.add(k);
    }
  }
  return { ok: errors.length === 0, errors, counts };
}
