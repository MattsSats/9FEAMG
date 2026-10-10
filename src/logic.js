// App logic. build.cjs splices this into src/app.html's x-dc script before bundling.
// All season numbers come from data/season.js (window.SEASON).
// Yahoo sync (window.YAHOO from /api/league) fills in the numbers: final scores, schedule,
// and the live week's scores and player points. Booth lines, captions and parlays stay in season.js.
function mergeYahoo(S, Y) {
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
    const Wk = Y.weeks[live], same = S.live?.week == live, pp = { ...(same ? S.live.playerPoints : {}) };
    for (const t of Object.values(Wk.box || {})) for (const r of [...t.starters, ...t.bench]) if (r[4]) pp[r[1]] = r[4];
    S.live = { status: 'Live', sheetNote: 'Live from Yahoo. Orange = points so far; the rest are projections.', ...(same ? S.live : {}), week: live, playerPoints: pp, asOf: Y.syncedAt,
      scores: Object.fromEntries(S.managers.map(x => [x.m, [Wk.teams[x.m].pts, Wk.teams[x.m].proj]])) };
  } else if (S.live && Y.weeks[S.live.week]?.status == 'postevent' && full(S.live.week)) S.live = null;
  return S;
}
const D = mergeYahoo(window.SEASON, window.YAHOO);
const MGR = D ? D.managers.map(x => x.m) : [];
// Team link slugs: 'Mr. G' → 'mr-g' (#team-mr-g).
const teamSlug = m => m.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const INIT = D ? Object.fromEntries(D.managers.map(x => [x.m, x.init])) : {};
// Three-letter initials (Tony's ASG) shrink to fit inside the crest.
if (D && typeof document != 'undefined' && !document.getElementById('ini-fit')) {
  const st = document.createElement('style'); st.id = 'ini-fit';
  st.textContent = D.managers.filter(x => (x.init || '').length > 2).map(x => `.crest .ini[data-i="${x.init}"]{font-size:.72em;letter-spacing:-.02em}`).join('');
  document.head.appendChild(st);
}
const HUE = D ? Object.fromEntries(D.managers.map(x => [x.m, x.hue])) : {};
// Manager colors: lightness comes from --mgrL (0.76 dark, 0.61 light) so dots and bars hold 3:1 on the light background.
const col = m => `oklch(var(--mgrL, 0.76) 0.12 ${HUE[m] ?? 0})`;
// Parlays can belong to someone outside the league (e.g. 'The Booth'), who gets the accent color.
const ownerCol = m => m in HUE ? col(m) : 'var(--accent)';
const SC = D ? D.scores : {};
const NF = D ? Math.max(0, ...MGR.map(m => (SC[m] || []).length)) : 0; // weeks final
const LIVE = D ? D.live : null;
const LW = LIVE ? LIVE.week : null;
const NEXT = D ? D.next : null;
const LIVEPTS = LIVE?.playerPoints || {};
// Players still on the field: their points are so far, not final.
const PLAYING = new Set(LIVE?.inProgress || []);
// Gameday opens on the week that just finished until the live week has points on the board
// (Tuesday and Wednesday are for last week's results), then on the live week.
const LIVE_STARTED = !!LIVE && (Object.keys(LIVEPTS).length > 0 || Object.values(LIVE.scores || {}).some(s => s[0] > 0));
const HOME_WK = LW && (LIVE_STARTED || !NF) ? LW : NF;
const PPROJ = D?.projections || {};
// "Your team": the manager this phone picked (request form, "I'm on it" or the Gameday prompt).
const MY_TEAM = (() => { try { const m = localStorage.getItem('9feamg-req-mgr'); return MGR.includes(m) ? m : null; } catch { return null; } })();
// "Scores as of Thu 10:19 PM" (Central).
const asOfLabel = iso => { const d = new Date(iso); return isNaN(d) ? '' : 'Scores as of ' + d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).replace(',', ''); };
const PAIRS = D ? D.schedule : {};
const PROJ = Object.fromEntries(MGR.map(m => [m, LIVE?.scores?.[m]?.[1] ?? 0]));
// Parlay request risk levels: total American odds, low to high (null = no top).
const RISKS = [
  { k: 'safe', label: 'Safe', lo: 100, hi: 250 }, { k: 'balanced', label: 'Balanced', lo: 250, hi: 600 },
  { k: 'spicy', label: 'Spicy', lo: 600, hi: 1500 }, { k: 'longshot', label: 'Long shot', lo: 1500, hi: 5000 },
  { k: 'lottery', label: 'Lottery', lo: 5000, hi: null }
];
// Parlay request bet types, with a rough range of what one leg of that kind pays (decimal odds),
// used only to warn when a risk level and leg count are out of reach.
const BET_TYPES = [
  { k: 'mix', label: 'Mix it up', lo: 1.2, hi: 7 }, { k: 'td', label: 'Anytime TD', lo: 1.5, hi: 7 },
  { k: 'yards', label: 'Yardage overs', lo: 1.6, hi: 4 }, { k: 'lines', label: 'Game lines', lo: 1.2, hi: 5 }
];
// NFL team names by Yahoo's abbreviation, for "→ Packers moneyline".
const NFL = { Ari: 'Cardinals', Atl: 'Falcons', Bal: 'Ravens', Buf: 'Bills', Car: 'Panthers', Chi: 'Bears', Cin: 'Bengals', Cle: 'Browns', Dal: 'Cowboys', Den: 'Broncos', Det: 'Lions', GB: 'Packers', Hou: 'Texans', Ind: 'Colts', Jax: 'Jaguars', KC: 'Chiefs', LAC: 'Chargers', LAR: 'Rams', LV: 'Raiders', Mia: 'Dolphins', Min: 'Vikings', NE: 'Patriots', NO: 'Saints', NYG: 'Giants', NYJ: 'Jets', Phi: 'Eagles', Pit: 'Steelers', SF: '49ers', Sea: 'Seahawks', TB: 'Buccaneers', Ten: 'Titans', Was: 'Commanders' };
// The leg a picked player can be: anytime TD, a yardage over, or their team's moneyline.
const PICK_LEGS = [{ k: 'td', label: () => 'TD' }, { k: 'yards', label: () => 'Yards' }, { k: 'ml', label: p => (NFL[p.nfl] || 'Team') + ' ML' }];
const pickText = { td: 'TD', yards: 'yards', ml: 'ML' };
// Leg kickoffs as real times (same rule as api/_parlays.js): the day and Central time in
// legs[].game, counted from that week's Thursday. Tails lock at a ticket's first kickoff.
const KICK_DAYS = { Thu: 0, Fri: 1, Sat: 2, Sun: 3, Mon: 4, Tue: 5, Wed: 6 };
function kickoff(week, game) {
  const m = String(game || '').match(/^(Thu|Fri|Sat|Sun|Mon|Tue|Wed)\s+(\d{1,2}):(\d{2})\s*(AM|PM)/);
  if (!m || !D?.week1Thursday) return null;
  const d = new Date(D.week1Thursday + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7 * (week - 1) + KICK_DAYS[m[1]]);
  const h = (+m[2] % 12) + (m[4] == 'PM' ? 12 : 0), ymd = d.toISOString().slice(0, 10);
  const cdt = d.getUTCMonth() < 10 || (d.getUTCMonth() == 10 && d.getUTCDate() < 1 + ((7 - new Date(Date.UTC(d.getUTCFullYear(), 10, 1)).getUTCDay()) % 7));
  return new Date(`${ymd}T${String(h).padStart(2, '0')}:${m[3]}:00${cdt ? '-05:00' : '-06:00'}`);
}
const tailsLocked = (week, p) => p.legs.some(l => (l.status || 'open') != 'open')
  || (ks => ks.length > 0 && Date.now() >= Math.min(...ks))(p.legs.map(l => kickoff(week, l.game)).filter(Boolean));
const legCount = l => l == 'any' ? null : l == '6+' ? 6 : +l;
// A warning (never a block) when n legs of this type can't land in the risk range.
function reqReach(risk, bt, legs) {
  const n = legCount(legs), b = BET_TYPES.find(x => x.k == bt) || BET_TYPES[0];
  if (!n) return '';
  const minD = b.lo ** n, maxD = b.hi ** n, lo = 1 + risk.lo / 100, hi = risk.hi ? 1 + risk.hi / 100 : Infinity;
  const what = `${n} ${{ mix: 'legs', td: 'anytime TD legs', yards: 'yardage overs', lines: 'game-line legs' }[b.k]}`;
  if (minD > hi) return `Hard to hit: ${what} usually pay more than ${risk.label}. Send it anyway and it’s built as close as the lines allow, flagged.`;
  if (maxD < lo) return `Hard to hit: ${what} rarely reach ${risk.label}. Send it anyway and it’s built as close as the lines allow, flagged.`;
  return '';
}
const pay10 = a => '$' + Math.round(10 * (1 + a / 100));
const riskText = r => '+' + r.lo + (r.hi ? ' to +' + r.hi : ' and up');
const riskPay = r => '$10 pays ' + pay10(r.lo) + (r.hi ? '–' + pay10(r.hi) : '+');
// Share images: CSS width they render at, at 3× pixels. Wide enough to stay short in a chat,
// narrow enough that the text still reads in an iMessage bubble.
const SHOT_W = 400;
// Screenshot library for the share buttons, loaded on demand.
const SHOT_LIB = {
  src: 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js',
  integrity: 'sha384-Tha/42qsYmpYmQ07pX+nJzkKumO0BzKJxK/uzVc7xyBQxVCUgQBhQIG8L7vXK+9C'
};
const ORD = { QB: 0, RB: 1, WR: 2, TE: 3, WRT: 4, K: 5, DEF: 6 };
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const MONS = Object.keys(MON);
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const f1 = n => n.toFixed(1), f2 = n => n.toFixed(2);
const sgn = n => n > 0 ? '+' + n.toFixed(2) : n < 0 ? '−' + Math.abs(n).toFixed(2) : '0.00';
const ord = n => n + (n % 10 == 1 && n != 11 ? 'st' : n % 10 == 2 && n != 12 ? 'nd' : n % 10 == 3 && n != 13 ? 'rd' : 'th');
const shortDate = d => MONS[d.getMonth()] + ' ' + d.getDate();
function parseWhen(s) {
  const m = s.match(/(\w+) (\d+), (\d+):(\d+) (am|pm)/);
  if (!m) return new Date(D.year, 8, 1);
  let h = +m[3] % 12; if (m[5] == 'pm') h += 12;
  return new Date(D.year, MON[m[1]], +m[2], h, +m[4]);
}
function opp(m, w) { const p = (PAIRS[w] || []).find(p => p.includes(m)); return p ? (p[0] == m ? p[1] : p[0]) : null; }
function won(m, w) { const o = opp(m, w); return o != null && SC[m][w - 1] > SC[o][w - 1]; }
function rec(m, upto) { let w = 0, l = 0; for (let i = 1; i <= upto; i++) { if (!opp(m, i)) continue; won(m, i) ? w++ : l++; } return w + '–' + l; }
function allPlay(m, wk) { const s = SC[m][wk - 1]; const w = MGR.filter(o => o != m && SC[o][wk - 1] < s).length; return { w, l: MGR.length - 1 - w, rank: MGR.length - w }; }

// Standings, derived from final weekly scores. Sorted by wins, then points for.
const ST = MGR.map(m => {
  let w = 0, l = 0, pf = 0, pa = 0, xw = 0;
  for (let i = 1; i <= NF; i++) {
    const o = opp(m, i); if (!o) continue;
    pf += SC[m][i - 1]; pa += SC[o][i - 1];
    won(m, i) ? w++ : l++;
    xw += allPlay(m, i).w / (MGR.length - 1);
  }
  // max is filled in by setMaxPF once the Yahoo box scores load.
  return { m, w, l, pf, pa, max: null, xw, luck: Math.round((w - xw) * 100) / 100 };
}).sort((a, b) => b.w - a.w || b.pf - a.pf);

// Power rankings through week n, scored 0–100: half season all-play win %, a quarter
// actual win %, a quarter all-play win % over the last two weeks (form). Ties go to PF.
function power(n) {
  const k = MGR.length - 1;
  return MGR.map(m => {
    let ap = 0, apW = 0, w = 0, g = 0, form = 0, fg = 0, pf = 0;
    for (let i = 1; i <= n; i++) {
      if (!opp(m, i)) continue;
      const a = allPlay(m, i).w;
      ap += a / k; apW += a; g++; pf += SC[m][i - 1];
      if (won(m, i)) w++;
      if (i > n - 2) { form += a / k; fg++; }
    }
    const score = g ? 100 * (0.5 * ap / g + 0.25 * w / g + 0.25 * (fg ? form / fg : 0)) : 0;
    return { m, score, pf, wl: w + '–' + (g - w), ap: apW + '–' + (g * k - apW) };
  }).sort((a, b) => b.score - a.score || b.pf - a.pf);
}

