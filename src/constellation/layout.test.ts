import { describe, expect, it } from 'vitest';
import { categories, relatedTo, technologies } from '../content';
import { computeLayout, landscapeView, nodeRadius, portraitView, type View } from './layout';

const views: [string, View][] = [
  ['landscape', landscapeView],
  ['portrait', portraitView],
];

describe.each(views)('constellation layout (%s)', (_name, view) => {
  const overview = computeLayout(view, { filter: null, focus: null });

  it('places every technology inside the canvas', () => {
    expect(overview.size).toBe(technologies.length);
    for (const [id, p] of overview) {
      expect(p.x, id).toBeGreaterThanOrEqual(0);
      expect(p.x, id).toBeLessThanOrEqual(view.width);
      expect(p.y, id).toBeGreaterThanOrEqual(0);
      expect(p.y, id).toBeLessThanOrEqual(view.height);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y), id).toBe(true);
    }
  });

  it('keeps nodes from overlapping in the overview', () => {
    const points = [...overview.values()];
    let closest = Infinity;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        closest = Math.min(closest, Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y));
      }
    }
    expect(closest).toBeGreaterThan(view === portraitView ? 22 : 36);
  });

  it('is deterministic', () => {
    const again = computeLayout(view, { filter: null, focus: null });
    for (const [id, p] of overview) expect(again.get(id)).toEqual(p);
  });

  it('keeps each category together: members sit nearer their own centroid than another group’s', () => {
    const centroid = new Map(
      categories.map((c) => {
        const members = technologies.filter((t) => t.category === c.id).map((t) => overview.get(t.id)!);
        return [c.id, { x: members.reduce((s, p) => s + p.x, 0) / members.length, y: members.reduce((s, p) => s + p.y, 0) / members.length }];
      }),
    );
    let misplaced = 0;
    for (const tech of technologies) {
      if (tech.category === 'language') continue; // languages deliberately lean toward the groups they underpin
      const p = overview.get(tech.id)!;
      const own = centroid.get(tech.category)!;
      const ownDistance = Math.hypot(p.x - own.x, p.y - own.y);
      for (const [other, c] of centroid) {
        if (other === tech.category || other === 'language') continue;
        if (Math.hypot(p.x - c.x, p.y - c.y) < ownDistance) misplaced++;
      }
    }
    expect(misplaced).toBe(0);
  });

  it('centres a focused technology and rings its related nodes around it', () => {
    const focus = 'vue';
    const layout = computeLayout(view, { filter: null, focus });
    const core = layout.get(focus)!;
    expect(core.emphasis).toBe('core');
    expect(core.x).toBeCloseTo(view.width / 2, 5);
    const related = new Set(relatedTo(focus));
    const ringDistances: number[] = [];
    const awayDistances: number[] = [];
    for (const [id, p] of layout) {
      if (id === focus) continue;
      const d = Math.hypot((p.x - core.x) / view.width, (p.y - core.y) / view.height);
      if (related.has(id)) {
        expect(p.emphasis, id).toBe('ring');
        ringDistances.push(d);
      } else {
        expect(p.emphasis, id).toBe('away');
        awayDistances.push(d);
      }
    }
    // Unrelated nodes are pushed clear of the ring.
    expect(Math.min(...awayDistances)).toBeGreaterThan(Math.max(...ringDistances) * 0.85);
  });

  it('gathers a filtered category at the centre and moves the rest away', () => {
    const layout = computeLayout(view, { filter: 'data', focus: null });
    for (const tech of technologies) {
      const p = layout.get(tech.id)!;
      expect(p.emphasis, tech.id).toBe(tech.category === 'data' ? 'ring' : 'away');
    }
  });

  it('lets a focused technology take precedence over a category filter', () => {
    const layout = computeLayout(view, { filter: 'data', focus: 'python' });
    expect(layout.get('python')?.emphasis).toBe('core');
  });
});

describe('node radius', () => {
  it('follows connectivity and role, within a narrow band', () => {
    for (const tech of technologies) {
      const r = nodeRadius(tech.id);
      expect(r).toBeGreaterThanOrEqual(4.6);
      expect(r).toBeLessThanOrEqual(13);
    }
    expect(nodeRadius('typescript')).toBeGreaterThan(nodeRadius('sqlite'));
  });
});
