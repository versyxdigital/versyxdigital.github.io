import { useEffect, useMemo, useRef, useState } from 'react';
import {
  categoryById,
  degreeOf,
  projectById,
  techEdges,
  technologies,
  type TechCategory,
  type TechId,
  type Technology,
} from '../content';
import { systemClock } from '../field/fieldState';
import { cellSeed } from '../field/waveMath';
import { registerAnchor } from '../schematic/registry';
import { focusedProject, selectHighlight, useSystem } from '../state/store';
import styles from './Constellation.module.css';
import { computeLayout, landscapeView, nodeRadius, portraitView, type Placement } from './layout';

type NodeState = 'rest' | 'primary' | 'lit' | 'dim';

const hexagon = (r: number): string =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');

const triangle = (r: number): string =>
  [-90, 30, 150].map((deg) => `${(Math.cos((deg * Math.PI) / 180) * r).toFixed(2)},${(Math.sin((deg * Math.PI) / 180) * r).toFixed(2)}`).join(' ');

/** Each category has its own glyph, so groups stay readable without colour. */
export function Glyph({ category, r }: { category: TechCategory; r: number }) {
  switch (category) {
    case 'language':
      return (
        <>
          <circle className={styles.halo} r={r + 5.5} />
          <circle className={styles.shape} r={r} />
        </>
      );
    case 'frontend':
      return <circle className={styles.shape} r={r} />;
    case 'backend':
      return <rect className={styles.shape} x={-r * 0.9} y={-r * 0.9} width={r * 1.8} height={r * 1.8} />;
    case 'data':
      return <rect className={styles.shape} x={-r * 0.85} y={-r * 0.85} width={r * 1.7} height={r * 1.7} transform="rotate(45)" />;
    case 'infra':
      return <polygon className={styles.shape} points={hexagon(r * 1.12)} />;
    case 'tooling':
      return <polygon className={styles.shape} points={triangle(r * 1.25)} />;
  }
}

interface Sim {
  x: number;
  y: number;
  drawX: number;
  drawY: number;
  seed: number;
}

const SIGNALS = 5;

/**
 * The technology constellation.
 *
 * React renders the nodes and edges once per interaction state (which node
 * is lit, which is dimmed). Positions are never React state: one animation
 * loop eases every node toward its place in the current arrangement and
 * writes transforms straight to the SVG.
 */
