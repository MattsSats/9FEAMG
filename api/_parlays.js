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

// A leg's kickoff as a Date: its day and time (Central) counted from that week's Thursday.
const DAYS = { Thu: 0, Fri: 1, Sat: 2, Sun: 3, Mon: 4, Tue: 5, Wed: 6 };
export function kickoff(season, week, game) {
  const m = String(game || '').match(/^(Thu|Fri|Sat|Sun|Mon|Tue|Wed)\s+(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (!m || !season?.week1Thursday) return null;
  const d = new Date(season.week1Thursday + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7 * (week - 1) + DAYS[m[1]]);
  const h = (+m[2] % 12) + (m[4] == 'PM' ? 12 : 0), ymd = d.toISOString().slice(0, 10);
  // Central Daylight Time until the first Sunday of November, Standard after.
  const cdt = d.getUTCMonth() < 10 || (d.getUTCMonth() == 10 && d.getUTCDate() < 1 + ((7 - new Date(Date.UTC(d.getUTCFullYear(), 10, 1)).getUTCDay()) % 7));
  return new Date(`${ymd}T${String(h).padStart(2, '0')}:${m[3]}:00${cdt ? '-05:00' : '-06:00'}`);
}
// Tails lock when the ticket's first game kicks off, or once any leg is graded.
export function locked(season, week, p, now = Date.now()) {
  if (p.legs.some(l => (l.status || 'open') != 'open')) return true;
  const ks = p.legs.map(l => kickoff(season, week, l.game)).filter(Boolean);
  return ks.length > 0 && now >= Math.min(...ks);
}
// Everyone on a ticket: placedBy and tailers from season.js plus taps saved through /api/tails.
// Everyone on a ticket, minus anyone who said they didn't bet it (passes).
export const onIt = (p, taps = [], passes = []) => [...new Set([...(p.placedBy || []), ...(p.tailers || []), ...taps])].filter(m => !passes.includes(m));

export function findParlay(season, slug) {
  for (const [week, list] of Object.entries(season?.parlays || {})) {
    for (const p of list) if (anchorFor(week, p) == slug) return { week: +week, p };
  }
  return null;
}

const toDecimal = o => { const n = parseFloat(o); return isNaN(n) || n == 0 ? null : n > 0 ? 1 + n / 100 : 1 + 100 / -n; };
const impliedProb = o => { const n = parseFloat(o); return isNaN(n) || n == 0 ? null : n > 0 ? 100 / (n + 100) : -n / (-n + 100); };
// Odds-implied chance a ticket still cashes: legs that hit count as done, any miss is 0.
// A same-game group (or a ticket-level price) with some legs in is split evenly across its
// legs, so it's a rough number. Book prices include the vig, so it runs a little high.
function hitChance(p) {
  const st = l => l.status || 'open';
  if (p.legs.some(l => st(l) == 'miss')) return 0;
  const groups = [];
  if (toDecimal(p.odds)) groups.push({ odds: p.odds, legs: p.legs });
  else {
    const by = new Map();
    for (const l of p.legs) {
      if (!l.sgp) { groups.push({ odds: l.odds, legs: [l] }); continue; }
      if (!by.has(l.sgp)) by.set(l.sgp, { odds: p.sgps?.[l.sgp - 1], legs: [] });
      by.get(l.sgp).legs.push(l);
    }
    groups.push(...by.values());
  }
  let prob = 1;
  for (const g of groups) {
    const open = g.legs.filter(l => st(l) == 'open').length;
    if (!open) continue;
    const ip = impliedProb(g.odds);
    if (ip == null) return null;
    prob *= Math.pow(ip, open / g.legs.length);
  }
  return prob;
}
const pct = x => x < 0.1 ? (Math.max(x, 0.001) * 100).toFixed(1) + '%' : Math.round(x * 100) + '%';
const toAmerican = d => d >= 2 ? '+' + Math.round((d - 1) * 100) : '−' + Math.round(100 / (d - 1));

// Everything the preview needs about one parlay.
export function describe(week, p, taps = [], passes = []) {
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
    by: (p.owners ? p.owners.join(' & ') : p.owner) + '’s Parlay',
    chance: status == 'OPEN' && hitChance(p) != null ? pct(hitChance(p)) : null,
    odds: priced ? toAmerican(dec) : null,
    payout: priced ? (10 * dec).toFixed(2) : null,
    legs: p.legs.map(l => ({ text: l.text, odds: l.sgp ? 'SGP ' + l.sgp : l.odds ? String(l.odds).replace('-', '−') : '', status: l.status || 'open' })),
    // Changes whenever odds or results change, so chat apps fetch a fresh image.
    // Managers on the ticket; the owner tapping their own ticket means they placed it.
    with: onIt(p, taps, passes).map(m => (p.owners || [p.owner]).includes(m) ? `${m} (placed)` : m),
    version: `${p.odds}|${p.sgps}|${onIt(p, taps, passes)}|` + p.legs.map(l => `${l.odds}:${l.status}`).join('|')
  };
}

export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
