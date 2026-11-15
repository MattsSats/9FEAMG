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
import { loadSeasonFile } from '../_parlays.js';
import { accessToken, writeAuth, readData, writeData, writeJson, yahoo, merge, list, num, teamManager, dataOrigin, isAdmin, isCron, keyForm, TEAMS, STATUS_PATH } from '../_yahoo.js';

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

// Yahoo's API only has the pregame team projection, which doesn't move during games (Nov 1, 2026), so
// while a week is live each team also gets teams[m].live, what it's on pace to finish with: for each
// starter his points plus his projection (uploads/9feamg-rosters.json) for the share of his game still
// to play (ESPN's clock). A defense in progress counts at its current score, since its points can fall
// as it allows points, and a starter Yahoo tags Out or IR at what he has (a player knocked out of his
// game; Yahoo's page zeroes him too). Within a few points of Yahoo's own page when checked. A team stays on Yahoo's
// number if ESPN or the file can't be read, the file is for another week (so also in the playoffs,
// where it has no projections), or an unfinished starter isn't in the file.
// Reads JSON, or null when the answer isn't JSON (Nov 15, 2026: one of these fetches came back as an HTML
// page on every pull from 17:45 to 18:32 UTC, so every live player read as Final). The failing URL,
// status and the start of the body go to the log.
async function getJson(url) {
  let r, text = '';
  try {
    r = await fetch(url, { headers: { accept: 'application/json' } });
    text = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return JSON.parse(text);
  } catch (e) {
    console.error(`live projections: ${url} failed (${r ? r.status + ' ' + (r.headers.get('content-type') || '') : 'no answer'}): ${e.message} · ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
    return null;
  }
}
// The last good copy of each, per server instance: a bad read falls back to it.
const lastGood = { ros: null, sb: null, inj: {} };
// Players hurt mid-game (Matt, Nov 15, 2026), from ESPN's play-by-play for each game in progress: Yahoo
// often tags a player Q or nothing for a while after he leaves. Each player's latest injury note wins:
// "LV-B.Bowers was injured during the play." or "** Injury Update: ... is out for the game / will not
// return / is questionable to return" means out; "... has returned to the game." means back.
// Keys are 'LV|b|bowers' (team, first initial, last name); the answer is { key: { s: 'out' | 'back', at } },
// at the play's wall-clock time (ms), so a manual report (season.js live.leftGame) can be weighed against it.
// ESPN's play text uses the league's own team codes for a few teams (ARZ, BLT, CLV, HST, LA).
const PBP_TEAM = { WSH: 'WAS', ARZ: 'ARI', BLT: 'BAL', CLV: 'CLE', HST: 'HOU', LA: 'LAR' };
const injKey = (team, first, last) => [(t => PBP_TEAM[t] || t)(String(team).toUpperCase()), String(first)[0].toLowerCase(),
  String(last).toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z]/g, '')].join('|');
export function injuryNotes(summary) {
  const plays = [...(summary?.drives?.previous || []), ...(summary?.drives?.current ? [summary.drives.current] : [])]
    .flatMap(d => d.plays || []).sort((a, b) => +a.sequenceNumber - +b.sequenceNumber);
  const out = {}, re = /\b([A-Z]{2,3})-([A-Za-z']+)\.\s?([A-Z][A-Za-z'-]*\.?(?: [A-Z][A-Za-z'-]*\.?){0,2}) (was injured during the play|has returned to the game|is out for the game|has been ruled out|will not return|is (?:questionable|doubtful|probable) to return)/g;
  for (const p of plays) for (const m of String(p.text || '').matchAll(re)) out[injKey(m[1], m[2], m[3])] = { s: /returned/.test(m[4]) ? 'back' : 'out', at: Date.parse(p.wallclock || p.modified) || 0 };
  return out;
}
const playerKey = (name, nfl) => { const w = String(name).split(' '); return injKey(nfl, w[0], w.slice(1).join(' ')); };
// leftGame: season.js live.leftGame, { 'Brock Bowers': '2026-11-15T16:05-06:00' }: players Matt reported leaving
// their game before ESPN logged it (Nov 15, 2026). Each counts as out from that time unless ESPN logs a later
// note saying he returned.
export async function addLiveProj(wk, w, season, origin, leftGame = {}) {
  if (wk.status != 'midevent' || !wk.box) return;
  try {
    const sbUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${w}&dates=${season}`;
    let [ros, sb] = await Promise.all([getJson(new URL('/uploads/9feamg-rosters.json', dataOrigin(origin)).href), getJson(sbUrl)]);
    if (ros?.teams) lastGood.ros = ros; else ros = lastGood.ros;
    if (sb?.events && sb.week?.number == w) lastGood.sb = { at: Date.now(), w, sb }; else sb = lastGood.sb?.w == w ? lastGood.sb.sb : null;
    if (!sb) return;
    const left = {}, playing = [], started = [], clock = {};
    for (const e of sb.events || []) {
      const s = e.status, st = s.type.state, share = st == 'pre' ? 1 : st == 'post' ? 0 : Math.max(0, ((4 - s.period) * 900 + (s.clock || 0)) / 3600);
      // Each team's game on ESPN's clock (Nov 15, 2026), for the lineup sheet's progress bars:
      // s 'pre' | 'in' | 'post', q the quarter (5 = overtime), c the clock, h at halftime, f the share played.
      const g = { s: st, q: s.period || 0, c: s.displayClock || '', f: +(1 - share).toFixed(3), ...(s.type.name == 'STATUS_HALFTIME' ? { h: 1 } : {}) };
      for (const c of e.competitions[0].competitors) {
        const t = c.team.abbreviation.toUpperCase(), names = t == 'WSH' ? [t, 'WAS'] : [t];
        left[t] = share;
        for (const n of names) clock[n] = g;
        // For mergeYahoo (Nov 8, 2026): teams on the field now show Live instead of Final, and a
        // player whose game has started counts at his points even at 0.
        if (st == 'in') playing.push(...names);
        if (st != 'pre') started.push(...names);
      }
    }
    left.WAS ??= left.WSH;
    wk.playing = playing; wk.started = started; wk.clock = clock;
    // Mid-game injuries from ESPN's play-by-play, games in progress only (one summary each). A summary that
    // can't be read keeps that game's last good notes.
    const liveIds = (sb.events || []).filter(e => e.status?.type?.state == 'in').map(e => e.id);
    const notes = {};
    await Promise.all(liveIds.map(async id => {
      const s = await getJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`);
      if (s?.drives) lastGood.inj[id] = injuryNotes(s);
      Object.assign(notes, lastGood.inj[id] || {});
    }));
    // wk.hurt: players whose latest note says they left (counted at their points, "left game" on the sheet);
    // wk.back: players whose latest note says they returned (counted in full even if Yahoo tagged them O).
    const rows = Object.values(wk.box).flatMap(t => [...t.starters, ...t.bench]);
    const stateOf = r => { const n = notes[playerKey(r[1], r[2])], man = Date.parse(leftGame?.[r[1]]);
      return man && (!n || man >= n.at) ? 'out' : n?.s; };
    wk.hurt = rows.filter(r => stateOf(r) == 'out').map(r => r[1]);
    wk.back = rows.filter(r => stateOf(r) == 'back').map(r => r[1]);
    const hurt = new Set(wk.hurt), back = new Set(wk.back);
    if (!ros) return;
    if (ros.week != w) return;
    for (const m of Object.keys(wk.teams)) {
      const players = ros.teams?.find(t => t.name == m)?.players || [], starters = wk.box[m]?.starters || [];
      if (!starters.length) continue;
      let total = 0, known = true;
      for (const [, name, nfl, pos, pts, , inj] of starters) {
        // Out: hurt mid-game per ESPN, or tagged O or IR by Yahoo unless ESPN says he returned. Counted at his points.
        const p = players.find(x => x.name == name), share = left[String(nfl).toUpperCase()] ?? 1;
        const out = share > 0 && share < 1 && hurt.has(name) || (inj == 'O' || inj == 'IR') && !back.has(name);
        // A starter still to play with no Yahoo projection yet (a new add, Nov 8, 2026) counts at ESPN's;
        // with neither, the team keeps Yahoo's own projection rather than counting him at 0.
        const proj = p?.proj > 0 ? p.proj : p?.espn > 0 ? p.espn : null;
        if (share > 0 && !out && proj == null) { known = false; break; }
        total += out ? pts : share == 1 ? proj || 0 : pts + (pos == 'DEF' ? 0 : (proj || 0) * share);
      }
      if (known) wk.teams[m].live = num(total);
    }
  } catch (e) { console.error('live projections:', e.message); }
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
  const sf = await loadSeasonFile(origin).catch(() => null);
  if (weeks[current]) await addLiveProj(weeks[current], current, meta.season, origin, sf?.live?.leftGame);
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
