// App logic. build.js splices this into src/app.html's x-dc script before bundling.
// All season numbers come from data/season.js (window.SEASON).
const D = window.SEASON;
const MGR = D ? D.managers.map(x => x.m) : [];
const INIT = D ? Object.fromEntries(D.managers.map(x => [x.m, x.init])) : {};
const HUE = D ? Object.fromEntries(D.managers.map(x => [x.m, x.hue])) : {};
const col = m => `oklch(0.76 0.12 ${HUE[m] ?? 0})`;
const SC = D ? D.scores : {};
const NF = D ? Math.max(0, ...MGR.map(m => (SC[m] || []).length)) : 0; // weeks final
const LIVE = D ? D.live : null;
const LW = LIVE ? LIVE.week : null;
const NEXT = D ? D.next : null;
const LIVEPTS = LIVE?.playerPoints || {};
const PPROJ = D?.projections || {};
const PAIRS = D ? D.schedule : {};
const PROJ = Object.fromEntries(MGR.map(m => [m, LIVE?.scores?.[m]?.[1] ?? 0]));
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
  const max = D?.maxPF?.[m] ?? pf;
  return { m, w, l, pf, pa, max, xw, luck: Math.round((w - xw) * 100) / 100 };
}).sort((a, b) => b.w - a.w || b.pf - a.pf);

