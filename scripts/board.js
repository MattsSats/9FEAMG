// The Booth Board's data: Matt's claude.ai view of exactly what 9feamg.cloud shows (never Desk
// drafts), built from data/season.js after a push. Writes a JSON file for the ArtifactData tool to
// `set` as board/current.
//
//   node scripts/board.js <out.json> [commit] [previous board.json]
//
// Text that went live keeps the time it first appeared on the site: Booth lines carry their own
// time; power notes and roasts use the commit that first put that exact text in data/season.js;
// the Wire lines (worked out by the site, not stored) keep the previous board's time while the
// line is unchanged, and take this sync's time when it changes.
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { seasonStats, powerRanks } from '../api/_shared.js';

const [out, commit = '', prevPath] = process.argv.slice(2);
if (!out) { console.error('usage: node scripts/board.js <out.json> [commit] [previous board.json]'); process.exit(1); }
const root = new URL('..', import.meta.url);
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('data/season.js', root), 'utf8'), box);
const S = box.window.SEASON;
let prev = null;
try { prev = prevPath ? JSON.parse(fs.readFileSync(prevPath, 'utf8')) : null; } catch { prev = null; }
const now = new Date().toISOString();

// When a piece of text first went live: the earliest commit whose data/season.js contains it.
const firstLive = text => {
  if (!text) return null;
  const needle = text.slice(0, 60).replace(/’/g, "'").includes("'") ? text.slice(0, 40) : text.slice(0, 60);
  try {
    const log = execFileSync('git', ['log', '--reverse', '--format=%cI', '-S', needle, '--', 'data/season.js'], { cwd: root, encoding: 'utf8' }).trim().split('\n')[0];
    return log || now;
  } catch { return now; }
};

// The live week, or the latest final week once the season moves on.
const has = w => S.booth?.[w]?.length || S.boothSnf?.[w]?.length || S.boothPreview?.[w]?.length;
const NF = Math.max(0, ...S.managers.map(x => (S.scores[x.m] || []).length));
const week = S.live?.week || NF || Math.max(0, ...Object.keys(S.schedule).map(Number).filter(has));
const live = S.live?.week == week;
const sc = m => live ? S.live.scores?.[m] || [0, 0] : [S.scores[m]?.[week - 1] ?? 0, S.scores[m]?.[week - 1] ?? 0];
const pairs = S.schedule[week] || [];

// The Booth for the week Gameday opens on: the latest final week until the live week has lines.
const boothWeek = has(week) ? week : NF;
const bpairs = S.schedule[boothWeek] || [];
const set = lines => (lines || []).map((l, i) => ({ pair: bpairs[i] || [l[0]], crest: l[0], text: l[1], at: l[2] || null, draft: l[3] == 'claude' }));
const previewAt = S.boothPreviewAt?.[boothWeek] ? S.boothPreviewAt[boothWeek] + 'T12:00:00-05:00' : null;

// Season: power rankings through the last final week, with that week's notes (what the site shows).
const st = seasonStats(S, null);
const power = NF ? powerRanks(S, NF).map((r, i) => ({ m: r.m, rank: i + 1, score: +r.score.toFixed(1), note: S.powerNotes?.[NF]?.[r.m] || '', at: S.powerNotes?.[NF]?.[r.m] ? firstLive(S.powerNotes[NF][r.m]) : null })) : [];
const rec = Object.fromEntries(st.rows.map(r => [r.m, `${r.w}–${r.l}`]));

// Teams: each manager's roast line.
const roasts = S.managers.map(({ m }) => ({ m, text: S.roasts?.[m] || '', at: S.roasts?.[m] ? firstLive(S.roasts[m]) : null })).filter(r => r.text);

// Wire: the two lines the site shows, as scripts/check.js prints them.
const checkOut = execFileSync('node', ['scripts/check.js'], { cwd: root, encoding: 'utf8' });
const wireLine = label => (checkOut.match(new RegExp(`^Wire, ${label}:\\s+(.*)$`, 'm')) || [])[1] || '';
const keep = (key, text) => prev?.wire?.[key]?.text == text ? prev.wire[key].at : now;
const wire = { week: { text: wireLine('this week'), at: null }, season: { text: wireLine('season'), at: null } };
wire.week.at = keep('week', wire.week.text); wire.season.at = keep('season', wire.season.text);

const board = {
  week,
  status: live ? S.live.status : 'Final',
  asOf: live ? S.live.asOf : null,
  managers: S.managers.map(({ m, init, hue }) => ({ m, init, hue })),
  records: rec,
  games: pairs.map(([a, b]) => ({ pair: [a, b], a: sc(a), b: sc(b) })),
  boothWeek,
  booth: {
    Preview: set(S.boothPreview?.[boothWeek]).map(l => ({ ...l, at: l.at || previewAt })),
    'Post-SNF': set(S.boothSnf?.[boothWeek]),
    Recap: set(S.booth?.[boothWeek])
  },
  boothFinal: boothWeek <= NF,
  powerWeek: NF, power,
  roasts,
  wire,
  commit,
  syncedAt: now
};
fs.writeFileSync(out, JSON.stringify(board));
console.log(`Week ${week} (${board.status}) · Booth Week ${boothWeek}: ${Object.entries(board.booth).map(([k, v]) => `${k} ${v.length}`).join(', ')} · power W${NF} notes ${power.filter(p => p.note).length} · roasts ${roasts.length} · wire "${wire.week.text.slice(0, 40)}…"`);
