/**
 * Adaptive-quality check. Runs the site on Chrome's software rasteriser, which
 * is far slower than any real GPU, and reports how the quality governor
 * responds over time. Requires the dev or preview server to be running.
 *
 *   node scripts/quality.mjs
 */
import { chromium } from 'playwright-core';

const base = process.env.QA_URL ?? 'http://127.0.0.1:5183';
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-compositing'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// ?webgl=force keeps the WebGL field on a software renderer so the governor can be observed.
await page.goto(`${base}/?webgl=force`, { waitUntil: 'networkidle' });

const sample = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const t0 = performance.now();
        let frames = 0;
        const tick = () => {
          frames++;
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
          else {
            const canvas = document.querySelector('canvas');
            const gl = canvas?.getContext('webgl2');
            const info = gl?.getExtension('WEBGL_debug_renderer_info');
            resolve({
              fps: Math.round(frames / 1.5),
              footer: [...document.querySelectorAll('#contact footer p')].map((p) => p.textContent).find((t) => t?.startsWith('Field')) ?? '',
              renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown',
              size: canvas ? `${canvas.width}x${canvas.height}` : '',
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );

for (const wait of [500, 2500, 3000, 3000, 4000, 4000]) {
  await page.waitForTimeout(wait);
  const s = await sample();
  console.log(`${s.fps} fps  |  ${s.footer}  |  canvas ${s.size}  |  ${s.renderer}`);
}
await browser.close();
