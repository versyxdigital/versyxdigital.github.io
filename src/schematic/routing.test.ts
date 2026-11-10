import { describe, expect, it } from 'vitest';
import { chamfer, corners, pointAt, polylineLength, route, slice, toPath, type Pt } from './routing';

const a: Pt = { x: 0, y: 0 };
const b: Pt = { x: 100, y: 60 };

const isOrthogonal = (pts: Pt[]): boolean =>
  pts.every((p, i) => i === 0 || Math.abs(p.x - pts[i - 1]!.x) < 1e-6 || Math.abs(p.y - pts[i - 1]!.y) < 1e-6);

describe('corners', () => {
  it('routes horizontally then vertically', () => {
    expect(corners(a, b, 'hv')).toEqual([a, { x: 100, y: 0 }, b]);
  });

  it('routes vertically then horizontally', () => {
    expect(corners(a, b, 'vh')).toEqual([a, { x: 0, y: 60 }, b]);
  });

  it('places the jog of an hvh route at the bend fraction', () => {
    expect(corners(a, b, 'hvh', 0.25)).toEqual([a, { x: 25, y: 0 }, { x: 25, y: 60 }, b]);
  });

  it('places the jog at a fixed pixel offset when one is given', () => {
    expect(corners(a, b, 'vhv', 0.5, 12)).toEqual([a, { x: 0, y: 12 }, { x: 100, y: 12 }, b]);
    expect(corners(a, b, 'hvh', 0.5, -20)[1]).toEqual({ x: -20, y: 0 });
  });

  it('only ever produces axis-aligned runs', () => {
    for (const style of ['hv', 'vh', 'hvh', 'vhv'] as const) expect(isOrthogonal(corners(a, b, style, 0.3))).toBe(true);
  });

  it('collapses to a straight line when the ends share an axis', () => {
    expect(corners(a, { x: 80, y: 0 }, 'hvh')).toEqual([a, { x: 80, y: 0 }]);
    expect(corners(a, { x: 0, y: 80 }, 'hv')).toEqual([a, { x: 0, y: 80 }]);
  });
});

describe('chamfer', () => {
  it('replaces a corner with two points and keeps the ends', () => {
    const pts = chamfer([a, { x: 100, y: 0 }, b], 10);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual(a);
    expect(pts[3]).toEqual(b);
    expect(pts[1]).toEqual({ x: 90, y: 0 });
    expect(pts[2]).toEqual({ x: 100, y: 10 });
  });

  it('never cuts more than half of a short run', () => {
    const pts = chamfer([a, { x: 6, y: 0 }, { x: 6, y: 100 }], 10);
    expect(pts[1]).toEqual({ x: 3, y: 0 });
    expect(pts[2]).toEqual({ x: 6, y: 3 });
  });

  it('shortens the path, as a diagonal must', () => {
    const square = corners(a, b, 'hv');
    expect(polylineLength(chamfer(square, 8))).toBeLessThan(polylineLength(square));
  });
});

describe('measurement', () => {
  const pts = [a, { x: 100, y: 0 }, { x: 100, y: 100 }];

  it('measures length', () => {
    expect(polylineLength(pts)).toBe(200);
  });

  it('finds points along the path, clamped to its ends', () => {
    expect(pointAt(pts, 0)).toEqual(a);
    expect(pointAt(pts, 0.25)).toEqual({ x: 50, y: 0 });
    expect(pointAt(pts, 0.75)).toEqual({ x: 100, y: 50 });
    expect(pointAt(pts, 1)).toEqual({ x: 100, y: 100 });
    expect(pointAt(pts, 7)).toEqual({ x: 100, y: 100 });
    expect(pointAt(pts, -1)).toEqual(a);
  });

  it('slices a sub-path spanning a corner', () => {
    const part = slice(pts, 0.25, 0.75);
    expect(part).toEqual([{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
    expect(polylineLength(part)).toBe(100);
  });

  it('returns nothing for an empty slice', () => {
    expect(slice(pts, 0.4, 0.4)).toEqual([]);
  });

  it('serialises to SVG path data', () => {
    expect(toPath([a, { x: 10, y: 0 }])).toBe('M0.0 0.0 L10.0 0.0');
  });

  it('routes with chamfers end to end', () => {
    const pts2 = route(a, b, 'hvh', 0.5, 6);
    expect(pts2[0]).toEqual(a);
    expect(pts2[pts2.length - 1]).toEqual(b);
    expect(pts2).toHaveLength(6);
  });
});
