// One copy of the league math, used by the site and the server so they can't drift apart.
//   Server: api/* import it like any module.
//   Site: build.cjs pastes it into src/logic.js at /*SHARED*/ (dropping the `export`s), so the
//   names below are globals there. Keep it pure: no imports, no window, no fetch, and no names
//   that src/logic.js also declares.
// Every function takes the season data (data/season.js, after mergeYahoo) it needs.

// ---- Time: everything is US Central ----
export const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// Days from the week's Thursday. A Wednesday game (the opener, Christmas) is the day before it.
const KICK_DAYS = { Wed: -1, Thu: 0, Fri: 1, Sat: 2, Sun: 3, Mon: 4, Tue: 5 };
// Central Daylight Time from the second Sunday of March until the first Sunday of November
// (month 0-based), so the January weeks (17 and 18) are Standard Time.
const nthSun = (y, mo, n) => 1 + ((7 - new Date(Date.UTC(y, mo, 1)).getUTCDay()) % 7) + 7 * (n - 1);
const isCDT = (y, mo, d) => (mo > 2 && mo < 10) || (mo == 2 && d >= nthSun(y, 2, 2)) || (mo == 10 && d < nthSun(y, 10, 1));
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
// A transaction time ("Oct 9, 1:39 pm", Central) as a Date, wherever the code runs. Yahoo leaves
// the year off, so January to June moves belong to the year after the season's.
export function parseCT(s, year) {
  const m = String(s || '').match(/(\w+) (\d+), (\d+):(\d+) (am|pm)/);
  if (!m) return new Date(Date.UTC(year, 8, 1));
  let h = +m[3] % 12; if (m[5] == 'pm') h += 12;
  const mo = MON[m[1]], d = +m[2], y = mo < 6 ? year + 1 : year;
  return new Date(Date.UTC(y, mo, d, h + (isCDT(y, mo, d) ? 5 : 6), +m[4]));
}
// When a week is over: its last kickoff (Monday night when the schedule isn't on file) plus 3.5 hours.
export function weekEndAt(season, w) {
  const ks = (season.nfl?.[w]?.games || []).map(g => kickoffAt(season, w, g)?.getTime()).filter(Boolean);
  return new Date((ks.length ? Math.max(...ks) : kickoffAt(season, w, 'Mon 7:15 PM').getTime()) + 3.5 * 36e5);
}
// The NFL regular season's weeks: the fantasy playoffs (15 to 17) run past regularSeasonWeeks.
const NFL_WEEKS = 18;
// The fantasy week a moment falls in, and when it started (the end of the week before).
export function fantasyWeekAt(season, now = Date.now()) {
  let wk = 1; while (wk < NFL_WEEKS && now >= weekEndAt(season, wk).getTime()) wk++;
  return { wk, start: wk > 1 ? weekEndAt(season, wk - 1) : new Date(Date.UTC(season.year, 7, 1)) };
}
// Game days, for polling: a Central day with a kickoff in this fantasy week or the last one,
// until 2 AM the next morning. Weeks without a schedule on file use the usual Thursday,
// Sunday and Monday slots; weeks 15 to 17 add Saturdays, and Christmas can fall on any day.
const USUAL_KICKS = ['Thu 7:15 PM', 'Sun 8:30 AM', 'Sun 12:00 PM', 'Sun 3:25 PM', 'Sun 7:20 PM', 'Mon 7:15 PM'];
const kickoffsAround = (season, now) => { const { wk } = fantasyWeekAt(season, now);
  return [wk - 1, wk].filter(w => w >= 1).flatMap(w => (season.nfl?.[w]?.games?.length ? season.nfl[w].games : USUAL_KICKS).map(g => kickoffAt(season, w, g)?.getTime()).filter(Boolean)); };
