import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSystem, type Quality } from '../state/store';
import { qualitySettings } from '../system/env';
import { scroll } from '../system/scroll';
import { blankPose, poseAt } from './cameraRail';
import { emitRipple, field, systemClock } from './fieldState';
import { fragmentShader, vertexShader } from './shaders';
import { FIELD_SIZE, MAX_RIPPLES, cellSeed } from './waveMath';

const BACKGROUND = new THREE.Color('#050608');
const BASE = new THREE.Color(0.125, 0.155, 0.198);

/** Anything matching this is content: the cursor reticle stays out of its way. */
const CONTENT_SELECTOR = 'a, button, h1, h2, h3, p, li, dl, svg, aside, article, header, nav, [role="button"]';

const isOpenField = (target: EventTarget | null): boolean => !(target instanceof Element && target.closest(CONTENT_SELECTOR) !== null);

/** Last known pointer position in viewport pixels, shared with the rig. */
const pointer = { x: -1, y: -1, movedAt: -100, fine: true };

function buildGeometry(grid: number): THREE.InstancedBufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = box.index;
  geometry.setAttribute('position', box.getAttribute('position'));
  geometry.setAttribute('normal', box.getAttribute('normal'));

  const count = grid * grid;
  const cells = new Float32Array(count * 2);
  const seeds = new Float32Array(count);
  const pitch = FIELD_SIZE / grid;
  const origin = -FIELD_SIZE / 2 + pitch / 2;
  let n = 0;
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      cells[n * 2] = origin + i * pitch;
      cells[n * 2 + 1] = origin + j * pitch;
      seeds[n] = cellSeed(i, j);
      n++;
    }
  }
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geometry.instanceCount = count;
  return geometry;
}

function buildMaterial(neighbours: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    defines: neighbours ? { FIELD_NEIGHBOURS: '' } : {},
    uniforms: {
      uPhase: { value: 0 },
      uClock: { value: 0 },
      uCell: { value: 1 },
      uAmp: { value: 1 },
      uFreq: { value: 1 },
      uTwist: { value: 1 },
      uOrder: { value: 0 },
      uTravel: { value: 1 },
      uInterf: { value: 0 },
      uRings: { value: 0 },
      uScan: { value: 0 },
      uStars: { value: 0 },
      uGlow: { value: 1 },
      uDim: { value: 1 },
      uFocus: { value: new THREE.Vector2() },
      uRipple: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -1000, 0)) },
      uRippleTone: { value: new Float32Array(MAX_RIPPLES) },
      uCursor: { value: new THREE.Vector3() },
      uBg: { value: BACKGROUND },
      uBase: { value: BASE },
      uFadeCenter: { value: new THREE.Vector2() },
      uFadeNear: { value: 16 },
      uFadeFar: { value: 60 },
      uFogStart: { value: 34 },
      uFogDensity: { value: 0.013 },
    },
  });
}

/**
 * The living cube field: one draw call, one instanced box, all motion in the
 * vertex shader. React renders this component once per quality tier.
 */
