// Checks data/season.js and the uploads before a push, using the same math as the site and the
// link previews (api/_shared.js). Prints problems (✗), warnings (!) and what the site will show
// for the Wire line and lineup alerts. Exits 1 if anything is wrong. Usage: node scripts/check.js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { seasonStats, byStandings, kickoffAt, nflKey, lineupIssues, wireOf, pointsOf, ticketSlug, parlayState, parlayFair, impliedProb, toAmerican, playoffOdds, oddsPct, matchupOdds, boothPickRecord } from '../api/_shared.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const box = { window: {} }; vm.runInNewContext(read('data/season.js'), box);
const S = box.window.SEASON, rosters = JSON.parse(read('uploads/9feamg-rosters.json'));
const tx = JSON.parse(read('uploads/9feamg-transactions.json')), scores = JSON.parse(read('uploads/9feamg-boxscores.json'));
const MGR = S.managers.map(x => x.m), bad = [], warn = [];
const st = seasonStats(S, scores), NF = st.NF, LW = S.live?.week;

// Schedule: every listed week pairs all ten managers once.
for (const [w, pairs] of Object.entries(S.schedule)) {
  const seen = pairs.flat();
  if (seen.length != MGR.length || new Set(seen).size != MGR.length || !seen.every(m => MGR.includes(m))) bad.push(`Week ${w} schedule doesn't pair all ${MGR.length} managers once.`);
}
// Scores: one per final week for everyone, and only for weeks on the schedule.
for (const m of MGR) if ((S.scores[m] || []).length != NF) bad.push(`${m} has ${(S.scores[m] || []).length} final scores; others have ${NF}.`);
for (let w = 1; w <= NF; w++) if (!S.schedule[w]) bad.push(`Week ${w} has final scores but no schedule.`);
if (LW && LW != NF + 1) warn.push(`live.week is ${LW} but ${NF} weeks are final.`);
if (LW && !S.schedule[LW]) bad.push(`live.week ${LW} has no schedule.`);
if (LW && !S.nfl?.[LW]) warn.push(`No nfl[${LW}] (ESPN schedule): kickoff times and bye alerts fall back to Sunday noon / Monday night.`);
if (st.maxOk === false) warn.push('Some final weeks have no box score, so Max PF and bench points are blank.');
// Booth lines run in schedule order: line i is about matchup i.
for (const key of ['booth', 'boothSnf', 'boothPreview']) for (const [w, lines] of Object.entries(S[key] || {})) lines.forEach(([m], i) => {
  const pair = S.schedule[w]?.[i];
  if (!pair) bad.push(`${key}[${w}] line ${i + 1} (${m}) has no matchup ${i + 1}.`);
  else if (!pair.includes(m)) bad.push(`${key}[${w}] line ${i + 1} is tagged ${m} but matchup ${i + 1} is ${pair.join(' vs ')}.`);
});
// Parlays: unique links, legs with a readable kickoff and a game this week, and a price.
// Games compare on their teams (nflKey), since weeks spell Washington WSH or WAS.
const matchupKey = g => { const m = String(g || '').match(/·\s*(\S+)\s*@\s*(\S+)/); return m ? nflKey(m[1]) + '@' + nflKey(m[2]) : null; };
for (const [w, list] of Object.entries(S.parlays || {})) {
  const slugs = list.map(p => ticketSlug(w, p));
  slugs.forEach((s, i) => { if (slugs.indexOf(s) != i) bad.push(`Two week ${w} tickets share the link ${s}.`); });
  for (const p of list) {
    for (const l of p.legs) {
      if (!kickoffAt(S, +w, l.game)) bad.push(`${ticketSlug(w, p)}: leg "${l.text}" has no readable kickoff ("${l.game}").`);
      else if (S.nfl?.[w] && !S.nfl[w].games.some(g => matchupKey(g) == matchupKey(l.game)) && / · /.test(l.game)) warn.push(`${ticketSlug(w, p)}: "${l.game}" isn't in nfl[${w}].`);
      if (!['open', 'hit', 'miss', 'push', undefined].includes(l.status)) bad.push(`${ticketSlug(w, p)}: leg "${l.text}" has status "${l.status}".`);
      if (l.fair != null && !(typeof l.fair == 'number' && l.fair > 0 && l.fair < 1)) bad.push(`${ticketSlug(w, p)}: leg "${l.text}" has fair ${l.fair} (a chance between 0 and 1).`);
      if (l.ladder != null && (l.type != 'td' || !Array.isArray(l.ladder) || l.ladder.length < 2 || l.ladder.some(o => impliedProb(o) == null))) bad.push(`${ticketSlug(w, p)}: leg "${l.text}" has a bad ladder (a TD leg's 1+, 2+ and 3+ TD prices).`);
      if (l.vs != null && impliedProb(l.vs) == null) bad.push(`${ticketSlug(w, p)}: leg "${l.text}" has an unreadable vs price "${l.vs}".`);
    }
    const ps = parlayState(p);
    if (!ps.priced) warn.push(`${ticketSlug(w, p)} isn't fully priced.`);
    const fr = parlayFair(p);
    if (fr && !(fr.edge > 0 && fr.edge < 0.5)) warn.push(`${ticketSlug(w, p)}: book edge ${Math.round(fr.edge * 100)}% looks wrong; check the vs prices.`);
    if (p.request && !p.requestAt) warn.push(`${ticketSlug(w, p)} was built for ${p.request}'s request but has no requestAt.`);
  }
}
// Rosters: the live week's lineups name only known managers.
for (const t of rosters.teams) if (!MGR.includes(t.name)) bad.push(`Roster file has an unknown team "${t.name}".`);

