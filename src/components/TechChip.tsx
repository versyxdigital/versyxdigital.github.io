import { categoryById, techById, type TechId } from '../content';
import { useAnchor } from '../schematic/registry';
import { selectHighlight, useSystem } from '../state/store';
import { scrollToSection } from '../system/scroll';
import styles from './TechChip.module.css';

/**
 * A technology reference outside the constellation. Hovering it drives the
 * same shared state as hovering the node itself; activating it opens that
 * technology in the constellation.
 */
export function TechChip({ id, anchor = false }: { id: TechId; anchor?: boolean }) {
  const tech = techById.get(id);
  const hoverTech = useSystem((s) => s.hoverTech);
  const selectTech = useSystem((s) => s.selectTech);
  const lit = useSystem((s) => {
    const h = selectHighlight(s);
    return h.primaryTech !== null && h.techs.has(id);
  });
  const ref = useAnchor<HTMLButtonElement>(`chip:${id}`);
  if (!tech) return null;
  const tone = categoryById.get(tech.category)?.tone ?? 'cyan';

  return (
    <button
      type="button"
      ref={anchor ? ref : undefined}
      className={styles.chip}
      data-tone={tone}
      data-lit={lit}
      onPointerEnter={() => hoverTech(id)}
      onPointerLeave={() => hoverTech(null)}
      onFocus={() => hoverTech(id)}
      onBlur={() => hoverTech(null)}
      onClick={() => {
        hoverTech(null);
        selectTech(id);
        scrollToSection('tech');
      }}
      title={`Show ${tech.name} in the Technologies section`}
    >
      <span className={styles.pip} aria-hidden="true" />
      {tech.name}
    </button>
  );
}
