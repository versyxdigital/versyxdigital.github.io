import { useEffect } from 'react';
import { sectionOrder, useSystem, type SectionId } from '../state/store';
import { hasGutter } from '../system/viewport';
import { pulse, useConnections } from './registry';

/** The anchor each section contributes to the spine. */
const anchorOf = (section: SectionId): string => (section === 'hero' ? 'hero:origin' : `head:${section}`);

const spineId = (from: SectionId, to: SectionId): string => `spine:${from}-${to}`;

/**
 * The spine: a single trace running down the left gutter that joins each
 * section heading node to the next. It is what makes the page read as one
 * board rather than five panels, and scrolling into a new section sends a
 * pulse down it.
 */
export function Spine() {
  const active = useSystem((s) => s.activeSection);

  useConnections(
    () =>
      sectionOrder.slice(0, -1).map((from, i) => {
        const to = sectionOrder[i + 1]!;
        return {
          id: spineId(from, to),
          from: { kind: 'anchor' as const, id: anchorOf(from), side: 'l' as const, gap: 5 },
          to: { kind: 'anchor' as const, id: anchorOf(to), side: 'l' as const, gap: 5 },
          route: 'hvh' as const,
          jog: -18,
          tone: 'cyan' as const,
          level: (s: { activeSection: SectionId }) => (hasGutter() && (s.activeSection === from || s.activeSection === to) ? 0.3 : 0),
          ambient: 9,
        };
      }),
    [],
  );

  // Arriving in a section sends a signal down the segment that leads into it.
  useEffect(() => {
    const index = sectionOrder.indexOf(active);
    const previous = sectionOrder[index - 1];
    if (previous) pulse(spineId(previous, active), { delay: 0.15 });
  }, [active]);

  return null;
}
