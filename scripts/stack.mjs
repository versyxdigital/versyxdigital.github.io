/**
 * Screenshots of the phone technology view (the layered stack): at rest, with
 * a technology selected, and scrolled to show connections in other layers.
 * Requires the dev or preview server (default http://127.0.0.1:5183).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.QA_URL ?? 'http://127.0.0.1:5183';
mkdirSync('qa-screens', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });

for (const [width, height] of [
  [390, 844],
  [360, 740],
]) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById('tech').scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `qa-screens/stack-${width}-1-top.png` });
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.55));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `qa-screens/stack-${width}-2-rest.png` });

  const tap = async (label) => {
    const box = await page.locator(`[aria-label='${label}']`).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1500);
  };
  await tap('Laravel, Backend');
  await page.screenshot({ path: `qa-screens/stack-${width}-3-selected.png` });
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `qa-screens/stack-${width}-4-connections.png` });

  const size = await page.evaluate(() => {
    const section = document.getElementById('tech');
    return { sectionHeight: Math.round(section.getBoundingClientRect().height), screens: +(section.getBoundingClientRect().height / window.innerHeight).toFixed(1), overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log(`${width}×${height}`, size, errors.length ? errors : 'no errors');
  await context.close();
}
await browser.close();
