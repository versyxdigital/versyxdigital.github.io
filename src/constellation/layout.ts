import {
  categories,
  degreeOf,
  neighboursOf,
  relatedTo,
  techById,
  technologies,
  type TechCategory,
  type TechId,
} from '../content';

/**
 * Constellation layout.
 *
 * A designed, deterministic arrangement — not a force simulation. Each
 * category owns a region of the canvas; its technologies sit on a ring inside
 * it, ordered by how connected they are. Languages take the centre because
 * every other group hangs off them.
 *
 * The same function produces the three arrangements the network moves
 * between (overview, category filter, focused technology), so transitions are
 * simply every node easing to its place in the next arrangement.
 */

export interface View {
  width: number;
  height: number;
}

export const landscapeView: View = { width: 1200, height: 720 };
/** Compact canvas for narrow screens: fewer units across, so touch targets stay large. */
export const portraitView: View = { width: 480, height: 640 };

export type Emphasis = 'rest' | 'core' | 'ring' | 'away';

export interface Placement {
  x: number;
  y: number;
  emphasis: Emphasis;
}

export interface Arrangement {
  filter: TechCategory | null;
  focus: TechId | null;
}

type Fractions = Record<TechCategory, [number, number]>;

const landscapeCentres: Fractions = {
  language: [0.5, 0.43],
  frontend: [0.205, 0.285],
  backend: [0.795, 0.27],
  tooling: [0.2, 0.765],
  data: [0.815, 0.755],
  infra: [0.5, 0.835],
};

const portraitCentres: Fractions = {
  frontend: [0.27, 0.17],
  backend: [0.74, 0.16],
  language: [0.5, 0.42],
  tooling: [0.25, 0.68],
  data: [0.77, 0.65],
  infra: [0.5, 0.87],
};

const MIN_DISTANCE = 62;
const MARGIN = 48;
const COMPACT_DISTANCE = 40;
const COMPACT_MARGIN = 26;

const isPortrait = (view: View): boolean => view.height > view.width;
const centreOf = (category: TechCategory, view: View): { x: number; y: number } => {
  const [fx, fy] = (isPortrait(view) ? portraitCentres : landscapeCentres)[category];
  return { x: fx * view.width, y: fy * view.height };
};

/** Node radius. Reflects role and connectivity in the published material, never a skill score. */
export function nodeRadius(id: TechId): number {
  const tech = techById.get(id);
  const base = tech?.role === 'language' ? 7.5 : 4.6;
  return base + Math.min(degreeOf(id), 9) * 0.55;
}

/** Pushes overlapping nodes apart. Deterministic: fixed order, fixed iteration count. */
function relax(points: Map<TechId, { x: number; y: number }>, view: View, pinned: ReadonlySet<TechId>, minDistance: number): void {
  const ids = [...points.keys()];
  for (let iteration = 0; iteration < 80; iteration++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = points.get(ids[i]!)!;
        const b = points.get(ids[j]!)!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        // Labels are wider than tall: treat vertical separation as worth more.
        const d = Math.hypot(dx, dy * 1.5);
        if (d >= minDistance) continue;
        if (d < 0.01) {
          dx = 1;
          dy = 0.3 * (i % 2 === 0 ? 1 : -1);
        }
        const push = (minDistance - d) / 2 / Math.max(d, 1);
        const pa = pinned.has(ids[i]!) ? 0 : pinned.has(ids[j]!) ? 2 : 1;
        const pb = pinned.has(ids[j]!) ? 0 : pinned.has(ids[i]!) ? 2 : 1;
        a.x -= dx * push * pa;
        a.y -= dy * push * pa;
        b.x += dx * push * pb;
        b.y += dy * push * pb;
      }
    }
    const margin = isPortrait(view) ? COMPACT_MARGIN : MARGIN;
    for (const p of points.values()) {
      p.x = Math.min(view.width - margin, Math.max(margin, p.x));
      p.y = Math.min(view.height - margin - 12, Math.max(margin, p.y));
    }
  }
}

function overview(view: View): Map<TechId, { x: number; y: number }> {
  const points = new Map<TechId, { x: number; y: number }>();
  const portrait = isPortrait(view);

  categories.forEach((category, categoryIndex) => {
    const members = technologies
      .filter((t) => t.category === category.id)
      .sort((a, b) => degreeOf(b.id) - degreeOf(a.id) || a.name.localeCompare(b.name));
    const centre = centreOf(category.id, view);

    if (category.id === 'language') {
      // Each language leans toward the groups it is the foundation of.
      members.forEach((tech, i) => {
        let ax = 0;
        let ay = 0;
        for (const other of neighboursOf(tech.id)) {
          const n = techById.get(other);
          if (!n || n.category === 'language') continue;
          const c = centreOf(n.category, view);
          ax += c.x - centre.x;
          ay += c.y - centre.y;
        }
        const angle = ax === 0 && ay === 0 ? (i / members.length) * Math.PI * 2 : Math.atan2(ay, ax);
        const reach = portrait ? 46 : 92;
        points.set(tech.id, { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach * 0.8 });
      });
      return;
    }

    // The best-connected member sits at the hub of larger groups; the rest ring it.
    const hub = members.length >= 7 ? members[0] : undefined;
    const ring = hub ? members.slice(1) : members;
    if (hub) points.set(hub.id, { ...centre });
    const radius = portrait ? Math.max(44, ring.length * 9) : Math.max(74, ring.length * 15.5);
    const rx = radius * (portrait ? 1.05 : 1.28);
    const ry = radius * (portrait ? 0.9 : 0.78);
    const start = -Math.PI / 2 + categoryIndex * 0.55;
    ring.forEach((tech, i) => {
      const angle = start + (i / ring.length) * Math.PI * 2;
      points.set(tech.id, { x: centre.x + Math.cos(angle) * rx, y: centre.y + Math.sin(angle) * ry });
    });
  });

  relax(points, view, new Set(), portrait ? COMPACT_DISTANCE : MIN_DISTANCE);
  return points;
}