const ctDay = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
export function isGameDay(season, now = Date.now()) {
  const today = ctDay(now - 2 * 36e5);
  return kickoffsAround(season, now).some(k => ctDay(k) == today);
}
// Game time, for the server's Yahoo refresh: 15 minutes before a kickoff until 5 hours after it.
export const isGameTime = (season, now = Date.now()) => kickoffsAround(season, now).some(k => now >= k - 15 * 6e4 && now < k + 5 * 36e5);

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
// group (legs with sgp: n, priced by p.sgps[n - 1]) plus one per other leg. A pushed leg
// (status 'push': a moneyline that ended in a tie) is voided, so it drops out, as the book does.
export function parlayParts(p) {
  const parts = [], seen = new Set();
  for (const l of p.legs) {
    if (l.status == 'push' && !l.sgp) continue;
    if (l.sgp) { if (!seen.has(l.sgp)) { seen.add(l.sgp); parts.push(p.sgps?.[l.sgp - 1] ?? null); } }
    else parts.push(l.odds ?? null);
  }
  return parts;
}
// A ticket's state from its legs (any miss = BUSTED, all hit = CASHED, else OPEN) and its price.
// A ticket-level price (the book's, for the whole slip) overrides the leg math.
export function parlayState(p) {
  const st = p.legs.map(l => l.status || 'open');
  const live = st.filter(s => s != 'push');
  const status = st.includes('miss') ? 'BUSTED' : live.length && live.every(s => s == 'hit') ? 'CASHED' : 'OPEN';
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
// A leg's no-vig chance: `fair` as given (a probability), or worked out from `vs`, the other
// side's price, by taking the book's cut out proportionally: p = imp(a) / (imp(a) + imp(b)).
export function fairProb(l) {
  if (typeof l.fair == 'number') return l.fair > 0 && l.fair < 1 ? l.fair : null;
  const a = impliedProb(l.odds), b = impliedProb(l.vs);
  if (a != null && b != null) return a / (a + b);
  return ladderProb(l);
}
// The one estimate (Matt, Oct 18, 2026): a TD leg has no No side, so its fair chance is estimated from
// the book's own TD ladder, `ladder: ['-190', '+285', '+1100']` (1+, 2+, 3+ TDs, same book and pull).
// TDs follow a Poisson count, so the ratio of the 2+ price to the 1+ price fixes the scoring rate λ
// whatever the cut (assumed the same share on both rungs); the leg's fair chance is P(count ≥ n | λ).
const poissonAtLeast = (lam, n) => { let s = 0, t = Math.exp(-lam); for (let i = 0; i < n; i++) { s += t; t *= lam / (i + 1); } return 1 - s; };
export function ladderProb(l) {
  if (l.type != 'td' || !Array.isArray(l.ladder)) return null;
  const q1 = impliedProb(l.ladder[0]), q2 = impliedProb(l.ladder[1]);
  if (q1 == null || q2 == null || !(q2 < q1)) return null;
  const ratio = q2 / q1;
  let lo = 0.01, hi = 6; // P(≥2)/P(≥1) rises with λ
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; poissonAtLeast(m, 2) / poissonAtLeast(m, 1) < ratio ? lo = m : hi = m; }
  return poissonAtLeast((lo + hi) / 2, l.count || 1);
}
// A ticket's fair (no-vig) price and the book's edge on it: fair decimal = 1 / Πp, edge = 1 − dec × Πp.
// Null unless every priced leg has a fair value (anytime TDs usually don't: DraftKings only offers
// Yes; a TD leg with its `ladder` gets an estimate), and for book-priced tickets and same-game groups,
// which have no other side to compare. est is true when a ladder estimate went in, and the site then
// shows "fair ~+X (est.) · book edge ~Y%".
export function parlayFair(p) {
  if (toDecimal(p.odds) || p.legs.some(l => l.sgp)) return null;
  const { priced, dec } = parlayState(p);
  if (!priced) return null;
  let prob = 1, est = false;
  for (const l of p.legs) {
    if (l.status == 'push') continue;
    const f = fairProb(l);
    if (f == null) return null;
    if (typeof l.fair != 'number' && l.vs == null) est = true; // from a TD ladder
    prob *= f;
  }
  return { dec: 1 / prob, prob, edge: 1 - dec * prob, est };
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
// The league's week-to-week spread: how far a team's weekly score lands from its own average
// (pooled standard deviation through week W0; 25 before there's enough to go on).
export function weeklySpread(season, W0) {
  const MGR = season.managers.map(x => x.m), SC = season.scores;
  let ss = 0, n = 0;
  for (const m of MGR) { const s = SC[m].slice(0, W0), mu = s.reduce((t, x) => t + x, 0) / (s.length || 1); for (const x of s) { ss += (x - mu) ** 2; n++; } }
  return n > MGR.length ? Math.sqrt(ss / (n - MGR.length)) : 25;
}
// Playoff odds: the rest of the regular season played out `sims` times. A team's weekly score is
// drawn around its average, pulled toward the league average as if it had played `shrink` more weeks
// at the league average (halfway after five weeks, less as the season goes on), with the league's
// week-to-week spread. The live week starts from Yahoo's projection, and its spread shrinks as points
// come in. Seeds go by wins, then points for, like the standings; the top `playoffTeams` make it and
// the seeds that skip the first round (two of six) get a bye. A fixed seed makes every run give the
// same numbers, so the site, link previews and check.js agree. `through` (default: every final week)
// with live: false gives the odds as they stood after an earlier week, for the change since then.
// Returns null when a week left to play has no schedule.
export function playoffOdds(season, { through, live = true, sims = 20000, shrink = 5 } = {}) {
  const MGR = season.managers.map(x => x.m), SC = season.scores, PAIRS = season.schedule || {};
  const NF = Math.max(0, ...MGR.map(m => (SC[m] || []).length)), W0 = Math.min(through ?? NF, NF), R = season.regularSeasonWeeks || 14;
  const P = season.playoffTeams || 6, byes = Math.max(0, 2 ** Math.ceil(Math.log2(P)) - P), N = MGR.length;
  for (let w = W0 + 1; w <= R; w++) if (!PAIRS[w]) return null;
  // Record and points through week W0.
  const wins = Object.fromEntries(MGR.map(m => [m, 0])), pf = Object.fromEntries(MGR.map(m => [m, 0]));
  for (let w = 1; w <= W0; w++) for (const [a, b] of PAIRS[w] || []) {
    const sa = SC[a][w - 1], sb = SC[b][w - 1]; pf[a] += sa; pf[b] += sb;
    if (sa > sb) wins[a]++; else if (sb > sa) wins[b]++; else { wins[a] += 0.5; wins[b] += 0.5; }
  }
  // Each team's expected weekly score, and the league's week-to-week spread around team averages.
  const all = MGR.flatMap(m => SC[m].slice(0, W0)), lg = all.length ? all.reduce((s, x) => s + x, 0) / all.length : 110;
  const avg = Object.fromEntries(MGR.map(m => { const s = SC[m].slice(0, W0); return [m, (s.reduce((t, x) => t + x, 0) + shrink * lg) / (s.length + shrink)]; }));
  const sd = weeklySpread(season, W0);
  // The live week (the one right after W0) from Yahoo: points so far plus the rest of the projection.
  const LV = live && season.live?.week == W0 + 1 && season.live.scores ? season.live.scores : null;
  const wk = {};
  for (let w = W0 + 1; w <= R; w++) wk[w] = Object.fromEntries(MGR.map(m => {
    const s = LV && w == W0 + 1 ? LV[m] : null;
    if (!s || !(s[1] > 0)) return [m, [avg[m], sd]];
    const left = Math.max(0, s[1] - (s[0] || 0)) / s[1];
    return [m, [s[1], sd * Math.sqrt(left)]];
  }));
  // Seeded random numbers (mulberry32) and normal draws (Box-Muller).
  let seed = 9 + W0 * 7919 + (LV ? Math.round(MGR.reduce((t, m) => t + LV[m][0] * 100 + LV[m][1], 0)) : 0);
  const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const draw = (mu, s) => s ? mu + s * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()) : mu;
  const out = Object.fromEntries(MGR.map(m => [m, { playoffs: 0, bye: 0, top: 0, last: 0, wins: 0 }]));
  for (let i = 0; i < sims; i++) {
    const W = { ...wins }, F = { ...pf };
    for (let w = W0 + 1; w <= R; w++) for (const [a, b] of PAIRS[w]) {
      const sa = draw(...wk[w][a]), sb = draw(...wk[w][b]); F[a] += sa; F[b] += sb;
      if (sa > sb) W[a]++; else if (sb > sa) W[b]++; else { W[a] += 0.5; W[b] += 0.5; }
    }
    const order = MGR.map(m => ({ m, w: W[m], pf: F[m] })).sort(byStandings);
    order.forEach((r, k) => { const o = out[r.m]; o.wins += W[r.m]; if (k < P) o.playoffs++; if (k < byes) o.bye++; if (k == 0) o.top++; if (k == N - 1) o.last++; });
  }
  for (const m of MGR) for (const k in out[m]) out[m][k] /= sims;
  return { through: W0, weeksLeft: R - W0, live: !!LV, sims, playoffTeams: P, byes, teams: out };
}
// A share as the site shows it. Simulated ends aren't certain, so they read ">99%" and "<1%"; once
// no weeks are left (done = true) they're "In" and "Out".
// Win odds for the live week's matchups, in schedule order: { a, b, pa } with pa a's chance to win.
// Each side is its points so far plus the rest of Yahoo's projection; the league's weekly spread
// (weeklySpread) shrinks with the share of the projection still to play, so a finished side counts
// as certain. Before kickoff it's projection against projection. Same model as the live week in
// playoffOdds. With the rosters file, a starter tagged Q or D whose game hasn't started counts at
// INJ_PLAY of his projection (he may sit), and that play/sit coin flip adds p(1−p)·proj² of
// variance to his side; O and IR are already 0 in Yahoo's projection.
// A dead slot (bye, Out, empty) counts as filled from the bench; see fillOf. Players with an ESPN
// projection (scripts/espn-proj.mjs) count at the average of Yahoo's and ESPN's; see projOf.
export const INJ_PLAY = { Q: 0.85, D: 0.35 };
// A player's projection for the win odds: Yahoo's and ESPN's averaged when the rosters file has both
// for the live week (Matt, Oct 29, 2026: one source's projections are noisier than two), else Yahoo's.
export const projOf = (p, rosters, wk) => p.espn != null && p.proj > 0 && rosters?.espn?.week == wk ? (p.proj + p.espn) / 2 : p.proj;
export function matchupOdds(season, rosters = null, now = Date.now()) {
  const L = season.live, wk = L?.week, NF = Math.max(0, ...season.managers.map(x => (season.scores[x.m] || []).length));
  if (!L?.scores || !season.schedule?.[wk]) return null;
  const sd = weeklySpread(season, NF);
  // Normal CDF through erf (Abramowitz and Stegun 7.1.26).
  const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x < 0 ? -y : y; };
  const pts = L.playerPoints || {}, playing = new Set(L.inProgress || []);
  const proj = p => projOf(p, rosters, wk), started = p => pts[p.name] != null || playing.has(p.name) || now >= (kickoffAt(season, wk, nflGameOf(season, p.nfl, wk) || 'Sun 12:00 PM')?.getTime() ?? Infinity);
  // Starters still to play: { cut: expected points lost to Q/D tags, v: variance added, espn: what
  // averaging in ESPN adds to Yahoo's team projection }.
  const injOf = m => {
    let cut = 0, v = 0, espn = 0;
    for (const p of rosters?.teams?.find(t => t.name == m)?.players || []) {
      if (p.slot != 'starter' || !(p.proj > 0) || started(p)) continue;
      espn += proj(p) - p.proj;
      const q = INJ_PLAY[String(p.inj || '').toUpperCase()];
      if (q != null) { cut += (1 - q) * proj(p); v += q * (1 - q) * proj(p) * proj(p); }
    }
    return { cut, v, espn };
  };
  // Managers set their lineups (Matt, Oct 21 and Oct 29, 2026): while lineupIssues still flags it, a
  // starter on bye or Out, or an empty slot, counts as filled by the team's best bench player who can
  // still go in (right position, game not started, not on bye or Out; Q and D at INJ_PLAY of his
  // projection), each used once, fixed slots before the FLEX. With nobody on the bench who fits, it's
  // waiver level: the lowest projection any other team starts at that position.
  const T = rosters?.teams || [], FLEXP = ['RB', 'WR', 'TE', 'WRT'], fits = (pos, k) => k == 'WRT' ? FLEXP.includes(pos) : pos == k;
  const waiver = (m, pos) => Math.min(...T.filter(t => t.name != m).flatMap(t => t.players)
    .filter(p => p.slot == 'starter' && p.proj > 0 && fits(p.pos, pos)).map(p => p.proj), Infinity);
  const fillOf = m => {
    const t = T.find(t => t.name == m); if (!t) return 0;
    const { bye, out, empty } = lineupIssues(season, t.players.filter(p => p.slot == 'starter'), wk, pts, now), w = pos => { const v = waiver(m, pos); return isFinite(v) ? v : 0; };
    const bench = t.players.filter(p => p.slot == 'bench' && p.proj > 0 && !started(p) && !onByeOf(season, p.nfl, wk) && !['O', 'IR'].includes(String(p.inj || '').toUpperCase()))
      .map(p => ({ pos: p.pos, v: proj(p) * (INJ_PLAY[String(p.inj || '').toUpperCase()] ?? 1) })).sort((a, b) => b.v - a.v);
    const fill = k => { const i = bench.findIndex(p => fits(p.pos, k)); return i < 0 ? w(k) : bench.splice(i, 1)[0].v; };
    const dead = [...bye, ...out].map(p => ({ k: p.pos, has: proj(p) || 0 })).concat(empty.map(k => ({ k, has: 0 })))
      .sort((a, b) => (a.k == 'WRT') - (b.k == 'WRT'));
    return dead.reduce((s, d) => s + Math.max(0, fill(d.k) - d.has), 0);
  };
  const side = m => { const [pnow, proj] = L.scores[m] || [0, 0], I = injOf(m);
    return { proj: (proj || pnow || 0) + I.espn - I.cut + fillOf(m), left: proj > 0 ? Math.max(0, proj - (pnow || 0)) / proj : 0, iv: I.v }; };
  return season.schedule[wk].map(([a, b]) => {
    const A = side(a), B = side(b), v = sd * sd * (A.left + B.left) + A.iv + B.iv, d = A.proj - B.proj;
    return { a, b, pa: v > 0 ? 0.5 * (1 + erf(d / Math.sqrt(2 * v))) : d > 0 ? 1 : d < 0 ? 0 : 0.5 };
  });
}
// Picks graded once their week is final. byWeek[week] holds one pick per matchup in schedule order,
// either a name or [name, win % when picked]. Returns { graded: [{ wk, i, pick, pct, winner, hit }], w, l }.
export function pickRecord(season, byWeek) {
  const NF = Math.max(0, ...season.managers.map(x => (season.scores[x.m] || []).length)), graded = [];
  for (const [w, picks] of Object.entries(byWeek || {})) {
    if (+w > NF) continue;
    (picks || []).forEach((p, i) => {
      const pair = season.schedule?.[w]?.[i]; if (!p || !pair) return;
      const [pick, pct] = Array.isArray(p) ? p : [p, null];
      const [a, b] = pair, sa = season.scores[a][w - 1], sb = season.scores[b][w - 1];
      const winner = sa > sb ? a : sb > sa ? b : null;
      graded.push({ wk: +w, i, pick, pct, winner, hit: winner == pick });
    });
  }
  return { graded, w: graded.filter(g => g.hit).length, l: graded.filter(g => g.winner && !g.hit).length };
}
// The week's first kickoff (ms), from nfl[week].games; null if the week's games aren't on file.
export function weekFirstKick(season, w) {
  const t = (season.nfl?.[w]?.games || []).map(g => kickoffAt(season, w, g)).filter(Boolean).map(Number);
  return t.length ? Math.min(...t) : null;
}
// Jerger's picks and Tristan's rankings can be set on the site (api/pundits.js, Matt, Oct 20, 2026):
// picks for the live week until its first kickoff (like the Booth's), rankings for the last final week
// until the next week's first kickoff. The site and the server both ask this, so they always agree.
export function punditOpen(season, kind, w, now = Date.now()) {
  const NF = Math.max(0, ...season.managers.map(x => (season.scores[x.m] || []).length));
  const k = kind == 'picks' ? (w == season.live?.week ? weekFirstKick(season, w) : -1) : kind == 'ranks' ? (w == NF ? weekFirstKick(season, w + 1) : -1) : -1;
  return k == null || (k > 0 && now < k);
}
// Who may set which: Jerger posts the experts' picks, Tristan the rankings.
export const PUNDIT_OF = { picks: 'Jerger', ranks: 'Tristan' };
// The Booth's picks: boothPicks[week] holds [pick, win % when picked] per matchup in schedule order.
export const boothPickRecord = season => pickRecord(season, season.boothPicks);
// Jerger's preview picks ("the experts"): expertPicks[week] holds a name per matchup (Matt, Oct 20, 2026).
export const expertPickRecord = season => pickRecord(season, season.expertPicks);
export const oddsPct = (x, done) => done ? (x >= 0.5 ? 'In' : 'Out') : x >= 0.995 ? '>99%' : x < 0.005 ? '<1%' : Math.round(x * 100) + '%';
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
// Yahoo's box scores for the current week (/api/league, /api/live) on top of the rosters file: when
// Yahoo was read after the rosters file, each team's starters, bench and IR follow Yahoo's lineup (Oct 29,
// 2026: Tristan set eight empty slots after the 6:11 PM browser pull, and the odds counted those slots as
// empty and filled at once), and injury tags follow Yahoo's (box rows carry them since Oct 30, 2026).
// Players keep the file's projection and ESPN number; anyone new to the team comes in without them. A
// team Yahoo didn't send stays as the file has it.
const BOX_SLOT = { 'W/R/T': 'WRT', BN: null, IR: null };
export function liveRosters(R, Y) {
  const Wk = Y?.weeks?.[R?.week];
  if (!Wk?.box || +Y.currentWeek != +R.week || !(Date.parse(Y.syncedAt) > Date.parse(R.asOf || 0))) return R;
  return { ...R, asOf: Y.syncedAt, teams: R.teams.map(t => {
    const B = Wk.box[t.name]; if (!B) return t;
    const had = new Map(t.players.map(p => [nameKey(p.name), p]));
    const put = (r, slot) => { const p = { ...(had.get(nameKey(r[1])) || { name: r[1], nfl: r[2] }), slot, pos: slot == 'starter' ? (BOX_SLOT[r[0]] || r[0]) : r[3] };
      if (r.length > 6) { if (r[6]) p.inj = r[6]; else delete p.inj; }
      return p; };
    return { ...t, players: [...B.starters.filter(r => r[1]).map(r => put(r, 'starter')), ...B.bench.filter(r => r[1]).map(r => put(r, r[0] == 'IR' ? 'IR' : 'bench'))] };
  }) };
}
// Yahoo's transactions (/api/league's tx, Oct 30, 2026) on top of uploads/9feamg-transactions.json:
// every Yahoo move the file doesn't have yet, newest first, ahead of the file's. A file row (read from
// Yahoo's website, so it has no Yahoo key) is the same move when the manager, action and player match
// and its time is within 36 hours of Yahoo's, so a time zone slip can't count a move twice.
export function mergeTx(tx, Y) {
  if (!Y?.tx?.length) return tx;
  const year = +Y.season || new Date().getFullYear(), left = [...(tx || [])].map(t => ({ t, k: [t.manager, t.action, nameKey(t.player)].join('|'), at: parseCT(t.when, year).getTime() }));
  const add = Y.tx.filter(y => {
    const k = [y.manager, y.action, nameKey(y.player)].join('|'), i = left.findIndex(f => f.k == k && Math.abs(f.at - y.ts * 1000) < 36 * 3600e3);
    if (i < 0) return true;
    left.splice(i, 1); return false;
  });
  return add.length ? [...add, ...(tx || [])] : tx;
}
// FAAB left and adds per manager: Yahoo's own numbers when /api/league has them, else counted from
// the transactions. Returns { [m]: { left, adds } }.
export function faabOf(season, tx, Y) {
  const out = {}, budget = season.faabBudget ?? 100;
  for (const { m } of season.managers) out[m] = { left: budget, adds: 0 };
  for (const t of tx || []) if (t.action == 'add' && out[t.manager]) { out[t.manager].adds++; out[t.manager].left -= parseInt(String(t.faab || '').replace(/\D/g, '')) || 0; }
  for (const [m, y] of Object.entries(Y?.managers || {})) if (out[m] && y.faab != null) out[m] = { left: y.faab, adds: y.moves };
  return out;
}
// A player's fantasy points in a week: live points for the live week, else that week's box score.
export function pointsOf(season, box, name, w) {
  if (w == season.live?.week) return season.live?.playerPoints?.[name] ?? null;
  for (const t of Object.values(box?.weeks?.[w] || {})) { const p = [...t.starters, ...t.bench].find(x => x[1] == name); if (p) return p[4]; }
  return null;
}

