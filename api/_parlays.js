// Shared by api/parlay.js, api/og.js, api/section.js and api/tails.js (files starting with _
// aren't deployed as functions). Reads data/season.js from this deployment (with the site's own
// Yahoo sync on top, as the site does) and finds parlays by their link name. The naming and odds
// math are the site's own, from api/_shared.js.
import vm from 'node:vm';
import { readData } from './_yahoo.js';
import { kickoffAt, ticketSlug, onTicket, toAmerican, hitChance, pct, parlayState, mergeYahoo } from './_shared.js';

export async function loadSeason(origin) {
  const res = await fetch(new URL('/data/season.js', origin), { cache: 'no-store' });
  if (!res.ok) throw new Error('season.js ' + res.status);
  const sandbox = { window: {} };
  vm.runInNewContext(await res.text(), sandbox, { timeout: 1000 });
  let yahoo = null;
  try { yahoo = await readData(); } catch { /* not connected yet */ }
  return mergeYahoo(sandbox.window.SEASON, yahoo);
}

export const anchorFor = ticketSlug;
export const kickoff = kickoffAt;
// Tails lock when the ticket's first game kicks off, or once any leg is graded.
export function locked(season, week, p, now = Date.now()) {
  if (p.legs.some(l => (l.status || 'open') != 'open')) return true;
  const ks = p.legs.map(l => kickoff(season, week, l.game)).filter(Boolean);
  return ks.length > 0 && now >= Math.min(...ks);
}
// Everyone on a ticket: placedBy and tailers from season.js plus taps saved through /api/tails,
// minus anyone who said they didn't bet it (passes).
export const onIt = onTicket;

export function findParlay(season, slug) {
  for (const [week, list] of Object.entries(season?.parlays || {})) {
    for (const p of list) if (anchorFor(week, p) == slug) return { week: +week, p };
  }
  return null;
}

// Everything the preview needs about one parlay.
export function describe(week, p, taps = [], passes = []) {
  const { status, priced, dec } = parlayState(p), chance = hitChance(p);
  const title = p.title ?? `${p.owner}’s parlay`;
  // Joint tickets name both owners; a single owner is already in the "Andy's parlay" line.
  const who = p.owners ? p.owners.join(' + ') : null;
  return {
    title, who, week, status,
    by: (p.owners ? p.owners.join(' & ') : p.owner) + '’s Parlay',
    chance: status == 'OPEN' && chance != null ? pct(chance) : null,
    odds: priced ? toAmerican(dec) : null,
    payout: priced ? (10 * dec).toFixed(2) : null,
    legs: p.legs.map(l => ({ text: l.text, odds: l.sgp ? 'SGP ' + l.sgp : l.odds ? String(l.odds).replace('-', '−') : '', status: l.status || 'open' })),
    // Managers on the ticket; the owner tapping their own ticket means they placed it.
    with: onIt(p, taps, passes).map(m => (p.owners || [p.owner]).includes(m) ? `${m} (placed)` : m),
    // Changes whenever odds or results change, so chat apps fetch a fresh image.
    version: `${p.odds}|${p.sgps}|${onIt(p, taps, passes)}|` + p.legs.map(l => `${l.odds}:${l.status}`).join('|')
  };
}

export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
