import gsap from 'gsap';
import { categoryById, projectById, techById, type Tone } from '../content';
import { emitRipple, emitRippleAtScreen, field } from '../field/fieldState';
import { fieldModes, pickParams } from '../field/modes';
import { toneIndex } from '../field/waveMath';
import { registry, signalFrom } from '../schematic/registry';
import { resolveVisualMode, useSystem, type SystemState, type VisualMode } from '../state/store';

/**
 * The director: animation orchestration for the whole system.
 *
 * It is the only place that turns interaction state into choreography. It
 * watches the store and, for each change of intent, drives the cube field's
 * mode, fires schematic signals and sequences transitions. Components never
 * talk to the field or to each other directly.
 *
 * The one visual rule everything follows: a signal travels along a trace as a
 * pulse, and when it reaches the field it becomes a radial wave of the same
 * tone.
 */

const techTone = (id: string): Tone => {
  const tech = techById.get(id);
  return (tech && categoryById.get(tech.category)?.tone) ?? 'cyan';
};

function applyMode(mode: VisualMode, reduced: boolean): void {
  const target = pickParams(fieldModes[mode]);
  gsap.to(field.params, {
    ...target,
    duration: reduced ? 0 : mode.startsWith('project:') ? 1.5 : 1.7,
    ease: 'power2.inOut',
    overwrite: true,
    onUpdate: field.invalidate,
  });
  document.documentElement.dataset.mode = mode;
}

/** Centre of an anchor in viewport pixels, if it is registered and laid out. */
function anchorCentre(id: string): { x: number; y: number } | null {
  const element = registry.anchors.get(id);
  if (!element) return null;
  const r = element.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function startDirector(): () => void {
  const store = useSystem;
  const disposers: (() => void)[] = [];
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const reduced = (): boolean => store.getState().reducedMotion;

  // ── Field behaviour follows the visual mode ─────────────────────────
  applyMode(resolveVisualMode(store.getState()), true);
  disposers.push(
    store.subscribe(
      (s: SystemState) => resolveVisualMode(s),
      (mode) => applyMode(mode, reduced()),
    ),
  );

  // ── Section navigation: a soft wave from wherever the camera is heading ──
  disposers.push(
    store.subscribe(
      (s) => s.activeSection,
      () => {
        if (reduced()) return;
        later(() => emitRippleAtScreen(window.innerWidth * 0.5, window.innerHeight * 0.62, 0.4, 1), 260);
      },
    ),
  );

  // ── Technology hover: node → trace → via → ripple ───────────────────
  let hoverTimer = 0;
  disposers.push(
    store.subscribe(
      (s) => s.hoveredTech,
      (tech) => {
        window.clearTimeout(hoverTimer);
        if (!tech || reduced()) return;
        // Debounced so sweeping the cursor across the graph does not spray signals.
        hoverTimer = window.setTimeout(() => {
          const id = registry.anchors.has(`tech:${tech}`) ? `tech:${tech}` : `chip:${tech}`;
          signalFrom(id, { tone: techTone(tech), dx: 30, dy: 30, side: 'c', route: 'vh', ripple: 0.5 });
        }, 110);
      },
    ),
  );

  // ── Technology selection: a stronger disturbance under the node ─────
  disposers.push(
    store.subscribe(
      (s) => s.selectedTech,
      (tech) => {
        if (!tech || reduced()) return;
        const centre = anchorCentre(`tech:${tech}`);
        if (centre) emitRippleAtScreen(centre.x, centre.y, 1.0, toneIndex[techTone(tech)]);
      },
    ),
  );

  // ── Project hover ───────────────────────────────────────────────────
  let projectTimer = 0;
  disposers.push(
    store.subscribe(
      (s) => s.hoveredProject,
      (project) => {
        window.clearTimeout(projectTimer);
        const entry = project ? projectById.get(project) : undefined;
        if (!entry || reduced()) return;
        projectTimer = window.setTimeout(() => {
          signalFrom(`project:${entry.id}`, { tone: entry.tone, side: 'l', dx: -34, dy: 40, route: 'hv', ripple: 0.55 });
        }, 110);
      },
    ),
  );

  // ── Project selection: focus → inspect, and release on close ────────
  disposers.push(
    store.subscribe(
      (s) => s.selectedProject,
      (project, previous) => {
        const state = store.getState();
        const entry = project ? projectById.get(project) : undefined;
        if (entry) {
          state.setTransition('focusing');
          // Rings and spirals are centred on the part of the field under the inspector.
          const centre = anchorCentre('inspector');
          const hit = centre ? field.unproject(centre.x, centre.y) : null;
          gsap.to(field, {
            focusX: hit?.x ?? 0,
            focusZ: hit?.z ?? 0,
            duration: reduced() ? 0 : 1.2,
            ease: 'power2.out',
            overwrite: 'auto',
          });
          if (!reduced()) {
            later(() => {
              const c = anchorCentre('inspector');
              if (c) emitRippleAtScreen(c.x, c.y, 1.5, toneIndex[entry.tone]);
            }, 380);
          }
          later(() => {
            if (store.getState().selectedProject === entry.id) store.getState().setTransition('inspecting');
          }, reduced() ? 0 : 900);
        } else if (previous) {
          state.setTransition('releasing');
          if (!reduced()) emitRipple(field.focusX, field.focusZ, -0.8, 1);
          later(() => {
            if (!store.getState().selectedProject) store.getState().setTransition('idle');
          }, reduced() ? 0 : 700);
        }
      },
    ),
  );

  return () => {
    for (const dispose of disposers) dispose();
    for (const id of timers) window.clearTimeout(id);
    window.clearTimeout(hoverTimer);
    window.clearTimeout(projectTimer);
    gsap.killTweensOf(field.params);
    gsap.killTweensOf(field);
  };
}
