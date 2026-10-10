// Checks data/season.js and the uploads before a push, using the same math as the site and the
// link previews (api/_shared.js). Prints problems (✗), warnings (!) and what the site will show
// for the Wire line and lineup alerts. Exits 1 if anything is wrong. Usage: node scripts/check.js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { seasonStats, byStandings, kickoffAt, lineupIssues, wireOf, pointsOf, ticketSlug, parlayState, toAmerican } from '../api/_shared.js';

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
for (const key of ['booth', 'boothPreview']) for (const [w, lines] of Object.entries(S[key] || {})) lines.forEach(([m], i) => {
  const pair = S.schedule[w]?.[i];
  if (!pair) bad.push(`${key}[${w}] line ${i + 1} (${m}) has no matchup ${i + 1}.`);
  else if (!pair.includes(m)) bad.push(`${key}[${w}] line ${i + 1} is tagged ${m} but matchup ${i + 1} is ${pair.join(' vs ')}.`);
});
// Parlays: unique links, legs with a readable kickoff and a game this week, and a price.
for (const [w, list] of Object.entries(S.parlays || {})) {
  const slugs = list.map(p => ticketSlug(w, p));
  slugs.forEach((s, i) => { if (slugs.indexOf(s) != i) bad.push(`Two week ${w} tickets share the link ${s}.`); });
  for (const p of list) {
    for (const l of p.legs) {
      if (!kickoffAt(S, +w, l.game)) bad.push(`${ticketSlug(w, p)}: leg "${l.text}" has no readable kickoff ("${l.game}").`);
      else if (S.nfl?.[w] && !S.nfl[w].games.some(g => g.split(' · ')[1] == String(l.game).split(' · ')[1]) && / · /.test(l.game)) warn.push(`${ticketSlug(w, p)}: "${l.game}" isn't in nfl[${w}].`);
      if (!['open', 'hit', 'miss', undefined].includes(l.status)) bad.push(`${ticketSlug(w, p)}: leg "${l.text}" has status "${l.status}".`);
    }
    const ps = parlayState(p);
    if (!ps.priced) warn.push(`${ticketSlug(w, p)} isn't fully priced.`);
    if (p.request && !p.requestAt) warn.push(`${ticketSlug(w, p)} was built for ${p.request}'s request but has no requestAt.`);
  }
}
// Rosters: the live week's lineups name only known managers.
for (const t of rosters.teams) if (!MGR.includes(t.name)) bad.push(`Roster file has an unknown team "${t.name}".`);

// What the site will show.
const out = [];
const ST = [...st.rows].sort(byStandings);
out.push('Standings: ' + ST.map((r, i) => `${i + 1}. ${r.m} ${r.w}–${r.l}`).join(', '));
const pts = (n, w) => pointsOf(S, scores, n, w);
out.push('Wire, this week: ' + wireOf(S, tx, pts, 'week').line);
out.push('Wire, season:    ' + wireOf(S, tx, pts, 'season').line);
if (LW) for (const t of rosters.teams) {
  const { bye, out: o, empty } = lineupIssues(S, t.players.filter(p => p.slot == 'starter'), LW, S.live.playerPoints || {});
  const bits = [...bye.map(p => p.name + ' on bye'), ...o.map(p => p.name + ' Out'), ...(empty.length ? [empty.length + ' empty'] : [])];
  if (bits.length) out.push(`Alert, ${t.name}: ${bits.join(', ')}`);
}
for (const p of S.parlays?.[LW] || []) { const s = parlayState(p); out.push(`Ticket ${ticketSlug(LW, p)}: ${s.status}${s.priced ? ' ' + toAmerican(s.dec) : ''}`); }

console.log(out.join('\n'));
if (warn.length) console.log('\n' + warn.map(x => '! ' + x).join('\n'));
if (bad.length) { console.log('\n' + bad.map(x => '✗ ' + x).join('\n')); process.exit(1); }
console.log('\nOK: data/season.js checks out.');
