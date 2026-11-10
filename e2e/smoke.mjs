/**
 * Browser smoke test.
 *
 * Builds nothing itself: it serves ./dist with `vite preview`, drives an
 * installed Chrome (or Edge) through playwright-core, and checks the things
 * unit tests cannot — that the field renders, that interactions propagate
 * between systems, and that the page holds up at three viewport sizes, with
 * reduced motion, and without WebGL.
 *
 *   npm run build && npm run test:e2e
 *
 * Screenshots are written to qa-screens/e2e-*.png.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}`;
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

mkdirSync('qa-screens', { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  pass' : '  FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

async function startServer() {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return server;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  server.kill();
  throw new Error('Preview server did not start. Run `npm run build` first.');
}

async function launch() {
  const options = { headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader'] };
  try {
    return await chromium.launch({ ...options, channel: 'chrome' });
  } catch {
    return chromium.launch({ ...options, channel: 'msedge' });
  }
}

async function open(browser, { width, height, mobile = false, reduced = false, query = '' }) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: mobile,
    isMobile: mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${BASE}/${query}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { page, context, errors };
}

const goTo = async (page, id, settle = 2200) => {
  await page.evaluate((target) => document.getElementById(target)?.scrollIntoView({ behavior: 'instant', block: 'start' }), id);
  await page.waitForTimeout(settle);
};

const centre = async (page, selector) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`No element for ${selector}`);
  return [box.x + box.width / 2, box.y + box.height / 2];
};

const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

/** Names whatever is wider than the viewport, for the failure message. */
const overflowing = (page) =>
  page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > width + 1 && !el.closest('[aria-label^="Filter"]'))
      .slice(0, 4)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).slice(0, 30)}`)
      .join(', ');
  });

/** Mean brightness of a canvas region, read back through a 2D copy. */
const canvasStats = (page) =>
  page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const grab = async () => {
      const bitmap = await createImageBitmap(canvas);
      const probe = document.createElement('canvas');
      probe.width = 96;
      probe.height = 60;
      const ctx = probe.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, 96, 60);
      return ctx.getImageData(0, 0, 96, 60).data;
    };
    // preserveDrawingBuffer is off, so sample inside an animation frame.
    // In reduced-motion mode the field only draws on demand; a scroll event asks for a frame.
    const frame = () =>
      new Promise((resolve) => {
        const attempt = (left) => {
          window.dispatchEvent(new Event('scroll'));
          requestAnimationFrame(async () => {
            const data = await grab();
            // A frame that has not been drawn yet reads back empty; ask again.
            if (left > 0 && !data.some((value, i) => i % 4 !== 3 && value > 20)) attempt(left - 1);
            else resolve(data);
          });
        };
        attempt(12);
      });
    const first = await frame();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const second = await frame();
    let lit = 0;
    let changed = 0;
    for (let i = 0; i < first.length; i += 4) {
      if (first[i] + first[i + 1] + first[i + 2] > 60) lit++;
      if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 2] - second[i + 2]) > 6) changed++;
    }
    return { lit: lit / (first.length / 4), changed: changed / (first.length / 4) };
  });

async function desktop(browser) {
  console.log('\nDesktop 1440×900');
  const { page, context, errors } = await open(browser, { width: 1440, height: 900 });

  // ── Keyboard, before anything has taken focus ───────────────────────
  await page.keyboard.press('Tab');
  check('keyboard: first tab stop is the skip link', await page.evaluate(() => document.activeElement?.classList.contains('skip-link') ?? false));
  await page.keyboard.press('Tab');
  check('keyboard: focus is visible', await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
  await page.evaluate(() => document.activeElement?.blur());

  check('hero: the studio name is present', (await page.locator('h1').innerText()).replace(/\s+/g, ' ').includes('Versyx Digital'));
  const heroText = await page.locator('#hero').innerText();
  check('hero: reads as a software studio', heroText.includes('Software studio') && !/founded by/i.test(heroText));
  check('hero: no field readout or field markers', (await page.locator('body > #root > header').innerText()).toLowerCase().includes('field') === false && !/travelling|interference/i.test(heroText));

  const stats = await canvasStats(page);
  check('field: WebGL canvas is rendering lit geometry', stats !== null && stats.lit > 0.05, stats ? `${(stats.lit * 100).toFixed(0)}% of sampled pixels lit` : 'no canvas');
  check('field: animating between frames', stats !== null && stats.changed > 0.01, stats ? `${(stats.changed * 100).toFixed(0)}% of sampled pixels changed` : '');

  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const t0 = performance.now();
        let n = 0;
        const tick = () => {
          n++;
          if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
          else resolve(n / 2);
        };
        requestAnimationFrame(tick);
      }),
  );
  check('field: frame rate', fps > 30, `${fps.toFixed(0)} fps`);
  await page.screenshot({ path: 'qa-screens/e2e-desktop-hero.png' });

  // Section navigation changes the field mode readout.
  // The director records the field's current behaviour on the document element.
  const mode = () => page.evaluate(() => document.documentElement.dataset.mode ?? '');
  const heroMode = await mode();
  await page.locator('header nav a', { hasText: 'Technologies' }).click();
  await page.waitForTimeout(2600);
  const techMode = await mode();
  check('navigation: section link scrolls and the field changes mode', heroMode !== techMode, `${heroMode} → ${techMode}`);
  check('navigation: active link is marked', (await page.locator('header nav a[aria-current="true"]').innerText()).includes('Technologies'));

  // ── Studio ──────────────────────────────────────────────────────────
  await goTo(page, 'about');
  check('studio: all five services are on the schematic', (await page.locator('#about button[aria-pressed]').count()) === 5);
  await page.locator('#about button[aria-pressed]', { hasText: 'APIs' }).click();
  await page.waitForTimeout(500);
  const record = await page.locator('#about [aria-live="polite"]').innerText();
  check('studio: selecting a service shows its record and the projects that exemplify it', record.includes('APIs') && record.includes('ED:CS'));
  check('studio: an undescribed service is marked pending, not invented', record.toLowerCase().includes('pending'));
  await page.locator('header nav a', { hasText: 'Technologies' }).click();
  await page.waitForTimeout(2600);

  // ── Constellation ───────────────────────────────────────────────────
  const [lx, ly] = await centre(page, "[aria-label='Laravel, Backend']");
  await page.mouse.move(lx - 40, ly - 40);
  await page.mouse.move(lx, ly, { steps: 5 });
  await page.waitForTimeout(600);
  check('constellation: hover shows the technology record', (await page.locator('aside[aria-label="Technology detail"] h3').innerText()) === 'Laravel');
  check('constellation: related nodes are lit', (await page.locator("[aria-label='PHP, Languages']").getAttribute('data-state')) === 'lit');
  check('constellation: unrelated nodes recede', (await page.locator("[aria-label='Sass, Frontend']").getAttribute('data-state')) === 'dim');
  check('constellation: hover lists the projects using it', (await page.locator('aside[aria-label="Technology detail"]').innerText()).includes('ED:CS'));
  await page.screenshot({ path: 'qa-screens/e2e-desktop-tech-hover.png' });

  await page.mouse.click(lx, ly);
  await page.waitForTimeout(1800);
  check('constellation: selecting focuses the node', (await page.locator("[aria-label='Laravel, Backend']").getAttribute('aria-pressed')) === 'true');
  check('constellation: selection changes the field mode', (await mode()) === 'focus:tech', await mode());
  await page.screenshot({ path: 'qa-screens/e2e-desktop-tech-focus.png' });
  await page.locator('button', { hasText: 'Release focus' }).click();
  await page.waitForTimeout(600);

  // Keyboard model: the graph is one tab stop and the arrow keys walk it.
  check('constellation: is a single tab stop', (await page.locator('svg[aria-label^="Technology constellation"] [role="button"][tabindex="0"]').count()) === 1);
  await page.locator("[aria-label='TypeScript, Languages']").focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  const moved = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  check('constellation: arrow keys move focus between nodes', moved !== '' && moved !== 'TypeScript, Languages', moved);
  check('constellation: keyboard focus shows the record too', (await page.locator('aside[aria-label="Technology detail"] h3').innerText()) === moved.split(',')[0]);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  check('constellation: Enter focuses the node', await page.evaluate(() => document.activeElement?.getAttribute('aria-pressed') === 'true'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  await page.evaluate(() => document.activeElement?.blur());

  // Scoped to the filter row: other buttons on the page also contain the word "data".
  const filters = page.locator('#tech [aria-label="Filter by category"] button');
  await filters.filter({ hasText: 'Data' }).click();
  await page.waitForTimeout(1500);
  check('constellation: category filter applies', (await page.locator("[aria-label='Redis, Data']").getAttribute('data-emphasis')) === 'ring');
  check('constellation: filtered-out nodes move away', (await page.locator("[aria-label='React, Frontend']").getAttribute('data-emphasis')) === 'away');
  await page.screenshot({ path: 'qa-screens/e2e-desktop-tech-filter.png' });
  await filters.filter({ hasText: /^All/ }).click();

  // ── Project explorer ────────────────────────────────────────────────
  await goTo(page, 'projects');
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(600);
  check('explorer: standby bay previews a system', (await page.locator('#inspection-bay').innerText()).toLowerCase().includes('standing by'));
  check('explorer: the catalogue lists the six projects', (await page.locator('[data-project-index] button').count()) === 6);
  await page.locator('[data-project-index] button', { hasText: 'wssh' }).click();
  await page.waitForTimeout(2200);
  check('explorer: selecting a project opens the inspector', (await page.locator('#inspection-bay h3').first().innerText()) === 'wssh');
  check('explorer: field adopts the project signature', (await mode()) === 'project:rings', await mode());
  check('explorer: focus moves into the inspector', await page.evaluate(() => document.activeElement?.id === 'inspect-wssh'));
  await page.screenshot({ path: 'qa-screens/e2e-desktop-project.png' });

  const [sx, sy] = await centre(page, '#inspection-bay svg [aria-label^="SSH client"]');
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(500);
  check('explorer: a diagram stage can be inspected', (await page.locator('#inspection-bay [aria-live="polite"]').innerText()).includes('holds the SSH connection'));

  await page.locator('[role="tab"]', { hasText: 'Engineering' }).click();
  await page.waitForTimeout(400);
  check('explorer: tabs disclose engineering notes', (await page.locator('[role="tabpanel"]').innerText()).toLowerCase().includes('implementation'));
  check('explorer: undocumented fields are marked pending, not invented', (await page.locator('[role="tabpanel"]').innerText()).toLowerCase().includes('pending'));
  await page.locator('[role="tab"]', { hasText: 'Stack' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa-screens/e2e-desktop-project-stack.png' });

  // A technology chip in the inspector drives the shared highlight.
  // The chip can sit below the fold once a stage is open: bring it into view before pointing at it.
  await page.locator('[role="tabpanel"] button:has-text("Paramiko")').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const [cx, cy] = await centre(page, '[role="tabpanel"] button:has-text("Paramiko")');
  await page.mouse.move(cx, cy, { steps: 4 });
  await page.waitForTimeout(400);
  check('system: hovering a technology in the inspector lights its project in the catalogue', (await page.locator('[data-project-index] button', { hasText: 'wssh' }).getAttribute('data-lit')) === 'true');
  await page.mouse.move(10, 400);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  check('explorer: Escape closes the inspector', (await page.locator('#inspection-bay').innerText()).toLowerCase().includes('standing by'));
  check('explorer: focus returns to the catalogue entry', await page.evaluate(() => document.activeElement?.textContent?.includes('wssh') ?? false));
  check('explorer: field returns to the section mode', (await mode()) === 'section:projects', await mode());

  // Every catalogued system opens, takes its own field behaviour and draws its diagram.
  const behaviours = new Set();
  for (const name of ['MKEditor', 'The Home Counties', 'Aldervast', 'ED:CS', 'OMG', 'wssh']) {
    await page.locator('[data-project-index] button', { hasText: name }).click();
    await page.waitForTimeout(1900);
    const title = await page.locator('#inspection-bay h3').first().innerText();
    const stages = await page.locator('#inspection-bay svg [role="button"]').count();
    behaviours.add(await mode());
    check(`explorer: ${name} opens with an architecture diagram`, title === name && stages >= 6, `${stages} stages`);
  }
  check('explorer: each project gives the field a distinct behaviour', behaviours.size === 6, [...behaviours].join(', '));
  await page.screenshot({ path: 'qa-screens/e2e-desktop-project-last.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);

  // ── Contact ─────────────────────────────────────────────────────────
  await goTo(page, 'contact');
  const contact = await page.locator('#contact').innerText();
  check('contact: email, GitHub and LinkedIn are present', contact.includes('outlook.com') && contact.includes('github.com/versyxdigital') && contact.includes('linkedin.com/in/chris-rowles'));
  check('contact: field settles', (await mode()) === 'section:contact', await mode());
  await page.screenshot({ path: 'qa-screens/e2e-desktop-contact.png' });

  // ── Accessibility ───────────────────────────────────────────────────
  await page.evaluate(axeSource);
  const axe = await page.evaluate(() =>
    window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], rules: { 'color-contrast': { enabled: false } } }),
  );
  check(
    'accessibility: no WCAG A/AA violations (axe-core, contrast checked separately)',
    axe.violations.length === 0,
    axe.violations.map((v) => `${v.id} ×${v.nodes.length}`).join(', '),
  );

  check('layout: no horizontal overflow', await noOverflow(page), await overflowing(page));
  check('console: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

async function tablet(browser) {
  console.log('\nTablet 820×1180');
  const { page, context, errors } = await open(browser, { width: 820, height: 1180, mobile: true });
  await page.screenshot({ path: 'qa-screens/e2e-tablet-hero.png' });
  for (const id of ['about', 'tech', 'projects', 'contact']) {
    await goTo(page, id, 1800);
    check(`layout: no horizontal overflow in ${id}`, await noOverflow(page));
    await page.screenshot({ path: `qa-screens/e2e-tablet-${id}.png` });
  }
  await goTo(page, 'projects', 1200);
  await page.locator('[data-project-index] button', { hasText: 'MKEditor' }).tap();
  await page.waitForTimeout(2400);
  check('explorer: inspector opens on tablet', (await page.locator('#inspection-bay h3').first().innerText()) === 'MKEditor');
  check('explorer: inspector is scrolled into view', await page.evaluate(() => document.getElementById('inspection-bay').getBoundingClientRect().top < window.innerHeight * 0.6));
  await page.screenshot({ path: 'qa-screens/e2e-tablet-project.png' });
  check('console: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

async function mobile(browser) {
  console.log('\nMobile 390×844');
  const { page, context, errors } = await open(browser, { width: 390, height: 844, mobile: true });
  check('layout: no horizontal overflow in hero', await noOverflow(page));
  await page.screenshot({ path: 'qa-screens/e2e-mobile-hero.png' });

  await page.locator('button', { hasText: 'Menu' }).tap();
  await page.waitForTimeout(500);
  check('menu: opens', await page.locator('#menu').isVisible());
  await page.screenshot({ path: 'qa-screens/e2e-mobile-menu.png' });
  await page.locator('#menu a', { hasText: 'Technologies' }).tap();
  await page.waitForTimeout(2600);
  check('menu: navigates and closes', !(await page.locator('#menu').isVisible()) && (await page.evaluate(() => Math.abs(document.getElementById('tech').getBoundingClientRect().top) < 80)));

  // Studio on a phone: a service's record opens directly under the service tapped.
  await goTo(page, 'about', 1500);
  const serviceRow = page.locator('#about button[aria-pressed]', { hasText: 'Bug fixing' });
  await serviceRow.scrollIntoViewIfNeeded();
  await serviceRow.tap();
  await page.waitForTimeout(1200);
  const placed = await page.evaluate(() => {
    const row = document.querySelector('#about button[aria-pressed="true"]').getBoundingClientRect();
    const record = document.querySelector('#about [aria-live="polite"]').getBoundingClientRect();
    return { gap: Math.round(record.top - row.bottom), rowTop: Math.round(row.top), recordTop: Math.round(record.top), screen: window.innerHeight };
  });
  check('studio: on a phone a service opens in place, right under it', placed.gap >= 0 && placed.gap < 24, `${placed.gap} px below its row`);
  check('studio: the tapped service and its record are on screen', placed.rowTop >= 56 && placed.recordTop < placed.screen, `row at ${placed.rowTop} px`);
  check('studio: only one record is open', (await page.locator('#about [aria-live="polite"]').count()) === 1);
  await page.screenshot({ path: 'qa-screens/e2e-mobile-services.png' });
  await goTo(page, 'tech', 1500);

  check('stack view: phones get the layered stack, not the graph', (await page.locator('svg[aria-label^="Technology constellation"]').count()) === 0);
  check('stack view: every technology is named', (await page.locator('#tech button[aria-pressed]').count()) === 49);
  const targets = await page.evaluate(() => Math.min(...[...document.querySelectorAll('#tech button[aria-pressed]')].map((b) => b.getBoundingClientRect().height)));
  check('stack view: every technology is a comfortable touch target', targets >= 40, `${targets.toFixed(0)} px minimum height`);
  const [tx, ty] = await centre(page, "[aria-label='TypeScript, Languages']");
  await page.touchscreen.tap(tx, ty);
  await page.waitForTimeout(1500);
  check('stack view: tap selects a technology', (await page.locator("[aria-label='TypeScript, Languages']").getAttribute('aria-pressed')) === 'true');
  check('stack view: its record opens in place', (await page.locator('aside[aria-label="Technology detail"] h3').innerText()) === 'TypeScript');
  check('stack view: connected technologies light up in other layers', (await page.locator("[aria-label='Next.js, Frontend']").getAttribute('data-state')) === 'lit');
  check('stack view: unrelated technologies recede', (await page.locator("[aria-label='PostgreSQL, Data']").getAttribute('data-state')) === 'dim');
  check('stack view: the rail energises between the layers involved', (await page.locator('#tech section[data-through="true"]').count()) >= 1);
  check('stack view: the record is on screen', await page.evaluate(() => {
    const r = document.querySelector('aside[aria-label="Technology detail"]').getBoundingClientRect();
    return r.top >= 0 && r.top < window.innerHeight;
  }));
  check('layout: no horizontal overflow in the stack view', await noOverflow(page));
  await page.screenshot({ path: 'qa-screens/e2e-mobile-tech-focus.png' });

  for (const id of ['about', 'projects', 'contact']) {
    await goTo(page, id, 1800);
    check(`layout: no horizontal overflow in ${id}`, await noOverflow(page));
    await page.screenshot({ path: `qa-screens/e2e-mobile-${id}.png` });
  }

  await goTo(page, 'projects', 1200);
  await page.locator('[data-project-index] button', { hasText: 'ED:CS' }).tap();
  await page.waitForTimeout(2600);
  check('explorer: inspector opens on mobile', (await page.locator('#inspection-bay h3').first().innerText()) === 'ED:CS');
  check('layout: no horizontal overflow with the inspector open', await noOverflow(page));
  await page.screenshot({ path: 'qa-screens/e2e-mobile-project.png' });
  check('console: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

async function reducedMotion(browser) {
  console.log('\nReduced motion 1440×900');
  const { page, context, errors } = await open(browser, { width: 1440, height: 900, reduced: true });
  check('reduced motion: preference is applied', (await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduced');
  const stats = await canvasStats(page);
  check('reduced motion: field is drawn', stats !== null && stats.lit > 0.05);
  check('reduced motion: field holds still', stats !== null && stats.changed < 0.01, stats ? `${(stats.changed * 100).toFixed(1)}% of sampled pixels changed` : '');
  check('reduced motion: content is visible without scroll reveals', await page.evaluate(() => getComputedStyle(document.querySelector('#about h2')).opacity === '1'));
  await goTo(page, 'projects', 800);
  await page.locator('[data-project-index] button', { hasText: 'Aldervast' }).click();
  await page.waitForTimeout(600);
  check('reduced motion: explorer still works', (await page.locator('#inspection-bay h3').first().innerText()) === 'Aldervast');
  await page.screenshot({ path: 'qa-screens/e2e-reduced-project.png' });
  check('console: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

async function noWebgl(browser) {
  console.log('\nWithout WebGL 1440×900');
  const { page, context, errors } = await open(browser, { width: 1440, height: 900, query: '?nowebgl' });
  check('fallback: no WebGL canvas is created', (await page.locator('canvas').count()) === 1, 'only the 2D schematic overlay');
  check('fallback: static field is drawn', (await page.locator('[class*="fallback"] svg path').count()) > 500);
  check('fallback: hero content is intact', (await page.locator('#hero').innerText()).includes('Software studio'));
  await page.screenshot({ path: 'qa-screens/e2e-nowebgl-hero.png' });
  await goTo(page, 'tech', 1000);
  const [x, y] = await centre(page, "[aria-label='Python, Languages']");
  await page.mouse.click(x, y);
  await page.waitForTimeout(1200);
  check('fallback: constellation still works', (await page.locator('aside[aria-label="Technology detail"] h3').innerText()) === 'Python');
  await goTo(page, 'projects', 800);
  await page.locator('[data-project-index] button', { hasText: 'MKEditor' }).click();
  await page.waitForTimeout(900);
  check('fallback: explorer still works', (await page.locator('#inspection-bay h3').first().innerText()) === 'MKEditor');
  check('console: no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

const server = await startServer();
const browser = await launch();
let crashed = null;
try {
  await desktop(browser);
  await tablet(browser);
  await mobile(browser);
  await reducedMotion(browser);
  await noWebgl(browser);
} catch (error) {
  crashed = error;
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (crashed) console.error('\nRun aborted:', crashed);
process.exit(failed.length > 0 || crashed ? 1 : 0);
