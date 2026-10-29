// ESPN's fantasy projections for the rostered QBs, RBs, WRs and TEs, for the win odds (Matt, Oct 29, 2026:
// Yahoo's projections alone are one source; matchupOdds in api/_shared.js averages the two). Runs locally.
//
//   node scripts/espn-proj.mjs [--dry-run]
//
// Reads ESPN's public player feed (no key) for the rosters file's week, standard and PPR scoring, and
// writes their average, which is half-PPR like the league, to each matched player as `espn` in
// uploads/9feamg-rosters.json, with `espn: { week, asOf, source }` at the top. ESPN's other scoring
// (4-point passing TDs, −2 per interception against Yahoo's −1) is close to Yahoo's but not the same.
// Kickers and defenses keep Yahoo's number alone, since the two sites score them differently. A player
// ESPN doesn't project this week (bye) gets no `espn`. Run it after every Yahoo apply; apply-yahoo keeps
// the numbers for players it already had while the week is the same.
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'uploads', '9feamg-rosters.json'), dry = process.argv.includes('--dry-run');
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data', 'season.js'), 'utf8'), box);
const year = box.window.SEASON.year, R = JSON.parse(fs.readFileSync(FILE, 'utf8')), wk = R.week;
if (!year || !wk) throw new Error('season.js needs year and the rosters file needs week');

// ESPN position ids: 1 QB, 2 RB, 3 WR, 4 TE.
const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE' };
async function feed(scoring) {
  const filter = { players: { filterSlotIds: { value: [0, 2, 4, 6] }, filterStatsForTopScoringPeriodIds: { value: 2, additionalValue: [`11${year}${wk}`] }, sortPercOwned: { sortPriority: 1, sortAsc: false }, limit: 2000 } };
  const r = await fetch(`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leaguedefaults/${scoring}?view=kona_player_info`,
    { headers: { 'x-fantasy-filter': JSON.stringify(filter), accept: 'application/json' } });
  if (!r.ok) throw new Error(`ESPN ${r.status}`);
  const out = new Map();
  for (const { player: p } of (await r.json()).players || []) {
    const s = (p.stats || []).find(x => x.statSourceId == 1 && x.scoringPeriodId == wk && x.seasonId == year);
    if (POS[p.defaultPositionId] && s?.appliedTotal != null) (out.get(key(p.fullName)) || out.set(key(p.fullName), []).get(key(p.fullName))).push({ pos: POS[p.defaultPositionId], pts: s.appliedTotal });
  }
  return out;
}
// Names compared without punctuation or suffixes ("Kenneth Walker III" = "Kenneth Walker").
const key = n => String(n || '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z0-9]/g, '');

const [std, ppr] = await Promise.all([feed(1), feed(3)]);
const skill = new Set(Object.values(POS)), missed = [];
let n = 0;
for (const t of R.teams) for (const p of t.players) {
  delete p.espn;
  const pick = m => { const l = m.get(key(p.name)) || []; return l.length == 1 ? l[0] : l.find(x => x.pos == p.pos) || null; };
  const a = pick(std), b = pick(ppr);
  if (!a || !b || !skill.has(a.pos)) { if (skill.has(p.pos) || p.pos == 'WRT') if (p.proj > 0) missed.push(`${t.name}: ${p.name}`); continue; }
  p.espn = Math.round((a.pts + b.pts) / 2 * 100) / 100; n++;
}
R.espn = { week: wk, asOf: new Date().toISOString(), source: 'ESPN fantasy projections, half-PPR (average of ESPN standard and PPR)' };
console.log(`Week ${wk}: ESPN projections for ${n} players.` + (missed.length ? ` No ESPN match for ${missed.length} with a Yahoo projection: ${missed.join(', ')}` : ''));
for (const t of R.teams) {
  const both = t.players.filter(p => p.slot == 'starter' && p.espn != null), d = both.reduce((s, p) => s + p.espn - p.proj, 0);
  console.log(`  ${t.name.padEnd(8)} starters ESPN minus Yahoo: ${(d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2)} over ${both.length}`);
}
if (dry) console.log('Dry run: nothing written.');
else { fs.writeFileSync(FILE, JSON.stringify(R, null, 2) + '\n'); console.log('Written: uploads/9feamg-rosters.json'); }