// What the site will show.
const out = [];
const ST = [...st.rows].sort(byStandings);
out.push('Standings: ' + ST.map((r, i) => `${i + 1}. ${r.m} ${r.w}–${r.l}`).join(', '));
// Win odds for the live week's matchups (Post-SNF lines quote these), and the Booth's picks.
const MO = matchupOdds(S, rosters);
if (MO) out.push(`Win odds, Week ${LW}: ` + MO.map(o => `${o.a} ${oddsPct(o.pa)}–${oddsPct(1 - o.pa)} ${o.b}`).join(', '));
for (const [w, picks] of Object.entries(S.boothPicks || {})) (picks || []).forEach((p, i) => {
  const pair = S.schedule[w]?.[i];
  if (!pair) bad.push(`boothPicks[${w}][${i}] has no matchup.`);
  else if (!pair.includes(p?.[0])) bad.push(`boothPicks[${w}][${i}] picks ${p?.[0]}, who isn't in ${pair.join(' vs ')}.`);
  else if (!(p[1] >= 1 && p[1] <= 99)) bad.push(`boothPicks[${w}][${i}]: the win % should be 1–99, not ${p[1]}.`);
});
{ const R = boothPickRecord(S), open = Object.entries(S.boothPicks || {}).filter(([w]) => +w > NF).flatMap(([w, p]) => p.map(x => `W${w} ${x[0]} ${x[1]}%`));
  if (R.graded.length || open.length) out.push(`Booth picks: ${R.w}–${R.l} graded${open.length ? ' · open: ' + open.join(', ') : ''}`); }
// Playoff odds as the site shows them (to check odds quoted in Booth lines against).
const OD = playoffOdds(S);
if (!OD) warn.push(`No playoff odds: the schedule needs every week through ${S.regularSeasonWeeks}.`);
else out.push('Playoff odds (playoffs/bye/last): ' + Object.entries(OD.teams).sort((a, b) => b[1].playoffs - a[1].playoffs).map(([m, o]) => `${m} ${oddsPct(o.playoffs, !OD.weeksLeft)}/${oddsPct(o.bye, !OD.weeksLeft)}/${oddsPct(o.last, !OD.weeksLeft)}`).join(', '));
const pts = (n, w) => pointsOf(S, scores, n, w);
out.push('Wire, this week: ' + wireOf(S, tx, pts, 'week').line);
out.push('Wire, season:    ' + wireOf(S, tx, pts, 'season').line);
if (LW) for (const t of rosters.teams) {
  const { bye, out: o, empty } = lineupIssues(S, t.players.filter(p => p.slot == 'starter'), LW, S.live.playerPoints || {});
  const bits = [...bye.map(p => p.name + ' on bye'), ...o.map(p => p.name + ' Out'), ...(empty.length ? [empty.length + ' empty'] : [])];
  if (bits.length) out.push(`Alert, ${t.name}: ${bits.join(', ')}`);
}
for (const p of S.parlays?.[LW] || []) { const s = parlayState(p); const f = parlayFair(p); out.push(`Ticket ${ticketSlug(LW, p)}: ${s.status}${s.priced ? ' ' + toAmerican(s.dec) : ''}${f ? ` (fair ${f.est ? '~' : ''}${toAmerican(f.dec)}${f.est ? ' est.' : ''}, book edge ${(f.edge * 100).toFixed(1)}%)` : ''}`); }

console.log(out.join('\n'));
if (warn.length) console.log('\n' + warn.map(x => '! ' + x).join('\n'));
if (bad.length) { console.log('\n' + bad.map(x => '✗ ' + x).join('\n')); process.exit(1); }
console.log('\nOK: data/season.js checks out.');