export function Constellation() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const view = compact ? portraitView : landscapeView;

  const filter = useSystem((s) => s.categoryFilter);
  const selected = useSystem((s) => s.selectedTech);
  const highlight = useSystem(selectHighlight);
  const projectFocus = useSystem((s) => focusedProject(s));
  const hoverTech = useSystem((s) => s.hoverTech);
  const selectTech = useSystem((s) => s.selectTech);

  const layout = useMemo(() => computeLayout(view, { filter, focus: selected }), [view, filter, selected]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // Roving tabindex: the graph is a single tab stop, arrows walk it.
  const [roving, setRoving] = useState<TechId>('typescript');

  const sim = useRef(new Map<TechId, Sim>());
  const nodeEls = useRef(new Map<TechId, SVGGElement>());
  const edgeEls = useRef(new Map<string, SVGLineElement>());
  const signalEls = useRef<(SVGCircleElement | null)[]>([]);
  const pointer = useRef({ x: 0, y: 0 });
  const litEdges = useRef<string[]>([]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect.width;
      const isCompact = width < 640;
      setCompact(isCompact);
      // Canvas units per CSS pixel. Labels are sized in CSS pixels times this
      // factor, so they stay legible when the graph is drawn small.
      // The drawing is fitted inside its box, so the tighter dimension sets the scale.
      const canvas = isCompact ? portraitView : landscapeView;
      const height = entry.contentRect.height;
      const k = Math.max(canvas.width / Math.max(1, width), height > 40 ? canvas.height / height : 0);
      el.style.setProperty('--k', Math.min(isCompact ? 1.6 : 1.5, Math.max(1, k)).toFixed(3));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Interaction state per node and edge ────────────────────────────
  const stateOf = (tech: Technology): NodeState => {
    if (highlight.active) {
      if (highlight.primaryTech === tech.id) return 'primary';
      return highlight.techs.has(tech.id) ? 'lit' : 'dim';
    }
    if (filter) return tech.category === filter ? 'rest' : 'dim';
    return 'rest';
  };

  const edgeStates = useMemo(() => {
    const out = new Map<string, 'rest' | 'lit' | 'dim'>();
    const lit: string[] = [];
    for (const edge of techEdges) {
      let state: 'rest' | 'lit' | 'dim' = 'rest';
      if (highlight.active) {
        const touchesPrimary = highlight.primaryTech === edge.a || highlight.primaryTech === edge.b;
        const inProject = projectFocus !== null && edge.projects.includes(projectFocus);
        const bothLit = highlight.techs.has(edge.a) && highlight.techs.has(edge.b);
        state = touchesPrimary || inProject || (highlight.primaryTech === null && bothLit) ? 'lit' : 'dim';
      } else if (filter) {
        const a = technologies.find((t) => t.id === edge.a)?.category;
        const b = technologies.find((t) => t.id === edge.b)?.category;
        state = a === filter || b === filter ? 'rest' : 'dim';
      }
      out.set(edge.id, state);
      if (state === 'lit') lit.push(edge.id);
    }
    litEdges.current = lit;
    return out;
  }, [highlight, filter, projectFocus]);

  // ── Animation loop ─────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let frame = 0;
    let running = false;
    let last = systemClock();
    const signals = Array.from({ length: SIGNALS }, () => ({ edge: '', start: -10, duration: 1, reverse: false }));
    let spawnCount = 0;
    let nextSpawn = 0;

    const step = (): void => {
      frame = requestAnimationFrame(step);
      const now = systemClock();
      const dt = Math.min(0.05, now - last);
      last = now;
      const reduced = useSystem.getState().reducedMotion;
      const k = reduced ? 1 : 1 - Math.exp(-dt * 4.2);
      const targets = layoutRef.current;

      for (const tech of technologies) {
        const target = targets.get(tech.id);
        const el = nodeEls.current.get(tech.id);
        if (!target || !el) continue;
        let s = sim.current.get(tech.id);
        if (!s) {
          s = { x: target.x, y: target.y, drawX: target.x, drawY: target.y, seed: cellSeed(tech.id.length * 7, tech.id.charCodeAt(0)) };
          sim.current.set(tech.id, s);
        }
        s.x += (target.x - s.x) * k;
        s.y += (target.y - s.y) * k;
        // Ambient drift: small, slow and periodic per node. Never random.
        const drift = reduced ? 0 : target.emphasis === 'core' ? 1.2 : 3;
        const depth = 0.35 + s.seed * 0.65;
        s.drawX = s.x + Math.sin(now * 0.31 + s.seed * 6.283) * drift + pointer.current.x * depth * 9;
        s.drawY = s.y + Math.cos(now * 0.27 + s.seed * 4.1) * drift + pointer.current.y * depth * 6;
        el.setAttribute('transform', `translate(${s.drawX.toFixed(2)} ${s.drawY.toFixed(2)})`);
      }

      for (const edge of techEdges) {
        const line = edgeEls.current.get(edge.id);
        const a = sim.current.get(edge.a);
        const b = sim.current.get(edge.b);
        if (!line || !a || !b) continue;
        line.setAttribute('x1', a.drawX.toFixed(2));
        line.setAttribute('y1', a.drawY.toFixed(2));
        line.setAttribute('x2', b.drawX.toFixed(2));
        line.setAttribute('y2', b.drawY.toFixed(2));
      }

      // Occasional signals along relationships; preferentially the lit ones.
      if (!reduced && now >= nextSpawn) {
        const pool = litEdges.current.length > 0 ? litEdges.current : techEdges.map((e) => e.id);
        const free = signals.find((s) => now - s.start > s.duration);
        if (free && pool.length > 0) {
          free.edge = pool[(spawnCount * 7) % pool.length] ?? '';
          free.start = now;
          free.duration = 0.9 + ((spawnCount * 13) % 5) * 0.12;
          free.reverse = spawnCount % 3 === 0;
          spawnCount++;
        }
        nextSpawn = now + (litEdges.current.length > 0 ? 0.35 : 1.25);
      }
      signals.forEach((signal, i) => {
        const dot = signalEls.current[i];
        if (!dot) return;
        const t = (now - signal.start) / signal.duration;
        const edge = techEdges.find((e) => e.id === signal.edge);
        const a = edge && sim.current.get(signal.reverse ? edge.b : edge.a);
        const b = edge && sim.current.get(signal.reverse ? edge.a : edge.b);
        if (reduced || t < 0 || t > 1 || !a || !b) {
          dot.setAttribute('opacity', '0');
          return;
        }
        const e = t * t * (3 - 2 * t);
        dot.setAttribute('cx', (a.drawX + (b.drawX - a.drawX) * e).toFixed(2));
        dot.setAttribute('cy', (a.drawY + (b.drawY - a.drawY) * e).toFixed(2));
        dot.setAttribute('opacity', Math.sin(t * Math.PI).toFixed(3));
      });
    };

    // Only animate while the constellation is on screen.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        const visible = entry?.isIntersecting ?? false;
        if (visible && !running) {
          running = true;
          last = systemClock();
          frame = requestAnimationFrame(step);
        } else if (!visible && running) {
          running = false;
          cancelAnimationFrame(frame);
        }
      },
      { rootMargin: '120px' },
    );
    visibility.observe(wrap);
    return () => {
      visibility.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const onPointerMove = (event: React.PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current.x = -(((event.clientX - rect.left) / rect.width) * 2 - 1);
    pointer.current.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  /** Moves focus to the nearest node in the pressed direction, by current on-screen position. */
  const moveFocus = (from: TechId, dx: number, dy: number): void => {
    const origin = sim.current.get(from);
    if (!origin) return;
    let best: TechId | null = null;
    let bestScore = Infinity;
    for (const tech of technologies) {
      if (tech.id === from) continue;
      const p = sim.current.get(tech.id);
      if (!p) continue;
      const ox = p.x - origin.x;
      const oy = p.y - origin.y;
      const along = ox * dx + oy * dy;
      if (along <= 4) continue;
      const across = Math.abs(ox * dy - oy * dx);
      // Prefer nodes ahead and close to the axis of travel.
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = tech.id;
      }
    }
    if (best) {
      setRoving(best);
      nodeEls.current.get(best)?.focus();
    }
  };

  const arrows: Record<string, [number, number]> = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowUp: [0, -1],
  };

  const setNode = (id: TechId) => (el: SVGGElement | null) => {
    if (el) nodeEls.current.set(id, el);
    else nodeEls.current.delete(id);
    registerAnchor(`tech:${id}`, el);
  };

  const hubs = useMemo(() => new Set(technologies.filter((t) => degreeOf(t.id) >= 5).map((t) => t.id)), []);
  const showLabel = (tech: Technology, state: NodeState, placement: Placement | undefined): boolean => {
    if (state === 'dim' || placement?.emphasis === 'away') return false;
    if (!compact) return true;
    // On the compact canvas the overview only names the anchors of the network,
    // and a focused view names the inner ring. The record below lists the rest.
    if (placement?.emphasis === 'rest' && state === 'rest') return tech.category === 'language' || hubs.has(tech.id);
    if (placement?.emphasis === 'ring' && (placement.ring ?? 0) > 0) return false;
    return true;
  };

  const projectName = projectFocus ? projectById.get(projectFocus)?.name : undefined;

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-compact={compact}
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        pointer.current.x = 0;
        pointer.current.y = 0;
      }}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${view.width} ${view.height}`}
        role="group"
        aria-label="Map of technologies. Each point is a technology. Use the arrow keys to move between them and Enter to select one."
        onClick={(event) => {
          if (event.target === event.currentTarget) selectTech(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') selectTech(null);
        }}
      >
        <g className={styles.edges} aria-hidden="true">
          {techEdges.map((edge) => (
            <line
              key={edge.id}
              ref={(el) => {
                if (el) edgeEls.current.set(edge.id, el);
                else edgeEls.current.delete(edge.id);
              }}
              className={styles.edge}
              data-state={edgeStates.get(edge.id)}
              data-weight={Math.min(3, edge.weight)}
            />
          ))}
          {Array.from({ length: SIGNALS }, (_, i) => (
            <circle
              key={i}
              ref={(el) => {
                signalEls.current[i] = el;
              }}
              className={styles.signal}
              r={compact ? 1.8 : 2.2}
              opacity="0"
            />
          ))}
        </g>

        {technologies.map((tech) => {
          const state = stateOf(tech);
          const placement = layout.get(tech.id);
          const category = categoryById.get(tech.category);
          const r = nodeRadius(tech.id) * (compact ? 0.82 : 1) * (placement?.emphasis === 'core' ? 1.5 : 1);
          const isSelected = selected === tech.id;
          return (
            <g
              key={tech.id}
              ref={setNode(tech.id)}
              className={styles.node}
              data-state={state}
              data-emphasis={placement?.emphasis}
              data-tone={category?.tone}
              data-selected={isSelected}
              role="button"
              tabIndex={roving === tech.id ? 0 : -1}
              aria-pressed={isSelected}
              aria-label={`${tech.name}, ${category?.label ?? ''}`}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') hoverTech(tech.id);
              }}
              onPointerLeave={() => hoverTech(null)}
              onFocus={() => {
                setRoving(tech.id);
                hoverTech(tech.id);
              }}
              onBlur={() => hoverTech(null)}
              onClick={(event) => {
                event.stopPropagation();
                selectTech(isSelected ? null : tech.id);
              }}
              onKeyDown={(event) => {
                const direction = arrows[event.key];
                if (direction) {
                  event.preventDefault();
                  moveFocus(tech.id, direction[0], direction[1]);
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectTech(isSelected ? null : tech.id);
                }
              }}
            >
              <circle className={styles.hit} r={compact ? 24 : 22} />
              <circle className={styles.focusRing} r={r + 10} />
              <Glyph category={tech.category} r={r} />
              <text className={styles.label} data-visible={showLabel(tech, state, placement)} y={r} textAnchor="middle">
                {tech.name}
              </text>
            </g>
          );
        })}
      </svg>
      {projectName && (
        <p className={`mono ${styles.context}`} aria-hidden="true">
          Lit: technologies used in {projectName}
        </p>
      )}
    </div>
  );
}
