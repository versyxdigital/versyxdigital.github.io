import { useEffect, useRef } from 'react';
import { Section } from '../components/Section';
import { profile, projectById, projects, techById, type Project } from '../content';
import { Diagram } from '../projects/Diagram';
import { Inspector } from '../projects/Inspector';
import { pulse, registry, useAnchor, useConnections } from '../schematic/registry';
import { selectHighlight, useSystem } from '../state/store';
import styles from './Projects.module.css';

function IndexItem({ project }: { project: Project }) {
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
  const stack = project.technologies
    .slice(0, 4)
    .map((id) => techById.get(id)?.name)
    .filter((name) => name !== undefined);

  return (
    <li>
      <button
        ref={anchor}
        type="button"
        className={styles.item}
        data-tone={project.tone}
        data-selected={selected}
        data-hovered={hovered}
        data-lit={lit}
        aria-pressed={selected}
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
          <span className={`mono ${styles.itemStack}`}>{stack.join(' · ')}</span>
        </span>
        <span className={styles.itemState} aria-hidden="true" />
      </button>
    </li>
  );
}

/** Idle state of the bay: a quiet wireframe of whichever system is under the cursor. */
function Standby({ project }: { project: Project }) {
  return (
    <div className={styles.standby}>
      <p className={`mono ${styles.standbyHead}`}>
        <span>Inspection bay · standing by</span>
        <span>
          {project.ref} · {project.name}
        </span>
      </p>
      <div className={styles.standbyCanvas} key={project.id}>
        <Diagram diagram={project.diagram} tone={project.tone} id={`p-${project.id}`} preview />
      </div>
      <p className={styles.standbyText}>
        <strong>{project.tagline}</strong> Select a system on the left to open its architecture, stages and engineering notes.
      </p>
    </div>
  );
}

export function Projects() {
  const selectedId = useSystem((s) => s.selectedProject);
  const hoveredId = useSystem((s) => s.hoveredProject);
  const selectProject = useSystem((s) => s.selectProject);
  const selected = selectedId ? projectById.get(selectedId) : undefined;
  const lastPreview = useRef<Project>(projects[0]!);
  const hoveredProject = hoveredId ? projectById.get(hoveredId) : undefined;
  if (hoveredProject) lastPreview.current = hoveredProject;
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
              level: (s: { activeSection: string; selectedProject: string | null }) =>
                s.activeSection === 'projects' ? (s.selectedProject ? 1 : 0.5) : 0,
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
  };

  return (
    <Section
      id="projects"
      index="03"
      label="Projects"
      meta={`${projects.length} systems catalogued`}
      title={
        <>
          System explorer. <em>Open one up.</em>
        </>
      }
      lede={profile.ndaNote}
    >
      <div className={styles.explorer} data-inspecting={selected !== undefined}>
        <div className={styles.index} data-reveal>
          <p className={`mono ${styles.indexHead}`}>
            <span>Catalogue</span>
            <span>Ref</span>
          </p>
          <ul data-project-index>
            {projects.map((project) => (
              <IndexItem key={project.id} project={project} />
            ))}
          </ul>
          <div className={styles.sealed}>
            <span className={`mono ${styles.itemRef}`}>NDA</span>
            <span className={styles.itemBody}>
              <span className={styles.itemName}>Production systems</span>
              <span className={styles.itemKind}>Under NDA. Available to discuss on request.</span>
            </span>
          </div>
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
          {selected ? <Inspector key={selected.id} project={selected} onClose={close} /> : <Standby project={lastPreview.current} />}
        </div>
      </div>
    </Section>
  );
}
