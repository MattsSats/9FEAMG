// /api/requests : parlay requests from the live week's Gameday tab.
//   GET  ?week=5  -> { week, requests: { [manager]: request } }. Public: the league sees who asked.
//   POST { week, manager, risk, legs, betType, players, playerLegs, game }  -> saves the manager's request for the week,
//        replacing any earlier one. { week, manager, cancel: true } removes it.
// Claude Code reads these on "sync", builds each parlay from real book lines and publishes it
// in data/season.js with request: <manager>, which the site shows as the request being filled.
// Stored in the private Blob store next to the Yahoo data: requests/w<week>.json.
import { readJson, writeJson, TEAMS } from './_yahoo.js';

const MANAGERS = Object.values(TEAMS);
// Total-odds bands the slider picks from (American odds).
const RISK = { safe: [100, 250], balanced: [250, 600], spicy: [600, 1500], longshot: [1500, 5000], lottery: [5000, null] };
const LEGS = ['any', '2', '3', '4', '5', '6+'];
// What kind of legs to build with. The form now always sends mix (older requests may differ);
// game is the form's "Add a leg?" text: a player or team (older requests: a typed game bet).
const BET_TYPES = ['mix', 'td', 'yards', 'lines'];
const PICK_LEGS = ['td', 'yards', 'ml'];
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
// Plain text only: no control characters, trimmed, capped.
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const path = w => `requests/w${w}.json`;
const weekOf = v => { const w = +v; return Number.isInteger(w) && w >= 1 && w <= 18 ? w : null; };

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method == 'GET') {
      const week = weekOf(url.searchParams.get('week'));
      if (!week) return json({ error: 'Pick a week from 1 to 18.' }, 400);
      let requests = {};
      try { requests = (await readJson(path(week)))?.requests || {}; } catch { /* nothing saved yet */ }
      return json({ week, requests });
    }
    if (request.method != 'POST') return json({ error: 'Use GET or POST.' }, 405);

    const raw = await request.text();
    if (raw.length > 2000) return json({ error: 'That request is too long.' }, 413);
    let b;
    try { b = JSON.parse(raw); } catch { return json({ error: 'Couldn’t read that request.' }, 400); }
    const week = weekOf(b.week), manager = MANAGERS.find(m => m == b.manager);
    if (!week || !manager) return json({ error: 'Pick who’s asking.' }, 400);

    let doc = null;
    try { doc = await readJson(path(week)); } catch { /* first request of the week */ }
    doc ||= { week, requests: {} };

    if (b.cancel) {
      delete doc.requests[manager];
    } else {
      if (!(b.risk in RISK)) return json({ error: 'Pick a risk level.' }, 400);
      const legs = LEGS.includes(String(b.legs)) ? String(b.legs) : 'any';
      const betType = BET_TYPES.includes(b.betType) ? b.betType : 'mix';
      const players = (Array.isArray(b.players) ? b.players : []).map(p => clean(p, 40)).filter(Boolean).slice(0, 3);
      // Each picked player's leg: td (anytime TD), yards (yardage over) or ml (their team's moneyline).
      const playerLegs = {};
      for (const p of players) { const l = b.playerLegs?.[p]; if (PICK_LEGS.includes(l)) playerLegs[p] = l; }
      doc.requests[manager] = { manager, risk: b.risk, odds: RISK[b.risk], legs, betType, players, playerLegs, game: clean(b.game, 60), at: new Date().toISOString() };
    }
    await writeJson(path(week), doc);
    return json({ week, requests: doc.requests });
  }
};
