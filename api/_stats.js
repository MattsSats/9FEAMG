// Season numbers for the chart previews (api/section.js): standings, xW, luck and power rankings
// come from api/_shared.js, the same code the site runs. Max PF uses the box scores in
// uploads/9feamg-boxscores.json, with the site's own Yahoo sync filling weeks the file doesn't have.
import { readData } from './_yahoo.js';
import { mergeBox } from './_shared.js';
export { seasonStats, powerRanks } from './_shared.js';

export async function loadBox(origin) {
  let box = null, yahoo = null;
  try { const r = await fetch(new URL('/uploads/9feamg-boxscores.json', origin), { cache: 'no-store' }); box = r.ok ? await r.json() : null; } catch { /* none */ }
  try { yahoo = await readData(); } catch { /* not connected yet */ }
  return mergeBox(box, yahoo);
}
