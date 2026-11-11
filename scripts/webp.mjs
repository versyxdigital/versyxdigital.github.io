/**
 * Converts an image to WebP for the project showcase, using the installed
 * Chrome (no image library needed).
 *
 *   node scripts/webp.mjs <input.png|jpg> <output.webp> [--w=1920] [--q=0.86] [--crop=x,y,width,height]
 *
 * `--w` caps the width (the image is never enlarged). Prints the output size
 * and dimensions, which go into the project's `image` entry in
 * src/content/projects.ts.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, extname } from 'node:path';
import { chromium } from 'playwright-core';

const [input, output, ...rest] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/webp.mjs <input> <output.webp> [--w=1920] [--q=0.86]');
  process.exit(1);
}
const args = Object.fromEntries(rest.map((arg) => arg.replace(/^--/, '').split('=')));
const maxWidth = Number(args.w ?? 1920);
const quality = Number(args.q ?? 0.86);
/** Optional region of the source to keep, in source pixels. */
const crop = typeof args.crop === 'string' ? args.crop.split(',').map(Number) : null;

const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(input).toLowerCase()];
if (!mime) {
  console.error(`unsupported input type: ${extname(input)}`);
  process.exit(1);
}
const source = `data:${mime};base64,${readFileSync(input).toString('base64')}`;

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage();
const result = await page.evaluate(
  async ({ source, maxWidth, quality, crop }) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const [sx, sy, sw, sh] = crop ?? [0, 0, image.naturalWidth, image.naturalHeight];
    const scale = Math.min(1, maxWidth / sw);
    const width = Math.round(sw * scale);
    const height = Math.round(sh * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    return { width, height, data: canvas.toDataURL('image/webp', quality) };
  },
  { source, maxWidth, quality, crop },
);
await browser.close();

const bytes = Buffer.from(result.data.split(',')[1], 'base64');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, bytes);
console.log(`${output}: ${result.width}×${result.height}, ${(bytes.length / 1024).toFixed(0)} KB`);
