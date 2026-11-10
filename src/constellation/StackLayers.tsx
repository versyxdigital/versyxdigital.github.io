import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { categories, degreeOf, technologies, type TechId } from '../content';
import { registerAnchor } from '../schematic/registry';
import { selectHighlight, useSystem } from '../state/store';
import { Glyph } from './Constellation';
import styles from './StackLayers.module.css';

/**
 * The technology network for narrow screens.
 *
 * A node-and-edge graph of this many technologies cannot be read on a phone,
 * so the same data is drawn as a layered stack instead: one layer per group,
 * every technology named and large enough to tap, and one signal rail down
 * the left that joins the layers.
 *
 * Relationships are shown on demand. Tapping a technology lights everything
 * it connects to, in whichever layers those sit; the rail energises between
 * the layers involved and carries a pulse to each one; and the technology's
 * record opens in place, directly under its layer.
 *
 * It reads the same shared state as the constellation, so a technology
 * selected elsewhere on the page arrives here already in focus.
 */
export function StackLayers({ record }: { record: (id: TechId) => ReactNode }) {
  const highlight = useSystem(selectHighlight);
  const selected = useSystem((s) => s.selectedTech);
  const hoverTech = useSystem((s) => s.hoverTech);
  const selectTech = useSystem((s) => s.selectTech);
  const layerEls = useRef(new Map<string, HTMLElement>());

  const layers = useMemo(
    () =>
      categories.map((category) => ({
        category,
        techs: technologies
          .filter((t) => t.category === category.id)
          .sort((a, b) => degreeOf(b.id) - degreeOf(a.id) || a.name.localeCompare(b.name)),
      })),
    [],
  );

  // Which layers the current highlight touches, and the span of rail between them.
  const trace = useMemo(() => {
    const lit = layers.map((layer) => (highlight.active ? layer.techs.filter((t) => highlight.techs.has(t.id)).length : 0));
    const involved = lit.map((count, index) => (count > 0 ? index : -1)).filter((index) => index >= 0);
    const origin = highlight.primaryTech ? layers.findIndex((layer) => layer.techs.some((t) => t.id === highlight.primaryTech)) : -1;
    return {
      lit,
      origin,
      from: involved.length > 0 ? Math.min(...involved) : -1,
      to: involved.length > 0 ? Math.max(...involved) : -1,
      total: lit.reduce((sum, count) => sum + count, 0),
    };
  }, [highlight, layers]);

  // When a record opens, make sure its layer and the record are on screen.
  useEffect(() => {
    if (!selected) return;
    const timer = window.setTimeout(() => {
      const category = technologies.find((t) => t.id === selected)?.category;
      const layer = category ? layerEls.current.get(category) : undefined;
      if (!layer) return;
      const rect = layer.getBoundingClientRect();
      if (rect.top < 72 || rect.bottom > window.innerHeight) {
        layer.scrollIntoView({ behavior: useSystem.getState().reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [selected]);

  return (
    <div className={styles.stack} data-tracing={highlight.active}>
      <p className={`mono ${styles.hint}`} aria-live="polite">
        {highlight.primaryTech && trace.total > 1
          ? `${trace.total - 1} connected across ${trace.lit.filter((n) => n > 0).length} layers`
          : 'Tap a technology to trace what it connects to'}
      </p>

      {layers.map((layer, index) => {
        const { category, techs } = layer;
        const litCount = trace.lit[index] ?? 0;
        const through = trace.from >= 0 && index >= trace.from && index < trace.to;
        const isOrigin = trace.origin === index;
        const selectedHere = selected !== null && techs.some((t) => t.id === selected);
        return (
          <section
            key={category.id}
            ref={(el) => {
              if (el) layerEls.current.set(category.id, el);
              else layerEls.current.delete(category.id);
            }}
            className={styles.layer}
            data-tone={category.tone}
            data-lit={litCount > 0}
            data-through={through}
            data-origin={isOrigin}
            style={{ '--d': trace.origin >= 0 ? Math.abs(index - trace.origin) : 0 } as React.CSSProperties}
            aria-labelledby={`layer-${category.id}`}
          >
            <span className={styles.railNode} aria-hidden="true" />
            <header className={styles.head}>
              <svg className={styles.glyph} viewBox="-10 -10 20 20" width="14" height="14" aria-hidden="true">
                <Glyph category={category.id} r={category.id === 'language' ? 3.6 : 5.5} />
              </svg>
              <h3 id={`layer-${category.id}`} className={`mono ${styles.label}`}>
                {category.label}
              </h3>
              <span className={`mono ${styles.count}`}>
                {highlight.primaryTech && litCount > 0 && !isOrigin ? `${litCount} linked` : techs.length}
              </span>
            </header>

            <ul className={styles.chips}>
              {techs.map((tech) => {
                const state = !highlight.active
                  ? 'rest'
                  : highlight.primaryTech === tech.id
                    ? 'primary'
                    : highlight.techs.has(tech.id)
                      ? 'lit'
                      : 'dim';
                const isSelected = selected === tech.id;
                return (
                  <li key={tech.id}>
                    <button
                      type="button"
                      ref={(el) => registerAnchor(`tech:${tech.id}`, el)}
                      className={styles.chip}
                      data-state={state}
                      data-selected={isSelected}
                      aria-pressed={isSelected}
                      aria-label={`${tech.name}, ${category.label}`}
                      onClick={() => selectTech(isSelected ? null : tech.id)}
                      onPointerEnter={(event) => {
                        if (event.pointerType === 'mouse') hoverTech(tech.id);
                      }}
                      onPointerLeave={() => hoverTech(null)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') selectTech(null);
                      }}
                    >
                      <span className={styles.pip} aria-hidden="true" />
                      {tech.name}
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedHere && selected && (
              <aside className={styles.record} aria-label="Technology detail">
                {record(selected)}
              </aside>
            )}
          </section>
        );
      })}
    </div>
  );
}