// Max PF: the best legal lineup each final week from that week's starters + bench
// (IR can't start). Filling the fixed slots with the top scorers at each position,
// then the FLEX with the best remaining RB/WR/TE, is optimal for this lineup shape.
const LINEUP = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'K', 'DEF'], FLEX = ['RB', 'WR', 'TE'];
function optimalLineup(players) {
  const pool = players.filter(p => p[0] != 'IR').map(p => ({ pos: p[3], pts: p[4] })).sort((a, b) => b.pts - a.pts);
  const take = ok => { const i = pool.findIndex(p => ok(p.pos)); return i < 0 ? 0 : pool.splice(i, 1)[0].pts; };
  return LINEUP.reduce((t, slot) => t + take(pos => pos == slot), 0) + take(pos => FLEX.includes(pos));
}
// Sets each manager's season Max PF, or leaves it null when any final week's box score is missing.
// American odds <-> decimal, for combining parlay legs.
const toDecimal = o => { const n = parseFloat(o); return isNaN(n) || n == 0 ? null : n > 0 ? 1 + n / 100 : 1 + 100 / -n; };
const toAmerican = d => d >= 2 ? '+' + Math.round((d - 1) * 100) : '−' + Math.round(100 / (d - 1));
// The book's implied chance of a leg hitting (includes the book's cut).
const impliedProb = o => { const n = parseFloat(o); return isNaN(n) || n == 0 ? null : n > 0 ? 100 / (n + 100) : -n / (-n + 100); };
const LEG_TAG = {
  open: { tag: 'OPEN', bg: 'var(--surface2)', fg: 'var(--muted)' },
  hit: { tag: 'HIT', bg: 'var(--pos)', fg: 'var(--onStatus)' },
  miss: { tag: 'MISS', bg: 'var(--neg)', fg: 'var(--onStatus)' }
};
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
// The priced pieces of a ticket, multiplied together for the parlay odds: one per
// same-game group (legs with sgp: n, priced by p.sgps[n - 1]) plus one per other leg.
function parlayParts(p) {
  const parts = [], seen = new Set();
  for (const l of p.legs) {
    if (l.sgp) { if (!seen.has(l.sgp)) { seen.add(l.sgp); parts.push(p.sgps?.[l.sgp - 1] ?? null); } }
    else parts.push(l.odds ?? null);
  }
  return parts;
}
// A ticket's link and tails key: 'w5-ground-and-pound' (id, else title, else owner).
const ticketSlug = (wk, p) => `w${wk}-` + String(p.id ?? p.title ?? p.owner).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// A parlay's state from its legs: any miss = BUSTED, all hit = CASHED, else OPEN.
// A ticket-level odds (same-game parlays, priced by the book as one bet) overrides the leg math.
function parlayState(p) {
  const st = p.legs.map(l => l.status || 'open');
  const status = st.includes('miss') ? 'BUSTED' : st.length && st.every(s => s == 'hit') ? 'CASHED' : 'OPEN';
  if (toDecimal(p.odds)) return { status, priced: true, dec: toDecimal(p.odds) };
  const decs = parlayParts(p).map(toDecimal), priced = decs.length > 0 && decs.every(d => d != null);
  return { status, priced, dec: priced ? decs.reduce((a, b) => a * b, 1) : null };
}
function setMaxPF(box) {
  ST.forEach(s => {
    let t = 0;
    for (let w = 1; w <= NF; w++) {
      const x = box?.weeks?.[w]?.[s.m];
      if (!x) { t = null; break; }
      t += optimalLineup([...x.starters, ...x.bench]);
    }
    s.max = t;
  });
}

