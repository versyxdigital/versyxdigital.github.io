import { useEffect, useRef } from 'react';
import type { Tone } from '../content';
import { emitRippleAtScreen, projectFieldPoint, systemClock } from '../field/fieldState';
import { toneIndex } from '../field/waveMath';
import { useSystem } from '../state/store';
import { registry, setClock, type AnchorSide, type ConnectionRuntime, type Endpoint } from './registry';
import { pointAt, polylineLength, route, slice, type Pt } from './routing';
import styles from './schematic.module.css';

/**
 * Greyscale theme: lines are drawn in grey unless a connection names its own
 * colour. Set to false to draw the three tones in colour again.
 */
const GREYSCALE = true;
const grey = (rgb: string): string => {
  const [r = 0, g = 0, b = 0] = rgb.split(',').map(Number);
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return `${y}, ${y}, ${y}`;
};
const themed = (rgb: string): string => (GREYSCALE ? grey(rgb) : rgb);

const TONE_RGB: Record<Tone, string> = {
  cyan: themed('39, 220, 235'),
  blue: themed('80, 145, 255'),
  violet: themed('158, 136, 240'),
};
const REST_RGB = themed('120, 142, 164');
/** Pixels per second for pulses without an explicit duration. */
const PULSE_SPEED = 620;

function anchorPoint(element: Element, side: AnchorSide, at: number, gap: number): Pt | null {
  const r = element.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  switch (side) {
    case 'l':
      return { x: r.left - gap, y: r.top + r.height * at };
    case 'r':
      return { x: r.right + gap, y: r.top + r.height * at };
    case 't':
      return { x: r.left + r.width * at, y: r.top - gap };
    case 'b':
      return { x: r.left + r.width * at, y: r.bottom + gap };
    case 'c':
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
}

function resolve(endpoint: Endpoint, start: Pt | null, width: number, height: number): Pt | null {
  switch (endpoint.kind) {
    case 'anchor': {
      const element = registry.anchors.get(endpoint.id);
      const p = element ? anchorPoint(element, endpoint.side ?? 'r', endpoint.at ?? 0.5, endpoint.gap ?? 6) : null;
      if (p) {
        p.x += endpoint.dx ?? 0;
        p.y += endpoint.dy ?? 0;
      }
      return p;
    }
    case 'field': {
      const p = projectFieldPoint(endpoint.x, endpoint.z);
      return p.visible ? { x: p.x, y: p.y } : null;
    }
    case 'via':
      return start ? { x: start.x + endpoint.dx, y: start.y + endpoint.dy } : null;
    case 'screen':
      return { x: endpoint.x * width, y: endpoint.y * height };
  }
}

function strokePolyline(ctx: CanvasRenderingContext2D, pts: readonly Pt[]): void {
  const first = pts[0];
  if (!first || pts.length < 2) return;
  ctx.beginPath();
  // Half-pixel alignment keeps 1px axis-aligned runs crisp.
  ctx.moveTo(Math.round(first.x) + 0.5, Math.round(first.y) + 0.5);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    ctx.lineTo(Math.round(p.x) + 0.5, Math.round(p.y) + 0.5);
  }
  ctx.stroke();
}

/**
 * The schematic overlay: a single fixed canvas that draws every declared
 * connection as a routed trace, animates signal pulses along them, and hands
 * a pulse over to the cube field as a ripple when it reaches a field endpoint.
 *
 * It is purely decorative for assistive technology; all of the information it
 * hints at is present in the DOM.
 */
