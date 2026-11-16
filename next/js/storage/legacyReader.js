// READ-ONLY access to data written by the production site (same origin).
// This module never calls setItem/removeItem/clear, never writes to or deletes from any legacy database, and never creates one.
import { chapterIdFor, CHAPTERS } from '../content/registry.js';

const KEY_DATA = 'mmg_v2_data';
const KEY_BOOK = 'mmg_book_library_progress_v1';
const ARCH_DB = 'mmg_archive_v1';
const ARCH_STORE = 'rows';

const cnt = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
const str = (v) => (v == null ? null : String(v).slice(0, 2000));
const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };

export function readRaw() {
  try { return { data: localStorage.getItem(KEY_DATA), book: localStorage.getItem(KEY_BOOK) }; } catch { return { data: null, book: null }; }
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Does the legacy archive database exist? indexedDB.open() on a missing DB would CREATE it, so ask first.
async function archiveExists() {
  if (!indexedDB || typeof indexedDB.databases !== 'function') return null; // cannot verify safely
  const list = await indexedDB.databases();
  return list.some((d) => d.name === ARCH_DB);
}

// Returns {rows: Map(id -> rows[]), state: 'absent'|'read'|'unverifiable'|'error', records}
export async function readArchive() {
  let exists;
  try { exists = await archiveExists(); } catch { return { rows: new Map(), state: 'error', records: 0 }; }
  if (exists === null) return { rows: new Map(), state: 'unverifiable', records: 0 };
  if (!exists) return { rows: new Map(), state: 'absent', records: 0 };
  return new Promise((resolve) => {
    const req = indexedDB.open(ARCH_DB); // no version: never upgrades
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch { /* safety net: never create */ } };
    req.onerror = () => resolve({ rows: new Map(), state: 'error', records: 0 });
    req.onsuccess = () => {
      const db = req.result;
      try {
        if (!db.objectStoreNames.contains(ARCH_STORE)) { db.close(); return resolve({ rows: new Map(), state: 'read', records: 0 }); }
        const r = db.transaction(ARCH_STORE, 'readonly').objectStore(ARCH_STORE).getAll();
        r.onsuccess = () => {
          const rows = new Map();
          (r.result || []).forEach((x) => { if (x && x.id != null && Array.isArray(x.rows)) rows.set(String(x.id), x.rows); });
          db.close();
          resolve({ rows, state: 'read', records: rows.size });
        };
        r.onerror = () => { db.close(); resolve({ rows: new Map(), state: 'error', records: 0 }); };
      } catch { try { db.close(); } catch { /* ignore */ } resolve({ rows: new Map(), state: 'error', records: 0 }); }
    };
  });
}

