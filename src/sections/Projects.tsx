import { useEffect, useRef } from 'react';
import { Section } from '../components/Section';
import { projectById, projects, type Project } from '../content';
import { Inspector } from '../projects/Inspector';
import { pulse, registry, useAnchor, useConnections } from '../schematic/registry';
import { selectHighlight, useSystem } from '../state/store';
import { widerThan } from '../system/viewport';
import styles from './Projects.module.css';

/** `shown` marks the project on display when none has been chosen yet. */
function IndexItem({ project, shown }: { project: Project; shown: boolean }) {
  const selected = useSystem((s) => s.selectedProject === project.id);
  const hovered = useSystem((s) => s.hoveredProject === project.id);
  // Lit when a technology elsewhere on the page is in focus and this project uses it.
  const lit = useSystem((s) => {
    const h = selectHighlight(s);
    return h.primaryTech !== null && h.projects.has(project.id);
  });
  const selectProject = useSystem((s) => s.selectProject);
  const hoverProject = useSystem((s) => s.hoverProject);
  const anchor = useAnchor<HTMLButtonElement>(`project:${project.id}`);

  return (
    <li>
      <button
        ref={anchor}
        type="button"
        className={styles.item}
        data-tone={project.tone}
        data-selected={selected || shown}
        data-hovered={hovered}
        data-lit={lit}
        aria-pressed={selected || shown}
        aria-controls="inspection-bay"
        onClick={() => selectProject(selected ? null : project.id)}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') hoverProject(project.id);
        }}
        onPointerLeave={() => hoverProject(null)}
        onFocus={() => hoverProject(project.id)}
        onBlur={() => hoverProject(null)}
      >
        <span className={`mono ${styles.itemRef}`}>{project.ref}</span>
        <span className={styles.itemBody}>
          <span className={styles.itemName}>{project.name}</span>
          <span className={styles.itemKind}>{project.kind}</span>
        </span>
        <span className={styles.itemState} aria-hidden="true" />
      </button>
    </li>
  );
}

export function Projects() {
  const selectedId = useSystem((s) => s.selectedProject);
  const hoveredId = useSystem((s) => s.hoveredProject);
  const selectProject = useSystem((s) => s.selectProject);
  const selected = selectedId ? projectById.get(selectedId) : undefined;
  // There is always a project on display: the chosen one, or the first until one is chosen.
  const shown = selected ?? projects[0]!;
  const bay = useAnchor<HTMLDivElement>('bay');
  const bayRef = useRef<HTMLDivElement | null>(null);

  const linked = selectedId ?? hoveredId;
  const tone = (linked && projectById.get(linked)?.tone) || 'cyan';

  // Index entry → bay, and bay → field. The second trace ends in a via, so its
  // pulses surface as ripples under the inspector.
  useConnections(
    () => [
      ...(linked
        ? [
            {
              id: 'projects:index-link',
              from: { kind: 'anchor' as const, id: `project:${linked}`, side: 'r' as const, gap: 0 },
              to: { kind: 'anchor' as const, id: 'bay', side: 'l' as const, at: 0.07, gap: 0 },
              route: 'hvh' as const,
              bend: 0.5,
              tone,
              // Only while catalogue and bay sit side by side (see the 980px breakpoint in the styles).
              level: (s: { activeSection: string; selectedProject: string | null }) =>
                s.activeSection === 'projects' && widerThan(980) ? (s.selectedProject ? 1 : 0.5) : 0,
              ambient: 4,
            },
          ]
        : []),
      {
        id: 'projects:bay-field',
        from: { kind: 'anchor', id: 'bay', side: 'b', at: 0.92, gap: 0 },
        to: { kind: 'via', dx: 34, dy: 46 },
        route: 'vh',
        tone,
        level: (s) => (s.activeSection === 'projects' ? (s.selectedProject ? 0.9 : 0.3) : 0),
        ambient: selectedId ? 3.5 : 9,
        ripple: selectedId ? 0.7 : 0.4,
      },
    ],
    [linked, selectedId, tone],
  );

  useEffect(() => {
    if (!selectedId) return;
    pulse('projects:index-link', { delay: 0.08 });
    pulse('projects:bay-field', { delay: 0.5, ripple: 0.9 });
    // On single-column layouts the bay is below the index: bring it into view.
    const el = bayRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.6 || rect.top < 0) {
      el.scrollIntoView({ behavior: useSystem.getState().reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [selectedId]);

  const close = (): void => {
    // Return focus to the entry that opened the inspector.
    const origin = selectedId ? registry.anchors.get(`project:${selectedId}`) : undefined;
    selectProject(null);
    if (origin instanceof HTMLElement) origin.focus({ preventScroll: true });
    // The page gets much shorter when the inspector closes. Without this the
    // browser clamps the scroll position and the visitor lands in the next section.
    requestAnimationFrame(() => {
      const explorer = bayRef.current?.parentElement;
      if (!explorer) return;
      const rect = explorer.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom < window.innerHeight * 0.5) {
        explorer.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    });
  };

  return (
    <Section
      id="projects"
      index="02"
      label="Projects"
      meta={`${projects.length} projects`}
    >
      <div className={styles.explorer} data-inspecting={selected !== undefined}>
        <div className={styles.index} data-reveal>
          {/* The heading sits above the list, so the project panel starts right under the rule. */}
          <h2 id="projects-title" className={styles.title}>
            Projects <em>we've built.</em>
          </h2>
          <p className={`mono ${styles.indexHead}`}>
            <span>Select a project</span>
          </p>
          <ul data-project-index>
            {projects.map((project) => (
              <IndexItem key={project.id} project={project} shown={selected === undefined && project.id === shown.id} />
            ))}
          </ul>
        </div>

        <div
          id="inspection-bay"
          ref={(el) => {
            bay(el);
            bayRef.current = el;
          }}
          className={styles.bay}
          data-reveal
          style={{ '--i': 1 } as React.CSSProperties}
        >
          <Inspector key={shown.id} project={shown} onClose={close} focusOnOpen={selected !== undefined} />
        </div>
      </div>
    </Section>
  );
}
