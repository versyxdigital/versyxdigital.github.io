/**
 * Orthogonal trace routing.
 *
 * Schematic connections are drawn like PCB traces: axis-aligned runs joined by
 * short 45° chamfers. Everything here is pure geometry so it can be unit
 * tested and reused by the overlay canvas and the SVG project diagrams.
 */

export interface Pt {
  x: number;
  y: number;
}

/**
 * hv  — horizontal run, then vertical.
 * vh  — vertical run, then horizontal.
 * hvh — horizontal, vertical jog at `bend`, horizontal.
 * vhv — vertical, horizontal jog at `bend`, vertical.
 */
export type RouteStyle = 'hv' | 'vh' | 'hvh' | 'vhv';

const EPS = 0.5;
const dist = (a: Pt, b: Pt): number => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * Corner points of an orthogonal route from a to b, without chamfers.
 * For hvh / vhv routes the jog sits at fraction `bend` of the way, or at a
 * fixed pixel offset `jog` from the start when one is given.
 */
export function corners(a: Pt, b: Pt, style: RouteStyle, bend = 0.5, jog?: number): Pt[] {
  let pts: Pt[];
  switch (style) {
    case 'hv':
      pts = [a, { x: b.x, y: a.y }, b];
      break;
    case 'vh':
      pts = [a, { x: a.x, y: b.y }, b];
      break;
    case 'hvh': {
      const mx = jog === undefined ? a.x + (b.x - a.x) * bend : a.x + jog;
      pts = [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
      break;
    }
    case 'vhv': {
      const my = jog === undefined ? a.y + (b.y - a.y) * bend : a.y + jog;
      pts = [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
      break;
    }
  }
  // Drop zero-length runs (e.g. when both ends share an axis).
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > EPS) out.push(p);
  }
  // Merge collinear runs so a straight line has no phantom corner.
  for (let i = out.length - 2; i > 0; i--) {
    const p = out[i - 1]!;
    const c = out[i]!;
    const n = out[i + 1]!;
    const cross = (c.x - p.x) * (n.y - c.y) - (c.y - p.y) * (n.x - c.x);
    if (Math.abs(cross) < EPS) out.splice(i, 1);
  }
  return out;
}

/** Replaces each corner with a 45° chamfer of up to `size` pixels. */
export function chamfer(pts: readonly Pt[], size: number): Pt[] {
  if (pts.length < 3 || size <= 0) return pts.slice();
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1]!;
    const c = pts[i]!;
    const n = pts[i + 1]!;
    const inLen = dist(p, c);
    const outLen = dist(c, n);
    const s = Math.min(size, inLen / 2, outLen / 2);
    if (s < EPS) {
      out.push(c);
      continue;
    }
    out.push({ x: c.x - ((c.x - p.x) / inLen) * s, y: c.y - ((c.y - p.y) / inLen) * s });
    out.push({ x: c.x + ((n.x - c.x) / outLen) * s, y: c.y + ((n.y - c.y) / outLen) * s });
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

export function route(a: Pt, b: Pt, style: RouteStyle, bend = 0.5, chamferSize = 7, jog?: number): Pt[] {
  return chamfer(corners(a, b, style, bend, jog), chamferSize);
}

export function polylineLength(pts: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!);
  return total;
}

/** Point at fraction t (0..1) along the polyline. */
export function pointAt(pts: readonly Pt[], t: number): Pt {
  const first = pts[0];
  if (!first) return { x: 0, y: 0 };
  const total = polylineLength(pts);
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = dist(a, b);
    if (remaining <= d && d > 0) {
      const k = remaining / d;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    remaining -= d;
  }
  return pts[pts.length - 1]!;
}

/** Sub-polyline between fractions t0 and t1. Used for line tracing and pulse tails. */
export function slice(pts: readonly Pt[], t0: number, t1: number): Pt[] {
  const lo = Math.min(1, Math.max(0, Math.min(t0, t1)));
  const hi = Math.min(1, Math.max(0, Math.max(t0, t1)));
  if (pts.length < 2 || hi - lo <= 0) return [];
  const total = polylineLength(pts);
  const start = lo * total;
  const end = hi * total;
  const out: Pt[] = [];
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = dist(a, b);
    const segStart = walked;
    const segEnd = walked + d;
    walked = segEnd;
    if (d <= 0 || segEnd < start || segStart > end) continue;
    const k0 = Math.max(0, (start - segStart) / d);
    const k1 = Math.min(1, (end - segStart) / d);
    const p0 = { x: a.x + (b.x - a.x) * k0, y: a.y + (b.y - a.y) * k0 };
    const p1 = { x: a.x + (b.x - a.x) * k1, y: a.y + (b.y - a.y) * k1 };
    if (out.length === 0) out.push(p0);
    out.push(p1);
  }
  return out;
}

/** SVG path data for a polyline. */
export function toPath(pts: readonly Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}
