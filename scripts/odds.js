// DraftKings prices from The Odds API, for building parlay requests. Runs locally only.
// The key lives in .env.local (never committed): ODDS_API_KEY=...
//
//   node scripts/odds.js games                  this week's NFL games: moneylines, spreads, totals
//   node scripts/odds.js props <team> [alt]     player props for that team's game (anytime TD, yardage, receptions);
//                                               add "alt" for alternate lines (e.g. 250+ passing yards)
//   node scripts/odds.js props <team> <market>  just one market, e.g. player_tds_over (Over 1.5 = 2+ TDs);
//                                               cheapest way to price one leg (about 1 credit)
//
// Every call prints the time it was pulled and the credits left, so the ticket can cite
// "DraftKings via The Odds API, <time>".
import { readFileSync } from 'node:fs';
try { process.loadEnvFile('.env.local'); } catch { /* fall back to the shell's environment */ }
// A file holding just the key (no "ODDS_API_KEY=") works too.
const bare = () => { try { const s = readFileSync('.env.local', 'utf8').trim(); return /^[\w-]+$/.test(s) ? s : ''; } catch { return ''; } };

const KEY = process.env.ODDS_API_KEY || bare();
const BASE = 'https://api.the-odds-api.com/v4/sports/americanfootball_nfl';
const PROPS = ['player_anytime_td', 'player_pass_yds', 'player_rush_yds', 'player_reception_yds', 'player_receptions'];
const ALT = ['player_pass_yds_alternate', 'player_rush_yds_alternate', 'player_reception_yds_alternate'];

const odds = n => (n > 0 ? '+' : '') + n;
const stamp = () => new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT';
const kickoff = t => new Date(t).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' });

async function get(path, params = {}) {
  const url = new URL(BASE + path);
  url.search = new URLSearchParams({ apiKey: KEY, regions: 'us', bookmakers: 'draftkings', oddsFormat: 'american', ...params });
  const r = await fetch(url);
  const left = r.headers.get('x-requests-remaining');
  if (!r.ok) throw new Error(`The Odds API said ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { data: await r.json(), left };
}

// Only this week's games: the next 7 days.
const thisWeek = games => games.filter(g => new Date(g.commence_time) - Date.now() < 7 * 864e5);

async function games() {
  const { data, left } = await get('/odds', { markets: 'h2h,spreads,totals' });
  for (const g of thisWeek(data)) {
    const m = Object.fromEntries((g.bookmakers[0]?.markets || []).map(x => [x.key, x.outcomes]));
    console.log(`\n${g.away_team} @ ${g.home_team}  (${kickoff(g.commence_time)})`);
    if (!m.h2h) { console.log('  no DraftKings lines yet'); continue; }
    for (const team of [g.away_team, g.home_team]) {
      const ml = m.h2h.find(o => o.name == team), sp = m.spreads?.find(o => o.name == team);
      console.log(`  ${team.padEnd(24)} ML ${odds(ml.price).padStart(5)}   ${sp ? `${odds(sp.point)} at ${odds(sp.price)}` : ''}`);
    }
    const over = m.totals?.find(o => o.name == 'Over'), under = m.totals?.find(o => o.name == 'Under');
    if (over) console.log(`  Total ${over.point}: over ${odds(over.price)}, under ${odds(under.price)}`);
  }
  return left;
}

async function props(team, flag) {
  const want = flag == 'alt' ? ALT : flag ? [flag] : PROPS;
  const { data: events } = await get('/events', {});
  const q = team.toLowerCase();
  const g = thisWeek(events).find(e => [e.home_team, e.away_team].some(t => t.toLowerCase().includes(q)));
  if (!g) throw new Error(`No game this week for "${team}".`);
  const { data, left } = await get(`/events/${g.id}/odds`, { markets: want.join(',') });
  console.log(`\n${g.away_team} @ ${g.home_team}  (${kickoff(g.commence_time)})`);
  const markets = data.bookmakers?.[0]?.markets || [];
  if (!markets.length) console.log('  no DraftKings props yet');
  for (const mk of markets) {
    console.log(`\n  ${mk.key}`);
    for (const o of mk.outcomes) {
      const line = o.point != null ? ` ${o.name} ${o.point}` : '';
      console.log(`    ${o.description || o.name}${o.description ? line : ''}  ${odds(o.price)}`);
    }
  }
  return left;
}

const [cmd, arg, flag] = process.argv.slice(2);
if (!KEY) { console.error('Add ODDS_API_KEY=... to .env.local first.'); process.exit(1); }
try {
  const left = cmd == 'games' ? await games() : cmd == 'props' && arg ? await props(arg, flag) : null;
  if (left === null) { console.error('Use: node scripts/odds.js games | props <team> [alt]'); process.exitCode = 1; } else
  console.log(`\nDraftKings via The Odds API, ${stamp()} · ${left} credits left`);
} catch (e) { console.error(e.message); process.exitCode = 1; }
