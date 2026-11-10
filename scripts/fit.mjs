/**
 * Fit check. On desktop sizes every section should occupy exactly one screen,
 * with nothing inside it running past the bottom. This measures that, and
 * takes a screenshot of each section as it sits after navigating to it.
 *
 *   node scripts/fit.mjs
 *
 * Requires the dev or preview server (default http://127.0.0.1:5183).
 * Screenshots go to qa-screens/fit-<size>-<section>.png.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.QA_URL ?? 'http://127.0.0.1:5183';
mkdirSync('qa-screens', { recursive: true });

const sizes = [
  [1905, 945],
  [1920, 1080],
  [1536, 864],
  [1440, 900],
  [1366, 768],
];

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
let failures = 0;

for (const [width, height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log(`\n${width}×${height}`);

  const measure = (id) =>
    page.evaluate((target) => {
      const section = document.getElementById(target);
      const rect = section.getBoundingClientRect();
      // Deepest bottom edge of anything visible inside the section.
      let lowest = 0;
      let culprit = '';
      for (const el of section.querySelectorAll('*')) {
        if (el.closest('[aria-hidden="true"]') || el.classList.contains('visually-hidden')) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.position === 'fixed') continue;
        // Content inside a scrolling tab body is allowed to extend; the body itself is measured.
        if (el.parentElement?.closest('[role="tabpanel"], [class*="panel"]') && el.closest('[role="tabpanel"], aside')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.bottom > lowest) {
          lowest = r.bottom;
          culprit = `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ').pop().slice(0, 24)}`;
        }
      }
      return {
        top: Math.round(rect.top),
        height: Math.round(rect.height),
        viewport: window.innerHeight,
        overflow: Math.round(lowest - window.innerHeight),
        culprit,
        rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      };
    }, id);

  const report = async (label, id) => {
    const m = await measure(id);
    const fits = Math.abs(m.top) <= 2 && m.height <= m.viewport + 1 && m.overflow <= 1;
    if (!fits) failures++;
    console.log(
      `  ${fits ? 'fits ' : 'FAILS'}  ${label.padEnd(22)} section ${m.height}px of ${m.viewport}px, top ${m.top}` +
        (m.overflow > 1 ? `, content runs ${m.overflow}px past the bottom (${m.culprit})` : '') +
        `  [root ${m.rem}px]`,
    );
    await page.screenshot({ path: `qa-screens/fit-${width}-${label.replace(/\W+/g, '-').toLowerCase()}.png` });
  };

  const go = async (id) => {
    await page.evaluate((target) => document.getElementById(target).scrollIntoView({ behavior: 'instant', block: 'start' }), id);
    await page.waitForTimeout(1700);
  };

  await report('hero', 'hero');
  await go('about');
  await report('studio', 'about');
  await go('tech');
  await report('technologies', 'tech');
  const node = await page.locator("[aria-label='Laravel, Backend']").boundingBox();
  await page.mouse.click(node.x + node.width / 2, node.y + node.height / 2);
  await page.waitForTimeout(1700);
  await report('technologies focus', 'tech');
  await page.keyboard.press('Escape');
  await go('projects');
  await report('projects', 'projects');
  for (const name of ['The Home Counties', 'OMG', 'ED:CS']) {
    await page.locator('[data-project-index] button', { hasText: name }).click();
    await page.waitForTimeout(2200);
    await report(`project ${name}`, 'projects');
  }
  await page.locator('#inspection-bay svg [role="button"]').first().click();
  await page.waitForTimeout(500);
  await report('project stage open', 'projects');
  await page.locator('[role="tab"]', { hasText: 'How it was built' }).click();
  await page.waitForTimeout(500);
  await report('project engineering', 'projects');
  await page.keyboard.press('Escape');
  await go('contact');
  await report('contact', 'contact');
  await page.close();
}

await browser.close();
console.log(`\n${failures} sections do not fit`);
process.exit(failures > 0 ? 1 : 0);
