// /api/yahoo/sync : pulls the league from Yahoo and saves it for /api/league.
// Runs daily from the Vercel cron (Bearer CRON_SECRET), or on demand with ?key=ADMIN_KEY.
// Saved shape:
// { syncedAt, league, leagueKey, currentWeek, weeks: { [w]: { status, matchups: [[a, b]],
//   teams: { [m]: { pts, proj } }, box?: { [m]: { total, starters, bench } } } } }
// Box rows match uploads/9feamg-boxscores.json: [slot, name, nfl, pos, pts, proj]; proj is null
// because Yahoo's API doesn't give per-player projections.
import { accessToken, writeAuth, readData, writeData, yahoo, merge, list, num, teamManager, isAdmin, isCron, TEAMS } from '../_yahoo.js';

async function findLeague(token, auth) {
  if (auth.league_key) return auth.league_key;
  const fc = await yahoo('users;use_login=1/games;game_keys=nfl/leagues', token);
  const user = merge(list(fc.users, 'user')[0]);
  const leagues = list(user.games, 'game').flatMap(g => list(merge(g).leagues, 'league').map(l => merge(l)));
  const want = process.env.YAHOO_LEAGUE_ID;
  const lg = leagues.find(l => want && String(l.league_id) == want) || leagues.find(l => +l.num_teams == 10) || leagues[0];
  if (!lg) throw new Error('No Yahoo NFL league found for this account.');
  return lg.league_key;
}

async function scoreboard(token, key, w) {
  const lg = merge((await yahoo(`league/${key}/scoreboard;week=${w}`, token)).league);
  const sb = lg.scoreboard || {};
  const matchups = list(sb['0']?.matchups, 'matchup');
  const out = { status: 'preevent', matchups: [], teams: {} };
  const st = new Set();
  for (const mu of matchups) {
    st.add(mu.status);
    const teams = list(mu['0']?.teams, 'team').map(t => merge(t));
    const ms = teams.map(teamManager);
    if (ms.every(Boolean)) out.matchups.push(ms);
    teams.forEach((t, i) => { if (ms[i]) out.teams[ms[i]] = { pts: num(t.team_points?.total), proj: num(t.team_projected_points?.total) }; });
  }
  out.status = st.has('midevent') ? 'midevent' : st.size && [...st].every(s => s == 'postevent') ? 'postevent' : 'preevent';
  return { out, league: lg };
}

async function boxScores(token, key, w, teams) {
  const box = {};
  await Promise.all(Object.keys(teams).map(async m => {
    const id = Object.keys(TEAMS).find(k => TEAMS[k] == m);
    const fc = await yahoo(`team/${key}.t.${id}/roster;week=${w}/players/stats;type=week;week=${w}`, token);
    const roster = merge(fc.team).roster;
    const rows = list(roster?.['0']?.players, 'player').map(p => {
      const x = merge(p), sel = merge(x.selected_position).position || 'BN', pos = x.primary_position || x.display_position || '';
      const name = pos == 'DEF' ? (x.name?.last || x.name?.full) : x.name?.full;
      return [sel, name, x.editorial_team_abbr || '', pos, num(x.player_points?.total), null];
    });
    box[m] = { total: teams[m].pts, starters: rows.filter(r => r[0] != 'BN' && r[0] != 'IR'), bench: rows.filter(r => r[0] == 'BN' || r[0] == 'IR') };
  }));
  return box;
}

export async function sync(origin) {
  const auth = await accessToken(origin), token = auth.access_token;
  const key = await findLeague(token, auth);
  if (key != auth.league_key) await writeAuth({ ...auth, league_key: key });

  const prev = (await readData().catch(() => null)) || {};
  const first = await scoreboard(token, key, 1);
  const meta = first.league, current = +meta.current_week || 1;
  const weeks = { 1: first.out };
  for (let w = 2; w <= current; w++) {
    // Settled weeks don't change, except the latest one (stat corrections).
    const old = prev.leagueKey == key && prev.weeks?.[w];
    weeks[w] = old?.status == 'postevent' && w < current - 1 ? old : (await scoreboard(token, key, w)).out;
  }
  for (const [w, wk] of Object.entries(weeks)) {
    const old = prev.leagueKey == key && prev.weeks?.[w];
    if (wk.status == 'preevent') continue;
    wk.box = old?.box && old.status == 'postevent' && wk === old ? old.box : await boxScores(token, key, w, wk.teams);
  }
  const data = { syncedAt: new Date().toISOString(), league: meta.name, leagueKey: key, season: meta.season, currentWeek: current, weeks };
  await writeData(data);
  return { league: meta.name, currentWeek: current, weeks: Object.keys(weeks).length, boxWeeks: Object.values(weeks).filter(w => w.box).length };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!isCron(request) && !isAdmin(url)) return new Response('Not allowed.', { status: 403 });
    try {
      const r = await sync(url.origin);
      return Response.json({ ok: true, ...r }, { headers: { 'cache-control': 'no-store' } });
    } catch (e) {
      return Response.json({ ok: false, error: e.message }, { status: 502, headers: { 'cache-control': 'no-store' } });
    }
  }
};
