// Shared by the preview images (api/og.js, api/section.js): light-theme colors, fonts,
// manager colors, a tiny element helper for Satori, and ImageResponse (element in, PNG out).
import { readFile } from 'node:fs/promises';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

// Light-theme tokens from the 9FEAMG design system (same values as :root in src/app.html).
export const C = { bg: '#F7F5F0', surface2: '#EFECE5', line: '#E0DBD0', ink: '#191815', muted: '#5F5B52', accent: '#E4572E', accentInk: '#B23B15', pos: '#25784A', neg: '#B8233F', onStatus: '#FFFFFF', onAccent: '#141311' };

// The three fonts ship with the site (api/_fonts, SIL Open Font License) so previews don't
// wait on Google. If a file is ever missing, fall back to Google Fonts, which serves TrueType
// to clients it doesn't recognize (what Satori needs).
const LOCAL = {
  'Big Shoulders Display900': new URL('./_fonts/BigShouldersDisplay-900.ttf', import.meta.url),
  'Instrument Sans600': new URL('./_fonts/InstrumentSans-600.ttf', import.meta.url),
  'JetBrains Mono600': new URL('./_fonts/JetBrainsMono-600.ttf', import.meta.url)
};
const fontCache = new Map();
function font(family, weight) {
  const key = family + weight;
  if (!fontCache.has(key)) fontCache.set(key, (async () => {
    try {
      const buf = await readFile(LOCAL[key]);
      return { name: family, weight, style: 'normal', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    } catch { /* not bundled: fetch from Google below */ }
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!src) throw new Error('no ttf for ' + family);
    return { name: family, weight, style: 'normal', data: await (await fetch(src)).arrayBuffer() };
  })().catch(err => { fontCache.delete(key); throw err; }));
  return fontCache.get(key);
}
export const F = { display: 'Big Shoulders Display', sans: 'Instrument Sans', mono: 'JetBrains Mono' };
export const fonts = async () => (await Promise.allSettled([font(F.display, 900), font(F.sans, 600), font(F.mono, 600)]))
  .filter(r => r.status == 'fulfilled').map(r => r.value);

// Tiny element helper: Satori takes React-style { type, props } objects.
export const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter(c => c != null && c !== false) } });

// Manager colors: the site's oklch(0.61 0.12 hue) (light theme), converted to hex for Satori.
export function mgrColor(hue, L = 0.61, Ch = 0.12) {
  const a = Ch * Math.cos(hue * Math.PI / 180), b = Ch * Math.sin(hue * Math.PI / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  return '#' + lin.map(x => { const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'); }).join('');
}

// ImageResponse: Satori draws the element as SVG, resvg turns it into a PNG. This used to come
// from @vercel/og, which does the same two steps; its 1.0.2+ Node build crashes on import
// ("Dynamic require of fs", a missing hb.wasm), and 0.x pins a Satori with an SVG escaping
// advisory (GHSA-wx4j-mvgx-mqwp), so the site calls Satori and resvg itself (Matt, Nov 26, 2026).
// Written as new URL(import.meta.resolve(...)) so Vercel's file tracing ships the .wasm with the functions.
const resvgReady = readFile(new URL(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm'))).then(initWasm);
// Any emoji in a name or note come in as Twemoji pictures, as @vercel/og drew them.
const emojiCode = s => [...(s.includes('\u200d') ? s : s.replace(/\ufe0f/g, ''))].map(c => c.codePointAt(0).toString(16)).join('-');
async function loadAdditionalAsset(code, text) {
  if (code != 'emoji') return [];
  try {
    const r = await fetch(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${emojiCode(text)}.svg`);
    if (r.ok) return 'data:image/svg+xml;base64,' + Buffer.from(await r.text()).toString('base64');
  } catch { /* drawn without it */ }
  return [];
}
export async function renderPng(element, { width = 1200, height = 630, fonts: fontList } = {}) {
  const svg = await satori(element, { width, height, fonts: fontList || await fonts(), loadAdditionalAsset });
  await resvgReady;
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } }), img = r.render(), png = img.asPng();
  img.free(); r.free();
  return png;
}
export class ImageResponse extends Response {
  constructor(element, { headers, status, statusText, ...opts } = {}) {
    super(new ReadableStream({ async start(c) { try { c.enqueue(await renderPng(element, opts)); c.close(); } catch (e) { c.error(e); } } }), {
      status, statusText,
      headers: { 'content-type': 'image/png', 'cache-control': 'public, immutable, no-transform, max-age=31536000', ...headers }
    });
  }
}
