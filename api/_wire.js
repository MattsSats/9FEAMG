// The Wire tab's numbers for link previews (/s/wire-week, /s/wire-season), worked out the same way
// as the site (src/logic.js, "Wire"): this fantasy week's or the season's adds per manager, each
// manager's record, and the Wire line (drop regret, best pickup, adds vs record, or no adds).
import { kickoff } from './_parlays.js';
import { seasonStats } from './_stats.js';

export async function loadTx(origin) {
  try { const r = await fetch(new URL('/uploads/9feamg-transactions.json', origin), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; }
}

const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// "Oct 9, 1:39 pm" is Central time (daylight until the first Sunday of November).
function parseWhen(s, year) {
  const m = String(s).match(/(\w+) (\d+), (\d+):(\d+) (am|pm)/);
  if (!m) return new Date(Date.UTC(year, 8, 1));
  let h = +m[3] % 12; if (m[5] == 'pm') h += 12;
  const mo = MON[m[1]], d = +m[2], firstSun = 1 + ((7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7);
  const cdt = mo < 10 || (mo == 10 && d < firstSun);
  return new Date(Date.UTC(year, mo, d, h + (cdt ? 5 : 6), +m[4]));
}
const NFL_ALIAS = { WSH: 'WAS', JAC: 'JAX', LA: 'LAR' };
const nflKey = t => { const u = String(t || '').toUpperCase(); return NFL_ALIAS[u] || u; };
const lastName = n => { const w = String(n || '').split(' ').filter(x => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(x)); return w.length > 1 ? w.slice(1).join(' ') : w[0] || ''; };
const f2 = n => n.toFixed(2);

export function wireOf(season, tx, box, mode, now = Date.now()) {
  const MGR = season.managers.map(x => x.m), st = seasonStats(season, null), LW = season.live?.week, NF = st.NF;
  const ST = [...st.rows].sort((a, b) => b.w - a.w || b.pf - a.pf), recOf = m => { const r = ST.find(x => x.m == m); return r.w + '–' + r.l; };
  const seasonMode = mode == 'season', when = t => parseWhen(t.when, season.year);
  // This fantasy week: from the end of last week's last game (kickoff + 3.5 hours).
  const weekEnd = w => { const ks = (season.nfl?.[w]?.games || []).map(g => kickoff(season, w, g)?.getTime()).filter(Boolean);
    return new Date((ks.length ? Math.max(...ks) : kickoff(season, w, 'Mon 7:15 PM').getTime()) + 3.5 * 36e5); };
  let wk = 1; while (wk < season.regularSeasonWeeks && now >= weekEnd(wk).getTime()) wk++;
  const cut = wk > 1 ? weekEnd(wk - 1) : new Date(Date.UTC(season.year, 7, 1));
  const adds = Object.fromEntries(MGR.map(m => [m, 0])), wkAdds = {};
  tx.forEach(t => { if (t.action == 'add' && t.manager in adds) { adds[t.manager]++; if (when(t) >= cut) wkAdds[t.manager] = (wkAdds[t.manager] || 0) + 1; } });
  const n = m => seasonMode ? adds[m] : wkAdds[m] || 0;
  const rows = [...MGR].sort((a, b) => n(b) - n(a)).map(m => ({ ...season.managers.find(x => x.m == m), n: n(m), rec: recOf(m) }));
  // The line, as the site writes it.
  const byAdds = [...MGR].sort((a, b) => adds[b] - adds[a]), top = byAdds[0];
  const sorted = byAdds.map(m => adds[m]).sort((a, b) => a - b), mid = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  const light = MGR.filter(m => adds[m] < median), place = m => ST.findIndex(x => x.m == m);
  const pickLow = not => (light.length ? light : MGR).filter(m => m != not).sort((a, b) => place(a) - place(b))[0];
  const pts = (name, w) => {
    if (w == LW) return season.live?.playerPoints?.[name] ?? null;
    for (const t of Object.values(box?.weeks?.[w] || {})) { const p = [...t.starters, ...t.bench].find(x => x[1] == name); if (p) return p[4]; }
    return null;
  };
  const gameAt = (nfl, w) => { const g = (season.nfl?.[w]?.games || []).find(g => { const x = g.match(/·\s*(\S+)\s*@\s*(\S+)/); return x && [nflKey(x[1]), nflKey(x[2])].includes(nflKey(nfl)); }); return kickoff(season, w, g || 'Sun 12:00 PM'); };
  const ptsSince = (t, at) => { let s = 0; for (let w = 1; w <= (LW || NF); w++) { const k = gameAt(t.nfl, w); if (k && k > at) s += pts(t.player, w) || 0; } return s; };
  const who = t => t.pos == 'DEF' ? `the ${t.player} defense` : lastName(t.player);
  const inWin = tx.filter(t => when(t) >= cut), dayOf = d => d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const regret = inWin.filter(t => t.action == 'drop').map(d => {
    const at = when(d), pick = tx.filter(t => t.action == 'add' && t.player == d.player && t.manager != d.manager && when(t) >= at).sort((a, b) => when(a) - when(b))[0];
    return pick ? { d, pick, pts: ptsSince(d, when(pick)) } : null;
  }).filter(x => x && x.pts > 0).sort((a, b) => b.pts - a.pts)[0];
  const pickup = inWin.filter(t => t.action == 'add').map(a => ({ a, pts: ptsSince(a, when(a)) })).filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts)[0];
  const topWk = Object.keys(wkAdds).sort((a, b) => wkAdds[b] - wkAdds[a])[0];
  const addsVsRecord = (m, lead) => {
    const low = pickLow(m), x = ST.find(s => s.m == m), y = ST.find(s => s.m == low);
    const end = x.w - x.l > y.w - y.l ? 'Turns out the waiver wire works.' : x.w - x.l < y.w - y.l ? 'Busy is not the same as good.'
      : `Same record, ${adds[m] - adds[low]} more trip${adds[m] - adds[low] == 1 ? '' : 's'} to the waiver wire.`;
    return `${lead} ${low} has made ${adds[low]}${seasonMode ? '' : ' all season'} and is ${recOf(low)}. ${end}`;
  };
  const line = seasonMode ? addsVsRecord(top, `${top} leads the league with ${adds[top]} adds and is ${recOf(top)}.`)
    : regret ? `${regret.d.manager} dropped ${who(regret.d)}. ${regret.pick.manager} picked ${regret.d.pos == 'DEF' ? 'it' : 'him'} up, and ${regret.d.pos == 'DEF' ? 'that defense' : lastName(regret.d.player)} has ${f2(regret.pts)} since.`
    : pickup ? `${pickup.a.manager} picked up ${who(pickup.a)} on ${dayOf(when(pickup.a))}. ${f2(pickup.pts)} since.`
    : topWk ? addsVsRecord(topWk, `${topWk} made ${wkAdds[topWk]} adds this week and is ${recOf(topWk)}.`)
    : 'Nobody has added anyone this week. Suspiciously quiet.';
  return { mode: seasonMode ? 'season' : 'week', wk, rows, line, total: rows.reduce((s, r) => s + r.n, 0) };
}
