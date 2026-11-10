import { sectionOrder, type SectionId } from '../state/store';

/**
 * Camera rail. One pose per section; the rig interpolates between neighbours
 * with the continuous scroll progress, so scrolling flies the camera around a
 * single persistent field rather than cutting between scenes.
 */
export interface CameraPose {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Radial fade of the field around the target, in world units. */
  fadeNear: number;
  fadeFar: number;
}

type Rail = Record<SectionId, CameraPose>;

const landscape: Rail = {
  hero: { pos: [-22, 20, 58], target: [11, -4, 2], fov: 25, fadeNear: 14, fadeFar: 54 },
  about: { pos: [-34, 19, 26], target: [-2, -3, -2], fov: 36, fadeNear: 12, fadeFar: 54 },
  tech: { pos: [0, 62, 16], target: [0, 0, 1], fov: 34, fadeNear: 20, fadeFar: 58 },
  projects: { pos: [32, 15, 33], target: [-1, -2, 0], fov: 36, fadeNear: 12, fadeFar: 54 },
  contact: { pos: [0, 8.5, 46], target: [0, 3.5, 0], fov: 34, fadeNear: 14, fadeFar: 58 },
};

/** Portrait screens: the field sits lower and further away so type keeps the upper half. */
const portrait: Rail = {
  hero: { pos: [-8, 17, 46], target: [3, -9, 0], fov: 46, fadeNear: 14, fadeFar: 52 },
  about: { pos: [-26, 24, 34], target: [0, -8, 0], fov: 46, fadeNear: 10, fadeFar: 48 },
  tech: { pos: [0, 70, 14], target: [0, 0, 0], fov: 44, fadeNear: 16, fadeFar: 52 },
  projects: { pos: [26, 20, 38], target: [0, -8, 0], fov: 46, fadeNear: 10, fadeFar: 48 },
  contact: { pos: [0, 10, 52], target: [0, -1, 0], fov: 46, fadeNear: 12, fadeFar: 52 },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (t: number): number => t * t * (3 - 2 * t);

/**
 * Pose for a continuous section index. The camera holds for the first part of
 * each section and travels during the remainder, so content is read against a
 * steady composition.
 */
export function poseAt(progress: number, isPortrait: boolean, out: CameraPose): CameraPose {
  const rail = isPortrait ? portrait : landscape;
  const max = sectionOrder.length - 1;
  const clamped = Math.min(max, Math.max(0, progress));
  const i = Math.min(max - 1, Math.floor(clamped));
  const a = rail[sectionOrder[i] ?? 'hero'];
  const b = rail[sectionOrder[i + 1] ?? 'contact'];
  const local = clamped - i;
  const t = ease(Math.min(1, Math.max(0, (local - 0.3) / 0.7)));
  for (let k = 0; k < 3; k++) {
    out.pos[k] = lerp(a.pos[k] ?? 0, b.pos[k] ?? 0, t);
    out.target[k] = lerp(a.target[k] ?? 0, b.target[k] ?? 0, t);
  }
  out.fov = lerp(a.fov, b.fov, t);
  out.fadeNear = lerp(a.fadeNear, b.fadeNear, t);
  out.fadeFar = lerp(a.fadeFar, b.fadeFar, t);
  return out;
}

export const blankPose = (): CameraPose => ({ pos: [0, 0, 0], target: [0, 0, 0], fov: 36, fadeNear: 10, fadeFar: 50 });
