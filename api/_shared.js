// One copy of the league math, used by the site and the server so they can't drift apart.
//   Server: api/* import it like any module.
//   Site: build.cjs pastes it into src/logic.js at /*SHARED*/ (dropping the `export`s), so the
//   names below are globals there. Keep it pure: no imports, no window, no fetch, and no names
//   that src/logic.js also declares.
// Every function takes the season data (data/season.js, after mergeYahoo) it needs.

// ---- Time: everything is US Central ----
export const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const KICK_DAYS = { Thu: 0, Fri: 1, Sat: 2, Sun: 3, Mon: 4, Tue: 5, Wed: 6 };
// Central Daylight Time until the first Sunday of November (month 0-based).
const isCDT = (y, mo, d) => mo < 10 || (mo == 10 && d < 1 + ((7 - new Date(Date.UTC(y, 10, 1)).getUTCDay()) % 7));
// A game's kickoff as a Date, from its day and Central time ('Sun 12:00 PM · CHI @ GB'),
// counted from that week's Thursday.
export function kickoffAt(season, week, game) {
  const m = String(game || '').match(/^(Thu|Fri|Sat|Sun|Mon|Tue|Wed)\s+(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (!m || !season?.week1Thursday) return null;
  const d = new Date(season.week1Thursday + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7 * (week - 1) + KICK_DAYS[m[1]]);
  const h = (+m[2] % 12) + (m[4] == 'PM' ? 12 : 0), ymd = d.toISOString().slice(0, 10);
  return new Date(`${ymd}T${String(h).padStart(2, '0')}:${m[3]}:00${isCDT(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) ? '-05:00' : '-06:00'}`);
}
// A transaction time ("Oct 9, 1:39 pm", Central) as a Date, wherever the code runs.
export function parseCT(s, year) {
  const m = String(s || '').match(/(\w+) (\d+), (\d+):(\d+) (am|pm)/);
  if (!m) return new Date(Date.UTC(year, 8, 1));
  let h = +m[3] % 12; if (m[5] == 'pm') h += 12;
  const mo = MON[m[1]], d = +m[2];
  return new Date(Date.UTC(year, mo, d, h + (isCDT(year, mo, d) ? 5 : 6), +m[4]));
}
// When a week is over: its last kickoff (Monday night when the schedule isn't on file) plus 3.5 hours.
export function weekEndAt(season, w) {
  const ks = (season.nfl?.[w]?.games || []).map(g => kickoffAt(season, w, g)?.getTime()).filter(Boolean);
  return new Date((ks.length ? Math.max(...ks) : kickoffAt(season, w, 'Mon 7:15 PM').getTime()) + 3.5 * 36e5);
}
// The fantasy week a moment falls in, and when it started (the end of the week before).
export function fantasyWeekAt(season, now = Date.now()) {
  let wk = 1; while (wk < season.regularSeasonWeeks && now >= weekEndAt(season, wk).getTime()) wk++;
  return { wk, start: wk > 1 ? weekEndAt(season, wk - 1) : new Date(Date.UTC(season.year, 7, 1)) };
}

// ---- NFL schedule: a team's game this week, and byes ----
// Roster files spell a few teams differently (Was/WSH, Jac/JAX), so compare normalized.
const NFL_ALIAS = { WSH: 'WAS', JAC: 'JAX', LA: 'LAR' };
export const nflKey = t => { const u = String(t || '').toUpperCase(); return NFL_ALIAS[u] || u; };
export const nflGameOf = (season, team, wk) => (season?.nfl?.[wk]?.games || []).find(g => { const m = g.match(/·\s*(\S+)\s*@\s*(\S+)/); return m && [nflKey(m[1]), nflKey(m[2])].includes(nflKey(team)); }) || null;
export const onByeOf = (season, team, wk) => (season?.nfl?.[wk]?.byes || []).map(nflKey).includes(nflKey(team));

// ---- Names ----
export const lastName = n => { const w = String(n || '').split(' ').filter(x => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(x)); return w.length > 1 ? w.slice(1).join(' ') : w[0] || ''; };
export const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// A ticket's link and tails key: 'w5-ground-and-pound' (id, else title, else owner).
export const ticketSlug = (wk, p) => `w${wk}-` + slugOf(p.id ?? p.title ?? p.owner);

// ---- Parlays ----
export const toDecimal = o => { const n = parseFloat(o); return isNaN(n) || n == 0 ? null : n > 0 ? 1 + n / 100 : 1 + 100 / -n; };
export const toAmerican = d => d >= 2 ? '+' + Math.round((d - 1) * 100) : '−' + Math.round(100 / (d - 1));
// The book's implied chance of a leg hitting (includes the book's cut).
export const impliedProb = o => { const n = parseFloat(o); return isNaN(n) || n == 0 ? null : n > 0 ? 100 / (n + 100) : -n / (-n + 100); };
export const pct = x => x < 0.1 ? (Math.max(x, 0.001) * 100).toFixed(1) + '%' : Math.round(x * 100) + '%';
// The priced pieces of a ticket, multiplied together for the parlay odds: one per same-game
// group (legs with sgp: n, priced by p.sgps[n - 1]) plus one per other leg.
export function parlayParts(p) {
  const parts = [], seen = new Set();
  for (const l of p.legs) {
    if (l.sgp) { if (!seen.has(l.sgp)) { seen.add(l.sgp); parts.push(p.sgps?.[l.sgp - 1] ?? null); } }
    else parts.push(l.odds ?? null);
  }
  return parts;
}
// A ticket's state from its legs (any miss = BUSTED, all hit = CASHED, else OPEN) and its price.
// A ticket-level price (the book's, for the whole slip) overrides the leg math.
export function parlayState(p) {
  const st = p.legs.map(l => l.status || 'open');
  const status = st.includes('miss') ? 'BUSTED' : st.length && st.every(s => s == 'hit') ? 'CASHED' : 'OPEN';
  if (toDecimal(p.odds)) return { status, priced: true, dec: toDecimal(p.odds) };
  const decs = parlayParts(p).map(toDecimal), priced = decs.length > 0 && decs.every(d => d != null);
  return { status, priced, dec: priced ? decs.reduce((a, b) => a * b, 1) : null };
}
// Odds-implied chance a ticket still cashes: legs that hit count as done, any miss is 0.
// A same-game group (or a ticket-level price) with some legs in is split evenly across its
// legs, so it's a rough number. Book prices include the vig, so it runs a little high.
export function hitChance(p) {
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
// Everyone on a ticket (placedBy, tailers, "I'm on it" taps), minus anyone who said they didn't bet it.
export const onTicket = (p, taps = [], passes = []) => [...new Set([...(p.placedBy || []), ...(p.tailers || []), ...taps])].filter(m => !passes.includes(m));

// ---- Season stats ----
// Max PF: the best legal lineup each final week from that week's starters + bench (IR can't
// start). Filling the fixed slots with the top scorers at each position, then the FLEX with the
// best remaining RB/WR/TE, is optimal for this lineup shape. Rows are [slot, name, nfl, pos, pts, proj].
const LINEUP = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'K', 'DEF'], FLEX_POS = ['RB', 'WR', 'TE'];
export function optimalLineup(players) {
  const pool = players.filter(p => p[0] != 'IR').map(p => ({ pos: p[3], pts: p[4] })).sort((a, b) => b.pts - a.pts);
  const take = ok => { const i = pool.findIndex(p => ok(p.pos)); return i < 0 ? 0 : pool.splice(i, 1)[0].pts; };
  return LINEUP.reduce((t, slot) => t + take(pos => pos == slot), 0) + take(pos => FLEX_POS.includes(pos));
}
// Record, points, expected wins (xW: each week's score ranked against the whole league) and luck
// (W − xW) per manager through the final weeks; max is null unless every week's box score is there.
export function seasonStats(season, box) {
  const MGR = season.managers.map(x => x.m), SC = season.scores, PAIRS = season.schedule;
  const NF = Math.max(0, ...MGR.map(m => (SC[m] || []).length));
  const opp = (m, w) => { const p = (PAIRS[w] || []).find(p => p.includes(m)); return p ? (p[0] == m ? p[1] : p[0]) : null; };
  const rows = MGR.map(m => {
    let w = 0, l = 0, pf = 0, pa = 0, xw = 0, max = 0;
    for (let i = 1; i <= NF; i++) {
      const o = opp(m, i); if (!o) continue;
      const s = SC[m][i - 1];
      pf += s; pa += SC[o][i - 1];
      s > SC[o][i - 1] ? w++ : l++;
      xw += MGR.filter(x => x != m && SC[x][i - 1] < s).length / (MGR.length - 1);
      const bx = box?.weeks?.[i]?.[m];
      max = max == null || !bx ? null : max + optimalLineup([...bx.starters, ...bx.bench]);
    }
    const mg = season.managers.find(x => x.m == m);
    return { m, init: mg.init, hue: mg.hue, w, l, pf, pa, xw, luck: Math.round((w - xw) * 100) / 100, max };
  });
  return { NF, rows, maxOk: rows.every(r => r.max != null) };
}
// Standings order: wins, then points for.
export const byStandings = (a, b) => b.w - a.w || b.pf - a.pf;
// Power rankings through week n, 0–100: half season all-play win %, a quarter actual win %,
// a quarter all-play win % over the last two weeks (form). Ties go to PF.
export function powerRanks(season, n) {
  const MGR = season.managers.map(x => x.m), SC = season.scores, PAIRS = season.schedule, k = MGR.length - 1;
  const opp = (m, w) => { const p = (PAIRS[w] || []).find(p => p.includes(m)); return p ? (p[0] == m ? p[1] : p[0]) : null; };
  return MGR.map(m => {
    let ap = 0, apW = 0, w = 0, g = 0, form = 0, fg = 0, pf = 0;
    for (let i = 1; i <= n; i++) {
      const o = opp(m, i); if (!o) continue;
      const a = MGR.filter(x => x != m && SC[x][i - 1] < SC[m][i - 1]).length;
      ap += a / k; apW += a; g++; pf += SC[m][i - 1];
      if (SC[m][i - 1] > SC[o][i - 1]) w++;
      if (i > n - 2) { form += a / k; fg++; }
    }
    const score = g ? 100 * (0.5 * ap / g + 0.25 * w / g + 0.25 * (fg ? form / fg : 0)) : 0;
    return { m, score, pf, wl: w + '–' + (g - w), ap: apW + '–' + (g * k - apW) };
  }).sort((a, b) => b.score - a.score || b.pf - a.pf);
}

// ---- Yahoo (the site's own sync, /api/league) on top of data/season.js ----
// Yahoo fills final scores and the schedule. For the live week the newer source wins: Yahoo's
// numbers replace season.js's only when Yahoo was read after season.js's live.asOf, so a hand
// update on a Sunday night isn't covered up by the morning's Yahoo pull.
export function mergeYahoo(S, Y) {
  if (!S || !Y?.weeks) return S;
  const ws = Object.keys(Y.weeks).map(Number).sort((a, b) => a - b);
  const full = w => S.managers.every(x => Y.weeks[w].teams?.[x.m]);
  S = { ...S, schedule: { ...S.schedule }, scores: Object.fromEntries(S.managers.map(x => [x.m, [...(S.scores[x.m] || [])]])) };
  for (const w of ws) {
    const Wk = Y.weeks[w];
    if (!full(w)) continue;
    if (!S.schedule[w] && Wk.matchups?.length == S.managers.length / 2) S.schedule[w] = Wk.matchups;
    if (Wk.status == 'postevent' && w <= S.regularSeasonWeeks) for (const x of S.managers) { const a = S.scores[x.m]; if (a.length >= w - 1) a[w - 1] = Wk.teams[x.m].pts; }
  }
  const live = ws.find(w => Y.weeks[w].status == 'midevent' && full(w));
  if (live) {
    const Wk = Y.weeks[live], same = S.live?.week == live;
    const ahead = S.live?.week > live, older = same && S.live?.asOf && Date.parse(Y.syncedAt) <= Date.parse(S.live.asOf);
    if (!ahead && !older) {
      const pp = { ...(same ? S.live.playerPoints : {}) };
      for (const t of Object.values(Wk.box || {})) for (const r of [...t.starters, ...t.bench]) if (r[4]) pp[r[1]] = r[4];
      S.live = { status: 'Live', sheetNote: 'Live from Yahoo. Orange = points so far; the rest are projections.', ...(same ? S.live : {}), week: live, playerPoints: pp, asOf: Y.syncedAt,
        scores: Object.fromEntries(S.managers.map(x => [x.m, [Wk.teams[x.m].pts, Wk.teams[x.m].proj]])) };
    }
  } else if (S.live && Y.weeks[S.live.week]?.status == 'postevent' && full(S.live.week)) S.live = null;
  return S;
}
// Yahoo's box scores fill the final weeks the uploads file doesn't have.
export function mergeBox(box, Y) {
  for (const [w, Wk] of Object.entries(Y?.weeks || {})) if (Wk.status == 'postevent' && Wk.box && !box?.weeks?.[w]) { box ||= { weeks: {} }; box.weeks ||= {}; box.weeks[w] = Wk.box; }
  return box;
}
// A player's fantasy points in a week: live points for the live week, else that week's box score.
export function pointsOf(season, box, name, w) {
  if (w == season.live?.week) return season.live?.playerPoints?.[name] ?? null;
  for (const t of Object.values(box?.weeks?.[w] || {})) { const p = [...t.starters, ...t.bench].find(x => x[1] == name); if (p) return p[4]; }
  return null;
}

// ---- Lineup alerts (live week) ----
// Starters a lineup needs (Yahoo: QB, 2 RB, 2 WR, TE, W/R/T, K, DEF).
export const SLOTS = { QB: 1, RB: 2, WR: 2, TE: 1, WRT: 1, K: 1, DEF: 1 };
// Starters who can't score and empty slots. A player's Out alert clears at his kickoff (Sunday noon
// when his game isn't on file); bye and empty-slot alerts clear at the week's last kickoff
// (Monday night when the schedule isn't on file), when nothing can be swapped in any more.
export function lineupIssues(season, starters, wk, livePts = {}, now = Date.now()) {
  const games = season.nfl?.[wk]?.games || [];
  const lastKick = games.length ? Math.max(0, ...games.map(g => kickoffAt(season, wk, g)?.getTime() || 0)) : kickoffAt(season, wk, 'Mon 7:15 PM')?.getTime() || 0;
  const open = now < lastKick, bye = [], out = [], empty = [];
  for (const p of starters) {
    if (livePts[p.name] != null) continue;
    if (onByeOf(season, p.nfl, wk)) { if (open) bye.push(p); continue; }
    const k = kickoffAt(season, wk, nflGameOf(season, p.nfl, wk) || 'Sun 12:00 PM');
    if (k && now >= k.getTime()) continue;
    if (['O', 'IR'].includes(String(p.inj || '').toUpperCase())) out.push(p);
  }
  if (open) {
    const have = {}; starters.forEach(p => { have[p.pos] = (have[p.pos] || 0) + 1; });
    for (const [k, n] of Object.entries(SLOTS)) for (let i = have[k] || 0; i < n; i++) empty.push(k);
  }
  return { open, bye, out, empty };
}

// ---- The Wire: adds per manager and the line at the top of the tab ----
// "This week" is the fantasy week (from the end of last Monday night's game); Season is everything.
// The line is the first of these that's true, so the joke always matches the numbers:
//   1. Drop regret (this week): a player dropped in the window who has scored the most since another
//      manager picked him up.
//   2. Best pickup (this week): the add in the window with the most points since.
//   3. Adds vs record (Season, or this week when 1-2 don't apply): the busiest adder against the
//      best record among the light adders (fewer season adds than the league median).
//   4. No adds in the window.
// "Since" counts a player's points in games that kicked off after the move (Sunday noon for weeks
// without a schedule on file). ptsOf(name, week) gives a player's points. Never FAAB amounts.
export function wireOf(season, tx, ptsOf, mode, now = Date.now()) {
  const MGR = season.managers.map(x => x.m), st = seasonStats(season, null), LW = season.live?.week, NF = st.NF;
  const ST = [...st.rows].sort(byStandings), recOf = m => { const r = ST.find(x => x.m == m); return r.w + '–' + r.l; };
  const seasonMode = mode == 'season', when = t => parseCT(t.when, season.year);
  const { wk, start: cut } = fantasyWeekAt(season, now);
  const adds = Object.fromEntries(MGR.map(m => [m, 0])), wkAdds = {};
  tx.forEach(t => { if (t.action == 'add' && t.manager in adds) { adds[t.manager]++; if (when(t) >= cut) wkAdds[t.manager] = (wkAdds[t.manager] || 0) + 1; } });
  const n = m => seasonMode ? adds[m] : wkAdds[m] || 0;
  const rows = [...MGR].sort((a, b) => n(b) - n(a)).map(m => ({ ...season.managers.find(x => x.m == m), n: n(m), rec: recOf(m) }));
  const byAdds = [...MGR].sort((a, b) => adds[b] - adds[a]), top = byAdds[0];
  const sorted = byAdds.map(m => adds[m]).sort((a, b) => a - b), mid = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
  const light = MGR.filter(m => adds[m] < median), place = m => ST.findIndex(x => x.m == m);
  const pickLow = not => (light.length ? light : MGR).filter(m => m != not).sort((a, b) => place(a) - place(b))[0];
  const gameAt = (nfl, w) => kickoffAt(season, w, nflGameOf(season, nfl, w) || 'Sun 12:00 PM');
  const ptsSince = (t, at) => { let s = 0; for (let w = 1; w <= (LW || NF); w++) { const k = gameAt(t.nfl, w); if (k && k > at) s += ptsOf(t.player, w) || 0; } return s; };
  const who = t => t.pos == 'DEF' ? `the ${t.player} defense` : lastName(t.player);
  const f2 = x => x.toFixed(2), s = (k, w) => k + (w == 1 ? '' : 's');
  const inWin = tx.filter(t => when(t) >= cut), dayOf = d => d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const regret = inWin.filter(t => t.action == 'drop').map(d => {
    const at = when(d), pick = tx.filter(t => t.action == 'add' && t.player == d.player && t.manager != d.manager && when(t) >= at).sort((a, b) => when(a) - when(b))[0];
    return pick ? { d, pick, pts: ptsSince(d, when(pick)) } : null;
  }).filter(x => x && x.pts > 0).sort((a, b) => b.pts - a.pts)[0];
  const pickup = inWin.filter(t => t.action == 'add').map(a => ({ a, pts: ptsSince(a, when(a)) })).filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts)[0];
  const topWk = Object.keys(wkAdds).sort((a, b) => wkAdds[b] - wkAdds[a])[0];
  const addsVsRecord = (m, lead) => {
    const low = pickLow(m), x = ST.find(r => r.m == m), y = ST.find(r => r.m == low);
    const end = x.w - x.l > y.w - y.l ? 'Turns out the waiver wire works.' : x.w - x.l < y.w - y.l ? 'Busy is not the same as good.'
      : adds[m] > adds[low] ? `Same record, ${adds[m] - adds[low]} more ${s('trip', adds[m] - adds[low])} to the waiver wire.` : 'Same record either way.';
    return `${lead} ${low} has made ${adds[low]}${seasonMode ? '' : ' all season'} and is ${recOf(low)}. ${end}`;
  };
  const line = seasonMode ? addsVsRecord(top, `${top} leads the league with ${adds[top]} ${s('add', adds[top])} and is ${recOf(top)}.`)
    : regret ? `${regret.d.manager} dropped ${who(regret.d)}. ${regret.pick.manager} picked ${regret.d.pos == 'DEF' ? 'it' : 'him'} up, and ${regret.d.pos == 'DEF' ? 'that defense' : lastName(regret.d.player)} has ${f2(regret.pts)} since.`
    : pickup ? `${pickup.a.manager} picked up ${who(pickup.a)} on ${dayOf(when(pickup.a))}. ${f2(pickup.pts)} since.`
    : topWk ? addsVsRecord(topWk, `${topWk} made ${wkAdds[topWk]} ${s('add', wkAdds[topWk])} this week and is ${recOf(topWk)}.`)
    : 'Nobody has added anyone this week. Suspiciously quiet.';
  return { mode: seasonMode ? 'season' : 'week', wk, cut, adds, wkAdds, rows, line, total: rows.reduce((a, r) => a + r.n, 0) };
}