// Fingerprint of everything we read, so the UI can prove nothing changed afterwards.
export async function fingerprint() {
  const raw = readRaw();
  const arch = await readArchive();
  const archText = JSON.stringify([...arch.rows.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  return {
    data: raw.data == null ? null : await sha256(raw.data),
    book: raw.book == null ? null : await sha256(raw.book),
    archive: arch.state === 'read' ? await sha256(archText) : arch.state,
  };
}

// Pure conversion. Used for the live legacy data AND for old backup files. No storage access.
export function legacyToRecords({ data, book, archive }) {
  const sessions = [];
  const attempts = [];
  const warnings = [];
  const arch = archive instanceof Map ? archive : new Map();
  let missingArchive = 0, withDetail = 0, detailGaps = 0;

  // --- Book Library history (per-question rows may be inline or archived) ---
  let bookSessA = 0, bookSessC = 0;
  for (const h of Array.isArray(book && book.history) ? book.history : []) {
    if (!h || typeof h !== 'object') continue;
    const n = cnt(h.attempted);
    if (!n) continue;
    const ts = Number(h.ts) || Date.parse(h.at) || null;
    const sid = 'legacy-book:' + String(h.id || 'ts' + ts).slice(0, 200);
    const c = Math.min(cnt(h.correct), n);
    const chapterId = chapterIdFor(h.chapterId, h.chapter);
    const mode = str(h.mode) || 'activity';
    let rows = Array.isArray(h.rows) && h.rows.length ? h.rows : null;
    if (!rows && h.arch) { rows = arch.get(String(h.id)) || null; if (!rows) missingArchive++; }
    // Only real question rows (they carry a question text); other modes store summary rows {title,a,k}.
    const qrows = (rows || []).filter((r) => r && typeof r === 'object' && typeof r.q === 'string');
    sessions.push({ id: sid, source: 'legacy-book', startedAt: ts, endedAt: ts, chapterId, chapterTitle: str(h.chapter), mode, attempted: n, correct: c, durationMs: null, detail: qrows.length });
    qrows.forEach((r, i) => attempts.push({
      id: sid + '#' + i, sessionId: sid, ts, chapterId, itemId: null, topic: null, mode,
      prompt: str(r.q), given: str(r.your), expected: str(r.correct), correct: r.ok === true, timeMs: null, source: 'legacy',
    }));
    if (qrows.length) { withDetail++; if (qrows.length !== n) detailGaps++; }
    bookSessA += n; bookSessC += c;
  }
  const bookA = cnt(book && book.attempted), bookC = Math.min(cnt(book && book.correct), bookA);

  // --- Old Admin-Studio practice history (session summaries only, no per-question rows) ---
  let dataSessA = 0, dataSessC = 0;
  const prog = (data && data.progress) || {};
  for (const h of Array.isArray(prog.history) ? prog.history : []) {
    if (!h || typeof h !== 'object') continue;
    const n = cnt(h.attempted);
    if (!n) continue;
    const ts = Date.parse(h.completedAt || '') || null;
    const sid = 'legacy-practice:' + String(h.id || 'ts' + ts).slice(0, 200);
    const c = Math.min(cnt(h.correct), n);
    sessions.push({ id: sid, source: 'legacy-practice', startedAt: ts, endedAt: ts, chapterId: chapterIdFor(h.chapterId, h.chapterTitle), chapterTitle: str(h.chapterTitle), mode: 'legacy-practice', topic: str(h.topicTitle), attempted: n, correct: c, durationMs: null, detail: 0 });
    dataSessA += n; dataSessC += c;
  }
  const dataA = cnt(prog.attempted), dataC = Math.min(cnt(prog.correct), dataA);

  // --- Counters that have no session row. Kept in totals; excluded from speed/mistake analytics. ---
  const orphan = (area, A, C, sA, sC) => {
    const a = Math.max(0, A - sA), c = Math.min(Math.max(0, C - sC), a);
    if (a > 0) sessions.push({ id: 'legacy-counter:' + area, source: 'legacy-counter', startedAt: null, endedAt: null, chapterId: 'unknown', chapterTitle: null, mode: 'counter', attempted: a, correct: c, durationMs: null, detail: 0 });
    return { a, c };
  };
  const ob = orphan('book', bookA, bookC, bookSessA, bookSessC);
  const od = orphan('data', dataA, dataC, dataSessA, dataSessC);

  const registryIds = new Set(CHAPTERS.map((c) => c.id));
  const custom = (Array.isArray(data && data.chapters) ? data.chapters : []).filter((c) => c && !registryIds.has(c.id));
  if (custom.length) warnings.push(custom.length + ' chapter(s) created in the old Admin Studio are not copied. They stay on the production site.');
  if (missingArchive) warnings.push(missingArchive + ' session(s) had their per-question rows archived in the old site but the archive was not readable. Session totals are kept; question details are not.');
  if (detailGaps) warnings.push(detailGaps + ' session(s) have fewer question rows than attempts. Totals are kept; the missing detail is not invented.');

  const totalA = sessions.reduce((n, s) => n + s.attempted, 0);
  const totalC = sessions.reduce((n, s) => n + s.correct, 0);
  const legacyA = bookA + dataA, legacyC = bookC + dataC;
  return {
    sessions, attempts, warnings,
    summary: {
      legacyAttempted: legacyA, legacyCorrect: legacyC, importedAttempted: totalA, importedCorrect: totalC,
      reconciled: totalA === Math.max(legacyA, 0) && totalC === legacyC,
      sessions: sessions.length, questionRows: attempts.length, sessionsWithDetail: withDetail,
      counterOnlyAttempts: ob.a + od.a, customChapters: custom.length,
    },
  };
}

export function legacyBackupToRecords(obj) {
  return legacyToRecords({ data: obj && obj.data, book: obj && obj.bookProgress, archive: null });
}
export const isLegacyBackup = (obj) => !!obj && typeof obj === 'object' && (obj.format === 'MMG-JSON' || obj.format === 'MMG-PROFILE-BACKUP');

// Scan the live legacy data on this device (read-only).
export async function scan() {
  const raw = readRaw();
  const data = parse(raw.data), book = parse(raw.book);
  const arch = await readArchive();
  const found = !!(data || book);
  const result = found ? legacyToRecords({ data, book, archive: arch.rows }) : null;
  return { found, archiveState: arch.state, archiveRecords: arch.records, result, rawBytes: { data: (raw.data || '').length, book: (raw.book || '').length } };
}
