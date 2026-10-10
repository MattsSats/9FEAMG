// /api/tails : who's "on it" (tailing) each Booth parlay, by week, and who said they didn't bet it.
//   GET  ?week=5 -> { week, tails: { [slug]: [manager] }, passes: { [slug]: [manager] }, log: { [slug]: [entry] } }.
//        Public, like requests.
//   POST { week, slug, manager, on } -> puts that manager on the ticket (on: true) or takes them off
//        (on: false). A ticket's owner on it means they placed it. Refused once the ticket's first
//        game kicks off (or a leg is graded).
//   POST { week, slug, manager, pass: true, on } -> "didn't bet it" for the ticket's owner or
//        requester (on: false undoes it). Passing also takes them off the ticket. Allowed until the
//        ticket settles (cashed or busted), so the ledger can't change after the fact.
//   `on` says what the tap should end up as, so a double tap or a retry can't undo it. (Without
//   `on`, from an older page, it flips like before.) `by` is the phone's own team when someone
//   else's "didn't bet" is undone for them; it goes in the log.
// Every change that actually changes something is logged per ticket: { m, a: 'on'|'off'|'pass'|'unpass',
// at, by? }, the last 30, so a stray tap shows up on the ticket.
// Stored in the private Blob store next to the requests: tails/w<week>.json. Writes never overwrite
// a tap saved at the same moment (api/_yahoo.js updateJson).
import { readJson, updateJson, TEAMS } from './_yahoo.js';
import { loadSeason, anchorFor, locked } from './_parlays.js';
import { parlayState } from './_shared.js';

const MANAGERS = Object.values(TEAMS);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const path = w => `tails/w${w}.json`;
const weekOf = v => { const w = +v; return Number.isInteger(w) && w >= 1 && w <= 18 ? w : null; };
const view = (week, doc) => ({ week, tails: doc?.tails || {}, passes: doc?.passes || {}, log: doc?.log || {} });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method == 'GET') {
      const week = weekOf(url.searchParams.get('week'));
      if (!week) return json({ error: 'Pick a week from 1 to 18.' }, 400);
      let doc = null;
      try { doc = await readJson(path(week)); } catch { /* nothing saved yet */ }
      return json(view(week, doc));
    }
    if (request.method != 'POST') return json({ error: 'Use GET or POST.' }, 405);

    const raw = await request.text();
    if (raw.length > 500) return json({ error: 'That request is too long.' }, 413);
    let b;
    try { b = JSON.parse(raw); } catch { return json({ error: 'Couldn’t read that.' }, 400); }
    const week = weekOf(b.week), manager = MANAGERS.find(m => m == b.manager), slug = String(b.slug || '');
    const by = MANAGERS.find(m => m == b.by && m != manager) || null;
    if (!week || !manager) return json({ error: 'Pick who you are first.' }, 400);
    if (b.on != null && typeof b.on != 'boolean') return json({ error: 'Couldn’t read that.' }, 400);

    let season;
    try { season = await loadSeason(url.origin); } catch { return json({ error: 'Couldn’t load the tickets. Try again.' }, 502); }
    const p = (season.parlays?.[week] || []).find(x => anchorFor(week, x) == slug);
    if (!p) return json({ error: 'That ticket isn’t on the site.' }, 404);
    const pass = b.pass === true;
    if (pass && ![...(p.owners || [p.owner]), p.request].includes(manager)) return json({ error: 'Only the person the ticket was made for can say they didn’t bet it.' }, 403);
    if (pass && parlayState(p).status != 'OPEN') return json({ error: 'This ticket is settled, so who bet it is final.' }, 409);
    if (!pass && locked(season, week, p)) return json({ error: 'Locked: this ticket’s first game has kicked off.' }, 409);

    try {
      const doc = await updateJson(path(week), d => {
        d ||= { week, tails: {}, passes: {} };
        d.tails ||= {}; d.passes ||= {}; d.log ||= {};
        const has = map => (map[slug] || []).includes(manager);
        const set = (map, on) => {
          const list = (map[slug] || []).filter(m => m != manager);
          if (on) list.push(manager);
          if (list.length) map[slug] = list; else delete map[slug];
        };
        const log = a => { d.log[slug] = [...(d.log[slug] || []), { m: manager, a, at: new Date().toISOString(), ...(by ? { by } : {}) }].slice(-30); };
        if (pass) {
          const want = b.on ?? !has(d.passes);
          if (want != has(d.passes)) { set(d.passes, want); log(want ? 'pass' : 'unpass'); }
          if (want && has(d.tails)) set(d.tails, false);
        } else {
          const want = b.on ?? !has(d.tails);
          if (want != has(d.tails)) { set(d.tails, want); log(want ? 'on' : 'off'); }
          if (want) set(d.passes, false);
        }
        return d;
      });
      return json(view(week, doc));
    } catch (e) {
      return json({ error: 'Couldn’t save that. Try again.', code: e?.name || 'Error' }, 503);
    }
  }
};
