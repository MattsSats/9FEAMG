// Smoke test: loads the built index.html in a real headless browser (the Chrome or Edge already on
// this machine; no packages needed), opens every tab and the awards page, and exits 1 on any
// uncaught error or console.error, or if the page didn't draw. data checks can't see a script error
// in the bundle (Nov 8, 2026: a variable collision took the live site down); this does.
// scripts/check.js runs it at the end, so it runs before every push.
//   node scripts/smoke.mjs      (CHROME_PATH=... to pick the browser)
// The page is served by scripts/dev.js: local files, /api reads from the live site, saves refused.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const exe = BROWSERS.find(p => p && existsSync(p));
if (!exe) { console.log('! Smoke test skipped: no Chrome or Edge found (set CHROME_PATH).'); process.exit(0); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (what, fn, ms = 15000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) { const v = await fn(); if (v) return v; }
  throw new Error('Timed out waiting for ' + what);
};
const port = 20000 + Math.floor(Math.random() * 20000), site = `http://127.0.0.1:${port}/`;
const profile = mkdtempSync(path.join(tmpdir(), '9feamg-smoke-'));
let server, browser, ws;
const problems = [];

try {
  server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'dev.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  await until('the local server', () => fetch(site + 'favicon.svg').then(r => r.ok, () => false));

  browser = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
  const cdpPort = await until('the browser', () => { try { return +readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch { return 0; } });
  const target = await until('a browser tab', () => fetch(`http://127.0.0.1:${cdpPort}/json/list`).then(r => r.json()).then(l => l.find(t => t.type == 'page'), () => null));

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('Couldn’t connect to the browser.')); });
  let id = 0, where = 'loading';
  const waiting = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { waiting.get(m.id)?.(m); waiting.delete(m.id); return; }
    if (m.method == 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      problems.push(`${where}: ${d.exception?.description?.split('\n').slice(0, 2).join(' ') || d.text}`);
    }
    if (m.method == 'Runtime.consoleAPICalled' && m.params.type == 'error')
      problems.push(`${where}: console.error: ${m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    waiting.set(++id, m => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async js => (await send('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true })).result.value;

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: site });
  // Drawn: the four tabs are on the page and there is real content behind them.
  const TABS = ['Gameday', 'Season', 'Teams', 'Wire'];
  const tabJs = t => `[...document.querySelectorAll('button,a')].find(b => b.innerText.trim().toLowerCase() == ${JSON.stringify(t.toLowerCase())})`;
  try {
    await until('the page to draw', () => run(`${JSON.stringify(TABS)}.every(t => [...document.querySelectorAll('button,a')].some(b => b.innerText.trim().toLowerCase() == t.toLowerCase())) && document.querySelectorAll('*').length > 300`), 20000);
  } catch { problems.push('The page didn’t draw: no tabs after 20 seconds.'); }

  if (!problems.length) {
    await sleep(1500);
    for (const t of TABS) {
      where = t + ' tab';
      if (!await run(`(() => { const b = ${tabJs(t)}; if (!b) return false; b.click(); return true; })()`)) { problems.push(`${where}: tab not found.`); continue; }
      await sleep(t == 'Season' ? 4000 : 1500); // the Season tab runs the playoff odds
      const size = await run(`document.querySelectorAll('*').length`);
      if (!(size > 300)) problems.push(`${where}: the page went blank (${size} elements).`);
    }
    where = 'awards page';
    await run(`location.hash = '#awards'`);
    await sleep(2000);
    if (!await run(`/award/i.test(document.body.innerText)`)) problems.push(`${where}: didn’t open.`);
  }
} catch (e) {
  problems.push('Smoke test couldn’t run: ' + e.message);
} finally {
  try { ws?.close(); } catch {}
  browser?.kill(); server?.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}

for (const p of [...new Set(problems)]) console.log('✗ ' + p);
console.log(problems.length ? '\nSmoke test FAILED: the built page has errors. Don’t push.' : 'OK: the built page loads and every tab opens without errors.');
process.exit(problems.length ? 1 : 0);
