/**
 * The slowly drifting accent colour.
 *
 * One loop through the six soft colours used on the dots and technology
 * pills. The hero's dot shows it, the pulse it sends takes it, and the field
 * is tinted with it where that pulse lands, so all three always agree.
 */

const STOPS: readonly (readonly [number, number, number])[] = [
  [63, 224, 238], // cyan
  [79, 139, 255], // blue
  [125, 127, 255], // indigo
  [169, 123, 255], // purple
  [221, 111, 232], // magenta
  [255, 127, 169], // rose
];

/** Seconds for one full loop: slow enough that the change is never noticed as movement. */
const PERIOD = 54;

/** The accent at a time in seconds, as red, green and blue from 0 to 255. */
export function accentAt(seconds: number): [number, number, number] {
  const position = (((seconds % PERIOD) + PERIOD) % PERIOD) / PERIOD * STOPS.length;
  const index = Math.floor(position) % STOPS.length;
  const from = STOPS[index]!;
  const to = STOPS[(index + 1) % STOPS.length]!;
  const t = position - Math.floor(position);
  // Ease between neighbours so each colour is held a little before moving on.
  const k = t * t * (3 - 2 * t);
  return [
    Math.round(from[0] + (to[0] - from[0]) * k),
    Math.round(from[1] + (to[1] - from[1]) * k),
    Math.round(from[2] + (to[2] - from[2]) * k),
  ];
}

/** The accent as "r, g, b", for CSS and canvas colours. */
export const accentRgb = (seconds: number): string => accentAt(seconds).join(', ');
