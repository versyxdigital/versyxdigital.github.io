/**
 * Visual QA helper. Drives an installed Chrome/Edge through playwright-core
 * and writes screenshots to qa-screens/.
 *
 *   node scripts/shot.mjs <name> [--w=1440] [--h=900] [--section=tech]
 *        [--js="code to run in the page"] [--wait=1200] [--query="?reduced"]
 *        [--hover="css selector"] [--click="css selector"] [--full] [--mobile]
 *
 * Requires the dev or preview server to be running (default http://127.0.0.1:5183).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = Object.fromEntries(
  process.argv.slice(3).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.length ? rest.join('=') : true];
  }),
);
const name = process.argv[2] ?? 'shot';
const base = process.env.QA_URL ?? 'http://127.0.0.1:5183';
const width = Number(args.w ?? 1440);
const height = Number(args.h ?? 900);

mkdirSync('qa-screens', { recursive: true });

const launch = async () => {
  const options = { headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader'] };
  try {
    return await chromium.launch({ ...options, channel: 'chrome' });
  } catch {
    return chromium.launch({ ...options, channel: 'msedge' });
  }
};

const browser = await launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: Number(args.dpr ?? 1),
  hasTouch: Boolean(args.mobile),
  isMobile: Boolean(args.mobile),
  reducedMotion: args.reduced ? 'reduce' : 'no-preference',
});
const page = await context.newPage();
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(base + '/' + (typeof args.query === 'string' ? args.query : ''), { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);

if (typeof args.section === 'string') {
  await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' }), args.section);
  await page.waitForTimeout(2600);
}
if (typeof args.scroll === 'string') {
  await page.evaluate((y) => window.scrollBy(0, Number(y)), args.scroll);
  await page.waitForTimeout(1200);
}
// Pointer actions go through raw mouse events at the element's centre, so the
// page is never scrolled as a side effect of targeting a moving SVG node.
const centre = async (selector) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`No element for ${selector}`);
  return [box.x + box.width / 2, box.y + box.height / 2];
};
if (typeof args.click === 'string') {
  for (const selector of args.click.split('|')) {
    const [x, y] = await centre(selector);
    await page.mouse.click(x, y);
    await page.waitForTimeout(900);
  }
}
if (typeof args.hover === 'string') {
  const [x, y] = await centre(args.hover);
  await page.mouse.move(x - 30, y - 30);
  await page.mouse.move(x, y, { steps: 6 });
  await page.waitForTimeout(700);
}
if (typeof args.js === 'string') {
  const result = await page.evaluate(args.js);
  if (result !== undefined) console.log('js:', JSON.stringify(result));
}
await page.waitForTimeout(Number(args.wait ?? 800));

const path = `qa-screens/${name}.png`;
await page.screenshot({ path, fullPage: Boolean(args.full) });
console.log(`saved ${path} (${width}x${height})`);
if (errors.length) console.log('console errors:', errors);
await browser.close();