export function SchematicOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    setClock(systemClock);

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let last = systemClock();
    let running = true;

    const resize = (): void => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = document.documentElement.clientWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const drawConnection = (c: ConnectionRuntime, now: number, dt: number, reduced: boolean): void => {
      const state = useSystem.getState();
      const transient = Number.isFinite(c.ttl);
      const age = now - c.born;
      let target = c.def.level(state);
      if (transient) target = age > c.ttl - 0.6 ? 0 : 1;

      const kLevel = reduced ? 1 : 1 - Math.exp(-dt * 7);
      c.level += (target - c.level) * kLevel;
      const kReveal = reduced ? 1 : 1 - Math.exp(-dt * (target > 0.01 ? (transient ? 14 : 5) : 6));
      c.reveal += ((target > 0.01 ? 1 : 0) - c.reveal) * kReveal;
      if (c.level < 0.012 && c.reveal < 0.012 && c.pulses.length === 0) return;

      const a = resolve(c.def.from, null, width, height);
      if (!a) return;
      const b = resolve(c.def.to, a, width, height);
      if (!b) return;
      const pts = route(a, b, c.def.route, c.def.bend, 7, c.def.jog);
      // Cull by the path's bounds, not its ends: a long trace can cross the
      // viewport while both of its endpoints are off-screen.
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const margin = 40;
      if (maxX < -margin || minX > width + margin || maxY < -margin || minY > height + margin) {
        c.pulses.length = 0;
        return;
      }
      const to = c.def.to;
      const dropsIntoField = to.kind === 'via' || to.kind === 'field' || (to.kind === 'anchor' && to.via === true);
      const length = polylineLength(pts);
      if (length < 2) return;
      const rgb = c.def.rgb ?? TONE_RGB[c.def.tone];
      const energy = Math.min(1, Math.max(0, (c.level - 0.3) / 0.7));

      // ── Trace ───────────────────────────────────────────────────────
      const drawn = c.reveal >= 0.995 ? pts : slice(pts, 0, c.reveal);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${REST_RGB}, ${(0.26 * Math.min(1, c.level / 0.3) * (1 - energy)).toFixed(3)})`;
      strokePolyline(ctx, drawn);
      if (energy > 0.01) {
        ctx.strokeStyle = `rgba(${rgb}, ${(0.16 * energy).toFixed(3)})`;
        ctx.lineWidth = 3;
        strokePolyline(ctx, drawn);
        ctx.strokeStyle = `rgba(${rgb}, ${(0.85 * energy).toFixed(3)})`;
        ctx.lineWidth = 1;
        strokePolyline(ctx, drawn);
      }

      // ── Junctions ───────────────────────────────────────────────────
      const nodeAlpha = Math.min(1, c.level / 0.3) * (0.5 + 0.5 * energy);
      const nodeRgb = energy > 0.2 ? rgb : REST_RGB;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${nodeRgb}, ${(0.9 * nodeAlpha).toFixed(3)})`;
      ctx.fillStyle = '#060606';
      ctx.beginPath();
      ctx.arc(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (c.reveal > 0.96) {
        const ex = Math.round(b.x) + 0.5;
        const ey = Math.round(b.y) + 0.5;
        if (dropsIntoField) {
          // A via: where the trace leaves this layer for the field beneath.
          ctx.beginPath();
          ctx.arc(ex, ey, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = `rgba(${nodeRgb}, ${(0.95 * nodeAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(ex, ey, 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(ex - 9, ey);
          ctx.lineTo(ex - 6.5, ey);
          ctx.moveTo(ex + 6.5, ey);
          ctx.lineTo(ex + 9, ey);
          ctx.moveTo(ex, ey - 9);
          ctx.lineTo(ex, ey - 6.5);
          ctx.moveTo(ex, ey + 6.5);
          ctx.lineTo(ex, ey + 9);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${nodeRgb}, ${(0.95 * nodeAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── Ambient signals: sparse and deterministic ───────────────────
      const period = c.def.ambient ?? 0;
      if (period > 0 && !reduced && c.level > 0.2 && c.reveal > 0.9) {
        let hash = 0;
        for (let i = 0; i < c.def.id.length; i++) hash = (hash * 31 + c.def.id.charCodeAt(i)) % 9973;
        const slot = Math.floor((now + (hash / 9973) * period) / period);
        if (c.lastAmbientSlot === -1) c.lastAmbientSlot = slot;
        else if (slot !== c.lastAmbientSlot) {
          c.lastAmbientSlot = slot;
          c.pulses.push({ start: now, duration: -1, tone: c.def.tone, ripple: (c.def.ripple ?? 0) * 0.6, done: false });
        }
      }

      // ── Pulses ──────────────────────────────────────────────────────
      for (const p of c.pulses) {
        if (p.done || now < p.start) continue;
        const duration = p.duration > 0 ? p.duration : Math.min(1.6, Math.max(0.3, length / PULSE_SPEED));
        const t = reduced ? 1 : (now - p.start) / duration;
        if (t >= 1) {
          p.done = true;
          if (p.ripple > 0 && dropsIntoField) {
            emitRippleAtScreen(b.x, b.y, p.ripple, toneIndex[p.tone]);
          }
          continue;
        }
        const eased = t * t * (3 - 2 * t);
        const prgb = c.def.rgb ?? TONE_RGB[p.tone];
        const tail = Math.min(0.5, 70 / length);
        const body = slice(pts, Math.max(0, eased - tail), eased);
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${prgb}, 0.22)`;
        ctx.lineWidth = 4;
        strokePolyline(ctx, body);
        ctx.strokeStyle = `rgba(${prgb}, 0.95)`;
        ctx.lineWidth = 1.5;
        strokePolyline(ctx, slice(pts, Math.max(0, eased - tail * 0.45), eased));
        ctx.lineCap = 'butt';
        const head = pointAt(pts, eased);
        ctx.fillStyle = `rgba(${prgb}, 0.28)`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4fdff';
        ctx.beginPath();
        ctx.arc(head.x, head.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      if (c.pulses.length > 0 && c.pulses.every((p) => p.done)) c.pulses.length = 0;
    };

    const tick = (): void => {
      if (!running) return;
      frame = requestAnimationFrame(tick);
      const now = systemClock();
      const dt = Math.min(0.05, now - last);
      last = now;
      const reduced = useSystem.getState().reducedMotion;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (const [id, c] of registry.connections) {
        if (Number.isFinite(c.ttl) && now - c.born > c.ttl && c.pulses.every((p) => p.done)) {
          registry.connections.delete(id);
          continue;
        }
        drawConnection(c, now, dt, reduced);
      }
    };

    const onVisibility = (): void => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        last = systemClock();
        frame = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.overlay} data-overlay aria-hidden="true" />;
}
