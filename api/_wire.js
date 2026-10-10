// The Wire tab's numbers for link previews (/s/wire-week, /s/wire-season): adds per manager, each
// record, and the Wire line, from api/_shared.js (the same code the site runs).
import { wireOf as wire, pointsOf } from './_shared.js';

export async function loadTx(origin) {
  try { const r = await fetch(new URL('/uploads/9feamg-transactions.json', origin), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; }
}

export const wireOf = (season, tx, box, mode, now = Date.now()) => wire(season, tx, (name, w) => pointsOf(season, box, name, w), mode, now);