export function CubeField({ quality }: { quality: Quality }) {
  const settings = qualitySettings[quality];
  const geometry = useMemo(() => buildGeometry(settings.grid), [settings.grid]);
  const material = useMemo(() => buildMaterial(settings.neighbours), [settings.neighbours]);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const rig = useRef({
    pose: blankPose(),
    pos: new THREE.Vector3(-13, 12.5, 38),
    target: new THREE.Vector3(9, -2, 1),
    fov: 36,
    parallax: new THREE.Vector2(),
    initialised: false,
    lastRippleX: 0,
    lastRippleZ: 0,
    lastTime: 0,
  });
  const scratch = useMemo(() => ({ v: new THREE.Vector3(), dir: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  useEffect(() => {
    field.instances = settings.grid * settings.grid;
    return () => {
      geometry.dispose();
    };
  }, [geometry, settings.grid]);
  useEffect(() => () => material.dispose(), [material]);

  // Install projection helpers so DOM-space systems can address the field.
  useEffect(() => {
    field.invalidate = () => invalidate();
    field.project = (x, y, z) => {
      const v = scratch.v.set(x, y, z).project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (-v.y * 0.5 + 0.5) * size.height,
        visible: v.z > -1 && v.z < 1,
      };
    };
    field.unproject = (sx, sy) => {
      const origin = camera.position;
      const dir = scratch.dir
        .set((sx / size.width) * 2 - 1, -(sy / size.height) * 2 + 1, 0.5)
        .unproject(camera)
        .sub(origin)
        .normalize();
      if (dir.y >= -0.0001) return null;
      const t = -origin.y / dir.y;
      const x = origin.x + dir.x * t;
      const z = origin.z + dir.z * t;
      const half = FIELD_SIZE / 2 + 2;
      return Math.abs(x) > half || Math.abs(z) > half ? null : { x, z };
    };
    field.ready = true;
    return () => {
      field.ready = false;
      field.invalidate = () => {};
      field.project = () => ({ x: 0, y: 0, visible: false });
      field.unproject = () => null;
    };
  }, [camera, invalidate, scratch, size.height, size.width]);

  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.movedAt = systemClock();
      pointer.fine = event.pointerType === 'mouse' || event.pointerType === 'pen';
      field.pointerMovedAt = pointer.movedAt;
      field.pointerFree = pointer.fine && isOpenField(event.target);
      if (useSystem.getState().reducedMotion) invalidate();
    };
    const onScroll = (): void => {
      invalidate();
      // Scrolling moves content under a stationary pointer: re-check what it is over.
      if (pointer.fine && pointer.x >= 0) field.pointerFree = isOpenField(document.elementFromPoint(pointer.x, pointer.y));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, [invalidate]);

  useFrame(() => {
    const r = rig.current;
    const reduced = useSystem.getState().reducedMotion;
    const now = systemClock();
    const dt = Math.min(0.05, r.lastTime === 0 ? 0.016 : now - r.lastTime);
    r.lastTime = now;
    const u = material.uniforms as Record<string, THREE.IUniform>;
    const p = field.params;

    // ── Time. Phase is integrated so a speed change never jumps the wave. ──
    if (!reduced) field.phase += dt * p.speed;
    field.clock = now;

    // ── Camera rail ────────────────────────────────────────────────────
    const pose = field.poseOverride ?? poseAt(scroll.progress, size.height > size.width * 1.05, r.pose);
    const k = r.initialised && !reduced ? 1 - Math.exp(-dt * 3.2) : 1;
    r.initialised = true;
    r.pos.x += (pose.pos[0] - r.pos.x) * k;
    r.pos.y += (pose.pos[1] - r.pos.y) * k;
    r.pos.z += (pose.pos[2] - r.pos.z) * k;
    r.target.x += (pose.target[0] - r.target.x) * k;
    r.target.y += (pose.target[1] - r.target.y) * k;
    r.target.z += (pose.target[2] - r.target.z) * k;
    r.fov += (pose.fov - r.fov) * k;

    // Gentle parallax from the pointer: depth without taking over the camera.
    const px = pointer.x < 0 ? 0 : (pointer.x / size.width) * 2 - 1;
    const py = pointer.y < 0 ? 0 : (pointer.y / size.height) * 2 - 1;
    const pk = reduced ? 0 : 1 - Math.exp(-dt * 2);
    r.parallax.x += (px - r.parallax.x) * pk;
    r.parallax.y += (py - r.parallax.y) * pk;

    camera.position.set(r.pos.x + r.parallax.x * 1.4, r.pos.y - r.parallax.y * 0.7, r.pos.z);
    camera.lookAt(scratch.look.copy(r.target));
    if (Math.abs(camera.fov - r.fov) > 0.01) {
      camera.fov = r.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();

    // ── Cursor disturbance ─────────────────────────────────────────────
    const idle = now - pointer.movedAt;
    const cursor = field.cursor;
    const targetStrength = !reduced && pointer.fine && idle < 2.2 ? 1 : 0;
    cursor.strength += (targetStrength - cursor.strength) * (1 - Math.exp(-dt * (targetStrength > 0 ? 5 : 1.4)));
    if (pointer.x >= 0 && targetStrength > 0) {
      const hit = field.unproject(pointer.x, pointer.y);
      if (hit) {
        const ck = 1 - Math.exp(-dt * 9);
        cursor.x += (hit.x - cursor.x) * ck;
        cursor.z += (hit.z - cursor.z) * ck;
        // A moving cursor leaves a wake of small ripples.
        const travelled = Math.hypot(cursor.x - r.lastRippleX, cursor.z - r.lastRippleZ);
        if (travelled > 11) {
          emitRipple(cursor.x, cursor.z, 0.17, 0);
          r.lastRippleX = cursor.x;
          r.lastRippleZ = cursor.z;
        }
      }
    }

    // ── Uniforms ───────────────────────────────────────────────────────
    u.uPhase!.value = field.phase;
    u.uClock!.value = now;
    u.uCell!.value = FIELD_SIZE / settings.grid;
    u.uAmp!.value = p.amp;
    u.uFreq!.value = p.freq;
    u.uTwist!.value = p.twist;
    u.uOrder!.value = p.order;
    u.uTravel!.value = p.travel;
    u.uInterf!.value = p.interf;
    u.uRings!.value = p.rings;
    u.uScan!.value = p.scan;
    u.uStars!.value = p.stars;
    u.uGlow!.value = p.glow;
    u.uDim!.value = p.dim;
    (u.uFocus!.value as THREE.Vector2).set(field.focusX, field.focusZ);
    (u.uCursor!.value as THREE.Vector3).set(cursor.x, cursor.z, cursor.strength);
    (u.uFadeCenter!.value as THREE.Vector2).set(r.target.x, r.target.z);
    u.uFadeNear!.value = pose.fadeNear;
    u.uFadeFar!.value = pose.fadeFar;
    // Distance fog begins just short of the point the camera is looking at.
    u.uFogStart!.value = r.pos.distanceTo(r.target) * 0.8;
    const ripples = u.uRipple!.value as THREE.Vector4[];
    const tones = u.uRippleTone!.value as Float32Array;
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const ripple = field.ripples[i];
      if (!ripple) continue;
      ripples[i]!.set(ripple.x, ripple.z, ripple.start, ripple.amp);
      tones[i] = ripple.tone;
    }
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
