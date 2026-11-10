import { useCallback, useRef } from 'react';

/**
 * Live numeric readouts.
 *
 * Small technical labels show real values from the running simulation. They
 * are written straight to the DOM a few times a second by one shared loop, so
 * a ticking number never causes a React render.
 */

type Updater = () => string;
const entries = new Map<HTMLElement, Updater>();
let frame = 0;
let count = 0;

function tick(): void {
  frame = requestAnimationFrame(tick);
  // ~8 updates per second is plenty for a readout and keeps digits legible.
  if (++count % 7 !== 0) return;
  for (const [element, update] of entries) {
    const next = update();
    if (element.textContent !== next) element.textContent = next;
  }
}

/**
 * Returns a ref callback. Attach it to the element that should display the
 * value; it registers on mount and unregisters on unmount, including for
 * elements that are rendered conditionally.
 */
export function useLiveText<T extends HTMLElement>(update: Updater): (element: T | null) => (() => void) | void {
  const latest = useRef(update);
  latest.current = update;
  return useCallback((element: T | null) => {
    if (!element) return;
    entries.set(element, () => latest.current());
    element.textContent = latest.current();
    if (entries.size === 1) frame = requestAnimationFrame(tick);
    return () => {
      entries.delete(element);
      if (entries.size === 0) cancelAnimationFrame(frame);
    };
  }, []);
}

/** Fixed-width signed number, e.g. +0.42 / −1.07. */
export const signed = (value: number, digits = 2): string =>
  `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(digits)}`;