const overviewCache = new Map<string, Map<TechId, { x: number; y: number }>>();
function cachedOverview(view: View): Map<TechId, { x: number; y: number }> {
  const key = `${view.width}x${view.height}`;
  let result = overviewCache.get(key);
  if (!result) {
    result = overview(view);
    overviewCache.set(key, result);
  }
  return result;
}

/**
 * Arranges `inner` on rings around the canvas centre and moves everything else
 * radially outward, clear of those rings.
 */
function focusLayout(
  view: View,
  base: Map<TechId, { x: number; y: number }>,
  core: TechId,
  inner: TechId[],
  /** 'core' when the centre node is the subject; 'ring' when it is simply first among equals. */
  coreEmphasis: Emphasis,
): Map<TechId, Placement> {
  const cx = view.width / 2;
  const cy = view.height * (isPortrait(view) ? 0.42 : 0.47);
  const portrait = isPortrait(view);
  const out = new Map<TechId, Placement>();
  const points = new Map<TechId, { x: number; y: number }>();
  const pinned = new Set<TechId>();

  points.set(core, { x: cx, y: cy });
  pinned.add(core);

  // Keep neighbours grouped by category, in the order the overview shows them,
  // so the ring reads as the same network pulled closer rather than a shuffle.
  const order = new Map(categories.map((c, i) => [c.id, i]));
  const sorted = [...inner].sort((a, b) => {
    const ta = techById.get(a);
    const tb = techById.get(b);
    const ca = order.get(ta?.category ?? 'tooling') ?? 0;
    const cb = order.get(tb?.category ?? 'tooling') ?? 0;
    return ca - cb || (ta?.name ?? '').localeCompare(tb?.name ?? '');
  });

  const firstRing = Math.min(sorted.length, portrait ? 8 : 12);
  const rings = [sorted.slice(0, firstRing), sorted.slice(firstRing)];
  const baseRx = portrait ? view.width * 0.31 : view.width * 0.19;
  const baseRy = portrait ? view.height * 0.2 : view.height * 0.27;
  rings.forEach((ring, ringIndex) => {
    const scale = 1 + ringIndex * 0.62;
    ring.forEach((id, i) => {
      const angle = -Math.PI / 2 + ((i + (ringIndex ? 0.5 : 0)) / ring.length) * Math.PI * 2;
      points.set(id, { x: cx + Math.cos(angle) * baseRx * scale, y: cy + Math.sin(angle) * baseRy * scale });
    });
  });

  relax(points, view, pinned, MIN_DISTANCE + 6);
  const outerScale = rings[1]!.length ? 1.62 : 1;
  const clearX = baseRx * outerScale + (portrait ? 44 : 96);
  const clearY = baseRy * outerScale + (portrait ? 52 : 78);

  for (const tech of technologies) {
    const placed = points.get(tech.id);
    if (placed) {
      out.set(tech.id, { ...placed, emphasis: tech.id === core ? coreEmphasis : 'ring' });
      continue;
    }
    const b = base.get(tech.id) ?? { x: cx, y: cy };
    let dx = b.x - cx;
    let dy = b.y - cy;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) dx = 1;
    // Distance in units of the clearance ellipse; anything inside it is pushed to its edge.
    const k = Math.hypot(dx / clearX, dy / clearY);
    if (k < 1) {
      dx /= k;
      dy /= k;
    }
    out.set(tech.id, {
      x: Math.min(view.width - 14, Math.max(14, cx + dx)),
      y: Math.min(view.height - 14, Math.max(14, cy + dy)),
      emphasis: 'away',
    });
  }
  return out;
}

/** Where every technology sits for the given arrangement. */
export function computeLayout(view: View, arrangement: Arrangement): Map<TechId, Placement> {
  const base = cachedOverview(view);
  if (arrangement.focus && techById.has(arrangement.focus)) {
    return focusLayout(view, base, arrangement.focus, relatedTo(arrangement.focus), 'core');
  }
  if (arrangement.filter) {
    // A filtered group gathers around its best-connected member.
    const members = technologies
      .filter((t) => t.category === arrangement.filter)
      .sort((a, b) => degreeOf(b.id) - degreeOf(a.id) || a.name.localeCompare(b.name))
      .map((t) => t.id);
    const [hub, ...rest] = members;
    if (hub) return focusLayout(view, base, hub, rest, 'ring');
  }
  const out = new Map<TechId, Placement>();
  for (const [id, p] of base) out.set(id, { x: p.x, y: p.y, emphasis: 'rest' });
  return out;
}
