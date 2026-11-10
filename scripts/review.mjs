// One-off review captures for states that need pointer movement or mid-scroll positions.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
mkdirSync('qa-screens', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto((process.env.QA_URL ?? 'http://127.0.0.1:5183') + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
// Sweep the pointer across the open field so the wake and reticle are live.
for (let i = 0; i <= 24; i++) {
  await page.mouse.move(820 + i * 16, 640 - i * 9);
  await page.waitForTimeout(40);
}
await page.waitForTimeout(350);
await page.screenshot({ path: 'qa-screens/r-hero-cursor.png' });
// Hover the role line: a pulse should run to the field.
await page.mouse.move(240, 514, { steps: 5 });
await page.waitForTimeout(450);
await page.screenshot({ path: 'qa-screens/r-hero-role.png' });
await page.mouse.move(700, 80);
// Mid-way between hero and about.
for (const [name, y] of [['r-scroll-1', 420], ['r-scroll-2', 760]]) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `qa-screens/${name}.png` });
}
await page.evaluate(() => document.getElementById('about').scrollIntoView({ behavior: 'instant' }));
await page.waitForTimeout(2600);
await page.screenshot({ path: 'qa-screens/r-about.png' });
await page.evaluate(() => document.getElementById('projects').scrollIntoView({ behavior: 'instant' }));
await page.waitForTimeout(2200);
await page.locator('[data-project-index] button', { hasText: 'MKEditor' }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: 'qa-screens/r-project-opening.png' });
await page.waitForTimeout(2600);
await page.screenshot({ path: 'qa-screens/r-project-open.png' });
console.log('errors:', errors);
await browser.close();
