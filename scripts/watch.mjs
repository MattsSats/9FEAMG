// The hourly failure alert (Matt, Nov 8, 2026), run by .github/workflows/site-alert.yml. It reads the
// site's two health checks and exits 1 when one is failing. GitHub then emails the repo owner that the
// run failed, which needs no account, key or server of our own, and still works if Vercel is down.
//   /api/league?format=status&peek=1  the Yahoo sync: last good read under 26 hours old, still connected,
//                                     and no error newer than the last good read
//   /api/live?format=status           the live-score function, during game time only
// Run it by hand with: node scripts/watch.mjs [--test]   (--test fails on purpose, to try the email)
const SITE = 'https://www.9feamg.cloud', GRACE = 15 * 60e3;

async function read(path) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(SITE + path, { cache: 'no-store', signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i) throw e;
      await new Promise(res => setTimeout(res, 30000)); // one retry, so a network blip isn't an alert
    }
  }
}

const problems = [];
if (process.argv.includes('--test')) problems.push('Test alert: nothing is actually wrong.');

try {
  const s = await read(`/api/league?format=status&peek=1&t=${Date.now()}`);
  if (!s.connected) problems.push('Yahoo sync: the site is no longer connected to Yahoo. Sign in again at /api/yahoo/login.');
  if (!s.healthy) problems.push(`Yahoo sync: no good read in over 26 hours (last was ${s.syncedAt || 'never'}).`);
  // A failed refresh gets 15 minutes to be replaced by a good one before it counts.
  if (s.lastError && Date.now() - Date.parse(s.lastError.at) > GRACE) problems.push(`Yahoo sync: ${s.lastError.from || 'sync'} failed at ${s.lastError.at}: ${s.lastError.error}`);
  if (s.txError) problems.push(`Yahoo sync: the moves and FAAB read failed: ${s.txError}`);
  console.log('Yahoo sync:', JSON.stringify(s));
} catch (e) { problems.push(`Yahoo sync: the status check itself failed: ${e.message}`); }

try {
  const s = await read(`/api/live?format=status&t=${Date.now()}`);
  if (s.gameTime && !s.ok) problems.push(`Live scores: failing during games: ${s.error || 'no data'}.`);
  console.log('Live scores:', JSON.stringify(s));
} catch (e) { problems.push(`Live scores: the status check itself failed: ${e.message}`); }

if (!problems.length) { console.log('OK: Yahoo sync and live scores are healthy.'); process.exit(0); }
for (const p of problems) console.log(`::error::${p}`);
if (process.env.GITHUB_STEP_SUMMARY) (await import('fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, problems.map(p => `- ${p}`).join('\n') + '\n');
process.exit(1);
