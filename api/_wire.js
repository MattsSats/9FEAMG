// The Wire tab's numbers for link previews (/s/wire-week, /s/wire-season): adds per manager, each
// record, and the Wire line, from api/_shared.js (the same code the site runs).
import { wireOf as wire, pointsOf, mergeTx } from './_shared.js';
import { readData } from './_yahoo.js';

// The transactions file with Yahoo's newer moves from /api/league on top (api/_shared.js mergeTx).
export async function loadTx(origin) {
  let tx = null, yahoo = null;
  try { const r = await fetch(new URL('/uploads/9feamg-transactions.json', origin), { cache: 'no-store' }); tx = r.ok ? await r.json() : null; } catch { return null; }
  try { yahoo = await readData(); } catch { /* the file alone then */ }
  return tx && mergeTx(tx, yahoo);
}

export const wireOf = (season, tx, box, mode, now = Date.now()) => wire(season, tx, (name, w) => pointsOf(season, box, name, w), mode, now);