class Component extends DCLogic {
  state = { tab: this.props.startTab ?? 'Gameday', week: LW ?? NF, theme: null, sheet: null, team: MGR[0], wire: '7 days', draftMode: 'By round', draftRound: 1, draftTeam: MGR[0], rosters: null, draft: null, tx: null, loaded: false };
  componentDidMount() {
    this.applyTheme();
    Promise.all(['uploads/9feamg-rosters.json', 'uploads/9feamg-draft-rosters.json', 'uploads/9feamg-transactions.json', 'uploads/9feamg-boxscores.json']
      .map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null)))
      .then(([rosters, draft, tx, box]) => this.setState({ rosters, draft, tx, box, loaded: true }));
    // Keep the newest week chips in view once the season gets long.
    setTimeout(() => { const el = document.querySelector('[data-weekchips]'); if (el) el.scrollLeft = el.scrollWidth; }, 0);
    // Preload the screenshot library so the first share is quick.
    setTimeout(() => this.loadShotLib().catch(() => {}), 1500);
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
  async share(name, e) {
    e?.stopPropagation?.();
    const el = document.querySelector(`[data-shot="${name}"]`);
    if (!el || this.state.sharing) return;
    this.setState({ sharing: name });
    el.classList.add('capturing');
    let file;
    try {
      const lib = await this.loadShotLib();
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      const blob = await lib.toBlob(el, { pixelRatio: 2, backgroundColor: bg, style: { margin: '0' }, filter: n => !n.classList?.contains('no-shot') });
      file = new File([blob], `9feamg-${name}.png`, { type: 'image/png' });
    } catch (err) {
      console.error('share capture failed', err);
      this.toast('Couldn’t create the image. Try again.');
      return;
    } finally {
      el.classList.remove('capturing');
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
  componentDidUpdate() { this.applyTheme(); }
  theme() { return this.state.theme ?? this.props.theme ?? 'dark'; }
  applyTheme() { document.documentElement.dataset.theme = this.theme(); }
  players(m) { const t = this.state.rosters?.teams?.find(t => t.name == m); return t ? t.players : []; }
  // Yahoo box score for a manager's final week: { total, starters, bench }, players as [slot, name, nfl, pos, pts, proj].
  box(m, wk) { return wk != LW ? this.state.box?.weeks?.[wk]?.[m] : null; }
  boxPlayers(list) {
    return list.map(([slot, name, nfl, pos, pts, proj]) => ({
      slot: slot == 'W/R/T' ? 'FLEX' : slot, name,
      meta: [nfl.toUpperCase(), slot == 'W/R/T' || slot == 'BN' || slot == 'IR' ? pos : null, slot == 'BN' || slot == 'IR' ? null : 'proj ' + f1(proj)].filter(Boolean).join(' · '),
      pts: slot == 'IR' ? '' : f2(pts),
      // Green when a player beat his projection by 8+, red when he missed it by 8+.
      ptsColor: pts - proj >= 8 ? 'var(--pos)' : proj - pts >= 8 ? 'var(--neg)' : 'var(--ink)'
    }));
  }
  starters(m, wk) {
    const live = wk == LW, bx = this.box(m, wk);
    if (bx) return this.boxPlayers(bx.starters);
    return this.players(m).filter(p => p.slot == 'starter').sort((a, b) => (ORD[a.pos] ?? 9) - (ORD[b.pos] ?? 9)).map(p => {
      const lp = live ? LIVEPTS[p.name] : null;
      const v = lp ?? (live ? (p.proj ?? p.projected ?? p.projections?.[wk] ?? PPROJ[p.name]) : (p.points?.[wk] ?? p.weeks?.[wk] ?? p.pts?.[wk]));
      return { slot: p.pos == 'WRT' ? 'FLEX' : p.pos, name: p.name, meta: (p.nfl ? p.nfl.toUpperCase() : '—') + (lp != null ? ' · Final' : ''), pts: v != null ? (lp != null ? f2(+v) : f1(+v)) : '—', ptsColor: lp != null ? 'var(--accentInk)' : v != null ? 'var(--ink)' : 'var(--muted)' };
    });
  }
  side(m, o, wk) {
    const place = ord(ST.findIndex(x => x.m == m) + 1);
    if (wk == LW) {
      const [c, p] = LIVE.scores[m] || [0, 0], op = (LIVE.scores[o] || [0, 0])[1];
      return { m, init: INIT[m], color: col(m), rec: rec(m, NF) + ' · ' + place, score: f2(p), raw: p, status: 'Now ' + f2(c), scoreColor: p < op ? 'var(--muted)' : 'var(--ink)' };
    }
    const s = SC[m][wk - 1], os = SC[o][wk - 1], win = s > os;
    return { m, init: INIT[m], color: col(m), rec: rec(m, wk - 1), score: f2(s), raw: s, status: win ? 'Won' : 'Lost', scoreColor: win ? 'var(--ink)' : 'var(--muted)' };
  }
  match(pair, wk) {
    const [a, b] = pair, A = this.side(a, b, wk), B = this.side(b, a, wk), gap = Math.abs(A.raw - B.raw), live = wk == LW;
    return { a: A, b: B, gap: live ? 'Proj gap ' + f2(gap) + ' · live' : 'Margin ' + f2(gap), mid: live ? 'proj gap ' + f2(gap) : 'final', share: (A.raw / (A.raw + B.raw || 1) * 100).toFixed(1) + '%', open: () => this.setState({ sheet: { a, b, wk } }) };
  }
  renderVals() {
    const S = this.state, themeLabel = this.theme() == 'dark' ? 'Light' : 'Dark', toggleTheme = () => this.setState({ theme: this.theme() == 'dark' ? 'light' : 'dark' });
    if (!D) return { ok: false, dataError: true, themeLabel, toggleTheme };
    const wk = S.week, boothOn = this.props.trashTalk ?? true;
    const tabsL = ['Gameday', 'Season', 'Teams', 'Draft', 'Wire'];
    const tabs = tabsL.map(t => ({ label: t, fg: S.tab == t ? 'var(--ink)' : 'var(--muted)', bar: S.tab == t ? 'var(--accent)' : 'transparent', pick: () => { this.setState({ tab: t }); window.scrollTo(0, 0); } }));

    // Gameday
    const chipWeeks = [...Array(NF).keys()].map(i => i + 1);
    if (LW) chipWeeks.push(LW);
    if (NEXT && NEXT.week != LW) chipWeeks.push(NEXT.week);
    const weekChips = chipWeeks.map(w => { const on = w == wk; return { label: 'W' + w, sub: w == LW ? '● LIVE' : w <= NF ? 'FINAL' : 'NEXT', bg: on ? 'var(--accent)' : 'var(--surface)', fg: on ? 'var(--onAccent)' : (w == LW ? 'var(--accentInk)' : 'var(--ink)'), border: on ? 'var(--accent)' : 'var(--line)', pick: () => this.setState({ week: w }) }; });
    const hasWeek = (wk <= NF || wk == LW) && !!PAIRS[wk];
    let matchups = [], hero = null;
    if (hasWeek) { const all = PAIRS[wk].map(p => this.match(p, wk)).sort((x, y) => Math.abs(x.a.raw - x.b.raw) - Math.abs(y.a.raw - y.b.raw)); hero = all[0]; matchups = all.slice(1); }
    const blank = { a: {}, b: {}, share: '50%' };
    const isNext = !hasWeek;
    const nextTitle = NEXT && wk == NEXT.week ? 'Not yet' : 'No matchups';
    const nextNote = NEXT && wk == NEXT.week ? NEXT.note : 'Add this week to the schedule in data/season.js.';
    const weekStatus = wk == LW ? `Week ${wk} · ${LIVE.status} · big number = projected` : NEXT && wk == NEXT.week ? `Week ${wk} · ${NEXT.dates}` : `Week ${wk} · Final`;

    // Season
    const P = D.playoffTeams;
    const standings = ST.map((s, i) => ({ rank: i + 1, m: s.m, init: INIT[s.m], color: col(s.m), pa: f1(s.pa), max: f1(s.max), wl: s.w + '–' + s.l, pf: f1(s.pf), luck: sgn(s.luck), luckColor: s.luck > 0 ? 'var(--pos)' : s.luck < 0 ? 'var(--neg)' : 'var(--muted)', cut: i == P - 1, open: () => { this.setState({ tab: 'Teams', team: s.m }); window.scrollTo(0, 0); } }));
    const allS = Object.values(SC).flat(), lo = Math.min(...allS), hi = Math.max(...allS);
    const heatHead = chipWeeks.filter(w => w <= NF).map(w => 'W' + w).concat(LW ? ['W' + LW] : []);
    const restFrom = (LW ?? NF) + 1, total = D.regularSeasonWeeks;
    const restLabel = restFrom < total ? restFrom + '–' + total : restFrom == total ? 'W' + total : '';
    const heatCols = `64px repeat(${heatHead.length},minmax(36px,1fr))` + (restLabel ? ' 36px' : '');
    const heatMinW = (64 + heatHead.length * 40 + (restLabel ? 40 : 0)) + 'px';
    const heat = MGR.map(m => ({ m, cells: [...Array(NF).keys()].map(i => { const w = i + 1, v = SC[m][i], t = (hi - v) / (hi - lo || 1), p = Math.round(6 + t * 80); return { v: f1(v), r: won(m, w) ? 'W' : 'L', bg: `color-mix(in oklch, var(--accent) ${p}%, var(--surface2))`, fg: p > 55 ? '#141311' : 'var(--ink)' }; }) }));
    let topW = { v: -1 };
    MGR.forEach(m => SC[m].forEach((v, i) => { if (v > topW.v) topW = { v, m, w: i + 1 }; }));
    const lucky = [...ST].sort((a, b) => b.luck - a.luck)[0], unlucky = [...ST].sort((a, b) => a.luck - b.luck)[0];
    const bench = ST.map(s => ({ m: s.m, b: s.max - s.pf })).sort((a, b) => b.b - a.b)[0];
    const seasonTiles = NF ? [
      { label: 'Top week', value: f1(topW.v), sub: topW.m + ' · W' + topW.w, dot: col(topW.m), color: 'var(--ink)' },
      { label: 'Luckiest', value: sgn(lucky.luck), sub: `${lucky.m} · ${lucky.w}–${lucky.l} on ${lucky.xw.toFixed(2)} xW`, dot: col(lucky.m), color: 'var(--pos)' },
      { label: 'Unluckiest', value: sgn(unlucky.luck), sub: `${unlucky.m} · ${unlucky.w}–${unlucky.l}`, dot: col(unlucky.m), color: 'var(--neg)' },
      { label: 'Left on bench', value: f1(bench.b), sub: bench.m + ' · ' + NF + (NF == 1 ? ' week' : ' weeks'), dot: col(bench.m), color: 'var(--accentInk)' }
    ] : [];
    const seasonSub = `Through week ${NF} · ${NF} of ${total} weeks final`;

    // Transactions
    const tx = S.tx || [], txOk = !!S.tx;
    const adds = {}, spent = {}; MGR.forEach(m => { adds[m] = 0; spent[m] = 0; });
    tx.forEach(t => { if (t.action == 'add' && t.manager in adds) { adds[t.manager]++; if (t.faab) spent[t.manager] += parseInt(t.faab.replace('$', '')) || 0; } });
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
      stats: [{ label: 'PF', value: f1(s.pf), sub: ord(pfRank) + ' in league' }, { label: 'PA', value: f1(s.pa), sub: ord(paRank) + ' fewest' }, { label: 'Luck', value: sgn(s.luck), sub: 'W − xW', color: s.luck > 0 ? 'var(--pos)' : s.luck < 0 ? 'var(--neg)' : 'var(--ink)' }, { label: 'xW', value: s.xw.toFixed(2), sub: 'vs ' + s.w + ' real wins' }, { label: 'Max PF', value: f1(s.max), sub: ord(maxRank) + ' best possible' }, { label: 'Bench', value: f1(bn), sub: 'Points left sitting' }, { label: 'FAAB left', value: txOk ? '$' + (budget - spent[tm]) : '—', sub: 'of $' + budget }, { label: 'Adds', value: txOk ? String(adds[tm]) : '—', sub: 'This season' }].map(x => ({ color: 'var(--ink)', ...x })),
      log, starters: this.starters(tm, lineupWeek),
      bench: pl.filter(p => p.slot != 'starter').map(p => { const lp = LIVEPTS[p.name]; const v = lp ?? p.proj ?? p.projected ?? p.projections?.[lineupWeek] ?? PPROJ[p.name]; return { slot: p.slot == 'IR' ? 'IR' : p.pos, name: p.name, meta: (p.nfl || '').toUpperCase(), pts: p.slot == 'IR' ? '' : (v != null ? (lp != null ? f2(+v) : f1(+v)) : '—') }; }),
      benchCount: pl.filter(p => p.slot != 'starter').length, lineupMsg, hasLineup: !lineupMsg
    };
    const teamPicker = MGR.map(m => ({ m, init: INIT[m], color: col(m), ring: m == tm ? '2px solid var(--accent)' : '2px solid transparent', op: m == tm ? 1 : .75, fg: m == tm ? 'var(--ink)' : 'var(--muted)', pick: () => this.setState({ team: m }) }));

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
      : MGR.map(m => { const on = m == S.draftTeam; return { label: INIT[m], bg: on ? col(m) : 'var(--surface)', fg: on ? '#141311' : 'var(--ink)', border: on ? col(m) : 'var(--line)', pick: () => this.setState({ draftTeam: m }) }; });
    const rp = byRound ? picks.filter(p => p.round == S.draftRound) : picks.filter(p => p.m == S.draftTeam);
    const draftPicks = rp.map(p => ({ pick: pn(p), player: p.player, who: byRound ? p.m : 'Round ' + p.round + ' · ' + p.overall + ' overall', color: col(p.m), meta: (p.nfl || '').toUpperCase() + ' ' + p.pos }));
    const firstM = picks.filter(p => p.round == S.draftRound)[0]?.m;
    const draftTitle = byRound ? 'Round ' + S.draftRound : S.draftTeam;
    const draftSub = byRound ? (S.draftRound % 2 ? 'Snake →' : '← Snake') + (firstM ? ' · ' + firstM + ' first' : '') : rp.length + ' picks';
    const draftMsg = !S.loaded ? 'Loading the draft…' : !dr ? 'Couldn’t load the draft results. Try refreshing in a minute.' : '';

    // Wire
    const seasonMode = S.wire == 'Season';
    const now = new Date(D.wire.asOf), cut = new Date(now.getTime() - D.wire.windowDays * 864e5);
    const groups = []; tx.forEach(t => { const d = parseWhen(t.when); const last = groups[groups.length - 1]; if (last && last.m == t.manager && last.when == t.when) last.items.push(t); else groups.push({ m: t.manager, when: t.when, d, items: [t] }); });
    const ym = n => dr?.managerMap?.[n] ?? n;
    const shown = groups.filter(g => seasonMode || g.d >= cut);
    const days = []; shown.forEach(g => {
      const key = g.d.toDateString(); let day = days.find(x => x.key == key);
      if (!day) { day = { key, label: DOW[g.d.getDay()] + ' · ' + g.when.split(',')[0].toUpperCase(), moves: [] }; days.push(day); }
      const time = g.when.split(', ')[1].toUpperCase();
      day.moves.push({ m: g.m, init: INIT[g.m], color: col(g.m), time, lines: g.items.sort((a, b) => (a.action == 'drop') - (b.action == 'drop')).map(t => ({ sign: t.action == 'add' ? '+' : t.action == 'drop' ? '−' : '⇄', color: t.action == 'add' ? 'var(--pos)' : t.action == 'drop' ? 'var(--neg)' : 'var(--accentInk)', player: t.player, weight: t.action == 'drop' ? 400 : 600, fg: t.action == 'drop' ? 'var(--muted)' : 'var(--ink)', meta: [t.pos, (t.nfl || '').toUpperCase(), t.action == 'trade' ? 'Trade with ' + ym(t.via.replace('trade from ', '')) : t.action == 'add' ? (t.via == 'Waivers' ? 'Waivers ' + (t.faab ?? '') : 'Free agent') : null].filter(Boolean).join(' · ') })) });
    });
    const wireModes = ['7 days', 'Season'].map(l => ({ label: l, bg: S.wire == l ? 'var(--surface2)' : 'transparent', fg: S.wire == l ? 'var(--ink)' : 'var(--muted)', pick: () => this.setState({ wire: l }) }));
    const byAdds = [...MGR].sort((a, b) => adds[b] - adds[a]); const maxA = Math.max(1, adds[byAdds[0]]);
    const recOf = m => { const st = ST.find(x => x.m == m); return st.w + '–' + st.l; };
    const activity = byAdds.map(m => ({ m, n: adds[m], w: (adds[m] / maxA * 100) + '%', color: col(m), rec: recOf(m) }));
    const top = byAdds[0], low = byAdds[byAdds.length - 1];
    const wk7 = {}; groups.filter(g => g.d >= cut).forEach(g => g.items.forEach(t => { if (t.action == 'add') wk7[t.manager] = (wk7[t.manager] || 0) + 1; }));
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
    const pfs = ST.map(x => x.pf), pas = ST.map(x => x.pa), x0 = Math.floor(Math.min(...pfs) / 10) * 10 - 5, x1 = Math.ceil(Math.max(...pfs) / 10) * 10 + 5, y0 = Math.floor(Math.min(...pas) / 10) * 10 - 10, y1 = Math.ceil(Math.max(...pas) / 10) * 10 + 10;
    const avg = a => a.reduce((s, v) => s + v, 0) / a.length, sx = v => ((v - x0) / (x1 - x0) * 100).toFixed(1) + '%', sy = v => ((y1 - v) / (y1 - y0) * 100).toFixed(1) + '%';
    const scatter = ST.map(x => ({ init: INIT[x.m], color: col(x.m), x: sx(x.pf), y: sy(x.pa), op: dim(x.m), ring: hl == x.m ? 'var(--ink)' : 'var(--bg)', z: hl == x.m ? 5 : 1, pick: pickHl(x.m) }));
    const maxL = Math.max(0.01, ...ST.map(x => Math.abs(x.luck)));
    const luckBars = [...ST].sort((a, b) => b.luck - a.luck).map(x => ({ m: x.m, v: sgn(x.luck), pos: x.luck > 0 ? (x.luck / maxL * 100) + '%' : '0%', neg: x.luck < 0 ? (-x.luck / maxL * 100) + '%' : '0%', color: x.luck > 0 ? 'var(--pos)' : x.luck < 0 ? 'var(--neg)' : 'var(--muted)', op: dim(x.m), pick: pickHl(x.m) }));
    const topMax = Math.max(...ST.map(x => x.max));
    const benchBars = [...ST].sort((a, b) => (b.max - b.pf) - (a.max - a.pf)).map(x => ({ m: x.m, pf: (x.pf / topMax * 100) + '%', bench: ((x.max - x.pf) / topMax * 100) + '%', v: f1(x.max - x.pf), color: 'var(--muted)', op: dim(x.m), pick: pickHl(x.m) }));

    return {
      ok: true, dataError: false,
      scatter, scatterMidX: sx(avg(pfs)), scatterMidY: sy(avg(pas)), pfMin: x0, pfMax: x1, luckBars, benchBars, hlHint: hl ? hl + ' · tap again to clear' : 'Tap a team',
      themeLabel, toggleTheme,
      tabs, tabGameday: S.tab == 'Gameday', tabSeason: S.tab == 'Season', tabTeams: S.tab == 'Teams', tabDraft: S.tab == 'Draft', tabWire: S.tab == 'Wire',
      weekChips, isW5: isNext, nextTitle, nextNote, hasWeek, hero: hero || blank, matchups, heroLabel: wk == LW ? 'Matchup of the week' : 'Closest finish', heroCaption: D.captions?.[wk] || '',
      weekStatus,
      showBooth: boothOn, booth: (D.booth?.[wk] || []).map(([m, text]) => ({ init: INIT[m], color: col(m), text })), hasBooth: boothOn && !!D.booth?.[wk]?.length,
      seasonSub, seasonTiles, standings, playoffLine: `Playoff line · top ${P} of ${MGR.length}`,
      heat, heatHead, heatCols, heatMinW, restLabel, hasRest: !!restLabel, liveCol: !!LW,
      team, teamPicker,
      draftInfo: D.draftInfo, draftOk: !draftMsg, draftMsg, draftFirsts, draftModes, draftChips, draftPicks, draftTitle, draftSub,
      wireSub: 'Adds, drops, trades and FAAB · through ' + shortDate(now), wireModes, wireSeason: seasonMode && txOk, wireDays: days, noMoves, activity, wireRoast, wireBanner: boothOn || !txOk, faab, faabBudget: '$' + budget + ' budget', txOk,
      sheetOpen: !!S.sheet, sheet, closeSheet: () => this.setState({ sheet: null }),
      // Share buttons
      shareHero: e => this.share('hero', e), shareStandings: e => this.share('standings', e), shareTeam: e => this.share('team', e),
      shareLabel: { hero: S.sharing == 'hero' ? '…' : 'Share', standings: S.sharing == 'standings' ? '…' : 'Share', team: S.sharing == 'team' ? '…' : 'Share' },
      shotHero: `Week ${wk} · ${wk == LW ? 'Live' : 'Final'}`, shotStandings: `Standings · through week ${NF}`, shotTeam: `${tm} · through week ${NF}`,
      toastOn: !!S.toast, toastText: S.toast?.text ?? '', toastAct: !!S.toast?.file,
      toastDo: () => { const f = S.toast?.file; this.setState({ toast: null }); if (f) navigator.share({ files: [f] }).catch(() => {}); }
    };
  }
}
