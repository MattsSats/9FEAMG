// /api/pundits : Jerger's preview picks ("the experts") and Tristan's power rankings, set on the site
// by whoever has that team picked (Matt, Oct 20, 2026: honor system plus a change log, like taps).
//   GET  -> { picks: { [week]: [name per matchup, schedule order] }, ranks: { [week]: [10 names] }, log: [entry] }.
//        Public. The site lays these over data/season.js (expertPicks, tristanRanks), week by week.
//   POST { manager: 'Jerger', week, i, pick } -> sets the pick for matchup i of the live week. Open until
//        the week's first kickoff (punditOpen in api/_shared.js), like the Booth's own picks.
//   POST { manager: 'Tristan', week, order } -> sets the rankings for the last final week (all ten
//        managers once each). Open until the next week's first kickoff.
// Every change is logged ({ m, a: 'pick'|'ranks', w, i?, v, at }), the last 100, so a stray edit shows.
// Stored in the private Blob store next to the taps: pundits.json. Simultaneous saves both land
// (api/_yahoo.js updateJson).
import { readJson, updateJson, TEAMS } from './_yahoo.js';
import { loadSeason } from './_parlays.js';
import { punditOpen, PUNDIT_OF } from './_shared.js';

const MANAGERS = Object.values(TEAMS);
const PATH = 'pundits.json';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const view = d => ({ picks: d?.picks || {}, ranks: d?.ranks || {}, log: d?.log || [] });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method == 'GET') {
      let doc = null;
      try { doc = await readJson(PATH); } catch { /* nothing saved yet */ }
      return json(view(doc));
    }
    if (request.method != 'POST') return json({ error: 'Use GET or POST.' }, 405);

    const raw = await request.text();
    if (raw.length > 1000) return json({ error: 'That request is too long.' }, 413);
    let b;
    try { b = JSON.parse(raw); } catch { return json({ error: 'Couldn’t read that.' }, 400); }
    const manager = MANAGERS.find(m => m == b.manager), week = +b.week;
    const kind = b.order ? 'ranks' : 'picks';
    if (!manager || !Number.isInteger(week)) return json({ error: 'Pick who you are first.' }, 400);
    if (manager != PUNDIT_OF[kind]) return json({ error: kind == 'picks' ? 'Only Jerger posts the experts’ picks.' : 'Only Tristan posts these rankings.' }, 403);

    let season;
    try { season = await loadSeason(url.origin); } catch { return json({ error: 'Couldn’t load the league. Try again.' }, 502); }
    if (!punditOpen(season, kind, week)) return json({ error: kind == 'picks' ? 'Picks are locked: the week has kicked off.' : 'Rankings for that week are closed.' }, 409);

    let entry;
    if (kind == 'picks') {
      const i = +b.i, pair = season.schedule?.[week]?.[i];
      if (!Number.isInteger(i) || !pair) return json({ error: 'That matchup isn’t on the schedule.' }, 400);
      if (!pair.includes(b.pick)) return json({ error: `Pick ${pair[0]} or ${pair[1]}.` }, 400);
      entry = { m: manager, a: 'pick', w: week, i, v: b.pick };
    } else {
      const all = season.managers.map(x => x.m), order = Array.isArray(b.order) ? b.order : [];
      if (order.length != all.length || all.some(m => !order.includes(m))) return json({ error: 'Rank all ten teams once each.' }, 400);
      entry = { m: manager, a: 'ranks', w: week, v: order };
    }

    try {
      const doc = await updateJson(PATH, d => {
        d ||= { picks: {}, ranks: {}, log: [] };
        d.picks ||= {}; d.ranks ||= {}; d.log ||= [];
        if (kind == 'picks') {
          const list = d.picks[week] || season.schedule[week].map(() => null);
          if (list[entry.i] == entry.v) return d;
          list[entry.i] = entry.v; d.picks[week] = list;
        } else {
          if (JSON.stringify(d.ranks[week]) == JSON.stringify(entry.v)) return d;
          d.ranks[week] = entry.v;
        }
        d.log = [...d.log, { ...entry, at: new Date().toISOString() }].slice(-100);
        return d;
      });
      return json(view(doc));
    } catch (e) {
      console.error('pundits save failed:', e?.name, e?.message);
      return json({ error: 'Couldn’t save that. Try again.' }, 503);
    }
  }
};
