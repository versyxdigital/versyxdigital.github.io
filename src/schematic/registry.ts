import { useCallback, useEffect, type DependencyList } from 'react';
import type { Tone } from '../content';
import type { SystemState } from '../state/store';
import type { RouteStyle } from './routing';

/**
 * Schematic registry.
 *
 * Components declare *what* is connected (two anchors, or an anchor and a
 * point on the cube field). The overlay works out *where* that is every
 * frame from live element positions, so traces stay attached through scroll,
 * resize and layout changes.
 */

export type AnchorSide = 'l' | 'r' | 't' | 'b' | 'c';

export type Endpoint =
  /**
   * A registered DOM/SVG element. `at` slides the attachment along the side
   * (0..1). With `via`, the element marks a point where the trace drops into the field.
   */
  | { kind: 'anchor'; id: string; side?: AnchorSide; at?: number; gap?: number; dx?: number; dy?: number; via?: boolean }
  /** A world position on the cube field. The trace ends on the cube at that cell. */
  | { kind: 'field'; x: number; z: number }
  /** A via: a pixel offset from the trace's start, where the signal drops into the field below. */
  | { kind: 'via'; dx: number; dy: number }
  /** A fixed viewport position, as fractions of width and height. */
  | { kind: 'screen'; x: number; y: number };

export interface Connection {
  id: string;
  from: Endpoint;
  to: Endpoint;
  route: RouteStyle;
  /** Position of the jog for hvh / vhv routes, 0..1. */
  bend?: number;
  /** Fixed pixel offset of the jog from the start; overrides `bend`. */
  jog?: number;
  tone: Tone;
  /** A colour of its own, as "r, g, b". Overrides the tone, and is kept in colour by the greyscale theme. */
  rgb?: string;
  /**
   * Visibility for the current interaction state: 0 hidden, ~0.3 resting,
   * 1 fully energised. Evaluated every frame, so keep it cheap.
   */
  level: (state: SystemState) => number;
  /** Mean seconds between ambient pulses while visible. 0 disables them. */
  ambient?: number;
  /** Ripple amplitude released when a pulse reaches a field or via end. */
  ripple?: number;
}

export interface Pulse {
  start: number;
  duration: number;
  tone: Tone;
  ripple: number;
  done: boolean;
}

export interface ConnectionRuntime {
  def: Connection;
  /** Smoothed level. */
  level: number;
  /** How much of the trace has been drawn, 0..1. */
  reveal: number;
  pulses: Pulse[];
  lastAmbientSlot: number;
  /** Seconds remaining for transient connections; Infinity for declared ones. */
  ttl: number;
  born: number;
}

type AnchorElement = Element;

const anchors = new Map<string, AnchorElement>();
const connections = new Map<string, ConnectionRuntime>();
let transientCounter = 0;

export const registry = {
  anchors,
  connections,
};

export function registerAnchor(id: string, element: AnchorElement | null): void {
  if (element) anchors.set(id, element);
  else anchors.delete(id);
}

export function addConnection(def: Connection, ttl = Infinity, born = 0): () => void {
  connections.set(def.id, { def, level: 0, reveal: 0, pulses: [], lastAmbientSlot: -1, ttl, born });
  return () => {
    connections.delete(def.id);
  };
}

export interface PulseOptions {
  tone?: Tone;
  /** Seconds to traverse the trace. Defaults to a speed-based duration. */
  duration?: number;
  ripple?: number;
  /** Seconds to wait before the pulse departs. */
  delay?: number;
}

let now = (): number => 0;
/** The overlay installs the shared clock so pulses use the system timebase. */
export function setClock(clock: () => number): void {
  now = clock;
}

/** Sends a signal along a declared connection. */
export function pulse(id: string, options: PulseOptions = {}): void {
  const runtime = connections.get(id);
  if (!runtime) return;
  runtime.pulses.push({
    start: now() + (options.delay ?? 0),
    duration: options.duration ?? -1,
    tone: options.tone ?? runtime.def.tone,
    ripple: options.ripple ?? runtime.def.ripple ?? 0,
    done: false,
  });
}

export interface SignalOptions {
  tone: Tone;
  /** Where the via sits relative to the anchor, in pixels. */
  dx?: number;
  dy?: number;
  side?: AnchorSide;
  route?: RouteStyle;
  ripple?: number;
}

/**
 * Fires a one-off signal from an element into the cube field: a short trace
 * is drawn to a via beside the element, a pulse travels along it, and where
 * it lands the field ripples.
 */
export function signalFrom(anchorId: string, options: SignalOptions): void {
  if (!anchors.has(anchorId)) return;
  const id = `signal:${transientCounter++}`;
  addConnection(
    {
      id,
      from: { kind: 'anchor', id: anchorId, side: options.side ?? 'b' },
      to: { kind: 'via', dx: options.dx ?? 46, dy: options.dy ?? 54 },
      route: options.route ?? 'vh',
      tone: options.tone,
      level: () => 1,
      ripple: options.ripple ?? 0.6,
    },
    1.9,
    now(),
  );
  pulse(id, { duration: 0.42, delay: 0.06 });
}

/** Registers the element as a named schematic anchor. */
export function useAnchor<T extends AnchorElement>(id: string): (element: T | null) => void {
  return useCallback((element: T | null) => registerAnchor(id, element), [id]);
}

/** Declares connections for the lifetime of a component. */
export function useConnections(build: () => Connection[], deps: DependencyList): void {
  useEffect(() => {
    const disposers = build().map((def) => addConnection(def));
    return () => {
      for (const dispose of disposers) dispose();
    };
    // The builder is intentionally keyed on the caller's dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
