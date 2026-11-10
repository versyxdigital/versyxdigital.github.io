import { useEffect, useRef, useState } from 'react';
import { Pending } from '../components/Pending';
import { TechChip } from '../components/TechChip';
import { isPending, type Maybe, type Project } from '../content';
import { fieldModes } from '../field/modes';
import { useAnchor } from '../schematic/registry';
import { useSystem } from '../state/store';
import { Diagram, diagramWidth } from './Diagram';
import styles from './Inspector.module.css';

type Tab = 'architecture' | 'overview' | 'engineering' | 'stack';
const tabs: { id: Tab; label: string }[] = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'overview', label: 'Overview' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'stack', label: 'Stack & links' },
];

const linkGlyph = { live: '↗', source: '</>', docs: '§' } as const;

function ListOrPending({ value, label }: { value: Maybe<string[]>; label: string }) {
  if (isPending(value)) return <Pending value={value} label={label} />;
  return (
    <ul className={styles.list}>
      {value.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * The project inspector: the focused state of the system explorer.
 *
 * It is one panel sized to the space it is given, so on desktop a project
 * never runs off the screen. The header says what the project is; the tabs
 * hold everything else, starting with the architecture diagram. Only the tab
 * body scrolls, and only when a tab has more to say than fits.
 */
export function Inspector({ project, onClose }: { project: Project; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('architecture');
  const [stage, setStage] = useState<string | null>(null);
  const transition = useSystem((s) => s.transition);
  const anchor = useAnchor<HTMLElement>('inspector');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setTab('architecture');
    setStage(null);
    // Move focus into the inspector so keyboard and screen-reader users land on it.
    headingRef.current?.focus({ preventScroll: true });
  }, [project.id]);

  const activeStage = project.diagram.nodes.find((n) => n.id === stage);

  const onTabKey = (event: React.KeyboardEvent, index: number): void => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    setTab(tabs[next]!.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <article
      ref={anchor}
      className={styles.inspector}
      data-tone={project.tone}
      data-phase={transition}
      aria-labelledby={`inspect-${project.id}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <header className={styles.head}>
        <div>
          <p className={`mono ${styles.ref}`}>
            {project.ref} <span>· {project.kind}</span>
          </p>
          <h3 id={`inspect-${project.id}`} ref={headingRef} tabIndex={-1} className={styles.name}>
            {project.name}
          </h3>
          <p className={styles.tagline}>{project.tagline}</p>
        </div>
        <div className={styles.headActions}>
          {project.links.map((link) => (
            <a key={link.href} className={`mono ${styles.link}`} href={link.href} target="_blank" rel="noreferrer noopener">
              <span aria-hidden="true">{linkGlyph[link.kind]}</span>
              {link.label}
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          ))}
          <button type="button" className={`mono ${styles.close}`} onClick={onClose}>
            Close <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label={`${project.name} detail`}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${project.id}-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${project.id}-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`mono ${styles.tab}`}
            onClick={() => setTab(t.id)}
            onKeyDown={(event) => onTabKey(event, i)}
          >
            <span className={styles.tabIndex}>{String(i + 1).padStart(2, '0')}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div
        key={tab}
        className={styles.panel}
        data-tab={tab}
        role="tabpanel"
        id={`panel-${project.id}-${tab}`}
        aria-labelledby={`tab-${project.id}-${tab}`}
        tabIndex={0}
      >
        {tab === 'architecture' && (
          <div className={styles.architecture}>
            <figure className={styles.figure}>
              <div className={styles.scroller} tabIndex={0} role="group" aria-label={`${project.name} architecture diagram`}>
                <div className={styles.canvas} style={{ '--natural': `${diagramWidth(project.diagram)}px` } as React.CSSProperties}>
                  <Diagram diagram={project.diagram} tone={project.tone} id={`d-${project.id}`} activeStage={stage} onStage={setStage} />
                </div>
              </div>
              <figcaption className={styles.caption}>
                <span className="mono">Fig. {project.ref.replace('SYS-', '')}</span>
                {project.diagram.caption}
                <span className={`mono ${styles.pan}`} aria-hidden="true">
                  ↔ Pan
                </span>
              </figcaption>
            </figure>

            {/* Small screens: every stage as a button, so nothing depends on panning the drawing. */}
            <div className={styles.stageList} role="group" aria-label="Diagram stages">
              {[...project.diagram.nodes]
                .sort((a, b) => a.col - b.col || a.row - b.row)
                .map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`mono ${styles.stageButton}`}
                    aria-pressed={stage === node.id}
                    onClick={() => setStage(stage === node.id ? null : node.id)}
                  >
                    {node.label}
                  </button>
                ))}
            </div>

            <div className={styles.stage} aria-live="polite" data-open={activeStage !== undefined}>
              {activeStage ? (
                <div key={activeStage.id} className={styles.stageBody}>
                  <div>
                    <p className={styles.stageTitle}>
                      <span className={`mono ${styles.stageKind}`}>{activeStage.kind}</span>
                      {activeStage.label}
                      {activeStage.sub && <span> — {activeStage.sub}</span>}
                    </p>
                    <p className={styles.stageText}>{activeStage.detail}</p>
                  </div>
                  {activeStage.tech && activeStage.tech.length > 0 && (
                    <div className={styles.chips}>
                      {activeStage.tech.map((id) => (
                        <TechChip key={id} id={id} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className={`mono ${styles.stageHint}`}>Select a stage to inspect it</p>
              )}
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <div className={styles.columns}>
            <div className={styles.prose}>
              <p>{project.description}</p>
              <h4 className="mono">Purpose</h4>
              {isPending(project.purpose) ? <Pending value={project.purpose} label="purpose" /> : <p>{project.purpose}</p>}
            </div>
            <dl className={styles.facts}>
              {project.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="mono">{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {tab === 'engineering' && (
          <div className={styles.columns}>
            <div className={styles.prose}>
              <h4 className="mono">Implementation</h4>
              <ListOrPending value={project.implementation} label="implementation" />
            </div>
            <div className={styles.prose}>
              <h4 className="mono">Challenges</h4>
              <ListOrPending value={project.challenges} label="challenges" />
              <h4 className="mono">Outcomes</h4>
              <ListOrPending value={project.achievements} label="outcomes" />
            </div>
          </div>
        )}

        {tab === 'stack' && (
          <div className={styles.columns}>
            <div className={styles.prose}>
              <h4 className="mono">Technologies</h4>
              <div className={styles.chips}>
                {project.technologies.map((id) => (
                  <TechChip key={id} id={id} anchor />
                ))}
              </div>
              <p className={styles.fine}>Select a technology to open it in the constellation.</p>
              <h4 className="mono">Field behaviour · {fieldModes[`project:${project.signature}`].label}</h4>
              <p>{project.signatureNote}</p>
            </div>
            <div className={styles.prose}>
              <h4 className="mono">Links</h4>
              <ul className={styles.links}>
                {project.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noreferrer noopener">
                      <span className="mono">{link.label}</span>
                      <span className={styles.url}>{link.href.replace(/^https?:\/\//, '')}</span>
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <h4 className="mono">Provenance</h4>
              <p className={styles.fine}>
                Details taken from {project.sources.includes('site') ? 'the project’s own site' : ''}
                {project.sources.includes('site') && project.sources.includes('repository') ? ' and ' : ''}
                {project.sources.includes('repository') ? 'the public repository documentation' : ''}.
              </p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
