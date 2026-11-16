// Chapter registry: ONLY ids, numbers and titles, taken from the BOOK_LIBRARY embedded in the production index.html (v2.7.2 RC).
// This is a PROVISIONAL reference, not the final book text. The final PDF/manuscript has not been supplied yet.
// legacyTitle = older title used by earlier versions; needed to match old progress records that lack a chapterId.
export const CONTENT_STATUS = 'provisional';
export const PROVISIONAL_LABEL = 'PROVISIONAL — Awaiting Final Book Manuscript';

export const CHAPTERS = [
  { id: 'ch-foundations', num: 1, title: 'Foundations of Mathematics', legacyTitle: 'Foundations: Fast Adding and Subtracting' },
  { id: 'ch-multiplication', num: 2, title: 'Multiplication', legacyTitle: 'Multiplication Shortcuts' },
  { id: 'ch-squares-cubes', num: 3, title: 'Squares, Cubes and Powers' },
  { id: 'ch-division', num: 4, title: 'Division', legacyTitle: 'Division and Divisibility' },
  { id: 'ch-fractions-decimals', num: 5, title: 'Fractions, Decimals and Percentages', legacyTitle: 'Fractions, Decimals and Percent' },
  { id: 'ch-estimation', num: 6, title: 'Estimation and Elimination' },
  { id: 'ch-mental-algebra', num: 7, title: 'Mental Algebra' },
  { id: 'ch-word-problems', num: 8, title: 'Word Problems' },
  { id: 'ch-number-properties', num: 9, title: 'Number Properties' },
  { id: 'ch-doomsday', num: 10, title: 'Doomsday Calendar Algorithm', legacyTitle: 'The Doomsday Calendar Algorithm: From Beginner to Advanced' },
];
export const chapterIds = () => CHAPTERS.map((c) => c.id);
export const getChapter = (id) => CHAPTERS.find((c) => c.id === id) || null;

// Map an old record to a stable chapter id. Falls back to the old id/title, or 'unknown'.
export function chapterIdFor(oldId, oldTitle) {
  if (oldId && getChapter(oldId)) return oldId;
  if (oldTitle) {
    const c = CHAPTERS.find((x) => x.title === oldTitle || x.legacyTitle === oldTitle);
    if (c) return c.id;
  }
  return oldId ? String(oldId).slice(0, 80) : 'unknown';
}
