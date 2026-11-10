import type { Quality } from '../state/store';

/** True when a WebGL2 (or WebGL1) context can actually be created. */
export function detectWebgl(): boolean {
  if (typeof document === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('nowebgl')) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

/** A conservative first guess. The quality governor lowers it further if frames run long. */
export function initialQuality(): Quality {
  if (typeof window === 'undefined') return 'medium';
  const forced = new URLSearchParams(window.location.search).get('quality');
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced;
  const hints = navigator as NavigatorHints;
  const cores = hints.hardwareConcurrency ?? 8;
  const memory = hints.deviceMemory ?? 8;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 720;
  if (cores <= 4 || memory <= 2) return 'low';
  if (coarse || small || memory <= 4) return 'medium';
  return 'high';
}

export const qualitySettings: Record<Quality, { grid: number; dpr: number; neighbours: boolean }> = {
  high: { grid: 124, dpr: 1.75, neighbours: true },
  medium: { grid: 92, dpr: 1.5, neighbours: true },
  low: { grid: 64, dpr: 1.25, neighbours: false },
};

export const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('reduced')) return true;
  return window.matchMedia(reducedMotionQuery).matches;
}