// ---- Where a team's points come from ----
// Names are compared on letters and digits only (the draft has "JK Dobbins", box scores "J.K. Dobbins").
export const nameKey = n => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Every way a team got a player (draft pick, add, trade) with the points he scored for that team
// in the final weeks' box scores. Each week's points go to the team's latest way of getting him
// before his kickoff, so a player added, dropped and added again counts as two stints.
// Returns [{ m, player, pos, nfl, how: 'draft'|'add'|'trade', round, faab, waivers, at, started,
// starts, bench, weeks }], where faab is the winning bid (null for free agents) and at a Date
// (null for draft picks).
export function acquisitionsOf(season, box, draft, tx) {
  const bidOf = t => { const n = parseFloat(String(t.faab ?? '').replace('$', '')); return isNaN(n) ? null : n; }; // "$11" in the file
  const ev = {}, all = [], put = (m, name, a) => { a.m = m; a.player = name; a.started = 0; a.starts = 0; a.bench = 0; a.weeks = 0; all.push(a); (ev[m + '|' + nameKey(name)] ||= []).push(a); };
  for (const r of Object.values(draft?.rosters || {})) for (const p of r.picks || []) put(r.manager, p.player, { how: 'draft', round: p.round, overall: p.overall, pos: p.pos, nfl: p.nfl, at: null });
  for (const t of tx || []) if (t.action == 'add' || t.action == 'trade') put(t.manager, t.player, { how: t.action, pos: t.pos, nfl: t.nfl, at: parseCT(t.when, season.year), faab: bidOf(t), waivers: t.via == 'Waivers' });
  Object.values(ev).forEach(l => l.sort((a, b) => (a.at ?? -Infinity) - (b.at ?? -Infinity)));
  for (const [w, W] of Object.entries(box?.weeks || {})) for (const [m, T] of Object.entries(W)) {
    for (const [list, started] of [[T.starters, true], [T.bench, false]]) for (const p of list) {
      const kick = kickoffAt(season, +w, nflGameOf(season, p[2], +w) || 'Sun 12:00 PM');
      const a = (ev[m + '|' + nameKey(p[1])] || []).filter(a => !a.at || !kick || a.at < kick).pop();
      if (!a) continue;
      a.weeks++;
      if (started) { a.started += p[4] || 0; a.starts++; } else a.bench += p[4] || 0;
    }
  }
  return all;
}
// Where each team's started points came from (acquisitionsOf): draft picks, adds off waivers or free
// agency, streams (a kicker or defense added, usually a week at a time; Matt, Oct 22, 2026) and trades.
// wirePct leaves streams out, so it measures real pickups. Most wire-built team first.
export const isStream = a => a.how == 'add' && ['K', 'DEF'].includes(a.pos);
export function pointSources(season, box, draft, tx) {
  const A = acquisitionsOf(season, box, draft, tx);
  return season.managers.map(x => x.m).map(m => {
    const sum = ok => A.filter(a => a.m == m && ok(a)).reduce((t, a) => t + a.started, 0);
    const r = { m, draft: sum(a => a.how == 'draft'), wire: sum(a => a.how == 'add' && !isStream(a)), stream: sum(isStream), trade: sum(a => a.how == 'trade') };
    r.total = r.draft + r.wire + r.stream + r.trade; r.wirePct = r.total ? r.wire / r.total : 0;
    return r;
  }).sort((a, b) => b.wirePct - a.wirePct || b.wire - a.wire);
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
