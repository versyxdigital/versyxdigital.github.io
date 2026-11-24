/** Production-page browser checks; uses installed Chrome and local HTTP only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');

const rootArgument = process.argv.indexOf('--root');
const root = path.resolve(
  rootArgument >= 0
    ? process.argv[rootArgument + 1]
    : path.resolve(__dirname, '../public/mkeditor'),
);
const fallback = path.resolve(__dirname, '../public/mkeditor');
const output = path.resolve(__dirname, '../qa-screens/mkeditor');
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const installer = (version, extension) =>
  `https://github.com/versyxdigital/mkeditor/releases/download/${version}/mkeditor-setup-${version.replace(/^v/, '')}.${extension}`;
const release = (version, formats, extra = {}) => ({
  tag_name: version,
  draft: false,
  prerelease: false,
  assets: formats.map((extension) => ({
    name: `mkeditor-setup-${version}.${extension}`,
    browser_download_url: installer(version, extension),
  })),
  ...extra,
});
const releaseFixture = [
  release('v6.0.0-rc.1', ['exe', 'pkg', 'deb'], { prerelease: true }),
  release('v5.0.0', ['exe', 'deb']),
  release('v4.8.0', ['pkg']),
];
const results = [];
const pass = (name) => {
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
};
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url, 'http://localhost').pathname,
  );
  const relative = pathname.replace(/^\/mkeditor\/?/, '');
  if (pathname !== '/mkeditor' && !pathname.startsWith('/mkeditor/')) {
    response.writeHead(404).end();
    return;
  }
  let target;
  for (const candidateRoot of [root, fallback]) {
    let candidate = path.resolve(candidateRoot, relative);
    if (
      candidate !== candidateRoot &&
      !candidate.startsWith(candidateRoot + path.sep)
    )
      continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())
      candidate = path.join(candidate, 'index.html');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      target = candidate;
      break;
    }
  }
  if (!target) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader(
    'Content-Type',
    mime[path.extname(target)] || 'application/octet-stream',
  );
  fs.createReadStream(target).pipe(response);
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/mkeditor/`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }
  try {
    for (const width of [360, 768, 1440, 1920]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: 'reduce',
      });
      await context.route(
        'https://api.github.com/repos/versyxdigital/mkeditor/releases**',
        (route) => route.fulfill({ json: releaseFixture }),
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator('footer').scrollIntoViewIfNeeded();
      await page.evaluate(async () => {
        for (const image of document.images) image.loading = 'eager';
        await Promise.all(
          [...document.images].map((image) => image.decode().catch(() => {})),
        );
        await document.fonts.ready;
      });
      const overflow = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return {
          overflow: document.documentElement.scrollWidth > width + 1,
          offenders: [...document.querySelectorAll('body *')]
            .filter((node) => node.getBoundingClientRect().right > width + 1)
            .slice(0, 4)
            .map((node) => node.tagName + '.' + node.className),
        };
      });
      assert.equal(
        overflow.overflow,
        false,
        `${width}px overflow: ${overflow.offenders.join(', ')}`,
      );
      const imageFailures = await page
        .locator('img[src]')
        .evaluateAll((images) =>
          images
            .filter(
              (image) =>
                image.getAttribute('src')?.trim() &&
                (!image.complete || image.naturalWidth === 0),
            )
            .map((image) => image.src),
        );
      assert.deepEqual(imageFailures, [], 'Broken image assets');
      assert.equal(await page.locator('h1').count(), 1, 'One page heading');
      const images = await page
        .locator('a[data-screenshot]')
        .evaluateAll((links) => [
          ...new Set(
            links.map((link) => new URL(link.href).pathname.split('/').pop()),
          ),
        ]);
      assert.equal(
        images.length,
        9,
        'All nine fresh product views are available',
      );
      await page.locator('[data-theme-shot="light"]').click();
      await page.waitForFunction(() =>
        document
          .querySelector('#hero-screenshot')
          .currentSrc.includes('editor-light'),
      );
      assert.equal(
        await page
          .locator('[data-theme-shot="light"]')
          .getAttribute('aria-pressed'),
        'true',
      );
      assert.ok(
        (
          await page.locator('#hero-screenshot-link').getAttribute('href')
        ).endsWith('/assets/screenshots/editor-light.webp'),
      );
      await page.locator('[data-theme-shot="dark"]').click();
      await page.waitForFunction(() =>
        document
          .querySelector('#hero-screenshot')
          .currentSrc.includes('editor-dark'),
      );
      const trigger = page.locator('a[data-screenshot]').first();
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => document.getElementById('screenshot-viewer').open,
      );
      await page.locator('#viewer-image').evaluate((image) => image.decode());
      assert.ok(
        (
          await page.locator('[data-viewer-original]').getAttribute('href')
        ).endsWith('.webp'),
      );
      await page.keyboard.press('Escape');
      assert.equal(
        await page
          .locator('#screenshot-viewer')
          .evaluate((dialog) => dialog.open),
        false,
      );
      assert.equal(
        await trigger.evaluate((node) => document.activeElement === node),
        true,
        'Escape restores keyboard focus',
      );
      await page.waitForFunction(
        () =>
          document.querySelector('[data-version="windows"]').textContent ===
          'v5.0.0',
      );
      assert.equal(
        await page
          .locator('[data-download="windows"]')
          .first()
          .getAttribute('href'),
        installer('v5.0.0', 'exe'),
      );
      assert.equal(
        await page
          .locator('[data-download="macos"]')
          .first()
          .getAttribute('href'),
        installer('v4.8.0', 'pkg'),
      );
      assert.equal(
        await page.locator('[data-version="macos"]').first().textContent(),
        'v4.8.0',
      );
      assert.equal(
        await page
          .locator('[data-download="linux"]')
          .first()
          .getAttribute('href'),
        installer('v5.0.0', 'deb'),
      );
      await page.addScriptTag({ content: axe });
      const violations = await page.evaluate(async () => {
        const result = await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
          },
        });
        return result.violations
          .filter((violation) =>
            ['critical', 'serious'].includes(violation.impact),
          )
          .map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => node.target),
          }));
      });
      assert.deepEqual(violations, [], `${width}px accessibility violations`);
      await page.evaluate(() => {
        document.activeElement?.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: path.join(output, `product-${width}.png`),
        fullPage: true,
      });
      await page.screenshot({
        path: path.join(output, `product-${width}-hero.png`),
      });
      assert.deepEqual(errors, [], 'No browser runtime errors');
      pass(
        `${width}px layout, assets, themes, keyboard lightbox, independent installer versions and accessibility`,
      );
      await context.close();
    }

    const offlineContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await offlineContext.route('https://api.github.com/**', (route) =>
      route.abort(),
    );
    const offline = await offlineContext.newPage();
    await offline.goto(base, { waitUntil: 'networkidle' });
    assert.equal(
      await offline
        .locator('[data-download="windows"]')
        .first()
        .getAttribute('href'),
      installer('v4.1.0', 'exe'),
    );
    assert.equal(
      await offline
        .locator('[data-download="macos"]')
        .first()
        .getAttribute('href'),
      installer('v3.6.0', 'pkg'),
    );
    pass('GitHub request failure preserves real published fallback installers');
    await offlineContext.close();

    const noJsContext = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 360, height: 800 },
    });
    const noJs = await noJsContext.newPage();
    await noJs.goto(base, { waitUntil: 'networkidle' });
    assert.ok((await noJs.locator('h1').innerText()).trim());
    assert.equal(await noJs.locator('[data-download]').count(), 3);
    assert.ok(
      await noJs.locator('a[data-screenshot]').first().getAttribute('href'),
    );
    for (const resource of ['privacy/', 'terms/', 'web/']) {
      const response = await noJs.request.get(new URL(resource, base).href);
      assert.equal(response.status(), 200, `${resource} remains available`);
    }
    pass(
      'Without JavaScript, copy, downloads, screenshot links, privacy, terms and browser app remain available',
    );
    await noJsContext.close();
    fs.writeFileSync(
      path.join(output, 'checks.json'),
      JSON.stringify(results, null, 2),
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
  server.close();
});
