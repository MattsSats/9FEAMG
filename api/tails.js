// /api/tails : who's "on it" (tailing) each open Booth parlay, by week.
//   GET  ?week=5 -> { week, tails: { [ticket slug]: [manager, ...] }, passes: { [slug]: [manager, ...] } }.
//        Public, like requests.
//   POST { week, slug, manager } -> toggles that manager on the ticket. A ticket's owner tapping
//        it means they placed it. Refused once the ticket's first game kicks off (or a leg is graded).
//   POST { week, slug, manager, pass: true } -> toggles "didn't bet it" for the ticket's owner or
//        requester. Allowed any time; passing also takes them off the ticket.
// The site lays these over the tickets in data/season.js (which can also list placedBy/tailers).
// Stored in the private Blob store next to the requests: tails/w<week>.json.
import { readJson, writeJson, TEAMS } from './_yahoo.js';
import { loadSeason, anchorFor, locked } from './_parlays.js';

const MANAGERS = Object.values(TEAMS);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const path = w => `tails/w${w}.json`;
const weekOf = v => { const w = +v; return Number.isInteger(w) && w >= 1 && w <= 18 ? w : null; };

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method == 'GET') {
      const week = weekOf(url.searchParams.get('week'));
      if (!week) return json({ error: 'Pick a week from 1 to 18.' }, 400);
      let doc = null;
      try { doc = await readJson(path(week)); } catch { /* nothing saved yet */ }
      return json({ week, tails: doc?.tails || {}, passes: doc?.passes || {} });
    }
    if (request.method != 'POST') return json({ error: 'Use GET or POST.' }, 405);

    const raw = await request.text();
    if (raw.length > 500) return json({ error: 'That request is too long.' }, 413);
    let b;
    try { b = JSON.parse(raw); } catch { return json({ error: 'Couldn’t read that.' }, 400); }
    const week = weekOf(b.week), manager = MANAGERS.find(m => m == b.manager), slug = String(b.slug || '');
    if (!week || !manager) return json({ error: 'Pick who you are first.' }, 400);

    let season;
    try { season = await loadSeason(url.origin); } catch { return json({ error: 'Couldn’t load the tickets. Try again.' }, 502); }
    const p = (season.parlays?.[week] || []).find(x => anchorFor(week, x) == slug);
    if (!p) return json({ error: 'That ticket isn’t on the site.' }, 404);
    const pass = b.pass === true;
    if (pass && ![...(p.owners || [p.owner]), p.request].includes(manager)) return json({ error: 'Only the person the ticket was made for can say they didn’t bet it.' }, 403);
    if (!pass && locked(season, week, p)) return json({ error: 'Locked: this ticket’s first game has kicked off.' }, 409);

    let doc = null;
    try { doc = await readJson(path(week)); } catch { /* first tail of the week */ }
    doc ||= { week, tails: {} };
    doc.passes ||= {};
    const toggle = (map, on) => {
      const list = (map[slug] || []).filter(m => m != manager);
      if (on) list.push(manager);
      if (list.length) map[slug] = list; else delete map[slug];
    };
    const passing = !(doc.passes[slug] || []).includes(manager), tapped = (doc.tails[slug] || []).includes(manager);
    if (pass) { toggle(doc.passes, passing); if (passing) toggle(doc.tails, false); }
    else { toggle(doc.tails, !tapped); toggle(doc.passes, false); }
    await writeJson(path(week), doc);
    return json({ week, tails: doc.tails, passes: doc.passes });
  }
};
