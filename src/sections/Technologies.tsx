import { Section } from '../components/Section';
import { TechChip } from '../components/TechChip';
import { Constellation, Glyph } from '../constellation/Constellation';
import { StackLayers } from '../constellation/StackLayers';
import {
  categories,
  categoryById,
  projectById,
  projectsUsing,
  relatedTo,
  techById,
  techEdges,
  technologies,
  type TechCategory,
} from '../content';
import { useAnchor, useConnections } from '../schematic/registry';
import { focusedTech, useSystem } from '../state/store';
import { scrollToSection } from '../system/scroll';
import { useMediaQuery } from '../system/useMediaQuery';
import { widerThan } from '../system/viewport';
import styles from './Technologies.module.css';

function Filters() {
  const filter = useSystem((s) => s.categoryFilter);
  const setFilter = useSystem((s) => s.setCategoryFilter);
  const selectTech = useSystem((s) => s.selectTech);
  const choose = (category: TechCategory | null) => () => {
    selectTech(null);
    setFilter(category);
  };
  return (
    <div className={styles.filters} role="group" aria-label="Filter by category">
      <button type="button" className={`mono ${styles.filter}`} aria-pressed={filter === null} onClick={choose(null)}>
        All
        <span className={styles.count}>{technologies.length}</span>
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={`mono ${styles.filter}`}
          data-tone={category.tone}
          aria-pressed={filter === category.id}
          onClick={choose(filter === category.id ? null : category.id)}
        >
          <svg className={styles.glyph} viewBox="-10 -10 20 20" width="14" height="14" aria-hidden="true">
            <Glyph category={category.id} r={category.id === 'language' ? 3.6 : 5.5} />
          </svg>
          {category.label}
          <span className={styles.count}>{technologies.filter((t) => t.category === category.id).length}</span>
        </button>
      ))}
    </div>
  );
}

function Overview() {
  const filter = useSystem((s) => s.categoryFilter);
  const category = filter ? categoryById.get(filter) : undefined;
  return (
    <div className={styles.panelBody}>
      <p className={`mono ${styles.panelTag}`}>{category ? 'Category' : 'Guide'}</p>
      <h3 className={styles.panelTitle}>{category ? category.label : 'How to read this'}</h3>
      <p className={styles.panelText}>
        {category
          ? category.blurb
          : 'Each point is a technology we use. A line joins two that work together, such as a framework and the language it is written in.'}
      </p>
      <dl className={styles.stats}>
        <div>
          <dt className="mono">Total</dt>
          <dd>{category ? technologies.filter((t) => t.category === category.id).length : technologies.length}</dd>
        </div>
        <div>
          <dt className="mono">Links</dt>
          <dd>
            {category
              ? techEdges.filter((e) => techById.get(e.a)?.category === category.id || techById.get(e.b)?.category === category.id).length
              : techEdges.length}
          </dd>
        </div>
        <div>
          <dt className="mono">Groups</dt>
          <dd>{category ? 1 : categories.length}</dd>
        </div>
      </dl>
      <ul className={styles.notes}>
        <li>Hover over a technology to see what it works with.</li>
        <li>Select one to read about it and see which of our projects use it.</li>
        <li>A larger point has more connections. Size is not a skill rating.</li>
      </ul>
    </div>
  );
}

/** `compact` drops the list of connected technologies, for views that already show them lit. */
function TechDetail({ id, compact = false }: { id: string; compact?: boolean }) {
  const tech = techById.get(id);
  const selected = useSystem((s) => s.selectedTech === id);
  const selectTech = useSystem((s) => s.selectTech);
  const selectProject = useSystem((s) => s.selectProject);
  if (!tech) return null;
  const category = categoryById.get(tech.category);
  const usedIn = projectsUsing(id);
  const related = relatedTo(id);

  return (
    <div className={styles.panelBody} key={id}>
      <p className={`mono ${styles.panelTag}`} data-tone={category?.tone}>
        {category?.label} · {tech.role}
      </p>
      <h3 className={styles.panelTitle}>{tech.name}</h3>
      <p className={styles.panelText}>{tech.summary}</p>

      {usedIn.length > 0 && (
        <div className={styles.block}>
          <h4 className="mono">Projects</h4>
          <ul className={styles.projectLinks}>
            {usedIn.map((pid) => {
              const project = projectById.get(pid);
              if (!project) return null;
              return (
                <li key={pid}>
                  <button
                    type="button"
                    onClick={() => {
                      selectProject(pid);
                      scrollToSection('projects');
                    }}
                  >
                    <span className="mono">{project.ref}</span>
                    {project.name}
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selected && !compact && related.length > 0 && (
        <div className={styles.block}>
          <h4 className="mono">Works with</h4>
          <div className={styles.chips}>
            {related.map((other) => (
              <TechChip key={other} id={other} />
            ))}
          </div>
        </div>
      )}

      <p className={`mono ${styles.origin}`}>
        {selected ? (
          <button type="button" className={`mono ${styles.release}`} onClick={() => selectTech(null)}>
            Close
          </button>
        ) : (
          <span>Click to keep this open</span>
        )}
      </p>
    </div>
  );
}

export function Technologies() {
  const focus = useSystem((s) => focusedTech(s));
  const selected = useSystem((s) => s.selectedTech);
  const panel = useAnchor<HTMLElement>('tech:panel');
  // A graph of this many nodes cannot be read on a phone: narrow screens get
  // the same data as a layered stack instead.
  const narrow = useMediaQuery('(max-width: 720px)');

  // The selected node is wired to its record in the side panel.
  useConnections(
    () =>
      selected
        ? [
            {
              id: 'tech:panel-link',
              from: { kind: 'anchor', id: `tech:${selected}`, side: 'c', gap: 0 },
              to: { kind: 'anchor', id: 'tech:panel', side: 'l', at: 0.12, gap: 0 },
              route: 'hvh',
              bend: 0.8,
              tone: categoryById.get(techById.get(selected)?.category ?? 'language')?.tone ?? 'cyan',
              // Only while graph and record sit side by side (the 1100px breakpoint in the styles).
              level: (s) => (s.activeSection === 'tech' && widerThan(1100) ? 0.9 : 0),
              ambient: 5,
            },
          ]
        : [],
    [selected],
  );

  return (
    <Section
      id="tech"
      index="03"
      label="Technologies"
      meta={`${technologies.length} technologies`}
      title={
        <>
          The technologies <em>we work with.</em>
        </>
      }
      lede="The languages, frameworks and tools we build with. Select one to see what it is and which of our projects use it."
    >
      {/* One stable wrapper carries the scroll reveal, whichever view is inside it. */}
      <div className={styles.body} data-reveal>
        {narrow ? (
          <StackLayers record={(id) => <TechDetail id={id} compact />} />
        ) : (
          <>
            <Filters />
            <div className={styles.stage}>
              <Constellation />
              <aside ref={panel} className={styles.panel} aria-label="Technology detail" data-active={focus !== null}>
                {focus ? <TechDetail id={focus} /> : <Overview />}
              </aside>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
