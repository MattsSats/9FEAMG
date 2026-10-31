// /api/yahoo/sync : pulls the league from Yahoo and saves it for /api/league.
// Runs daily from the Vercel cron (Bearer CRON_SECRET), or on demand: open it to get a form for
// the admin key (POSTed, never in the URL), or send Authorization: Bearer <ADMIN_KEY>.
// Saved shape:
// { syncedAt, league, leagueKey, currentWeek, weeks: { [w]: { status, matchups: [[a, b]], kinds: ['regular' |
//   'playoffs' | 'consolation', one per matchup], teams: { [m]: { pts, proj } }, box?: { [m]: { total, starters, bench } } } },
//   managers: { [m]: { team, faab, moves, trades, rank, seed } }, tx: [transactions, newest first] }
// Box rows match uploads/9feamg-boxscores.json: [slot, name, nfl, pos, pts, proj, inj]; proj is null
// because Yahoo's API doesn't give per-player projections, and inj is the site's injury tag (Q, D, O,
// IR, PUP) or null. The current week's box is read even before kickoff, for lineups and injury tags.
// tx rows are in uploads/9feamg-transactions.json's format plus Yahoo's key and timestamp, and
// managers holds each team's FAAB left and moves from Yahoo (Matt, Oct 30, 2026: injuries, moves and
// FAAB come from the API, so nothing needs the Yahoo website sign-in).
import { accessToken, writeAuth, readData, writeData, writeJson, yahoo, merge, list, num, teamManager, isAdmin, isCron, keyForm, TEAMS, STATUS_PATH } from '../_yahoo.js';

export async function findLeague(token, auth) {
  if (auth.league_key) return auth.league_key;
  // "My leagues" needs the user's profile; when Yahoo refuses it, read the league by its id directly
  // (nfl.l.<id> is this season's league).
  let fc;
  try { fc = await yahoo('users;use_login=1/games;game_keys=nfl/leagues', token); }
  catch (e) {
    if (!/Yahoo 40[13]/.test(e.message)) throw e;
    const lg = merge((await yahoo(`league/nfl.l.${process.env.YAHOO_LEAGUE_ID || '935526'}`, token)).league);
    if (!lg.league_key) throw e;
    return lg.league_key;
  }
  const user = merge(list(fc.users, 'user')[0]);
  const leagues = list(user.games, 'game').flatMap(g => list(merge(g).leagues, 'league').map(l => merge(l)));
  const want = process.env.YAHOO_LEAGUE_ID;
  const lg = leagues.find(l => want && String(l.league_id) == want) || leagues.find(l => +l.num_teams == 10) || leagues[0];
  if (!lg) throw new Error('No Yahoo NFL league found for this account.');
  return lg.league_key;
}

// w left out: the league's current week (the league meta in the answer says which).
export async function scoreboard(token, key, w) {
  const lg = merge((await yahoo(`league/${key}/scoreboard` + (w ? `;week=${w}` : ''), token)).league);
  const sb = lg.scoreboard || {};
  const matchups = list(sb['0']?.matchups, 'matchup');
  // kinds runs with matchups: 'regular', 'playoffs' or 'consolation' (Yahoo's is_playoffs and
  // is_consolation), for the playoff weeks' bracket and Toilet Bowl.
  const out = { status: 'preevent', matchups: [], kinds: [], teams: {} };
  const st = new Set();
  for (const mu of matchups) {
    st.add(mu.status);
    const teams = list(mu['0']?.teams, 'team').map(t => merge(t));
    const ms = teams.map(teamManager);
    if (ms.every(Boolean)) { out.matchups.push(ms); out.kinds.push(mu.is_consolation == '1' ? 'consolation' : mu.is_playoffs == '1' ? 'playoffs' : 'regular'); }
    teams.forEach((t, i) => { if (ms[i]) out.teams[ms[i]] = { pts: num(t.team_points?.total), proj: num(t.team_projected_points?.total) }; });
  }
  out.status = st.has('midevent') ? 'midevent' : st.size && [...st].every(s => s == 'postevent') ? 'postevent' : 'preevent';
  return { out, league: lg };
}

// Yahoo's player status as the site's injury tag; anything else (NA, SUSP, ...) isn't one the site shows.
export const injTag = s => { const t = String(s || '').toUpperCase(); return ['Q', 'D', 'O'].includes(t) ? t : /^IR/.test(t) ? 'IR' : /^PUP/.test(t) ? 'PUP' : null; };
const nameOf = x => { const pos = (x.primary_position || x.display_position || '').split(',')[0]; return { pos, name: pos == 'DEF' ? (x.name?.last || x.name?.full) : x.name?.full }; };

export async function boxScores(token, key, w, teams) {
  const box = {};
  await Promise.all(Object.keys(teams).map(async m => {
    const id = Object.keys(TEAMS).find(k => TEAMS[k] == m);
    const fc = await yahoo(`team/${key}.t.${id}/roster;week=${w}/players/stats;type=week;week=${w}`, token);
    const roster = merge(fc.team).roster;
    const rows = list(roster?.['0']?.players, 'player').map(p => {
      const x = merge(p), sel = merge(x.selected_position).position || 'BN', { pos, name } = nameOf(x);
      return [sel, name, x.editorial_team_abbr || '', pos, num(x.player_points?.total), null, injTag(x.status)];
    });
    box[m] = { total: teams[m].pts, starters: rows.filter(r => r[0] != 'BN' && r[0] != 'IR'), bench: rows.filter(r => r[0] == 'BN' || r[0] == 'IR') };
  }));
  return box;
}

