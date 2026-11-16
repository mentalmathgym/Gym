// IndexedDB layer for the NEW build. Database name 'mmg3' is separate from every legacy store.
const DB_NAME = 'mmg3';
const DB_VERSION = 1;
export const STORES = {
  attempts: { keyPath: 'id', indexes: [['ts', 'ts'], ['chapterId', 'chapterId'], ['sessionId', 'sessionId']] },
  sessions: { keyPath: 'id', indexes: [['startedAt', 'startedAt'], ['chapterId', 'chapterId']] },
  mistakes: { keyPath: 'attemptId' },
  cards: { keyPath: 'itemId' },
  journal: { keyPath: 'id' },
  bookmarks: { keyPath: 'key' },
  achievements: { keyPath: 'key' },
  snapshots: { keyPath: 'id' },
  meta: { keyPath: 'key' },
};
// Learner data. 'snapshots' and 'meta' are deliberately NOT in this list: reset/replace never touch them.
export const DATA_STORES = ['attempts', 'sessions', 'mistakes', 'cards', 'journal', 'bookmarks', 'achievements'];

let dbp = null;
export function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('This browser has no IndexedDB, so progress cannot be saved.'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const os = db.createObjectStore(name, { keyPath: cfg.keyPath });
        (cfg.indexes || []).forEach(([n, p]) => os.createIndex(n, p));
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbp = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('Could not open storage'));
    req.onblocked = () => reject(new Error('Storage is blocked by another open tab. Close other tabs and retry.'));
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}

const friendly = (e) => {
  if (e && e.name === 'QuotaExceededError') return new Error('Storage is full. Export a backup and free some space.');
  return e instanceof Error ? e : new Error('Storage error');
};
async function run(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    let out;
    const t = db.transaction(stores, mode);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(friendly(t.error));
    t.onabort = () => reject(friendly(t.error || new Error('Storage transaction aborted')));
    try { fn(t, (v) => { out = v; }); } catch (e) { try { t.abort(); } catch { /* already done */ } reject(friendly(e)); }
  });
}

export const getAll = (store) => run(store, 'readonly', (t, set) => { const r = t.objectStore(store).getAll(); r.onsuccess = () => set(r.result); });
export const get = (store, key) => run(store, 'readonly', (t, set) => { const r = t.objectStore(store).get(key); r.onsuccess = () => set(r.result); });
export const count = (store) => run(store, 'readonly', (t, set) => { const r = t.objectStore(store).count(); r.onsuccess = () => set(r.result); });
export const put = (store, rec) => run(store, 'readwrite', (t) => { t.objectStore(store).put(rec); });
export const remove = (store, key) => run(store, 'readwrite', (t) => { t.objectStore(store).delete(key); });

// Insert only records whose key is not present yet. Existing records are never overwritten.
export function addMany(store, recs) {
  let added = 0, skipped = 0;
  return run(store, 'readwrite', (t, set) => {
    const os = t.objectStore(store);
    for (const rec of recs) {
      const r = os.add(rec);
      r.onsuccess = () => { added++; };
      r.onerror = (e) => { skipped++; e.preventDefault(); e.stopPropagation(); }; // duplicate key: keep the old record
    }
    t.addEventListener('complete', () => set({ added, skipped }));
  }).then(() => ({ added, skipped }));
}

export function dumpAll() {
  return run(DATA_STORES, 'readonly', (t, set) => {
    const out = {};
    let left = DATA_STORES.length;
    for (const s of DATA_STORES) {
      const r = t.objectStore(s).getAll();
      r.onsuccess = () => { out[s] = r.result; if (--left === 0) set(out); };
    }
  });
}

// All-or-nothing: clears every learner store and writes the given records in ONE transaction.
export function replaceAll(storesMap) {
  return run(DATA_STORES, 'readwrite', (t) => {
    for (const s of DATA_STORES) {
      const os = t.objectStore(s);
      os.clear();
      for (const rec of (storesMap && storesMap[s]) || []) os.put(rec);
    }
  });
}
