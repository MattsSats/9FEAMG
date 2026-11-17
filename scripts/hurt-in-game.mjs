// Starters who got hurt during a game (Matt, Nov 16, 2026): Biggest bust skips them, since a player who leaves
// in the first quarter didn't bust. Reads ESPN's play-by-play for every final week ("NYG-J.Dart was injured
// during the play"), matches it to the league's starters in the box scores, and writes `hurtInGame` to
// data/season.js. Run after each week goes final (RUNBOOK section 4). Usage: node scripts/hurt-in-game.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = path.join(ROOT, 'data/season.js');
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(SEASON, 'utf8'), ctx); const season = ctx.window.SEASON;
const box = JSON.parse(fs.readFileSync(path.join(ROOT, 'uploads/9feamg-boxscores.json'), 'utf8'));
const ALIAS = { WSH: 'WAS', JAC: 'JAX', LA: 'LAR' };
const team = t => { const u = String(t || '').toUpperCase(); return ALIAS[u] || u; };
const key = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const strip = n => String(n).replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, '');

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + url); return await r.json(); }
    catch (e) { if (i >= tries) throw e; await new Promise(r => setTimeout(r, 800 * i)); }
  }
}

const weeks = Object.keys(box.weeks || {}).map(Number).sort((a, b) => a - b);
const out = {};
for (const w of weeks) {
  // The league's starters this week, by NFL team, as "first initial + last name" keys.
  const starters = [];
  for (const [m, t] of Object.entries(box.weeks[w])) for (const r of t.starters || []) {
    if (['DEF', 'K'].includes(r[3])) continue;
    const parts = strip(r[1]).split(/\s+/);
    starters.push({ m, name: r[1], nfl: team(r[2]), k: key(parts[0][0] + parts.slice(1).join('')) });
  }
  const sb = await get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${w}&dates=${season.year}`);
  const hurt = new Set();
  for (const ev of sb.events || []) {
    if (ev.status?.type?.state != 'post') continue;
    const s = await get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${ev.id}`);
    const inGame = new Set((ev.competitions?.[0]?.competitors || []).map(c => team(c.team?.abbreviation)));
    const plays = (s.drives?.previous || []).flatMap(d => d.plays || []);
    // A player only counts when he left: no play mentions him after the injury, with at least 10 minutes
    // left (ESPN also logs players who are shaken up for a snap and come back).
    const names = plays.map(p => new Set([...String(p.text || "").matchAll(/([A-Z][A-Za-z]{0,2}.s?[A-Z][A-Za-z'.-]+)/g)].map(x => key(x[1]))));
    const left = p => { const q = p.period?.number || 1, [mm, ss] = String(p.clock?.displayValue || "0:00").split(":").map(Number); return (4 - Math.min(q, 4)) * 15 + mm + ss / 60; };
    plays.forEach((p, i) => { for (const mt of String(p.text || "").matchAll(/(?:([A-Z]{2,3})-)?([A-Z][A-Za-z]{0,2}.s?[A-Z][A-Za-z'.-]+(?:s[A-Z][A-Za-z'.-]+)?) was injured/g)) {
      const k = key(mt[2]), nfl = mt[1] && team(mt[1]);
      if (left(p) < 10 || names.slice(i + 1).some(n => n.has(k))) continue;
      for (const st of starters) if (st.k == k && inGame.has(st.nfl) && (!nfl || st.nfl == nfl)) hurt.add(st.name);
    } });
  }
  if (hurt.size) out[w] = [...hurt].sort();
  console.log(`Week ${w}: ${hurt.size ? [...hurt].join(', ') : 'none'}`);
}

if (process.argv.includes('--dry')) process.exit(0);
const body = Object.entries(out).map(([w, l]) => `    ${w}: [${l.map(n => `'${n.replace(/'/g, "\\'")}'`).join(', ')}],`).join('\n').replace(/,$/, '');
const block = `  // Starters hurt during a game (scripts/hurt-in-game.mjs, from ESPN's play-by-play): Biggest bust skips them.\n  // Written by the script; don't edit.\n  hurtInGame: {\n${body}\n  },\n`;
const src = fs.readFileSync(SEASON, 'utf8');
const re = /\n  \/\/ Starters hurt during a game[\s\S]*?\n  hurtInGame: \{[\s\S]*?\n  \},\n/;
const next = re.test(src) ? src.replace(re, () => '\n' + block) : src.replace(/\n  \/\/ Roster strength/, () => '\n' + block + '\n  // Roster strength');
if (next == src && !re.test(src)) throw new Error('anchor not found');
fs.writeFileSync(SEASON, next);
console.log('hurtInGame written');