// Each team's name, FAAB left and moves (adds), as Yahoo's standings show them.
export async function managersOf(token, key) {
  const out = {};
  for (const t of list(merge((await yahoo(`league/${key}/teams`, token)).league).teams, 'team').map(t => merge(t))) {
    const m = teamManager(t); if (m) out[m] = { team: t.name, faab: t.faab_balance == null ? null : +t.faab_balance, moves: +t.number_of_moves || 0, trades: +t.number_of_trades || 0 };
  }
  return out;
}
// Each team's place and playoff seed from Yahoo's standings ({ rank, seed }; seed null until Yahoo sets it).
export async function seedsOf(token, key) {
  const out = {}, lg = merge((await yahoo(`league/${key}/standings`, token)).league);
  for (const t of list(lg.standings?.['0']?.teams ?? lg.standings?.teams, 'team').map(t => merge(t))) {
    const m = teamManager(t), s = t.team_standings || {};
    if (m) out[m] = { rank: +s.rank || null, seed: +s.playoff_seed || null };
  }
  return out;
}
// "Oct 29, 9:08 am" in Central time, the transactions file's form.
const CT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
export const whenOf = ts => CT.format(new Date(ts * 1000)).replace(/\s+/g, ' ').replace(/ (AM|PM)$/, (_, x) => ' ' + x.toLowerCase());
// The league's completed adds, drops and trades, newest first, one row per player moved, in the
// transactions file's form: { when, yahooTeam, manager, action, player, nfl, pos, faab, via, notes,
// key, ts }. Pages of 25 from the newest; it stops at the first move it already has in prev.
export async function transactions(token, key, mgrs, prev = []) {
  const have = new Set(prev.map(t => t.key)), rows = [];
  const team = k => teamManager({ team_key: k });
  for (let start = 0, done = false; !done && start < 2000; start += 25) {
    const page = list(merge((await yahoo(`league/${key}/transactions;types=add,drop,trade;start=${start};count=25`, token)).league).transactions, 'transaction');
    for (const tr of page) {
      const meta = merge(tr[0]);
      if (have.has(meta.transaction_key)) { done = true; break; }
      if (meta.status != 'successful') continue;
      for (const p of list(merge(tr[1]).players, 'player')) {
        const x = merge(p[0]), d = merge(p[1]?.transaction_data), { pos, name } = nameOf(x);
        let r;
        if (d.type == 'add') r = { manager: team(d.destination_team_key), action: 'add', via: d.source_type == 'waivers' ? 'Waivers' : 'Free Agency', faab: d.source_type == 'waivers' && meta.faab_bid != null ? '$' + meta.faab_bid : null };
        else if (d.type == 'drop') r = { manager: team(d.source_team_key), action: 'drop', via: d.destination_type == 'freeagents' ? 'Free Agency' : 'Waivers', faab: null };
        else if (d.type == 'trade') r = { manager: team(d.destination_team_key), action: 'trade', via: 'trade from ' + (d.source_team_name || mgrs[team(d.source_team_key)]?.team || ''), faab: null };
        if (!r?.manager) continue;
        rows.push({ when: whenOf(+meta.timestamp), yahooTeam: mgrs[r.manager]?.team || '', manager: r.manager, action: r.action, player: name, nfl: x.editorial_team_abbr || '', pos, faab: r.faab, via: r.via, notes: 'Yahoo API', key: meta.transaction_key, ts: +meta.timestamp });
      }
    }
    if (page.length < 25) done = true;
  }
  const fresh = new Set(rows.map(t => t.key));
  return [...rows, ...prev.filter(t => !fresh.has(t.key))];
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
    if (wk.status == 'preevent' && +w != current) continue;
    wk.box = old?.box && old.status == 'postevent' && wk === old ? old.box : await boxScores(token, key, w, wk.teams);
  }
  // Moves and FAAB never cost the scores: if Yahoo refuses them, the last good copy stays and the
  // error is saved with it.
  let managers = prev.managers || null, tx = prev.leagueKey == key ? prev.tx || [] : [], txError = null;
  try {
    managers = await managersOf(token, key);
    // Seeds and places ride along with each manager; a standings hiccup never costs the moves.
    const sd = await seedsOf(token, key).catch(() => ({}));
    for (const m in sd) if (managers[m]) Object.assign(managers[m], sd[m]);
    tx = await transactions(token, key, managers, tx);
  }
  catch (e) { txError = String(e.message || e); }
  const data = { syncedAt: new Date().toISOString(), league: meta.name, leagueKey: key, season: meta.season, currentWeek: current, weeks, managers, tx, ...(txError ? { txError } : {}) };
  await writeData(data);
  return { league: meta.name, currentWeek: current, weeks: Object.keys(weeks).length, boxWeeks: Object.values(weeks).filter(w => w.box).length, tx: tx.length };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!isCron(request) && !(await isAdmin(request))) {
      if (request.method == 'POST') return new Response('Not allowed.', { status: 403 });
      const note = url.searchParams.has('key') ? '<p>Keys in the address bar aren’t accepted any more. Enter it below.</p>' : '';
      return keyForm('Sync 9FEAMG from Yahoo', url.pathname, 'Sync now', note);
    }
    try {
      const r = await sync(url.origin);
      return Response.json({ ok: true, ...r }, { headers: { 'cache-control': 'no-store' } });
    } catch (e) {
      // Kept for /api/league?format=status (the daily health check), so a failing token gets noticed.
      await writeJson(STATUS_PATH, { at: new Date().toISOString(), error: String(e.message || e), from: isCron(request) ? 'cron' : 'admin' }).catch(() => {});
      return Response.json({ ok: false, error: e.message }, { status: 502, headers: { 'cache-control': 'no-store' } });
    }
  }
};
