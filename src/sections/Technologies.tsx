import { Section } from '../components/Section';
import { TechChip } from '../components/TechChip';
import { Constellation, Glyph } from '../constellation/Constellation';
import {
  categories,
  categoryById,
  projectById,
  projectsUsing,
  relatedTo,
  roleById,
  rolesUsing,
  techById,
  techEdges,
  technologies,
  type TechCategory,
} from '../content';
import { useAnchor, useConnections } from '../schematic/registry';
import { focusedTech, useSystem } from '../state/store';
import { scrollToSection } from '../system/scroll';
import styles from './Technologies.module.css';

const originLabel = {
  skills: 'Listed under skills',
  project: 'From a project stack',
  experience: 'From the experience record',
} as const;

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
      <p className={`mono ${styles.panelTag}`}>{category ? category.tag : 'Network'}</p>
      <h3 className={styles.panelTitle}>{category ? category.label : 'How to read this'}</h3>
      <p className={styles.panelText}>
        {category
          ? category.blurb
          : 'Every node is a technology from the published record. Lines are structural: a framework and the language it is written in, a tool and the platform it runs on.'}
      </p>
      <dl className={styles.stats}>
        <div>
          <dt className="mono">Nodes</dt>
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
        <li>Hover a node to trace what it connects to.</li>
        <li>Select one to pull its neighbourhood into focus.</li>
        <li>Node size follows connectivity in this record. It is not a proficiency score.</li>
      </ul>
    </div>
  );
}

function TechDetail({ id }: { id: string }) {
  const tech = techById.get(id);
  const selected = useSystem((s) => s.selectedTech === id);
  const selectTech = useSystem((s) => s.selectTech);
  const selectProject = useSystem((s) => s.selectProject);
  if (!tech) return null;
  const category = categoryById.get(tech.category);
  const usedIn = projectsUsing(id);
  const roles = rolesUsing(id);
  const related = relatedTo(id);

  return (
    <div className={styles.panelBody} key={id}>
      <p className={`mono ${styles.panelTag}`} data-tone={category?.tone}>
        {category?.label} · {tech.role}
      </p>
      <h3 className={styles.panelTitle}>{tech.name}</h3>
      <p className={styles.panelText}>{tech.summary}</p>

      <div className={styles.block}>
        <h4 className="mono">In use</h4>
        {tech.usage ? (
          <p className={styles.usage}>{tech.usage}</p>
        ) : (
          <p className={styles.muted}>No public project links to this yet. Most production work is under NDA.</p>
        )}
      </div>

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

      {roles.length > 0 && (
        <div className={styles.block}>
          <h4 className="mono">Roles</h4>
          <p className={styles.muted}>
            {roles
              .map((rid) => roleById.get(rid))
              .filter((r) => r !== undefined)
              .map((r) => `${r.organisation}, ${r.period}`)
              .join(' · ')}
          </p>
        </div>
      )}

      {selected && related.length > 0 && (
        <div className={styles.block}>
          <h4 className="mono">Connected to</h4>
          <div className={styles.chips}>
            {related.map((other) => (
              <TechChip key={other} id={other} />
            ))}
          </div>
        </div>
      )}

      <p className={`mono ${styles.origin}`}>
        {originLabel[tech.origin]}
        {selected ? (
          <button type="button" className={`mono ${styles.release}`} onClick={() => selectTech(null)}>
            Release focus
          </button>
        ) : (
          <span>Select to focus</span>
        )}
      </p>
    </div>
  );
}

export function Technologies() {
  const focus = useSystem((s) => focusedTech(s));
  const selected = useSystem((s) => s.selectedTech);
  const panel = useAnchor<HTMLElement>('tech:panel');

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
              level: (s) => (s.activeSection === 'tech' ? 0.9 : 0),
              ambient: 5,
            },
          ]
        : [],
    [selected],
  );

  return (
    <Section
      id="tech"
      index="02"
      label="Technologies"
      meta={`${technologies.length} nodes · ${techEdges.length} links`}
      title={
        <>
          Stack and tooling, <em>as a network.</em>
        </>
      }
      lede="Polyglot by necessity, opinionated by experience. The graph is built from the same data as the projects below, so the relationships shown are the ones that exist."
    >
      <div data-reveal>
        <Filters />
      </div>
      <div className={styles.stage} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
        <Constellation />
        <aside ref={panel} className={styles.panel} aria-label="Technology detail" data-active={focus !== null}>
          {focus ? <TechDetail id={focus} /> : <Overview />}
        </aside>
      </div>
    </Section>
  );
}
