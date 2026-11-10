import { describe, expect, it } from 'vitest';
import { poseAt, blankPose } from './cameraRail';
import { fieldModes, paramKeys, pickParams, type FieldParams } from './modes';
import { fragmentShader, vertexShader } from './shaders';
import {
  FIELD_SIZE,
  RIPPLE_LIFETIME,
  RIPPLE_SPEED,
  baseHeight,
  blocks,
  cellSeed,
  heightAt,
  interference,
  island,
  rings,
  rippleAt,
  scan,
  spiral,
  steps,
  travel,
  type FieldSnapshot,
} from './waveMath';

const samples: [number, number][] = [];
for (let x = -FIELD_SIZE / 2; x <= FIELD_SIZE / 2; x += 7) for (let z = -FIELD_SIZE / 2; z <= FIELD_SIZE / 2; z += 7) samples.push([x, z]);

describe('basis behaviours', () => {
  it('stay bounded everywhere on the field', () => {
    for (const t of [0, 3.7, 120, 5000]) {
      for (const [x, z] of samples) {
        expect(Math.abs(travel(x, z, t, 1))).toBeLessThanOrEqual(1.0001);
        expect(Math.abs(interference(x, z, t, 1))).toBeLessThanOrEqual(1.0001);
        expect(Math.abs(rings(x, z, t, 0, 0))).toBeLessThanOrEqual(1.4001);
        expect(scan(x, z, t)).toBeGreaterThanOrEqual(-0.3501);
        expect(scan(x, z, t)).toBeLessThanOrEqual(1.36);
        expect(spiral(x, z, t)).toBeGreaterThanOrEqual(0);
        expect(spiral(x, z, t)).toBeLessThanOrEqual(1);
        expect(blocks(x, z, t)).toBeGreaterThanOrEqual(-0.3501);
        expect(blocks(x, z, t)).toBeLessThanOrEqual(0.9501);
        expect(Math.abs(island(x, z, t, 0, 0))).toBeLessThan(3.2);
        expect(steps(x, z, t)).toBeGreaterThanOrEqual(-0.8001);
        expect(steps(x, z, t)).toBeLessThanOrEqual(1.14);
      }
    }
  });

  it('are continuous in space: neighbouring cells move together', () => {
    const step = 0.05;
    for (const [x, z] of samples) {
      expect(Math.abs(travel(x + step, z, 9, 1) - travel(x, z, 9, 1))).toBeLessThan(0.03);
      expect(Math.abs(interference(x, z + step, 9, 1) - interference(x, z, 9, 1))).toBeLessThan(0.03);
    }
  });

  it('are continuous in time: no jitter between frames', () => {
    const dt = 1 / 60;
    for (const [x, z] of samples) {
      expect(Math.abs(travel(x, z, 40 + dt, 1) - travel(x, z, 40, 1))).toBeLessThan(0.03);
      expect(Math.abs(rings(x, z, 40 + dt, 0, 0) - rings(x, z, 40, 0, 0))).toBeLessThan(0.06);
    }
  });

  it('evolve: the pattern is not a short loop', () => {
    const at = (t: number): number[] => samples.slice(0, 40).map(([x, z]) => travel(x, z, t, 1) + interference(x, z, t, 1));
    const distance = (p: number[], q: number[]): number => Math.sqrt(p.reduce((sum, v, i) => sum + (v - q[i]!) ** 2, 0));
    const reference = at(10);
    for (const later of [10 + 6.283, 10 + 30, 10 + 120, 10 + 600]) expect(distance(reference, at(later))).toBeGreaterThan(0.5);
  });

  it('draw a street plan: roads stay low and every block is raised', () => {
    // Road centre-lines sit on multiples of the 14-unit cell; block centres are half a cell off.
    for (const road of [-28, -14, 0, 14, 28]) expect(blocks(road, 5, 3)).toBeLessThan(0.05);
    for (const cx of [-21, -7, 7, 21]) for (const cz of [-21, -7, 7, 21]) expect(blocks(cx, cz, 3)).toBeGreaterThan(0.2);
  });

  it('raise one island: highest at the focus, open water far from it', () => {
    const peak = island(4, -6, 10, 4, -6);
    expect(peak).toBeGreaterThan(1.5);
    for (const [x, z] of [[4 + 20, -6], [4, -6 + 30], [4 - 33, -6]] as const) expect(island(x, z, 10, 4, -6)).toBeLessThan(peak);
    for (const [x, z] of [[50, 50], [-50, 40], [45, -50]] as const) expect(Math.abs(island(x, z, 10, 4, -6) + 0.35)).toBeLessThan(0.13);
  });

  it('march a staircase in one direction', () => {
    // Away from a riser, the level a little later in time equals the level a little further back in space.
    const t = 20;
    const dt = 1;
    const shift = (0.22 * dt) / 0.085;
    let agreed = 0;
    let checked = 0;
    for (let x = -50; x <= 50; x += 3.7) {
      const u = x * 0.085 - t * 0.22;
      const within = u - Math.floor(u);
      if (within < 0.2 || within > 0.8) continue;
      checked++;
      // Compare along a row where the travelling token term is negligible.
      const later = steps(x + shift, 0, t + dt) ;
      const now = steps(x, 0, t);
      if (Math.abs(later - now) < 0.26) agreed++;
    }
    expect(checked).toBeGreaterThan(5);
    expect(agreed).toBe(checked);
  });

  it('are deterministic', () => {
    expect(travel(3, 4, 5, 1)).toBe(travel(3, 4, 5, 1));
    expect(cellSeed(12, 7)).toBe(cellSeed(12, 7));
    expect(cellSeed(12, 7)).toBeGreaterThanOrEqual(0);
    expect(cellSeed(12, 7)).toBeLessThan(1);
  });
});

