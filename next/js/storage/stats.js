import * as idb from './idb.js';

// Every number comes from stored session records. Nothing is estimated or invented.
export async function totals() {
  const sessions = await idb.getAll('sessions');
  const t = { attempted: 0, correct: 0, sessions: sessions.length, byChapter: {} };
  for (const s of sessions) {
    t.attempted += s.attempted; t.correct += s.correct;
    const c = (t.byChapter[s.chapterId || 'unknown'] ||= { attempted: 0, correct: 0, sessions: 0 });
    c.attempted += s.attempted; c.correct += s.correct; c.sessions++;
  }
  t.accuracy = t.attempted ? Math.round((t.correct / t.attempted) * 100) : null;
  return t;
}
