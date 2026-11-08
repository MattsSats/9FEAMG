// Roster strength for the playoff odds (playoffOdds in api/_shared.js; Matt, Nov 8, 2026): what each
// team's best healthy lineup projects to score, by week, written to data/season.js as `rosterProj`.
// rosterProj[w] is the roster at the start of week w: weeks already final from the box scores file
// (that week's roster and Yahoo's projections), the live week from the rosters file. The odds as of
// week W blend this (rosterProj[W + 1]) with the season average, so a trade or a season-ending
// injury shows up that day instead of weeks later.
// Best lineup: QB, 2 RB, 2 WR, TE, a RB/WR/TE flex, K and DEF from everyone not on IR or tagged Out.
// A player on bye that week counts at his projection from the nearest week he had one (box scores,
// any team); a player with no Yahoo projection yet (a new add) at ESPN's, else the same lookup.
// Run after each Yahoo apply: node scripts/roster-strength.mjs [--dry-run]
import fs from 'fs';
import vm from 'vm';

const SEASON = 'data/season.js', dry = process.argv.includes('--dry-run');
const src = fs.readFileSync(SEASON, 'utf8'), box = { window: {} };
vm.createContext(box); vm.runInContext(src, box);
const S = box.window.SEASON, MGR = S.managers.map(x => x.m), LW = S.live?.week;
const B = JSON.parse(fs.readFileSync('uploads/9feamg-boxscores.json', 'utf8')).weeks;
const R = JSON.parse(fs.readFileSync('uploads/9feamg-rosters.json', 'utf8'));

// Every projection a player had, by week, from the box scores (any team).
const seen = {};
for (const [w, teams] of Object.entries(B)) for (const t of Object.values(teams))
  for (const [, name, , , , proj] of [...t.starters, ...t.bench]) if (proj > 0) (seen[name] ||= {})[w] = proj;
const nearest = (name, w) => {
  const h = seen[name]; if (!h) return 0;
  const k = Object.keys(h).map(Number).sort((a, b) => Math.abs(a - w) - Math.abs(b - w) || b - a)[0];
  return k ? h[k] : 0;
};
const onBye = (nfl, w) => (S.nfl?.[w]?.byes || []).includes(String(nfl).toUpperCase());

const best = ps => {
  const by = pos => ps.filter(p => p.pos == pos).sort((a, b) => b.v - a.v), take = (l, n) => l.splice(0, n).reduce((s, p) => s + p.v, 0);
  const QB = by('QB'), RB = by('RB'), WR = by('WR'), TE = by('TE'), K = by('K'), D = by('DEF');
  let t = take(QB, 1) + take(RB, 2) + take(WR, 2) + take(TE, 1) + take(K, 1) + take(D, 1);
  const flex = [...RB, ...WR, ...TE].sort((a, b) => b.v - a.v);
  return Math.round((t + take(flex, 1)) * 100) / 100;
};

const out = {};
// Final weeks, from the box scores.
for (const [wk, teams] of Object.entries(B)) {
  const w = +wk; if (w == LW) continue;
  out[w] = Object.fromEntries(MGR.map(m => {
    const t = teams[m]; if (!t) return [m, null];
    const ps = [...t.starters, ...t.bench].filter(([slot]) => slot != 'IR')
      .map(([, name, nfl, pos, , proj]) => ({ pos, v: onBye(nfl, w) ? nearest(name, w) : proj || 0 }));
    return [m, best(ps)];
  }));
}
// The live week, from the rosters file.
if (LW && R.week == LW) out[LW] = Object.fromEntries(MGR.map(m => {
  const t = R.teams.find(t => t.name == m); if (!t) return [m, null];
  const ps = t.players.filter(p => p.slot != 'IR' && !['O', 'IR'].includes(String(p.inj || '').toUpperCase()))
    .map(p => ({ pos: p.pos, v: onBye(p.nfl, LW) ? nearest(p.name, LW) : p.proj > 0 ? p.proj : p.espn > 0 ? p.espn : nearest(p.name, LW) }));
  return [m, best(ps)];
}));

for (const w of Object.keys(out)) if (MGR.some(m => out[w][m] == null)) delete out[w];
const weeks = Object.keys(out).map(Number).sort((a, b) => a - b);
for (const w of weeks) console.log(`Week ${w}: ` + MGR.map(m => `${m} ${out[w][m].toFixed(2)}`).join(', '));

const block = '  // Roster strength (scripts/roster-strength.mjs): each team\'s best healthy lineup, projected, at the\n' +
  '  // start of each week. The playoff odds blend it with the season average. Written by the script; don\'t edit.\n' +
  '  rosterProj: {\n' + weeks.map(w => `    ${w}: { ` + MGR.map(m => `${/^[A-Za-z]+$/.test(m) ? m : `'${m}'`}: ${out[w][m]}`).join(', ') + ' }').join(',\n') + '\n  },\n';
let next;
if (/\n  \/\/ Roster strength[\s\S]*?\n  rosterProj: \{[\s\S]*?\n  \},\n/.test(src)) next = src.replace(/\n  \/\/ Roster strength[\s\S]*?\n  rosterProj: \{[\s\S]*?\n  \},\n/, '\n' + block);
else next = src.replace(/\n  scores: \{/, '\n' + block + '  scores: {');
if (next == src) { console.log('rosterProj unchanged.'); process.exit(0); }
if (dry) { console.log('Dry run: nothing written.'); process.exit(0); }
fs.writeFileSync(SEASON, next);
console.log(`Written: ${SEASON} (rosterProj, weeks ${weeks[0]}–${weeks.at(-1)})`);