describe('modes', () => {
  it('define every parameter for every mode', () => {
    for (const [name, mode] of Object.entries(fieldModes)) {
      expect(mode.label.length, name).toBeGreaterThan(0);
      for (const key of paramKeys) expect(Number.isFinite(mode[key]), `${name}.${key}`).toBe(true);
    }
  });

  it('terrace the surface when order is 1', () => {
    const params: FieldParams = { ...pickParams(fieldModes['section:hero']), order: 1 };
    const q = 2.2;
    for (const [x, z] of samples) {
      const h = baseHeight(x, z, 12, params);
      expect(Math.abs(h * q - Math.round(h * q))).toBeLessThan(1e-6);
    }
  });

  it('keep the surface within the amplitude budget', () => {
    for (const mode of Object.values(fieldModes)) {
      const params = pickParams(mode);
      for (const [x, z] of samples) expect(Math.abs(baseHeight(x, z, 33, params))).toBeLessThan(4.5);
    }
  });
});

describe('ripples', () => {
  const ripple = { x: 0, z: 0, start: 10, amp: 1, tone: 0 };

  it('do nothing before they start or after they expire', () => {
    expect(rippleAt(5, 0, ripple, 9.9)).toEqual({ h: 0, env: 0 });
    expect(rippleAt(5, 0, ripple, 10 + RIPPLE_LIFETIME + 0.01)).toEqual({ h: 0, env: 0 });
  });

  it('travel outward at the ripple speed', () => {
    const age = 1.5;
    const front = age * RIPPLE_SPEED;
    const atFront = rippleAt(front, 0, ripple, ripple.start + age).env;
    const behind = rippleAt(front - 12, 0, ripple, ripple.start + age).env;
    const ahead = rippleAt(front + 12, 0, ripple, ripple.start + age).env;
    expect(atFront).toBeGreaterThan(behind * 5);
    expect(atFront).toBeGreaterThan(ahead * 5);
  });

  it('decay with age', () => {
    const early = rippleAt(RIPPLE_SPEED * 0.5, 0, ripple, ripple.start + 0.5).env;
    const late = rippleAt(RIPPLE_SPEED * 4, 0, ripple, ripple.start + 4).env;
    expect(late).toBeLessThan(early * 0.3);
  });

  it('are radially symmetric', () => {
    const clock = ripple.start + 1;
    expect(rippleAt(8, 0, ripple, clock).h).toBeCloseTo(rippleAt(0, 8, ripple, clock).h, 10);
    expect(rippleAt(8, 0, ripple, clock).h).toBeCloseTo(rippleAt(-5.6568542, 5.6568542, ripple, clock).h, 5);
  });

  it('add to the surface height', () => {
    const snapshot: FieldSnapshot = {
      params: pickParams(fieldModes['section:hero']),
      phase: 4,
      clock: 11,
      focusX: 0,
      focusZ: 0,
      ripples: [ripple],
      cursor: { x: 0, z: 0, strength: 0 },
    };
    const x = RIPPLE_SPEED;
    const withRipple = heightAt(x, 0, snapshot);
    const without = heightAt(x, 0, { ...snapshot, ripples: [] });
    expect(withRipple - without).toBeCloseTo(rippleAt(x, 0, ripple, 11).h, 10);
  });
});

describe('shader parity', () => {
  // The GLSL mirrors waveMath.ts. These guards catch a constant changed on one side only.
  const constants = ['0.19', '0.62', '0.31', '0.81', '0.53', '1.13', '0.021', '0.027', '0.105', '0.475', '0.42', '3.2', '1.15', '2.2', '12.9898', '78.233', '34.0', '0.085', '0.22'];

  it('shares its wave constants with the CPU reference', () => {
    for (const constant of constants) expect(vertexShader, constant).toContain(constant);
  });

  it('declares every uniform it reads', () => {
    for (const shader of [vertexShader, fragmentShader]) {
      const declared = new Set([...shader.matchAll(/uniform\s+\w+\s+(u\w+)/g)].map((m) => m[1]));
      const used = new Set([...shader.matchAll(/\b(u[A-Z]\w*)\b/g)].map((m) => m[1]));
      for (const name of used) expect(declared.has(name), name).toBe(true);
    }
  });

  it('passes every varying from vertex to fragment', () => {
    const varyings = (src: string): string[] => [...src.matchAll(/varying\s+\w+\s+(v\w+);/g)].map((m) => m[1]!).sort();
    expect(varyings(fragmentShader)).toEqual(varyings(vertexShader));
  });
});

describe('camera rail', () => {
  it('interpolates continuously between section poses', () => {
    const p = blankPose();
    let previous = [...poseAt(0, false, p).pos];
    for (let progress = 0.01; progress <= 4; progress += 0.01) {
      const pos = [...poseAt(progress, false, p).pos];
      const jump = Math.hypot(pos[0]! - previous[0]!, pos[1]! - previous[1]!, pos[2]! - previous[2]!);
      expect(jump).toBeLessThan(1.6);
      previous = pos;
    }
  });

  it('clamps outside the document', () => {
    const p = blankPose();
    expect([...poseAt(-3, false, p).pos]).toEqual([...poseAt(0, false, blankPose()).pos]);
    expect([...poseAt(99, true, p).pos]).toEqual([...poseAt(4, true, blankPose()).pos]);
  });
});
