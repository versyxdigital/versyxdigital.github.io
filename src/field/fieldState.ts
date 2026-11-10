import { fieldModes, pickParams, type FieldParams } from './modes';
import { MAX_RIPPLES, heightAt, type Cursor, type FieldSnapshot, type Ripple } from './waveMath';

/**
 * Mutable, non-React state of the cube field.
 *
 * High-frequency values (wave phase, tweened parameters, ripples, cursor,
 * camera projection) live here rather than in the store so that the render
 * loop, the schematic overlay and the director can exchange them every frame
 * without causing React renders.
 */

const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
/** Seconds since the system started. The shared timebase for every animation. */
export const systemClock = (): number => (typeof performance !== 'undefined' ? (performance.now() - t0) / 1000 : 0);

export interface ScreenPoint {
  x: number;
  y: number;
  /** False when the point is behind the camera or the field is not rendering. */
  visible: boolean;
}

interface FieldRuntime extends FieldSnapshot {
  params: FieldParams;
  ripples: Ripple[];
  cursor: Cursor;
  /** Index of the next ripple slot to overwrite. */
  rippleHead: number;
  /** Bumped whenever something changed that needs a redraw in on-demand mode. */
  invalidate: () => void;
  /** World (x, y, z) -> viewport pixels. Installed by the camera rig. */
  project: (x: number, y: number, z: number) => ScreenPoint;
  /** Viewport pixels -> point on the y = 0 plane. Installed by the camera rig. */
  unproject: (sx: number, sy: number) => { x: number; z: number } | null;
  ready: boolean;
  instances: number;
  /** True while the pointer is over open field rather than over content. */
  pointerFree: boolean;
  /** Development aid: overrides the camera rail when set (see window.__system). */
  poseOverride: { pos: [number, number, number]; target: [number, number, number]; fov: number; fadeNear: number; fadeFar: number } | null;
}

const emptyRipple = (): Ripple => ({ x: 0, z: 0, start: -1000, amp: 0, tone: 0 });

export const field: FieldRuntime = {
  params: pickParams(fieldModes['section:hero']),
  phase: 0,
  clock: 0,
  focusX: 0,
  focusZ: 0,
  ripples: Array.from({ length: MAX_RIPPLES }, emptyRipple),
  cursor: { x: 0, z: 0, strength: 0 },
  rippleHead: 0,
  invalidate: () => {},
  project: () => ({ x: 0, y: 0, visible: false }),
  unproject: () => null,
  ready: false,
  instances: 0,
  pointerFree: false,
  poseOverride: null,
};

/** Starts a radial disturbance at a field position. */
export function emitRipple(x: number, z: number, amp: number, tone: number): void {
  const slot = field.ripples[field.rippleHead];
  if (!slot) return;
  slot.x = x;
  slot.z = z;
  slot.start = systemClock();
  slot.amp = amp;
  slot.tone = tone;
  field.rippleHead = (field.rippleHead + 1) % MAX_RIPPLES;
  field.invalidate();
}

/** Starts a radial disturbance under a viewport position. Returns false when it misses the field. */
export function emitRippleAtScreen(sx: number, sy: number, amp: number, tone: number): boolean {
  const hit = field.unproject(sx, sy);
  if (!hit) return false;
  emitRipple(hit.x, hit.z, amp, tone);
  return true;
}

/** Where a field position currently appears on screen, riding the wave. */
export function projectFieldPoint(x: number, z: number): ScreenPoint {
  if (!field.ready) return { x: 0, y: 0, visible: false };
  return field.project(x, heightAt(x, z, field), z);
}