class Component extends DCLogic {
  state = { tab: this.props.startTab ?? 'Gameday', week: HOME_WK, theme: null, sheet: null, team: MY_TEAM || MGR[0], wire: '7 days', draftMode: 'By round', draftRound: 1, draftTeam: MGR[0], rosters: null, draft: null, tx: null, loaded: false,
    // Parlay request form: who's asking is remembered on this device.
    reqMgr: MY_TEAM, teamSheet: null, reqOpen: false, shareSheet: null, newScores: false, compact: false,
    req: { risk: 1, legs: 'any', players: [], playerLegs: {}, game: '', sending: false }, tails: {}, passes: {}, tailBusy: null, reqs: null };
  componentDidMount() {
    // Keyboard: Enter or Space activates clickable rows (role="button"); Escape closes the lineup sheet.
    document.addEventListener('keydown', e => {
      if (e.key == 'Escape' && this.state.sheet) { this.setState({ sheet: null }); return; }
      const el = e.target;
      if ((e.key == 'Enter' || e.key == ' ') && el?.getAttribute?.('role') == 'button' && el.tagName != 'BUTTON') { e.preventDefault(); el.click(); }
    });
    this.applyTheme();
    Promise.all(['uploads/9feamg-rosters.json', 'uploads/9feamg-draft-rosters.json', 'uploads/9feamg-transactions.json', 'uploads/9feamg-boxscores.json']
      .map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null)))
      .then(([rosters, draft, tx, box]) => {
        // Yahoo fills box-score weeks the uploads file doesn't have.
        for (const [w, Wk] of Object.entries(window.YAHOO?.weeks || {})) if (Wk.status == 'postevent' && Wk.box && !box?.weeks?.[w]) { box ||= { weeks: {} }; box.weeks ||= {}; box.weeks[w] = Wk.box; }
        setMaxPF(box); this.setState({ rosters, draft, tx, box, loaded: true }); });
    // Parlay requests for the live week (api/requests.js). The slider and the game box are read
    // with plain listeners; everything else on the form is a tap.
    if (LW) this.loadRequests();
    this.loadTails();
    const onReq = e => {
      const el = e.target;
      if (el?.dataset?.reqRisk != null) this.setState({ req: { ...this.state.req, risk: +el.value } });
      else if (el?.dataset?.reqGame != null) this.state.req.game = el.value; // read on send; no re-render while typing
    };
    document.addEventListener('input', onReq); document.addEventListener('change', onReq);
    setTimeout(() => this.syncRiskSlider(), 0);
    // Week chips start at W1; once the season is long, scroll just enough to show the open week.
    setTimeout(() => { const el = document.querySelector('[data-weekchips] [data-on="1"]'); if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, 0);
    this.restoreAfterRefresh();
    this.pollScores();
    // Phones: tuck the header and week row down to a slim bar while scrolling down; back on the way up.
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY, c = y > 120 && y > lastY ? true : y < lastY - 4 || y < 60 ? false : this.state.compact;
      lastY = y;
      if (c != this.state.compact) this.setState({ compact: c });
    }, { passive: true });
    // Preload the screenshot library so the first share is quick.
    setTimeout(() => this.loadShotLib().catch(() => {}), 1500);
    // Parlay deep links: #w4-the-truce opens that week and scrolls to the card.
    this.openHash();
    // Back/forward and typed hashes (popstate fires for both).
    window.addEventListener('popstate', () => this.openHash(true));
  }
  // Game days (Thursday, Sunday, Monday and the early hours after): check season.js and the Yahoo
  // feed every 3 minutes. New numbers refresh the page in place unless someone is mid-something,
  // in which case a "New scores" button does it.
  pollScores() {
    if (!LW) return;
    const read = () => Promise.all(['/data/season.js', '/api/league?format=js'].map(u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.text() : '').catch(() => ''))).then(a => a.join('\n'));
    const gameDay = () => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })), day = d.getDay(), h = d.getHours();
      return [4, 0, 1].includes(day) || ([5, 2].includes(day) && h < 2);
    };
    let base = null;
    read().then(t => { base = t; });
    setInterval(async () => {
      if (base == null || document.hidden || !gameDay()) return;
      const t = await read();
      if (!t || t == base) return;
      base = t;
      if (this.isIdle()) this.refreshInPlace(); else this.setState({ newScores: true });
    }, 180000);
  }
  isIdle() {
    const S = this.state, a = document.activeElement;
    return !S.sheet && !S.shareSheet && !S.teamSheet && !S.sharing && !S.reqOpen && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  refreshInPlace() {
    const S = this.state;
    try { sessionStorage.setItem('9feamg-restore', JSON.stringify({ t: Date.now(), y: window.scrollY, tab: S.tab, week: S.week, team: S.team })); } catch {}
    location.reload();
  }
  restoreAfterRefresh() {
    let r = null;
    try { r = JSON.parse(sessionStorage.getItem('9feamg-restore') || 'null'); sessionStorage.removeItem('9feamg-restore'); } catch {}
    if (!r || Date.now() - r.t > 60000) return;
    this.setState({ tab: r.tab, week: r.week, team: r.team });
    setTimeout(() => window.scrollTo(0, r.y), 50);
  }
  // Your team: one picker (the header's crest button), remembered on this phone. Requests,
  // "I'm on it" and "Didn't bet" all use it; when they need it first, the picker opens and
  // carries on with what was tapped (teamSheet.then).
  setMine(m) {
    const S = this.state, then = S.teamSheet?.then;
    try { localStorage.setItem('9feamg-req-mgr', m); } catch {}
    this.setState({ reqMgr: m, teamSheet: null, team: S.tab == 'Teams' ? S.team : m, ...(m != S.reqMgr ? { req: { ...S.req, players: [], playerLegs: {} } } : {}) });
    if (typeof then == 'function') then(m);
  }
  clearMine() {
    try { localStorage.removeItem('9feamg-req-mgr'); } catch {}
    this.setState({ reqMgr: null, teamSheet: null, req: { ...this.state.req, players: [], playerLegs: {} } });
  }
  // One Share button per card: a sheet offers the link or the image.
  shareMenu(title, link, img) { return e => { e?.stopPropagation?.(); this.setState({ shareSheet: { title, link, img } }); }; }
  jump(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  loadRequests() {
    fetch('/api/requests?week=' + LW, { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      .then(d => d && this.setState({ reqs: d.requests || {} })).catch(() => {});
  }
  // Who's on each ticket (/api/tails), for every week that has tickets.
  loadTails() {
    for (const w of Object.keys(D?.parlays || {}))
      fetch('/api/tails?week=' + w, { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
        .then(d => d && this.setState({ tails: { ...this.state.tails, [w]: d.tails || {} }, passes: { ...this.state.passes, [w]: d.passes || {} } })).catch(() => {});
  }
  // "I'm on it": the first tap asks who you are (remembered with the request form's pick).
  // "Didn't bet it" (pass) goes through the same endpoint; only the ticket's owner or requester can.
  // onBehalf: Undo on someone's "didn't bet" acts for them without making them this phone's team.
  async toggleTail(week, slug, as, pass = false, onBehalf = false) {
    const m = as || this.state.reqMgr;
    if (!m) return this.setState({ teamSheet: { then: me => this.toggleTail(week, slug, me, pass) } });
    if (as && !onBehalf) { try { localStorage.setItem('9feamg-req-mgr', as); } catch {} }
    this.setState({ ...(onBehalf ? {} : { reqMgr: m }), tailBusy: slug });
    try {
      const r = await fetch('/api/tails', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ week, slug, manager: m, ...(pass ? { pass: true } : {}) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Couldn’t save that. Try again.');
      this.setState({ tailBusy: null, tails: { ...this.state.tails, [week]: d.tails || {} }, passes: { ...this.state.passes, [week]: d.passes || {} } });
    } catch (err) {
      this.setState({ tailBusy: null });
      this.toast(err.message || 'Couldn’t save that. Try again.');
    }
  }
  async sendRequest(cancel) {
    const S = this.state, m = S.reqMgr;
    if (!m || S.req.sending) return;
    const body = cancel ? { week: LW, manager: m, cancel: true }
      : { week: LW, manager: m, risk: RISKS[S.req.risk].k, legs: S.req.legs, betType: 'mix', players: S.req.players, playerLegs: S.req.playerLegs, game: S.reqAddOpen ? S.req.game.trim() : '' };
    this.setState({ req: { ...S.req, sending: true } });
    try {
      const r = await fetch('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Couldn’t save that. Try again.');
      this.setState({ reqs: d.requests || {}, req: { ...this.state.req, sending: false } });
      this.toast(cancel ? 'Request canceled.' : 'Request sent. It’s built with real DraftKings lines on the next sync and shows here as Built.');
    } catch (err) {
      this.setState({ req: { ...this.state.req, sending: false } });
      this.toast(err.message || 'Couldn’t save that. Try again.');
    }
  }
  // Home: Gameday on the current week, back at the top, with a clean URL (drops #parlay links and ?query).
  goHome(e) {
    e?.preventDefault?.();
    this.setState({ tab: 'Gameday', week: HOME_WK, sheet: null });
    if (location.pathname != '/' || location.search || location.hash) history.pushState(null, '', '/');
    window.scrollTo(0, 0);
  }
  openHash(nav) {
    // #w5 opens that week, #season the standings, #team-mr-g a team page, #wire and #draft those tabs.
    const h = location.hash, wk = h.match(/^#w(\d+)$/), tm = h.match(/^#team-([\w-]+)$/);
    if (!h && nav) { this.setState({ tab: 'Gameday', week: HOME_WK, sheet: null }); window.scrollTo(0, 0); return; }
    if (h == '#wire' || h == '#draft') { this.setState({ tab: h == '#wire' ? 'Wire' : 'Draft', sheet: null }); window.scrollTo(0, 0); return; }
    if (wk) { this.setState({ tab: 'Gameday', week: +wk[1], sheet: null }); window.scrollTo(0, 0); return; }
    if (h == '#season') { this.setState({ tab: 'Season', sheet: null }); window.scrollTo(0, 0); return; }
    // Season sections: #power, #pfpa, #luck, #bench open the Season tab scrolled to that section.
    if (['#power', '#pfpa', '#luck', '#bench'].includes(h)) { this.setState({ tab: 'Season', sheet: null }); setTimeout(() => document.getElementById(h.slice(1))?.scrollIntoView({ block: 'start' }), 350); return; }
    if (h == '#ledger') { this.setState({ tab: 'Gameday', week: HOME_WK, sheet: null }); setTimeout(() => document.getElementById('ledger')?.scrollIntoView({ block: 'start' }), 350); return; }
    if (tm) { const t = MGR.find(x => teamSlug(x) == tm[1]); if (t) { this.setState({ tab: 'Teams', team: t, sheet: null }); window.scrollTo(0, 0); } return; }
    const m = h.match(/^#w(\d+)-([\w-]+)$/);
    if (!m) return;
    this.setState({ tab: 'Gameday', week: +m[1], bustedOpen: true, unbetOpen: true, prOpen: { ...this.state.prOpen, [m[0].slice(1)]: true } });
    setTimeout(() => {
      const el = document.getElementById(m[0].slice(1));
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }, 350);
  }
  // Shares a link through the phone's share sheet where there is one, otherwise copies it.
  async shareLink(url, title, e) {
    e?.stopPropagation?.();
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; }
      catch (err) { if (err.name == 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); }
    catch {
      // Older browsers: copy through a temporary text field.
      const t = document.createElement('textarea'); t.value = url; t.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    this.toast('Link copied.');
  }
  loadShotLib() {
    if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
    if (!this._shotLib) this._shotLib = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = SHOT_LIB.src; s.integrity = SHOT_LIB.integrity; s.crossOrigin = 'anonymous';
      s.onload = () => window.htmlToImage ? res(window.htmlToImage) : rej(new Error('html-to-image missing'));
      s.onerror = () => { this._shotLib = null; rej(new Error('html-to-image failed to load')); };
      document.head.appendChild(s);
    });
    return this._shotLib;
  }
  toast(text, file) {
    clearTimeout(this._toastT);
    this.setState({ toast: { text, file } });
    this._toastT = setTimeout(() => this.setState({ toast: null }), file ? 10000 : 3500);
  }
  // Renders the element marked data-shot="<name>" to a PNG, then opens the share
  // sheet (phones), copies it (desktop) or downloads it as a last resort.
  // Images render from an off-screen copy at phone width (SHOT_W), so they read the same
  // in an iMessage bubble whichever screen shared them, and the page doesn't move.
  async share(name, e) {
    e?.stopPropagation?.();
    const el = document.querySelector(`[data-shot="${name}"]`);
    if (!el || this.state.sharing) return;
    this.setState({ sharing: name });
    const stage = document.createElement('div');
    stage.className = 'offstage'; stage.style.width = (+el.dataset.shotW || SHOT_W) + 'px';
    const copy = el.cloneNode(true);
    // Icon colors like fill:var(--hi-a) come out blank in the image, so bake in the real color.
    const vSrc = el.querySelectorAll('[style*="var(--"]'), vDst = copy.querySelectorAll('[style*="var(--"]');
    vSrc.forEach((n, i) => {
      const d = vDst[i], cs = getComputedStyle(n), st = n.getAttribute('style');
      if (!d) return;
      if (/fill:\s*var/.test(st)) d.style.fill = cs.fill;
      if (/stroke:\s*var/.test(st)) d.style.stroke = cs.stroke;
    });
    copy.removeAttribute('id'); copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    // Drop what images leave out before layout, so the card closes up around the gap.
    copy.querySelectorAll('.no-shot').forEach(n => n.remove());
    copy.classList.add('capturing'); copy.style.margin = '0'; copy.style.width = 'auto';
    stage.appendChild(copy); document.body.appendChild(stage);
    let file;
    try {
      const lib = await this.loadShotLib();
      await new Promise(r => setTimeout(r, 30)); // let the copy lay out (rAF stalls in background tabs)
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      const blob = await lib.toBlob(copy, { pixelRatio: 3, backgroundColor: bg, filter: n => !n.classList?.contains('no-shot') });
      file = new File([blob], `9feamg-${name}.png`, { type: 'image/png' });
    } catch (err) {
      console.error('share capture failed', err);
      this.toast('Couldn’t create the image. Try again.');
      return;
    } finally {
      stage.remove();
      this.setState({ sharing: null });
    }
    await this.deliver(file);
  }
  async deliver(file) {
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]);
        this.toast('Image copied. Paste it into the chat.');
        return;
      }
    } catch (err) {
      if (err.name == 'AbortError') return;
      // iOS drops the tap's permission while the image renders; a second tap re-grants it.
      if (err.name == 'NotAllowedError' && navigator.canShare?.({ files: [file] })) { this.toast('Image ready.', file); return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.toast('Image saved.');
  }
  componentDidUpdate() { this.applyTheme(); this.syncRiskSlider(); this.syncUrl(); }
  // The address bar follows the tabs, so it's always a link to what's on screen:
  // / for this week's Gameday, #w3 for another week, #season, #team-mr-g, #wire, #draft.
  // A deep link that's already more specific (#w4-the-truce, #power) stays put.
  syncUrl() {
    const S = this.state, h = location.hash;
    const want = S.tab == 'Gameday' ? (S.week == HOME_WK ? '' : '#w' + S.week)
      : S.tab == 'Season' ? '#season' : S.tab == 'Teams' ? '#team-' + teamSlug(S.team)
      : S.tab == 'Wire' ? '#wire' : S.tab == 'Draft' ? '#draft' : null;
    if (want == null || h == want) return;
    if (S.tab == 'Gameday' && (h == '#w' + S.week || h.startsWith('#w' + S.week + '-') || h == '#ledger')) return;
    if (S.tab == 'Season' && ['#power', '#pfpa', '#luck', '#bench'].includes(h)) return;
    if (!want && !h) return;
    history.pushState(null, '', want || location.pathname + location.search);
  }
  // The risk slider isn't bound to a value (a bound one is read-only here), so set its
  // position from state when it first appears or the form resets.
  syncRiskSlider() {
    const el = document.querySelector('[data-req-risk]');
    if (el && +el.value != this.state.req.risk) el.value = this.state.req.risk;
    // Same for the "Add a leg?" box, which is unbound so typing isn't interrupted.
    const g = document.querySelector('[data-req-game]');
    if (g && g.value != this.state.req.game) g.value = this.state.req.game;
  }
  // Light by default; a viewer's own pick is remembered on their device.
  theme() {
    if (this.state.theme) return this.state.theme;
    try { const t = localStorage.getItem('9feamg-theme'); if (t == 'light' || t == 'dark') return t; } catch {}
    return this.props.theme ?? 'light';
  }
  applyTheme() {
    const t = this.theme();
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || (t == 'dark' ? '#0D1424' : '#F7F5F0'));
  }
  players(m) { const t = this.state.rosters?.teams?.find(t => t.name == m); return t ? t.players : []; }
  // Whose roster a player (or team defense, by team name) is on: { m, starter, pos }.
  // Final weeks use that week's box score; otherwise the current roster file.
  rosterSpot(name, wk) {
    const wkBox = wk != LW ? this.state.box?.weeks?.[wk] : null;
    if (wkBox) for (const [m, t] of Object.entries(wkBox)) {
      const p = [...t.starters, ...t.bench].find(x => x[1] == name);
      if (p) return { m, starter: p[0] != 'BN' && p[0] != 'IR', pos: p[0] == 'W/R/T' ? 'FLEX' : p[0] == 'DEF' ? 'D/ST' : p[0] };
    }
    for (const t of this.state.rosters?.teams || []) {
      const p = t.players.find(x => x.name == name);
      if (p) return { m: t.name, starter: p.slot == 'starter', pos: p.pos == 'WRT' ? 'FLEX' : p.pos == 'DEF' ? 'D/ST' : p.pos };
    }
    return null;
  }
  // Managers starting at least one player from these NFL teams (e.g. ['Jax', 'Cin']).
  gameStakes(teams, wk) {
    const want = new Set(teams.map(t => t.toLowerCase())), out = [];
    const wkBox = wk != LW ? this.state.box?.weeks?.[wk] : null;
    if (wkBox) Object.entries(wkBox).forEach(([m, t]) => { if (t.starters.some(p => want.has(String(p[2]).toLowerCase()))) out.push(m); });
    else (this.state.rosters?.teams || []).forEach(t => { if (t.players.some(p => p.slot == 'starter' && want.has(String(p.nfl).toLowerCase()))) out.push(t.name); });
    return MGR.filter(m => out.includes(m));
  }
  // A player's fantasy points for the week, if known (live points or final box score).
  fantasyPts(name, wk) {
    if (wk == LW) return LIVEPTS[name] ?? null;
    for (const t of Object.values(this.state.box?.weeks?.[wk] || {})) {
      const p = [...t.starters, ...t.bench].find(x => x[1] == name);
      if (p) return p[4];
    }
    return null;
  }
  // Yahoo box score for a manager's final week: { total, starters, bench }, players as [slot, name, nfl, pos, pts, proj].
  box(m, wk) { return wk != LW ? this.state.box?.weeks?.[wk]?.[m] : null; }
  boxPlayers(list) {
    return list.map(([slot, name, nfl, pos, pts, proj]) => ({
      slot: slot == 'W/R/T' ? 'FLEX' : slot, name,
      meta: [nfl.toUpperCase(), slot == 'W/R/T' || slot == 'BN' || slot == 'IR' ? pos : null, slot == 'BN' || slot == 'IR' || proj == null ? null : 'proj ' + f1(proj)].filter(Boolean).join(' · '),
      pts: slot == 'IR' ? '' : f2(pts),
      // Green when a player beat his projection by 8+, red when he missed it by 8+.
      ptsColor: proj == null ? 'var(--ink)' : pts - proj >= 8 ? 'var(--pos)' : proj - pts >= 8 ? 'var(--neg)' : 'var(--ink)'
    }));
  }
  starters(m, wk) {
    const live = wk == LW, bx = this.box(m, wk);
    if (bx) return this.boxPlayers(bx.starters);
    return this.players(m).filter(p => p.slot == 'starter').sort((a, b) => (ORD[a.pos] ?? 9) - (ORD[b.pos] ?? 9)).map(p => {
      const lp = live ? LIVEPTS[p.name] : null;
      const v = lp ?? (live ? (p.proj ?? p.projected ?? p.projections?.[wk] ?? PPROJ[p.name]) : (p.points?.[wk] ?? p.weeks?.[wk] ?? p.pts?.[wk]));
      return { slot: p.pos == 'WRT' ? 'FLEX' : p.pos, name: p.name, meta: (p.nfl ? p.nfl.toUpperCase() : '—') + (lp != null ? (PLAYING.has(p.name) ? ' · Live' : ' · Final') : live && v != null ? ' · proj' : ''), pts: v != null ? f2(+v) : '—', ptsColor: lp != null ? (PLAYING.has(p.name) ? 'var(--ink)' : 'var(--accentInk)') : v != null && !live ? 'var(--ink)' : 'var(--muted)' };
    });
  }
  side(m, o, wk) {
    const place = ord(ST.findIndex(x => x.m == m) + 1);
    if (wk == LW) {
      const [c, p] = LIVE.scores[m] || [0, 0], op = (LIVE.scores[o] || [0, 0])[1];
      const left = this.startersLeft(m);
      return { m, init: INIT[m], color: col(m), rec: rec(m, NF) + ' · ' + place, info: rec(m, NF) + ' · ' + place, left: left == null ? '' : left ? left + ' left' : 'done', score: f2(p), raw: p, now: f2(c), status: 'Now ' + f2(c), scoreColor: p < op ? 'var(--muted)' : 'var(--ink)', nowColor: c < (LIVE.scores[o] || [0])[0] ? 'var(--muted)' : 'var(--ink)' };
    }
    const s = SC[m][wk - 1], os = SC[o][wk - 1], win = s > os;
    return { m, init: INIT[m], color: col(m), rec: rec(m, wk - 1), info: rec(m, wk - 1), score: f2(s), raw: s, now: '', status: win ? 'Won' : 'Lost', scoreColor: win ? 'var(--ink)' : 'var(--muted)', nowColor: 'var(--muted)' };
  }
  match(pair, wk) {
    const [a, b] = pair, A = this.side(a, b, wk), B = this.side(b, a, wk), gap = Math.abs(A.raw - B.raw), live = wk == LW;
    const lead = A.raw > B.raw ? A.m : B.raw > A.raw ? B.m : null;
    return { a: A, b: B, live,
      // Column headers: Now (live only) and Proj, or Final once the week is done.
      colNow: live ? 'Now' : '', colScore: live ? 'Proj' : 'Final',
      // The gap in words, leader first: "Pablo +3.55 proj" or "Tony won by 9.04".
      chip: lead ? (live ? `${lead} +${f2(gap)} proj` : `${lead} won by ${f2(gap)}`) : live ? 'Even on projection' : 'Tied',
      open: () => this.setState({ sheet: { a, b, wk } }) };
  }
  // Live week: how many of a manager's starters haven't finished (not started or still playing).
  startersLeft(m) {
    const st = this.players(m).filter(p => p.slot == 'starter');
    if (!st.length) return null;
    return st.filter(p => LIVEPTS[p.name] == null || PLAYING.has(p.name)).length;
  }
  // A week's caption. Strings always show; { pair, text } only when that pair is featured.
  // A live week whose featured matchup has no caption gets a plain one from the scores.
  heroCaption(wk, hero) {
    const c = D.captions?.[wk], pair = hero ? [hero.a.m, hero.b.m].sort().join() : '';
    if (typeof c == 'string') return c;
    if (c?.text && [...c.pair].sort().join() == pair) return c.text;
    if (wk != LW || !hero) return '';
    const [A, B] = [hero.a.m, hero.b.m], ca = LIVE.scores[A]?.[0] ?? 0, cb = LIVE.scores[B]?.[0] ?? 0;
    const projLead = hero.a.raw >= hero.b.raw ? A : B, nowLead = ca == cb ? null : ca > cb ? A : B;
    const out = [nowLead ? `${nowLead} is up ${f2(Math.abs(ca - cb))} so far${nowLead == projLead ? '' : ', but the projection favors ' + projLead}.` : 'Level so far.'];
    const la = this.startersLeft(A), lb = this.startersLeft(B), n = x => x + (x == 1 ? ' starter' : ' starters');
    if (la != null && lb != null) out.push(la == lb ? `Both have ${n(la)} left.` : `${A} has ${n(la)} left, ${B} has ${lb}.`);
    // The biggest projection still to kick off on either side.
    const next = [A, B].flatMap(m => this.players(m).filter(p => p.slot == 'starter' && LIVEPTS[p.name] == null && p.proj).map(p => ({ m, p })))
      .sort((x, y) => y.p.proj - x.p.proj)[0];
    if (next) out.push(`Still to come: ${next.p.name}, ${f2(next.p.proj)} projected for ${next.m}.`);
    return out.join(' ');
  }
  renderVals() {
    const S = this.state, themeLabel = this.theme() == 'dark' ? 'Light' : 'Dark', toggleTheme = () => { const t = this.theme() == 'dark' ? 'light' : 'dark'; try { localStorage.setItem('9feamg-theme', t); } catch {} this.setState({ theme: t }); };
    if (!D) return { ok: false, dataError: true, themeLabel, toggleTheme };
    const wk = S.week, boothOn = this.props.trashTalk ?? true;
    // Draft lives in the header (it's rarely used), so the tab bar has four tabs.
    const tabsL = ['Gameday', 'Season', 'Teams', 'Wire'];
    const tabs = tabsL.map(t => ({ label: t, fg: S.tab == t ? 'var(--ink)' : 'var(--muted)', cls: S.tab == t ? 'tab on' : 'tab', cur: S.tab == t ? 'page' : 'false', ['is' + t]: true, pick: t == 'Gameday' ? e => this.goHome(e) : () => { this.setState({ tab: t }); window.scrollTo(0, 0); } }));

    // Gameday
    const chipWeeks = [...Array(NF).keys()].map(i => i + 1);
    if (LW) chipWeeks.push(LW);
    if (NEXT && NEXT.week != LW) chipWeeks.push(NEXT.week);
    const weekChips = chipWeeks.map(w => { const on = w == wk; return { label: 'W' + w, on: on ? '1' : '0', live: w == LW, sub: w == LW ? 'LIVE' : w <= NF ? 'FINAL' : 'NEXT', bg: on ? 'var(--accent)' : 'var(--surface)', fg: on ? 'var(--onAccent)' : (w == LW ? 'var(--accentInk)' : 'var(--ink)'), border: on ? 'var(--accent)' : 'var(--line)', pick: () => { this.setState({ week: w }); if (window.scrollY > 150) window.scrollTo(0, 0); } }; });
    const hasWeek = (wk <= NF || wk == LW) && !!PAIRS[wk];
    let matchups = [], hero = null;
    let heroMine = false;
    if (hasWeek) {
      const all = PAIRS[wk].map(p => this.match(p, wk)).sort((x, y) => Math.abs(x.a.raw - x.b.raw) - Math.abs(y.a.raw - y.b.raw));
      // Your matchup leads, with you on top; otherwise the closest one.
      const mine = S.reqMgr ? all.find(x => x.a.m == S.reqMgr || x.b.m == S.reqMgr) : null;
      hero = mine || all[0]; heroMine = !!mine; matchups = all.filter(x => x != hero);
      if (mine && mine.b.m == S.reqMgr) hero = { ...mine, a: mine.b, b: mine.a };
    }
    const blank = { a: {}, b: {}, share: '50%' };
    const isNext = !hasWeek;
    // Week recap (final weeks): every final score with its Booth line, for sharing.
    // booth[week] runs in schedule order, one line per matchup. Closest finish first;
    // one score row per matchup keeps the phone-width image short.
    // The live week gets the same image as a preview: projections before kickoff (live points
    // once games start) with each matchup's Booth preview line.
    const isFinal = wk <= NF, livePreview = !isFinal && wk == LW && !!PAIRS[wk] && !!LIVE?.scores;
    const hasRecap = (isFinal || livePreview) && !!PAIRS[wk];
    const liveIdx = LIVE_STARTED ? 0 : 1;
    const recap = hasRecap ? PAIRS[wk].map(([a, b], i) => {
      const sa = isFinal ? SC[a][wk - 1] : LIVE.scores[a]?.[liveIdx] ?? 0, sb = isFinal ? SC[b][wk - 1] : LIVE.scores[b]?.[liveIdx] ?? 0;
      const side = (m, s, win) => ({ m, init: INIT[m], color: col(m), score: f2(s), weight: win ? 800 : 500, fg: win ? 'var(--ink)' : 'var(--muted)' });
      const line = boothOn ? (isFinal ? D.booth?.[wk]?.[i]?.[1] : D.boothPreview?.[wk]?.[i]?.[1]) || '' : '';
      return { a: side(a, sa, sa > sb), b: side(b, sb, sb > sa), booth: line, hasBooth: !!line, gap: Math.abs(sa - sb), winner: sa > sb ? a : b };
    }).sort((x, y) => x.gap - y.gap).map((r, i) => ({ ...r, wide: i == 0, wideLabel: `Closest finish · ${r.winner} by ${f2(r.gap)}` })) : [];
    // The Booth, per matchup slot: the recap (after Monday night) leads, with the preview
    // (before Thursday kickoff) tucked under it; a preview alone shows in the recap's spot.
    const recaps = D.booth?.[wk] || [], previews = D.boothPreview?.[wk] || [];
    const boothLines = [...Array(Math.max(recaps.length, previews.length)).keys()].map(i => {
      const r = recaps[i], p = previews[i], main = r || p;
      const pair = PAIRS[wk]?.[i] || [main[0]];
      return main && { crests: pair.map(m => ({ m, init: INIT[m], color: col(m) })), matchup: pair.join(' vs '),
        text: main[1], isPreview: !r, preview: r && p ? p[1] : '', hasPreview: !!(r && p) };
    }).filter(Boolean);
    // Parlay requests (live week only): who's asking, a risk slider, legs, and optional
    // players (their own starters) or a game. A published parlay with request: <manager> fills it.
    const hasReq = !!LW && wk == LW, R = S.req, rk = RISKS[R.risk], rm = S.reqMgr, mine = S.reqs?.[rm];
    // A request is built when a ticket carries its manager and its exact send time (requestAt), so
    // asking again after a ticket is built shows as waiting instead of pointing at the old ticket.
    const builtFor = r => r ? (D.parlays?.[LW] || []).find(p => p.request == r.manager && p.requestAt == r.at) : null;
    const sentAt = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).replace(',', ''); };
    const anchorOf = p => `w${LW}-` + String(p.id ?? p.title ?? p.owner).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const pickMgr = m => () => { try { localStorage.setItem('9feamg-req-mgr', m); } catch {} this.setState({ reqMgr: m, reqPicking: false, req: { ...R, players: [], playerLegs: {} } }); };
    // The requester's starters (no K or DEF), and the two with the best points per game in final weeks.
    const reqStarters = !hasReq || !rm ? [] : this.players(rm).filter(p => p.slot == 'starter' && !['K', 'DEF'].includes(p.pos));
    const ppg = n => { let t = 0, g = 0; for (let w = 1; w <= NF; w++) { const v = this.fantasyPts(n, w); if (v != null) { t += v; g++; } } return g ? t / g : 0; };
    const suggNames = reqStarters.map(p => [p.name, ppg(p.name)]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
    const togglePlayer = n => () => { const on = R.players.includes(n), players = on ? R.players.filter(x => x != n) : [...R.players, n].slice(-3), playerLegs = {};
      for (const x of players) playerLegs[x] = R.playerLegs[x] || 'td';
      this.setState({ req: { ...R, players, playerLegs } }); };
    const chip = n => { const on = R.players.includes(n); return { name: n, short: n.replace(/^(\S)\S*\s+/, '$1. '), bg: on ? 'var(--accent)' : 'transparent', fg: on ? 'var(--onAccent)' : 'var(--ink)', border: on ? 'var(--accent)' : 'var(--line)', pressed: String(on), pick: togglePlayer(n) }; };
    const sugg = suggNames.map(chip), otherPicks = R.players.filter(n => !suggNames.includes(n)).length;
    const parlaysBy = m => Object.values(D.parlays || {}).flat().filter(p => p.owner == m || p.owners?.includes(m)).length;
    const reqForm = !hasReq ? {} : {
      // One sliding row, most parlays made first (ties keep league order).
      mgrs: [...MGR].sort((a, b) => parlaysBy(b) - parlaysBy(a)).map(m => ({ m, init: INIT[m], color: col(m), ring: m == rm ? 'var(--ink)' : 'transparent', fg: m == rm ? 'var(--ink)' : 'var(--muted)', pick: pickMgr(m), pressed: String(m == rm) })),
      // Once someone's picked, the ten crests fold into "Requesting as Matt · Change".
      mgrCollapsed: !!rm, needMgr: !rm, me: rm ? { m: rm, init: INIT[rm], color: col(rm) } : {}, changeMgr: () => this.setState({ teamSheet: {} }),
      hasMgr: !!rm, risk: R.risk, riskLabel: rk.label, riskRange: riskText(rk), riskPay: riskPay(rk),
      reach: reqReach(rk, 'mix', R.legs), hasReach: !!reqReach(rk, 'mix', R.legs),
      legs: ['any', '2', '3', '4', '5', '6+'].map(l => ({ label: l == 'any' ? 'Any' : l, bg: R.legs == l ? 'var(--ink)' : 'transparent', fg: R.legs == l ? 'var(--bg)' : 'var(--ink)', pressed: String(R.legs == l), pick: () => this.setState({ req: { ...R, legs: l } }) })),
      players: reqStarters.map(p => chip(p.name)),
      // Each picked player gets a leg: TD, Yards or their team's moneyline.
      picks: !rm ? [] : R.players.map(n => { const p = this.players(rm).find(x => x.name == n) || { name: n }, cur = R.playerLegs[n] || 'td';
        return { name: n, opts: PICK_LEGS.map(o => ({ label: o.label(p), pressed: String(cur == o.k), bg: cur == o.k ? 'var(--ink)' : 'transparent', fg: cur == o.k ? 'var(--bg)' : 'var(--ink)',
          pick: () => this.setState({ req: { ...R, playerLegs: { ...R.playerLegs, [n]: o.k } } }) })) }; }),
      hasPicks: R.players.length > 0,
      // Two suggested players (best points per game so far), then "Your team" opens the full list.
      suggest: sugg, teamOpen: !!S.reqTeamOpen,
      team: { open: String(!!S.reqTeamOpen), label: (S.reqTeamOpen ? 'Hide team' : 'Your team') + (otherPicks ? ' · ' + otherPicks : ''),
        bg: otherPicks ? 'var(--accent)' : S.reqTeamOpen ? 'var(--ink)' : 'transparent', fg: otherPicks ? 'var(--onAccent)' : S.reqTeamOpen ? 'var(--bg)' : 'var(--ink)', border: otherPicks ? 'var(--accent)' : S.reqTeamOpen ? 'var(--ink)' : 'var(--line)',
        toggle: () => this.setState({ reqTeamOpen: !S.reqTeamOpen }) },
      // "Add a leg?": a typed player or team, folded away until asked for. Opening or closing it starts fresh.
      addOpen: !!S.reqAddOpen, addLabel: S.reqAddOpen ? '− Add a leg?' : '+ Add a leg?',
      toggleAdd: () => this.setState({ reqAddOpen: !this.state.reqAddOpen, req: { ...this.state.req, game: '' } }),
      sendLabel: R.sending ? 'Sending…' : mine && !builtFor(mine) ? 'Update request' : mine ? 'Request another' : 'Request parlay', send: () => this.sendRequest(false),
      hasMine: !!mine && !builtFor(mine), cancel: () => this.sendRequest(true)
    };
    const reqList = Object.values(S.reqs || {}).sort((a, b) => a.at < b.at ? -1 : 1).map(r => {
      const band = RISKS.find(x => x.k == r.risk) || RISKS[1], built = builtFor(r);
      // Older requests may carry a bet type or a typed game bet; show them if so.
      const who = (r.players || []).map(n => r.playerLegs?.[n] ? `${n} ${pickText[r.playerLegs[n]]}` : n);
      const bits = [band.label + ' (' + riskText(band) + ')', r.betType && r.betType != 'mix' ? (BET_TYPES.find(x => x.k == r.betType) || {}).label : '', r.legs == 'any' ? 'any legs' : r.legs + ' legs', who.length ? 'with ' + who.join(', ') : '', r.game || ''].filter(Boolean);
      return { m: r.manager, init: INIT[r.manager], color: col(r.manager), text: bits.join(' · '), status: built ? 'Built ›' : 'Waiting · sent ' + sentAt(r.at),
        statusFg: built ? 'var(--pos)' : 'var(--muted)', href: built ? '#' + anchorOf(built) : null, hasHref: !!built, waiting: !built };
    });
    const nextTitle = NEXT && wk == NEXT.week ? 'Not yet' : 'No matchups';
    const nextNote = NEXT && wk == NEXT.week ? NEXT.note : 'Add this week to the schedule in data/season.js.';
    // Booth parlays for the selected week (data/season.js -> parlays[week]).
    const parlays = (D.parlays?.[wk] || []).map((p, i) => {
      const { status, dec, priced } = parlayState(p), chance = hitChance(p);
      const vs = p.vs ?? opp(p.owner, wk), shot = 'parlay-' + i;
      // Stable link name from the parlay's id, title or owner: 'w4-the-truce'.
      const anchor = ticketSlug(wk, p);
      const legs = p.legs.map(l => {
        const who = l.type == 'ml' ? null : l.player;
        const spot = who ? this.rosterSpot(who, wk) : null, pts = who ? this.fantasyPts(who, wk) : null;
        // Game legs (totals, moneylines) list the managers starting someone in that game.
        const stakes = !who && l.teams ? this.gameStakes(l.teams, wk) : null;
        const owner = spot ? spot.m + '’s ' + (spot.starter ? spot.pos : 'bench') : who ? 'Free agent'
          : stakes ? (stakes.length ? 'Starters in this game: ' + stakes.join(', ') : 'No league starters in this game') : '';
        const meta = [l.result || (pts != null ? f2(pts) + ' fantasy pts' : l.game), l.line != null && !l.text.includes(String(l.line)) ? 'line ' + l.line : null].filter(Boolean).join(' · ');
        const d = toDecimal(l.odds), ip = impliedProb(l.odds), g = l.sgp ? p.sgps?.[l.sgp - 1] : null;
        return { text: l.text, odds: l.sgp ? 'SGP ' + l.sgp : l.odds ? l.odds.replace('-', '−') : '—', oddsSub: l.sgp ? (g ? String(g).replace('-', '−') + ' together' : 'no line') : d ? `×${d.toFixed(2)} · ${Math.round(ip * 100)}%` : 'no line', owner, ownerColor: spot ? col(spot.m) : stakes ? 'var(--accent)' : 'transparent', hasOwner: !!owner,
          // Game legs list every league starter in the game; images leave that list out to stay short.
          ownerCls: stakes ? 'no-shot' : '', meta, ...(LEG_TAG[l.status] || LEG_TAG.open), spot };
      });
      // How the ticket lines up with the fantasy matchup.
      const mine = legs.filter(l => l.spot && l.spot.m == p.owner && l.spot.starter).length, theirs = vs ? legs.filter(l => l.spot && l.spot.m == vs && l.spot.starter).length : 0;
      const proj = wk == LW && p.legs.every(l => (l.status || 'open') != 'miss') && p.legs.some(l => (l.status || 'open') == 'open') ? LIVE.scores?.[p.owner]?.[1] : null, angle = [];
      if (mine) angle.push((mine == legs.length ? (mine == 1 ? 'The leg is' : `All ${mine} legs are`) : `${mine} of ${legs.length} legs ${mine == 1 ? 'is' : 'are'}`) + ` ${p.owner}’s starter${mine == 1 ? '' : 's'}.` + (proj ? ` If this cashes, that ${f2(proj)} projection is probably low.` : ''));
      if (theirs) angle.push(`${theirs == 1 ? 'One leg is' : theirs + ' legs are'} ${vs}’s starter${theirs == 1 ? '' : 's'}. ${p.owner} is betting on the opponent.`);
      // Everyone on the ticket: placedBy/tailers from season.js plus taps from the site.
      // Anyone who said they didn't bet it (owner or requester) comes off.
      const taps = S.tails?.[wk]?.[anchor] || [], fixed = [...(p.placedBy || []), ...(p.tailers || [])], passes = S.passes?.[wk]?.[anchor] || [];
      const owners = p.owners || [p.owner], me = S.reqMgr, onIt = [...new Set([...fixed, ...taps])].filter(m => !passes.includes(m));
      const makers = [...new Set([...owners, p.request].filter(m => MGR.includes(m)))], iPassed = !!me && passes.includes(me);
      const lockedNow = tailsLocked(wk, p), iTapped = !!me && taps.includes(me);
      onIt.filter(m => m == vs && mine).forEach(m => angle.push(`${m} is rooting against these players in the matchup and for them on the ticket.`));
      // Joint tickets (owners: ['Andy', 'Tony']): how many legs come from each lineup.
      if (p.owners?.length > 1) {
        const per = p.owners.map(m => ({ m, n: legs.filter(l => l.spot && l.spot.m == m && l.spot.starter).length })).filter(x => x.n);
        if (per.length) angle.push(per.map(x => `${x.n} ${x.n == 1 ? 'leg' : 'legs'} from ${x.m}’s starters`).join(', ') + '.');
        if (p.owners.length == 2 && opp(p.owners[0], wk) == p.owners[1]) angle.push(`${p.owners[0]} and ${p.owners[1]} play each other this week, so every leg that hits helps one of them in the matchup and both of them on the ticket.`);
      }
      return {
        shot, title: p.title ?? p.owner + '’s parlay', init: INIT[p.owner] ?? p.init ?? p.owner.replace(/^The /, '').slice(0, 2).toUpperCase(), color: ownerCol(p.owner),
        sub: [p.owners ? p.owners.join(' + ') : vs ? 'vs ' + vs : null, 'Week ' + wk, legs.length + (legs.length == 1 ? ' leg' : ' legs')].filter(Boolean).join(' · '),
        legs, status, settled: status != 'OPEN',
        stampColor: status == 'CASHED' ? 'var(--pos)' : 'var(--neg)',
        statusBg: status == 'CASHED' ? 'var(--pos)' : status == 'BUSTED' ? 'var(--neg)' : 'var(--surface2)',
        statusFg: status == 'OPEN' ? 'var(--muted)' : 'var(--onStatus)',
        oddsLabel: (priced ? 'Parlay ' + toAmerican(dec) : 'Lines TBD') + (status == 'OPEN' && chance != null ? ` · ~${pct(chance)} to hit${p.legs.some(l => l.status == 'hit') ? ' now' : ''}` : ''),
        by: (p.owners ? p.owners.join(' & ') : p.owner) + '’s Parlay',
        // e.g. "2.20 × 1.87 × 1.67 = ×6.86 · hits about 1 in 7 (15%)"
        oddsMath: toDecimal(p.odds) ? 'Same-game parlay · book price ' + String(p.odds).replace('-', '−') : priced ? (() => {
          const parts = parlayParts(p), decs = parts.map(toDecimal), prob = parts.reduce((a, o) => a * impliedProb(o), 1);
          return decs.map(x => x.toFixed(2)).join(' × ') + ` = ×${dec.toFixed(2)} · before kickoff about 1 in ${Math.max(1, Math.round(1 / prob))}`;
        })() : `${parlayParts(p).filter(o => toDecimal(o)).length} of ${parlayParts(p).length} ${p.sgps ? 'parts' : 'legs'} priced`,        payout: !priced ? 'Odds calculate once every leg has a line' : (status == 'CASHED' ? '$10 paid $' : status == 'BUSTED' ? '$10 would have paid $' : '$10 pays $') + (10 * dec).toFixed(2),
        angle: angle.join(' '), hasAngle: angle.length > 0,
        // "On it" row: crests of everyone on the ticket. The owner on it means they placed it;
        // tailing your own opponent's parlay is a hedge (win the matchup or cash the ticket).
        withList: onIt.map(m => { const tag = owners.includes(m) ? 'PLACED' : m == vs ? 'HEDGE' : ''; return { m, init: INIT[m] ?? m.slice(0, 2).toUpperCase(), color: ownerCol(m), tag, hasTag: !!tag }; }),
        hasWith: onIt.length > 0, unbet: status == 'OPEN' && !onIt.length && !(me && owners.includes(me)), withLabel: status == 'CASHED' ? 'Cashed with' : status == 'BUSTED' ? 'Busted with' : 'On it',
        canTail: !lockedNow && !(me && fixed.includes(me)) && !iPassed, showTails: onIt.length > 0 || !lockedNow || passes.length > 0 || (!!me && makers.includes(me)),
        // "Didn't bet": shown to the ticket's owner or requester once the phone knows who you are.
        canPass: !!me && makers.includes(me) && !iPassed,
        passLabel: S.tailBusy == anchor ? '…' : 'Didn’t bet',
        tapPass: () => this.toggleTail(wk, anchor, null, true),
        // "<name> didn't bet this one · Undo", one per person who passed.
        hasPassed: passes.length > 0, passedList: passes.map(m => ({ line: m + ' didn’t bet this one.', undo: () => this.toggleTail(wk, anchor, m, true, true) })),
        tailLabel: S.tailBusy == anchor ? '…' : iTapped ? (owners.includes(me) ? 'Placed ✓' : 'You’re on it ✓') : me && owners.includes(me) ? 'I placed it' : 'I’m on it',
        tailPressed: String(iTapped), tailBg: iTapped ? 'var(--accent)' : 'transparent', tailFg: iTapped ? 'var(--onAccent)' : 'var(--ink)', tailBorder: iTapped ? 'var(--accent)' : 'var(--line)',
        tapTail: () => this.toggleTail(wk, anchor, null, false),
        booth: p.booth || '', hasBooth: boothOn && !!p.booth,
        share: e => this.share(shot, e), shareLabel: S.sharing == shot ? '…' : 'Image',
        // /p/<anchor> serves a preview of this parlay to chat apps, then forwards to /#<anchor>.
        anchor, shareLink: e => this.shareLink(location.origin + '/p/' + anchor, p.title, e),
        menu: this.shareMenu(p.title ?? p.owner + '’s parlay', e => this.shareLink(location.origin + '/p/' + anchor, p.title, e), e => this.share(shot, e)),
        // Parlays start collapsed to the header and payout; a deep link opens its card.
        expanded: String(!!S.prOpen?.[anchor]), bodyDisplay: S.prOpen?.[anchor] ? 'block' : 'none',
        legCount: legs.length + (legs.length == 1 ? ' leg' : ' legs'), toggleLabel: S.prOpen?.[anchor] ? 'Hide legs ▴' : 'Show legs ▾',
        toggle: () => this.setState({ prOpen: { ...S.prOpen, [anchor]: !S.prOpen?.[anchor] } }),
        shotLabel: `${p.owner}’s parlay · Week ${wk}`,
        rank: status == 'CASHED' ? 2 : status == 'OPEN' ? 1 : 0, chance: chance ?? -1
      };
    });
    // Cashed and open tickets someone's on (by chance to hit) first, then two collapsible
    // sections: open tickets nobody's on (your own team's stay up top), then busted ones.
    // Each section's toggle sits above its first card.
    const group = x => x.status == 'BUSTED' ? 2 : x.unbet ? 1 : 0;
    parlays.sort((a, b) => group(a) - group(b) || b.rank - a.rank || b.chance - a.chance);
    const sections = [
      { g: 1, open: S.unbetOpen !== false, key: 'unbetOpen', label: n => `Nobody’s on these · ${n}` },
      { g: 2, open: !!S.bustedOpen, key: 'bustedOpen', label: n => `Busted · ${n}` }];
    parlays.forEach(x => { x.firstGroup = false; x.wrapDisplay = 'block'; });
    for (const sec of sections) {
      const list = parlays.filter(x => group(x) == sec.g);
      list.forEach(x => {
        x.firstGroup = x == list[0];
        x.wrapDisplay = sec.open ? 'block' : 'none';
        x.groupLabel = sec.label(list.length);
        x.groupToggleLabel = sec.open ? 'Hide ▴' : 'Show ▾';
        x.groupExpanded = String(sec.open);
        x.toggleGroup = () => this.setState({ [sec.key]: !sec.open });
      });
    }
    // Season ledger: real bets only, a flat $10 each. Everyone who placed or tailed a ticket
    // (placedBy, tailers, "I'm on it" taps) is one bet; tickets nobody is on count as paper.
    const allParlays = Object.entries(D.parlays || {}).flatMap(([w, ps]) => ps.map(p => [w, p]));
    const ledger = { w: 0, l: 0, open: 0, net: 0, unpriced: 0 }, paper = { w: 0, l: 0, open: 0 }, byOwner = {};
    allParlays.forEach(([w, p]) => {
      const s = parlayState(p), k = s.status == 'CASHED' ? 'w' : s.status == 'BUSTED' ? 'l' : 'open';
      const slug = ticketSlug(w, p), passed = S.passes?.[w]?.[slug] || [];
      const bettors = [...new Set([...(p.placedBy || []), ...(p.tailers || []), ...(S.tails?.[w]?.[slug] || [])])].filter(m => !passed.includes(m));
      if (!bettors.length) return paper[k]++;
      bettors.forEach(m => {
        const o = byOwner[m] ??= { m, w: 0, l: 0, open: 0, net: 0 };
        ledger[k]++; o[k]++;
        const won = k == 'w' ? (s.priced ? 10 * (s.dec - 1) : 0) : k == 'l' ? -10 : 0;
        ledger.net += won; o.net += won;
        if (k == 'w' && !s.priced) ledger.unpriced++;
      });
    });
    const money = n => (n < 0 ? '−' : n > 0 ? '+' : '') + '$' + Math.abs(n).toFixed(2), moneyCol = n => n > 0 ? 'var(--pos)' : n < 0 ? 'var(--neg)' : 'var(--muted)';
    const bets = ledger.w + ledger.l + ledger.open;
    const ledgerTiles = [
      { label: 'RECORD', value: `${ledger.w}–${ledger.l}`, color: 'var(--ink)' },
      { label: 'NET', value: money(ledger.net), color: moneyCol(ledger.net) },
      { label: 'OPEN', value: String(ledger.open), color: 'var(--ink)' }];
    const ledgerSub = `${bets} ${bets == 1 ? 'bet' : 'bets'} · $10 each` + (ledger.unpriced ? ` · ${ledger.unpriced} cashed without a line` : '');
    // Best net first; each row: crest, record, open count, net.
    const ledgerOwners = Object.values(byOwner).sort((a, b) => b.net - a.net || b.w - a.w || a.l - b.l).map(o => ({
      m: o.m, init: INIT[o.m] ?? o.m.slice(0, 2).toUpperCase(), color: ownerCol(o.m), rec: `${o.w}–${o.l}`,
      open: o.open ? o.open + ' open' : '', net: money(o.net), netColor: moneyCol(o.net) }));
    const hasPaper = paper.w + paper.l + paper.open > 0;
    const paperLine = `${paper.w}–${paper.l}` + (paper.open ? ` · ${paper.open} open` : '');
    const weekStatus = wk == LW ? `Week ${wk} · ${LIVE.status}` : NEXT && wk == NEXT.week ? `Week ${wk} · ${NEXT.dates}` : `Week ${wk} · Final`;

    // Season
    const P = D.playoffTeams;
    // Power rankings, with movement since the week before.
    const prevRank = NF > 1 ? Object.fromEntries(power(NF - 1).map((r, i) => [r.m, i + 1])) : {};
    const powerRows = NF ? power(NF).map((r, i) => {
      const mv = prevRank[r.m] ? prevRank[r.m] - (i + 1) : 0;
      // One-liner per team for the latest rankings (data/season.js -> powerNotes[week]), from the writer.
      const note = boothOn ? D.powerNotes?.[NF]?.[r.m] || '' : '';
      return { rank: i + 1, m: r.m, init: INIT[r.m], color: col(r.m), score: f1(r.score), wl: r.wl, ...(l => ({ luck: sgn(l), luckColor: l > 0 ? 'var(--pos)' : l < 0 ? 'var(--neg)' : 'var(--muted)' }))(ST.find(s => s.m == r.m).luck), note, hasNote: !!note,
        move: mv > 0 ? '▲' + mv : mv < 0 ? '▼' + -mv : '–', moveColor: mv > 0 ? 'var(--pos)' : mv < 0 ? 'var(--neg)' : 'var(--muted)',
        open: () => { this.setState({ tab: 'Teams', team: r.m }); window.scrollTo(0, 0); } };
    }) : [];
    const standings = ST.map((s, i) => ({ rank: i + 1, m: s.m, rowBg: s.m == S.reqMgr ? 'var(--surface2)' : 'transparent', rowEdge: s.m == S.reqMgr ? col(s.m) : 'transparent', you: s.m == S.reqMgr, init: INIT[s.m], color: col(s.m), pa: f1(s.pa), max: s.max == null ? '—' : f1(s.max), wl: s.w + '–' + s.l, pf: f1(s.pf), luck: sgn(s.luck), luckColor: s.luck > 0 ? 'var(--pos)' : s.luck < 0 ? 'var(--neg)' : 'var(--muted)', cut: i == P - 1, open: () => { this.setState({ tab: 'Teams', team: s.m }); window.scrollTo(0, 0); } }));
    const allS = Object.values(SC).flat(), lo = Math.min(...allS), hi = Math.max(...allS);
    const heatHead = chipWeeks.filter(w => w <= NF).map(w => 'W' + w).concat(LW ? ['W' + LW] : []);
    const restFrom = (LW ?? NF) + 1, total = D.regularSeasonWeeks;
    const restLabel = restFrom < total ? restFrom + '–' + total : restFrom == total ? 'W' + total : '';
    const heatCols = `64px repeat(${heatHead.length},minmax(36px,1fr))` + (restLabel ? ' 36px' : '');
    const heatMinW = (64 + heatHead.length * 40 + (restLabel ? 40 : 0)) + 'px';
    const heat = MGR.map(m => ({ m, cells: [...Array(NF).keys()].map(i => { const w = i + 1, v = SC[m][i], t = (hi - v) / (hi - lo || 1), k = Math.min(5, Math.floor(t * 5) + 1); return { v: f1(v), r: won(m, w) ? 'W' : 'L', bg: `var(--heat${k})`, fg: 'var(--ink)' }; }) }));
    let topW = { v: -1 };
    MGR.forEach(m => SC[m].forEach((v, i) => { if (v > topW.v) topW = { v, m, w: i + 1 }; }));
    const lucky = [...ST].sort((a, b) => b.luck - a.luck)[0], unlucky = [...ST].sort((a, b) => a.luck - b.luck)[0];
    const maxOk = ST.every(s => s.max != null);
    const bench = maxOk ? ST.map(s => ({ m: s.m, b: s.max - s.pf })).sort((a, b) => b.b - a.b)[0] : null;
    const seasonTiles = NF ? [
      { label: 'Top week', value: f1(topW.v), sub: topW.m + ' · W' + topW.w, dot: col(topW.m), color: 'var(--ink)' },
      { label: 'Luckiest', value: sgn(lucky.luck), sub: `${lucky.m} · ${lucky.w}–${lucky.l} on ${lucky.xw.toFixed(2)} xW`, dot: col(lucky.m), color: 'var(--pos)' },
      { label: 'Unluckiest', value: sgn(unlucky.luck), sub: `${unlucky.m} · ${unlucky.w}–${unlucky.l}`, dot: col(unlucky.m), color: 'var(--neg)' },
      bench ? { label: 'Left on bench', value: f1(bench.b), sub: bench.m + ' · ' + NF + (NF == 1 ? ' week' : ' weeks'), dot: col(bench.m), color: 'var(--accentInk)' }
        : { label: 'Left on bench', value: '—', sub: S.loaded ? 'Box scores unavailable' : 'Loading…', dot: 'transparent', color: 'var(--muted)' }
    ] : [];
    const seasonSub = `Through week ${NF} · ${NF} of ${total} weeks final`;

    // Transactions
    const tx = S.tx || [], txOk = !!S.tx;
    const adds = {}, spent = {}; MGR.forEach(m => { adds[m] = 0; spent[m] = 0; });
    tx.forEach(t => { if (t.action == 'add' && t.manager in adds) { adds[t.manager]++; if (t.faab) spent[t.manager] += parseInt(String(t.faab).replace('$', '')) || 0; } });
    const budget = D.faabBudget;

    // Teams
    const tm = S.team, s = ST.find(x => x.m == tm), place = ST.indexOf(s) + 1;
    const res = [...Array(NF).keys()].map(i => won(tm, i + 1) ? 'W' : 'L');
    let k = 0; for (let i = res.length - 1; i >= 0 && res[i] == res[res.length - 1]; i--) k++;
    const pfRank = [...ST].sort((a, b) => b.pf - a.pf).indexOf(s) + 1, paRank = [...ST].sort((a, b) => a.pa - b.pa).indexOf(s) + 1, maxRank = [...ST].sort((a, b) => b.max - a.max).indexOf(s) + 1;
    const bn = s.max - s.pf, rt = S.rosters?.teams?.find(t => t.name == tm);
    const logWeeks = [...Array(NF).keys()].map(i => i + 1).concat(LW ? [LW] : []);
    const log = logWeeks.filter(w => opp(tm, w)).map(w => {
      const o = opp(tm, w);
      if (w == LW) { const a = LIVE.scores[tm] || [0, 0], b = LIVE.scores[o] || [0, 0]; return { w, opp: o, color: col(o), sub: 'Live · now ' + f2(a[0]) + '–' + f2(b[0]), score: f2(a[1]) + '–' + f2(b[1]), r: '·', rbg: 'var(--surface2)', rfg: 'var(--muted)', open: () => this.setState({ sheet: { a: tm, b: o, wk: w } }) }; }
      const ap = allPlay(tm, w), win = won(tm, w);
      return { w, opp: o, color: col(o), sub: ord(ap.rank) + ' of ' + MGR.length + ' · all-play ' + ap.w + '–' + ap.l, score: f2(SC[tm][w - 1]) + '–' + f2(SC[o][w - 1]), r: win ? 'W' : 'L', rbg: win ? 'var(--accent)' : 'var(--surface2)', rfg: win ? 'var(--onAccent)' : 'var(--muted)', open: () => this.setState({ sheet: { a: tm, b: o, wk: w } }) };
    });
    const pl = this.players(tm), lineupWeek = LW ?? NF + 1;
    const lineupMsg = !S.loaded ? 'Loading rosters…' : !S.rosters ? 'Couldn’t load rosters. Try refreshing in a minute.' : '';
    const team = {
      m: tm, init: INIT[tm], color: col(tm), teamName: rt?.team ?? '', roast: D.roasts?.[tm] ?? '',
      line: `${s.w}–${s.l} · ${ord(place)} place` + (NF ? ` · ${res[res.length - 1]}${k} streak` : ''),
      lineupTitle: `Week ${lineupWeek} lineup`, proj: LW ? 'Proj ' + f2(PROJ[tm]) : '',
      stats: [{ label: 'PF', value: f1(s.pf), sub: ord(pfRank) + ' in league' }, { label: 'PA', value: f1(s.pa), sub: ord(paRank) + ' fewest' }, { label: 'Luck', value: sgn(s.luck), sub: 'W − xW', color: s.luck > 0 ? 'var(--pos)' : s.luck < 0 ? 'var(--neg)' : 'var(--ink)' }, { label: 'xW', value: s.xw.toFixed(2), sub: 'vs ' + s.w + ' real wins' }, { label: 'Max PF', value: maxOk ? f1(s.max) : '—', sub: maxOk ? ord(maxRank) + ' best possible' : 'Best possible lineup' }, { label: 'Bench', value: maxOk ? f1(bn) : '—', sub: 'Points left sitting' }, { label: 'FAAB left', value: txOk ? '$' + (budget - spent[tm]) : '—', sub: 'of $' + budget }, { label: 'Adds', value: txOk ? String(adds[tm]) : '—', sub: 'This season' }].map(x => ({ color: 'var(--ink)', isLuck: x.label == 'Luck', isBench: x.label == 'Bench', ...x })),
      log, starters: this.starters(tm, lineupWeek),
      bench: pl.filter(p => p.slot != 'starter').map(p => { const lp = LIVEPTS[p.name]; const v = lp ?? p.proj ?? p.projected ?? p.projections?.[lineupWeek] ?? PPROJ[p.name]; return { slot: p.slot == 'IR' ? 'IR' : p.pos, name: p.name, meta: (p.nfl || '').toUpperCase() + (lp == null && v != null && p.slot != 'IR' ? ' · proj' : lp != null && PLAYING.has(p.name) ? ' · live' : ''), pts: p.slot == 'IR' ? '' : (v != null ? f2(+v) : '—') }; }),
      benchCount: pl.filter(p => p.slot != 'starter').length, lineupMsg, hasLineup: !lineupMsg
    };
    const teamPicker = MGR.map(m => ({ m, init: INIT[m], color: col(m), ring: m == tm ? '2px solid var(--accent)' : '2px solid transparent', ringFill: m == tm ? 'var(--accent)' : 'transparent', op: m == tm ? 1 : .75, fg: m == tm ? 'var(--ink)' : 'var(--muted)', pick: () => this.setState({ team: m }) }));

    // Draft
    const dr = S.draft, picks = [];
    if (dr) Object.entries(dr.rosters).forEach(([yt, r]) => r.picks.forEach(p => picks.push({ ...p, m: r.manager || dr.managerMap[yt] })));
    picks.sort((a, b) => a.overall - b.overall);
    const nT = dr?.teams ?? MGR.length;
    const pn = p => p.round + '.' + String(p.overall - (p.round - 1) * nT).padStart(2, '0');
    const firstOf = pos => picks.find(p => p.pos == pos);
    const draftFirsts = [['FIRST QB', 'QB'], ['FIRST TE', 'TE'], ['FIRST KICKER', 'K'], ['FIRST DEFENSE', 'DEF']].map(([label, pos]) => { const p = firstOf(pos); return p ? { label, player: p.player, pick: pn(p), m: p.m, color: col(p.m) } : { label, player: '—', pick: '', m: '', color: 'transparent' }; });
    const byRound = S.draftMode == 'By round';
    const draftModes = ['By round', 'By team'].map(l => ({ label: l, bg: S.draftMode == l ? 'var(--surface2)' : 'transparent', fg: S.draftMode == l ? 'var(--ink)' : 'var(--muted)', pick: () => this.setState({ draftMode: l }) }));
    const rounds = dr?.rounds ?? 15;
    const draftChips = byRound ? Array.from({ length: rounds }, (_, i) => i + 1).map(r => { const on = r == S.draftRound; return { label: String(r), bg: on ? 'var(--accent)' : 'var(--surface)', fg: on ? 'var(--onAccent)' : 'var(--ink)', border: on ? 'var(--accent)' : 'var(--line)', pick: () => this.setState({ draftRound: r }) }; })
      : MGR.map(m => { const on = m == S.draftTeam; return { label: INIT[m], bg: on ? col(m) : 'var(--surface)', fg: on ? 'var(--onAccent)' : 'var(--ink)', border: on ? col(m) : 'var(--line)', pick: () => this.setState({ draftTeam: m }) }; });
    const rp = byRound ? picks.filter(p => p.round == S.draftRound) : picks.filter(p => p.m == S.draftTeam);
    const draftPicks = rp.map(p => ({ pick: pn(p), player: p.player, who: byRound ? p.m : 'Round ' + p.round + ' · ' + p.overall + ' overall', color: col(p.m), meta: (p.nfl || '').toUpperCase() + ' ' + p.pos }));
    const firstM = picks.filter(p => p.round == S.draftRound)[0]?.m;
    const draftTitle = byRound ? 'Round ' + S.draftRound : S.draftTeam;
    const draftSub = byRound ? (S.draftRound % 2 ? 'Snake →' : '← Snake') + (firstM ? ' · ' + firstM + ' first' : '') : rp.length + ' picks';
    const draftMsg = !S.loaded ? 'Loading the draft…' : !dr ? 'Couldn’t load the draft results. Try refreshing in a minute.' : '';

    // Wire
    const seasonMode = S.wire == 'Season';
    // The window ends at the newest move on file (today when there are none), so the header date
    // and the 7-day counts move on by themselves as transactions come in.
    const txTimes = tx.map(t => parseWhen(t.when).getTime());
    const now = new Date(txTimes.length ? Math.max(...txTimes) : Date.now()), cut = new Date(now.getTime() - (D.wire?.windowDays ?? 7) * 864e5);
    const groups = []; tx.forEach(t => { const d = parseWhen(t.when); const last = groups[groups.length - 1]; if (last && last.m == t.manager && last.when == t.when) last.items.push(t); else groups.push({ m: t.manager, when: t.when, d, items: [t] }); });
    const ym = n => dr?.managerMap?.[n] ?? n;
    const shown = groups.filter(g => seasonMode || g.d >= cut);
    const days = []; shown.forEach(g => {
      const key = g.d.toDateString(); let day = days.find(x => x.key == key);
      if (!day) { day = { key, label: DOW[g.d.getDay()] + ' · ' + g.when.split(',')[0].toUpperCase(), moves: [] }; days.push(day); }
      const time = g.when.split(', ')[1].toUpperCase();
      day.moves.push({ m: g.m, init: INIT[g.m], color: col(g.m), time, lines: g.items.sort((a, b) => (a.action == 'drop') - (b.action == 'drop')).map(t => ({ sign: t.action == 'add' ? '+' : t.action == 'drop' ? '−' : '⇄', color: t.action == 'add' ? 'var(--pos)' : t.action == 'drop' ? 'var(--neg)' : 'var(--accentInk)', player: t.player, weight: t.action == 'drop' ? 400 : 600, fg: t.action == 'drop' ? 'var(--muted)' : 'var(--ink)', meta: [t.pos, (t.nfl || '').toUpperCase(), t.action == 'trade' ? 'Trade with ' + ym(t.via.replace('trade from ', '')) : t.action == 'add' ? (t.via == 'Waivers' ? 'Waivers ' + (typeof t.faab == 'number' ? '$' + t.faab : t.faab ?? '') : 'Free agent') : null].filter(Boolean).join(' · ') })) });
    });
    const wireModes = ['7 days', 'Season'].map(l => ({ label: l, bg: S.wire == l ? 'var(--surface2)' : 'transparent', fg: S.wire == l ? 'var(--ink)' : 'var(--muted)', pick: () => this.setState({ wire: l }) }));
    const byAdds = [...MGR].sort((a, b) => adds[b] - adds[a]); const maxA = Math.max(1, adds[byAdds[0]]);
    const recOf = m => { const st = ST.find(x => x.m == m); return st.w + '–' + st.l; };
    const top = byAdds[0], low = byAdds[byAdds.length - 1];
    const wk7 = {}; groups.filter(g => g.d >= cut).forEach(g => g.items.forEach(t => { if (t.action == 'add') wk7[t.manager] = (wk7[t.manager] || 0) + 1; }));
    // Activity vs record: season adds on Season, the last 7 days' adds on 7 days.
    const actN = m => seasonMode ? adds[m] : wk7[m] || 0;
    const actOrder = [...MGR].sort((a, b) => actN(b) - actN(a)), actMax = Math.max(1, actN(actOrder[0]));
    const activity = actOrder.map(m => ({ m, n: actN(m), w: (actN(m) / actMax * 100) + '%', color: col(m), rec: recOf(m) }));
    const top7 = Object.keys(wk7).sort((a, b) => wk7[b] - wk7[a])[0];
    const wireRoast = !S.loaded ? 'Loading the wire…'
      : !txOk ? 'Couldn’t load transactions. Try refreshing in a minute.'
      : seasonMode ? `${top} leads the league with ${adds[top]} adds and is ${recOf(top)}. ${low} has made ${adds[low]} and is ${recOf(low)}. Draw your own conclusions.`
      : top7 ? `${top7} made ${wk7[top7]} adds this week. ${low} has made ${adds[low]} all season and is ${recOf(low)}. Draw your own conclusions.`
      : 'Nobody has added anyone this week. Suspiciously quiet.';
    const faab = [...MGR].sort((a, b) => spent[a] - spent[b]).map(m => ({ m, left: '$' + (budget - spent[m]), w: ((budget - spent[m]) / budget * 100) + '%', color: col(m) }));
    const noMoves = txOk && !days.length;

    // Lineup sheet
    let sheet = { a: {}, b: {}, rows: [], title: '', note: '' };
    if (S.sheet) {
      const { a, b, wk: w } = S.sheet, A = this.side(a, b, w), B = this.side(b, a, w), sa = this.starters(a, w), sb = this.starters(b, w), n = Math.max(sa.length, sb.length);
      const blankP = { name: '—', meta: '', pts: '' };
      const pair = (x, y) => { const r = []; for (let i = 0; i < Math.max(x.length, y.length); i++) r.push({ slot: (x[i] || y[i]).slot, a: x[i] || blankP, b: y[i] || blankP }); return r; };
      const rows = pair(sa, sb);
      const ba = this.box(a, w), bb = this.box(b, w), hasBox = !!(ba && bb);
      const bench = hasBox ? pair(this.boxPlayers(ba.bench), this.boxPlayers(bb.bench)).map(r => ({ ...r, slot: r.a.slot && r.b.slot && r.a.slot != r.b.slot ? '' : r.slot })) : [];
      const missing = [...sa, ...sb].some(p => p.pts == '—'), live = w == LW;
      const asOf = S.rosters?.asOf ? shortDate(new Date(S.rosters.asOf)) : '';
      const note = hasBox ? 'Final, from Yahoo. Green beat the projection by 8+, red missed it by 8+.'
        : !S.rosters ? (S.loaded ? 'Couldn’t load rosters, so lineups aren’t available.' : 'Loading rosters…')
        : (live ? LIVE.sheetNote : `Lineups shown are current rosters${asOf ? ' as of ' + asOf : ''}, not the Week ${w} lineups.`) + (missing ? ' — = no player ' + (live ? 'projection' : 'score') + ' in the data yet.' : '');
      sheet = { a: A, b: B, rows, bench, hasBench: bench.length > 0, title: 'WEEK ' + w + (live ? ' · LIVE' : ' · FINAL'), ptsLabel: live ? 'PTS/PROJ' : 'PTS', note };
    }

    // Charts
    const hl = S.hl, dim = m => hl && hl != m ? .3 : 1, pickHl = m => () => this.setState({ hl: S.hl == m ? null : m });
    // Extra room above and below keeps the top and bottom dots clear of the corner labels.
    const pfs = ST.map(x => x.pf), pas = ST.map(x => x.pa), x0 = Math.floor(Math.min(...pfs) / 10) * 10 - 5, x1 = Math.ceil(Math.max(...pfs) / 10) * 10 + 5, y0 = Math.floor(Math.min(...pas) / 10) * 10 - 25, y1 = Math.ceil(Math.max(...pas) / 10) * 10 + 25;
    const avg = a => a.reduce((s, v) => s + v, 0) / a.length, sx = v => ((v - x0) / (x1 - x0) * 100).toFixed(1) + '%', sy = v => ((y1 - v) / (y1 - y0) * 100).toFixed(1) + '%';
    // Nudge overlapping dots apart so every crest stays readable and tappable. DX/DY are a
    // 30px dot plus a gap, as a share of the plot: 340px tall, and on a phone the screen
    // width less the card's padding (desktop columns are wider, so this is the tight case).
    const plotW = Math.max(200, Math.min(window.innerWidth || 440, 440) - 94);
    const pts = ST.map(x => ({ x: (x.pf - x0) / (x1 - x0), y: (y1 - x.pa) / (y1 - y0) })), DX = 36 / plotW, DY = 36 / 340;
    for (let it = 0; it < 80; it++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j], dx = (b.x - a.x) / DX, dy = (b.y - a.y) / DY, d = Math.hypot(dx, dy);
      if (d >= 1) continue;
      const push = (1 - d) / 2, ux = d ? dx / d : 1, uy = d ? dy / d : 0;
      a.x -= ux * push * DX; b.x += ux * push * DX; a.y -= uy * push * DY; b.y += uy * push * DY;
    }
    const plotPos = v => (Math.min(0.97, Math.max(0.03, v)) * 100).toFixed(1) + '%';
    const scatter = ST.map((x, i) => ({ init: INIT[x.m], color: col(x.m), x: plotPos(pts[i].x), y: plotPos(pts[i].y), op: dim(x.m), ring: hl == x.m ? 'var(--ink)' : 'var(--bg)', z: hl == x.m ? 5 : 1, pick: pickHl(x.m) }));
    const maxL = Math.max(0.01, ...ST.map(x => Math.abs(x.luck)));
    const luckBars = [...ST].sort((a, b) => b.luck - a.luck).map(x => ({ m: x.m, v: sgn(x.luck), pos: x.luck > 0 ? (x.luck / maxL * 100) + '%' : '0%', neg: x.luck < 0 ? (-x.luck / maxL * 100) + '%' : '0%', color: x.luck > 0 ? 'var(--pos)' : x.luck < 0 ? 'var(--neg)' : 'var(--muted)', op: dim(x.m), pick: pickHl(x.m) }));
    const topMax = Math.max(...ST.map(x => x.max ?? x.pf));
    const benchBars = !maxOk ? [] : [...ST].sort((a, b) => (b.max - b.pf) - (a.max - a.pf)).map(x => ({ m: x.m, pf: (x.pf / topMax * 100) + '%', bench: ((x.max - x.pf) / topMax * 100) + '%', v: f1(x.max - x.pf), color: 'var(--muted)', op: dim(x.m), pick: pickHl(x.m) }));

    return {
      ok: true, dataError: false,
      scatter, scatterMidX: sx(avg(pfs)), scatterMidY: sy(avg(pas)), pfMin: x0, pfMax: x1, paMin: y0, paMax: y1, luckBars, benchBars, hlHint: hl ? hl + ' · tap again to clear' : 'Tap a team',
      themeLabel, toggleTheme,
      draftIconCls: S.tab == 'Draft' ? 'hi play inv' : 'hi', goHome: e => this.goHome(e), openDraft: () => { this.setState({ tab: 'Draft' }); window.scrollTo(0, 0); },
      draftBtnBg: S.tab == 'Draft' ? 'var(--accent)' : 'var(--surface)', draftBtnFg: S.tab == 'Draft' ? 'var(--onAccent)' : 'var(--ink)', draftBtnBorder: S.tab == 'Draft' ? 'var(--accent)' : 'var(--line)',
      tabs, tabGameday: S.tab == 'Gameday', tabSeason: S.tab == 'Season', tabTeams: S.tab == 'Teams', tabDraft: S.tab == 'Draft', tabWire: S.tab == 'Wire',
      // Gameday header, jump links, your-team prompt, scores time, request toggle, share sheet.
      gamedaySub: hasRecap ? (isFinal ? 'Week recap · scores + Booth' : LIVE_STARTED ? 'Live week · scores + Booth' : 'Week preview · projections + Booth') : '9 Fantasy Experts & Mr. Glenn',
      gamedayShare: hasRecap ? this.shareMenu(`Week ${wk}`, e => this.shareLink(location.origin + '/#w' + wk, '9FEAMG · Week ' + wk, e), e => this.share('recap', e)) : null, hasGamedayShare: !!hasRecap,
      jumps: hasWeek ? [['Matchups', 'matchups'], ...(boothOn && boothLines.length ? [['Booth', 'booth']] : []), ...(parlays.length || hasReq ? [['Parlays', 'parlays']] : [])].map(([label, id]) => ({ label, go: () => this.jump(id) })) : [], hasJumps: hasWeek,
      // Header crest button and the one "Your team" picker.
      hasMe: !!S.reqMgr, noMe: !S.reqMgr, meInit: INIT[S.reqMgr] || '', meColor: S.reqMgr ? col(S.reqMgr) : 'transparent',
      meLabel: S.reqMgr ? 'Your team: ' + S.reqMgr + '. Change' : 'Pick your team', openTeamSheet: () => this.setState({ teamSheet: {} }),
      hasTeamSheet: !!S.teamSheet, teamSheetNote: S.teamSheet?.then ? 'Pick your team to carry on.' : 'Your matchup goes first on Gameday, your Standings row is highlighted and Teams opens on you. Requests and “I’m on it” use it too.',
      teamSheetMgrs: [...MGR].sort((a, b) => parlaysBy(b) - parlaysBy(a)).map(m => ({ m, init: INIT[m], color: col(m), ring: m == S.reqMgr ? 'var(--ink)' : 'transparent', fg: m == S.reqMgr ? 'var(--ink)' : 'var(--muted)', pressed: String(m == S.reqMgr), pick: () => this.setMine(m) })),
      canClearTeam: !!S.reqMgr, clearTeam: () => this.clearMine(), closeTeamSheet: () => this.setState({ teamSheet: null }),
      heroMine,
      scoresAsOf: wk == LW && LIVE?.asOf ? asOfLabel(LIVE.asOf) : '', hasAsOf: wk == LW && !!LIVE?.asOf,
      newScores: !!S.newScores, refreshNow: () => this.refreshInPlace(),
      reqOpen: !!S.reqOpen, reqClosed: !S.reqOpen, openReq: () => this.setState({ reqOpen: true }), closeReq: () => this.setState({ reqOpen: false }),
      hasShareSheet: !!S.shareSheet, shareSheetTitle: S.shareSheet?.title || '',
      sheetLink: e => { const f = S.shareSheet?.link; this.setState({ shareSheet: null }); f?.(e); },
      sheetImg: e => { const f = S.shareSheet?.img; this.setState({ shareSheet: null }); f?.(e); },
      closeShareSheet: () => this.setState({ shareSheet: null }), stopTap: e => e.stopPropagation(),
      compactCls: S.compact ? 'app compact' : 'app',
      deskTabs: tabs,
      weekChips, isW5: isNext, nextTitle, nextNote, hasWeek, hero: hero || blank, matchups, heroLabel: heroMine ? 'Your matchup' : wk == LW ? 'Matchup of the week' : 'Closest finish', heroCaption: this.heroCaption(wk, hero),
      weekStatus, parlays, hasParlays: parlays.length > 0, hasLedger: allParlays.length > 0, ledgerTiles, ledgerSub, ledgerOwners, hasLedgerRows: ledgerOwners.length > 0, hasPaper, paperLine,
      shareLedger: e => this.share('ledger', e), ledgerLabel: S.sharing == 'ledger' ? '…' : 'Image',
      linkLedger: e => this.shareLink(location.origin + '/s/ledger', '9FEAMG · Parlay ledger', e), shotLedger: `Parlay ledger · through week ${LW}`,
      hasReq, reqForm, reqList, hasReqList: reqList.length > 0,
      showBooth: boothOn, booth: boothLines, hasBooth: boothOn && boothLines.length > 0,
      seasonSub, seasonTiles, standings, playoffLine: `Playoff line · top ${P} of ${MGR.length}`,
      heat, heatHead, heatCols, heatMinW, restLabel, hasRest: !!restLabel, liveCol: !!LW,
      team, teamPicker,
      draftInfo: D.draftInfo, draftToolUrl: D.draftToolUrl || '', hasDraftTool: !!D.draftToolUrl, draftOk: !draftMsg, draftMsg, draftFirsts, draftModes, draftChips, draftPicks, draftTitle, draftSub,
      wireSub: 'Adds, drops, trades and FAAB · through ' + shortDate(now), wireModes, activityLabel: seasonMode ? 'Adds · season' : 'Adds · 7 days', wireSeason: txOk, wireDays: days, noMoves, activity, wireRoast, wireBanner: boothOn || !txOk, faab, faabBudget: '$' + budget + ' budget', txOk,
      sheetOpen: !!S.sheet, sheet, closeSheet: () => this.setState({ sheet: null }),
      // Share buttons
      menuHero: this.shareMenu('This matchup', e => this.shareLink(location.origin + '/#w' + S.week, '9FEAMG · Week ' + S.week, e), e => this.share('hero', e)),
      menuStandings: this.shareMenu('Standings', e => this.shareLink(location.origin + '/#season', '9FEAMG · Standings', e), e => this.share('standings', e)),
      menuPower: this.shareMenu('Power rankings', e => this.shareLink(location.origin + '/#power', '9FEAMG · Power rankings', e), e => this.share('power', e)),
      menuTeam: this.shareMenu(S.team, e => this.shareLink(location.origin + '/#team-' + teamSlug(S.team), '9FEAMG · ' + S.team, e), e => this.share('team', e)),
      menuLedger: this.shareMenu('Parlay ledger', e => this.shareLink(location.origin + '/s/ledger', '9FEAMG · Parlay ledger', e), e => this.share('ledger', e)),
      ...Object.fromEntries([['Pfpa', 'pfpa', 'Points for vs against'], ['Luck', 'luck', 'Luck'], ['Bench', 'bench', 'Points left on bench']].map(([k, id, title]) =>
        ['menu' + k, this.shareMenu(title, e => this.shareLink(location.origin + '/s/' + id, '9FEAMG · ' + title, e), e => this.share(id, e))])),
      shareHero: e => this.share('hero', e), shareStandings: e => this.share('standings', e), shareTeam: e => this.share('team', e),
      shareLabel: { hero: S.sharing == 'hero' ? '…' : 'Image', standings: S.sharing == 'standings' ? '…' : 'Image', team: S.sharing == 'team' ? '…' : 'Image' },
      hasRecap, recap, recapTitle: `Week ${wk} · ${isFinal ? 'Final' : LIVE_STARTED ? 'Live' : 'Preview'}`, recapBar: isFinal ? 'Week recap · scores + Booth' : LIVE_STARTED ? 'Live week · scores + Booth' : 'Week preview · projections + Booth', shareRecap: e => this.share('recap', e), recapLabel: S.sharing == 'recap' ? '…' : 'Image',
      powerRows, hasPower: powerRows.length > 0, powerSub: `Through week ${NF}`, sharePower: e => this.share('power', e), powerLabel: S.sharing == 'power' ? '…' : 'Image',
      linkPower: e => this.shareLink(location.origin + '/#power', '9FEAMG · Power rankings', e), shotPower: `Power rankings · through week ${NF}`,
      // Season charts: a link to the chart and an image of it.
      ...Object.fromEntries([['Pfpa', 'pfpa', 'Points for vs against'], ['Luck', 'luck', 'Luck'], ['Bench', 'bench', 'Points left on bench']].flatMap(([k, id, title]) => [
        // Links go through /s/<chart> so chats show a preview image of the chart (api/section.js).
        ['link' + k, e => this.shareLink(location.origin + '/s/' + id, '9FEAMG · ' + title, e)], ['shot' + k, e => this.share(id, e)],
        ['shotLabel' + k, S.sharing == id ? '…' : 'Image'], ['shotNote' + k, `${title} · through week ${NF}`]])),
      linkHero: e => this.shareLink(location.origin + '/#w' + S.week, '9FEAMG · Week ' + S.week, e),
      linkStandings: e => this.shareLink(location.origin + '/#season', '9FEAMG · Standings', e),
      linkTeam: e => this.shareLink(location.origin + '/#team-' + teamSlug(S.team), '9FEAMG · ' + S.team, e),
      shotHero: `Week ${wk} · ${wk == LW ? 'Live' : 'Final'}`, shotStandings: `Standings · through week ${NF}`, shotTeam: `${tm} · through week ${NF}`,
      toastOn: !!S.toast, toastText: S.toast?.text ?? '', toastAct: !!S.toast?.file,
      toastDo: () => { const f = S.toast?.file; this.setState({ toast: null }); if (f) navigator.share({ files: [f] }).catch(() => {}); }
    };
  }
}
