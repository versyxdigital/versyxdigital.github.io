import type { FieldParams } from './modes';

/**
 * Wave mathematics of the cube field.
 *
 * This module is the CPU reference for the height function that the vertex
 * shader (shaders.ts) evaluates per cube. The two are kept term-for-term
 * identical so that DOM-space elements — schematic leader lines, annotations,
 * the non-WebGL fallback — can ask "how high is the surface at (x, z) right
 * now?" and get the same answer the GPU drew.
 *
 * If you change a constant here, change it in shaders.ts as well.
 */

/** Side length of the square field, in world units, centred on the origin. */
export const FIELD_SIZE = 112;
export const MAX_RIPPLES = 8;
export const RIPPLE_SPEED = 11;
export const RIPPLE_LIFETIME = 6;

const TAU = 6.283185307179586;

/** A radial disturbance. `start` is in system-clock seconds. */
export interface Ripple {
  x: number;
  z: number;
  start: number;
  amp: number;
  /** Tone index: 0 cyan, 1 blue, 2 violet. */
  tone: number;
}

export interface Cursor {
  x: number;
  z: number;
  strength: number;
}

const glslMod = (a: number, b: number): number => a - b * Math.floor(a / b);
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Three travelling sine waves whose headings drift slowly, so the pattern never loops. */
export function travel(x: number, z: number, t: number, f: number): number {
  const a1 = 0.35 + 0.25 * Math.sin(t * 0.013);
  const a2 = 2.1 + 0.3 * Math.sin(t * 0.017 + 1.3);
  const a3 = 4.4 + 0.2 * Math.sin(t * 0.011 + 2.1);
  return (
    0.5 * Math.sin((x * Math.cos(a1) + z * Math.sin(a1)) * 0.19 * f - t * 0.62) +
    0.32 * Math.sin((x * Math.cos(a2) + z * Math.sin(a2)) * 0.31 * f - t * 0.81 + 1.7) +
    0.18 * Math.sin((x * Math.cos(a3) + z * Math.sin(a3)) * 0.53 * f - t * 1.13 + 4.1)
  );
}

/** Three point sources on slow orbits. Their circular waves overlap into interference fringes. */
export function interference(x: number, z: number, t: number, f: number): number {
  const s1x = 22 * Math.cos(t * 0.021);
  const s1z = 22 * Math.sin(t * 0.027);
  const s2x = 26 * Math.cos(t * 0.017 + 2.4);
  const s2z = 26 * Math.sin(t * 0.023 + 1.1);
  const s3x = 18 * Math.cos(-t * 0.019 + 4.0);
  const s3z = 18 * Math.sin(t * 0.015 + 3.3);
  const k = 0.55 * f;
  return (
    (Math.sin(Math.hypot(x - s1x, z - s1z) * k - t * 1.25) +
      Math.sin(Math.hypot(x - s2x, z - s2z) * k - t * 1.25) +
      Math.sin(Math.hypot(x - s3x, z - s3z) * k * 1.21 - t * 1.4)) /
    3
  );
}

/** Packets of concentric rings leaving a focus at a steady cadence. */
export function rings(x: number, z: number, t: number, fx: number, fz: number): number {
  const d = Math.hypot(x - fx, z - fz);
  const env = Math.pow(0.5 + 0.5 * Math.sin(d * 0.105 - t * 0.475), 3);
  return (1.4 * Math.sin(d * 0.42 - t * 1.9) * env) / (1 + d * 0.02);
}

/** Ruled rows along x, modulated like words on a line, with a carriage travelling each row. */
export function scan(x: number, z: number, t: number): number {
  const K = 0.8;
  const row = Math.floor((z * K) / TAU + 0.5);
  let ridge = 0.5 + 0.5 * Math.cos(z * K);
  ridge *= ridge;
  const words = 0.5 + 0.5 * Math.sin(x * 0.5 - t * 1.2 + row * 1.7);
  const carriageX = glslMod(t * 7 + row * 13, 150) - 75;
  const carriage = Math.exp(-Math.pow((x - carriageX) * 0.16, 2));
  return ridge * (0.25 + 0.55 * smoothstep(0.3, 0.6, words) + 0.9 * carriage) - 0.35;
}

/** Two-armed logarithmic spiral density, 0..1. */
export function spiral(x: number, z: number, t: number): number {
  const r = Math.hypot(x, z);
  return 0.5 + 0.5 * Math.sin(2 * Math.atan2(z, x) - Math.log(r + 1) * 3.2 + t * 0.12);
}

/** Height contribution of one ripple, and its energy envelope (for colour). */
export function rippleAt(x: number, z: number, ripple: Ripple, clock: number): { h: number; env: number } {
  const age = clock - ripple.start;
  if (age <= 0 || age >= RIPPLE_LIFETIME || ripple.amp === 0) return { h: 0, env: 0 };
  const d = Math.hypot(x - ripple.x, z - ripple.z);
  const u = d - age * RIPPLE_SPEED;
  const sigma = 2.2 + age * 0.9;
  const env = Math.exp(-(u * u) / (2 * sigma * sigma)) * Math.exp(-age * 0.55);
  return { h: ripple.amp * env * Math.cos(u * 1.15), env: Math.abs(ripple.amp) * env };
}

export function cursorAt(x: number, z: number, cursor: Cursor, clock: number): number {
  if (cursor.strength <= 0.001) return 0;
  const d = Math.hypot(x - cursor.x, z - cursor.z);
  return cursor.strength * 0.55 * Math.exp(-(d * d) / 26) * (0.75 + 0.25 * Math.cos(d * 0.9 - clock * 2.4));
}

/** The continuous part of the surface: basis mix, then terracing. */
export function baseHeight(x: number, z: number, t: number, p: FieldParams, focusX = 0, focusZ = 0): number {
  let h = 0;
  if (p.travel > 0.0001) h += p.travel * travel(x, z, t, p.freq);
  if (p.interf > 0.0001) h += p.interf * interference(x, z, t, p.freq);
  if (p.rings > 0.0001) h += p.rings * rings(x, z, t, focusX, focusZ);
  if (p.scan > 0.0001) h += p.scan * scan(x, z, t);
  if (p.stars > 0.0001) h += p.stars * (spiral(x, z, t) * 0.3 - 0.25);
  h *= p.amp;
  const q = 2.2;
  return h + (Math.floor(h * q + 0.5) / q - h) * p.order;
}

export interface FieldSnapshot {
  params: FieldParams;
  /** Integrated wave phase time. */
  phase: number;
  /** System clock, seconds. */
  clock: number;
  focusX: number;
  focusZ: number;
  ripples: readonly Ripple[];
  cursor: Cursor;
}

/** Height of the surface at (x, z), excluding the per-cube "star" spikes. */
export function heightAt(x: number, z: number, s: FieldSnapshot): number {
  let h = baseHeight(x, z, s.phase, s.params, s.focusX, s.focusZ);
  for (const ripple of s.ripples) h += rippleAt(x, z, ripple, s.clock).h;
  h += cursorAt(x, z, s.cursor, s.clock);
  return h;
}

/** Deterministic per-cell hash in [0, 1). Shared by the instanced geometry and the fallback. */
export function cellSeed(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const toneIndex = { cyan: 0, blue: 1, violet: 2 } as const;
