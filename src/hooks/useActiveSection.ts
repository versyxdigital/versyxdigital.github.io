import { useEffect, useState } from 'react';

/**
 * Tracks which section ID is currently active in the viewport.
 * Uses a horizontal "trigger band" near the top of the viewport — the
 * section whose top crosses that band is considered active.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (!elements.length) return;

    const visible = new Map<string, number>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visible.set(id, entry.intersectionRatio);
          } else {
            visible.delete(id);
          }
        }
        if (visible.size === 0) {
          setActive(null);
          return;
        }
        // Pick the earliest section in the original order that's currently in band.
        const firstActive = ids.find((id) => visible.has(id)) ?? null;
        setActive(firstActive);
      },
      {
        // Trigger band: between 20% and 60% from the top of the viewport.
        rootMargin: '-20% 0px -40% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    elements.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);

  return active;
}
