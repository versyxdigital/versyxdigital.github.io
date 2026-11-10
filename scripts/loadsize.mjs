/**
 * Reports what the first screen downloads: request count, bytes, and when the
 * text and the 3D background are ready. Needs the preview server on 5183.
 *
 *   node scripts/loadsize.mjs
 */
import { chromium } from 'playwright-core';

const base = process.env.QA_URL ?? 'http://127.0.0.1:5183';
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
// A mid-range connection, so ordering and size differences show up.
const client = await context.newCDPSession(page);
await client.send('Network.enable');
await client.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8 });

await page.goto(`${base}/`, { waitUntil: 'load' });
const canvasAt = await page
  .waitForFunction(() => (document.querySelector('canvas') ? performance.now() : 0), null, { timeout: 15000 })
  .then((h) => h.jsonValue())
  .catch(() => 0);
await page.waitForTimeout(1500);

const result = await page.evaluate(() => {
  const entries = performance.getEntriesByType('resource');
  const bytes = (list) => list.reduce((sum, e) => sum + (e.transferSize || e.encodedBodySize || 0), 0);
  const images = entries.filter((e) => /\.(webp|png|jpg|svg)(\?|$)/.test(e.name));
  const paint = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
  return {
    requests: entries.length,
    kilobytes: Math.round(bytes(entries) / 1024),
    images: images.length,
    imageKilobytes: Math.round(bytes(images) / 1024),
    firstPaintMs: paint ? Math.round(paint.startTime) : null,
  };
});
console.log(JSON.stringify({ ...result, backgroundReadyMs: Math.round(canvasAt) }));
await browser.close();
