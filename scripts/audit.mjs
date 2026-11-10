/**
 * Fit and readability audit. Walks the page at several viewport sizes, takes a
 * screenshot of each section and of the main interactive states, and reports
 * anything that is clipped, spills out of its box or runs off the screen.
 *
 *   node scripts/audit.mjs            # all viewports
 *   node scripts/audit.mjs phone      # only viewports whose name contains "phone"
 *
 * Requires the dev or preview server (default http://127.0.0.1:5183).
 * Screenshots go to qa-screens/audit-<viewport>-<state>.png.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.QA_URL ?? 'http://127.0.0.1:5183';
const only = process.argv[2];
mkdirSync('qa-screens', { recursive: true });

const viewports = [
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'phone-360', width: 360, height: 740, mobile: true },
].filter((v) => !only || v.name.includes(only));

/** Finds content that does not fit: clipped text, boxes wider than the viewport, overlapping siblings. */
const findProblems = () => {
  const width = document.documentElement.clientWidth;
  const problems = [];
  const describe = (el) => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(' ').pop().slice(0, 28)} "${(el.textContent ?? '').trim().slice(0, 32)}"`;
  for (const el of document.querySelectorAll('main *, header *')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || el.classList.contains('visually-hidden')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const scrollable = /(auto|scroll)/.test(style.overflowX);
    const insideScroller = el.closest('[class*="scroller"], [class*="filters"], [class*="tabs"]') !== null;
    if (!insideScroller && !scrollable && rect.right > width + 1 && style.position !== 'fixed' && !el.closest('[aria-hidden="true"]')) {
      problems.push(`off-screen right by ${Math.round(rect.right - width)}px: ${describe(el)}`);
    }
    // Text wider than its own box.
    if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !scrollable && style.overflowX !== 'visible') {
      problems.push(`clipped text: ${describe(el)}`);
    }
  }
  // SVG diagram labels that spill out of their node box.
  // Only the architecture diagrams: constellation labels sit outside their nodes by design.
  for (const node of document.querySelectorAll('#inspection-bay svg [class*="node"]')) {
    const box = node.querySelector('rect');
    if (!box) continue;
    const b = box.getBoundingClientRect();
    for (const text of node.querySelectorAll('text')) {
      const t = text.getBoundingClientRect();
      if (t.width > 0 && t.right > b.right - 1) problems.push(`diagram label spills by ${Math.round(t.right - b.right + 1)}px: "${text.textContent}"`);
    }
  }
  return [...new Set(problems)].slice(0, 12);
};

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
let total = 0;

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: Boolean(vp.mobile), isMobile: Boolean(vp.mobile) });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  console.log(`\n${vp.name} (${vp.width}×${vp.height})`);
  const seen = new Set();

  const capture = async (state) => {
    await page.screenshot({ path: `qa-screens/audit-${vp.name}-${state}.png` });
    const problems = (await page.evaluate(findProblems)).filter((problem) => !seen.has(problem));
    total += problems.length;
    for (const problem of problems) {
      seen.add(problem);
      console.log(`  [${state}] ${problem}`);
    }
  };
  const tap = async (locator) => {
    const box = await locator.first().boundingBox();
    if (!box) return false;
    if (vp.mobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return true;
  };
  const goTo = async (id, offset = 0) => {
    await page.evaluate(([target, extra]) => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'instant', block: 'start' });
      window.scrollBy(0, extra);
    }, [id, offset]);
    await page.waitForTimeout(1900);
  };

  // Does the hero fit in one screen?
  const heroFits = await page.evaluate(() => {
    const foot = document.querySelector('#hero [class*="foot"]');
    const actions = document.querySelector('#hero [class*="actions"]');
    return { actionsBottom: Math.round(actions.getBoundingClientRect().bottom), footTop: Math.round(foot.getBoundingClientRect().top), viewport: window.innerHeight };
  });
  if (heroFits.actionsBottom > heroFits.viewport) {
    total++;
    console.log(`  [hero] calls to action end ${heroFits.actionsBottom - heroFits.viewport}px below the first screen`);
  }
  await capture('hero');

  await goTo('about');
  await capture('studio');
  await goTo('about', vp.height * 0.8);
  await capture('studio-2');

  await goTo('tech');
  await capture('tech');
  await goTo('tech', vp.height * 0.7);
  await tap(page.locator("[aria-label='TypeScript, Languages']"));
  await page.waitForTimeout(1600);
  await capture('tech-focus');
  await page.keyboard.press('Escape');

  await goTo('projects');
  await capture('projects');
  for (const [name, slug] of [['The Home Counties', 'thc'], ['OMG', 'omg']]) {
    await goTo('projects', vp.mobile ? 0 : 160);
    await page.locator('[data-project-index] button', { hasText: name }).first().scrollIntoViewIfNeeded();
    await tap(page.locator('[data-project-index] button', { hasText: name }));
    await page.waitForTimeout(2400);
    await capture(`project-${slug}`);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.85));
    await page.waitForTimeout(900);
    await capture(`project-${slug}-2`);
  }
  await page.evaluate(() => document.querySelector('#inspection-bay button[class*="close"]')?.click());
  await page.waitForTimeout(800);

  await goTo('contact');
  await capture('contact');

  if (vp.mobile) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await tap(page.locator('button', { hasText: 'Menu' }));
    await page.waitForTimeout(500);
    await capture('menu');
  }
  await context.close();
}

await browser.close();
console.log(`\n${total} fit problems reported`);
