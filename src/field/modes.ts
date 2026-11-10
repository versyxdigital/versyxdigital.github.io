import type { VisualMode } from '../state/store';

/**
 * Wave behaviours of the cube field.
 *
 * A mode is a weighting of the basis behaviours implemented in waveMath.ts
 * (and mirrored in the vertex shader). Moving between modes tweens these
 * numbers, so the surface morphs continuously instead of cutting.
 */
export interface FieldParams {
  /** Overall wave amplitude in world units. */
  amp: number;
  /** Spatial frequency multiplier. */
  freq: number;
  /** Phase speed multiplier. */
  speed: number;
  /** Yaw response of the columns to the local gradient. */
  twist: number;
  /** Overall brightness of the field (lower behind dense text). */
  dim: number;
  /** Strength of crest illumination. */
  glow: number;
  /** Basis weights. */
  travel: number;
  interf: number;
  rings: number;
  scan: number;
  stars: number;
  /** Terrace quantisation, 0 = smooth, 1 = stepped. */
  order: number;
}

export interface FieldMode extends FieldParams {
  /** Human-readable name shown in the system readout. */
  label: string;
}

const base: FieldParams = {
  amp: 1.5,
  freq: 1,
  speed: 1,
  twist: 1,
  dim: 1,
  glow: 1,
  travel: 0,
  interf: 0,
  rings: 0,
  scan: 0,
  stars: 0,
  order: 0,
};

export const fieldModes: Record<VisualMode, FieldMode> = {
  'section:hero': { ...base, label: 'Travelling waves · interference', travel: 1, interf: 0.6, amp: 1.65 },
  'section:about': { ...base, label: 'Long swell', travel: 1, interf: 0.12, amp: 1.25, freq: 0.62, speed: 0.7, dim: 0.5, glow: 0.7 },
  'section:tech': {
    ...base,
    label: 'Interference lattice',
    travel: 0.12,
    interf: 1,
    amp: 1.0,
    freq: 1.35,
    speed: 0.85,
    order: 0.55,
    twist: 0.4,
    dim: 0.36,
    glow: 0.9,
  },
  'section:projects': { ...base, label: 'Standing by', travel: 0.7, interf: 0.45, amp: 1.0, freq: 0.85, speed: 0.75, dim: 0.5, glow: 0.7 },
  'section:contact': {
    ...base,
    label: 'Settled lattice',
    travel: 1,
    interf: 0,
    amp: 0.5,
    freq: 0.5,
    speed: 0.4,
    order: 1,
    twist: 0,
    dim: 0.8,
    glow: 0.8,
  },
  'focus:tech': {
    ...base,
    label: 'Focused interference',
    travel: 0,
    interf: 1,
    amp: 0.9,
    freq: 1.7,
    speed: 1.1,
    order: 0.8,
    twist: 0.3,
    dim: 0.34,
    glow: 1,
  },
  'project:rings': { ...base, label: 'Sample pulses', rings: 1, travel: 0.1, amp: 1.5, speed: 1, twist: 0.5, dim: 0.56, glow: 1.2 },
  'project:scan': { ...base, label: 'Ruled rows', scan: 1, amp: 1.5, speed: 1, twist: 0, order: 0.25, dim: 0.54, glow: 1.1 },
  'project:stars': { ...base, label: 'Catalogue of systems', stars: 1, travel: 0.06, amp: 1.4, speed: 1, twist: 0, dim: 0.56, glow: 1.2 },
};

export const paramKeys: readonly (keyof FieldParams)[] = [
  'amp',
  'freq',
  'speed',
  'twist',
  'dim',
  'glow',
  'travel',
  'interf',
  'rings',
  'scan',
  'stars',
  'order',
];

export const pickParams = (mode: FieldMode): FieldParams => {
  const out = {} as FieldParams;
  for (const key of paramKeys) out[key] = mode[key];
  return out;
};
