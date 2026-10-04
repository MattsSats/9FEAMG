// Shared by api/parlay.js and api/og.js (files starting with _ aren't deployed as functions).
// Reads data/season.js from this deployment and finds parlays by their link name,
// using the same naming and odds math as the site (src/logic.js).
import vm from 'node:vm';

export async function loadSeason(origin) {
  const res = await fetch(new URL('/data/season.js', origin), { cache: 'no-store' });
  if (!res.ok) throw new Error('season.js ' + res.status);
  const sandbox = { window: {} };
  vm.runInNewContext(await res.text(), sandbox, { timeout: 1000 });
  return sandbox.window.SEASON;
}

export const anchorFor = (week, p) =>
  `w${week}-` + String(p.id ?? p.title ?? p.owner).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function findParlay(season, slug) {
  for (const [week, list] of Object.entries(season?.parlays || {})) {
    for (const p of list) if (anchorFor(week, p) == slug) return { week: +week, p };
  }
  return null;
}

const toDecimal = o => { const n = parseFloat(o); return isNaN(n) || n == 0 ? null : n > 0 ? 1 + n / 100 : 1 + 100 / -n; };
const toAmerican = d => d >= 2 ? '+' + Math.round((d - 1) * 100) : '−' + Math.round(100 / (d - 1));

// Everything the preview needs about one parlay.
export function describe(week, p) {
  const st = p.legs.map(l => l.status || 'open');
  const status = st.includes('miss') ? 'BUSTED' : st.length && st.every(s => s == 'hit') ? 'CASHED' : 'OPEN';
  // A ticket-level odds (same-game parlays, priced by the book as one bet) overrides the leg math.
  // Same-game groups (legs with sgp: n) are priced once, by p.sgps[n - 1].
  const parts = [], seen = new Set();
  for (const l of p.legs) {
    if (l.sgp) { if (!seen.has(l.sgp)) { seen.add(l.sgp); parts.push(p.sgps?.[l.sgp - 1] ?? null); } }
    else parts.push(l.odds ?? null);
  }
  const decs = parts.map(toDecimal), ticket = toDecimal(p.odds);
  const priced = !!ticket || (decs.length > 0 && decs.every(d => d != null));
  const dec = ticket ?? (priced ? decs.reduce((a, b) => a * b, 1) : null);
  const title = p.title ?? `${p.owner}’s parlay`;
  const who = p.owners ? p.owners.join(' + ') : title.includes(p.owner) ? null : p.owner;
  return {
    title, who, week, status,
    odds: priced ? toAmerican(dec) : null,
    payout: priced ? (10 * dec).toFixed(2) : null,
    legs: p.legs.map(l => ({ text: l.text, odds: l.sgp ? 'SGP ' + l.sgp : l.odds ? String(l.odds).replace('-', '−') : '', status: l.status || 'open' })),
    // Changes whenever odds or results change, so chat apps fetch a fresh image.
    version: `${p.odds}|${p.sgps}|` + p.legs.map(l => `${l.odds}:${l.status}`).join('|')
  };
}

export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
