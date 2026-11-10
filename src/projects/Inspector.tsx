import { useEffect, useRef, useState } from 'react';
import { Pending } from '../components/Pending';
import { TechChip } from '../components/TechChip';
import { contentConfig, isPending, type Maybe, type Project } from '../content';
import { useAnchor } from '../schematic/registry';
import { useSystem } from '../state/store';
import { Diagram, diagramWidth } from './Diagram';
import styles from './Inspector.module.css';

type Tab = 'architecture' | 'overview' | 'engineering' | 'stack';
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'architecture', label: 'How it works' },
  { id: 'engineering', label: 'How it was built' },
  { id: 'stack', label: 'Technology & links' },
];

const linkGlyph = { live: '↗', source: '</>', docs: '§' } as const;

/** A project with a screenshot opens on it; one without opens on its diagram. */
const firstTab = (project: Project): Tab => (project.images?.length ? 'overview' : 'architecture');

/**
 * The showcase on a project's overview: one screenshot at a time, with small
 * buttons underneath to switch between them when there are several. A video
 * is the last of those buttons; its player loads only when it is chosen.
 */
function Media({ project }: { project: Project }) {
  const images = project.images ?? [];
  const [index, setIndex] = useState(0);
  const image = images[index];
  const count = images.length + (project.video ? 1 : 0);
  return (
    <figure className={styles.shot}>
      {image ? (
        <a href={image.src} target="_blank" rel="noreferrer noopener">
          <img key={image.src} src={image.src} alt={image.alt} width={image.width} height={image.height} decoding="async" />
          <span className="visually-hidden"> (opens full size in a new tab)</span>
        </a>
      ) : (
        project.video && (
          <div className={styles.video}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${project.video.youtubeId}`}
              title={project.video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        )
      )}
      <figcaption className={styles.shotCaption}>
        <span>{image ? image.caption : project.video?.title}</span>
        {image && (
          <span className="mono" aria-hidden="true">
            Select to view full size ↗
          </span>
        )}
      </figcaption>
      {count > 1 && (
        <div className={styles.thumbs} role="group" aria-label="Screenshots and video">
          {images.map((item, i) => (
            <button
              key={item.src}
              type="button"
              className={styles.thumb}
              aria-pressed={index === i}
              aria-label={`Screenshot ${i + 1}${item.caption ? `: ${item.caption}` : ''}`}
              onClick={() => setIndex(i)}
            >
              <img src={item.thumb ?? item.src} alt="" width={item.width} height={item.height} decoding="async" />
            </button>
          ))}
          {project.video && (
            <button
              type="button"
              className={`mono ${styles.thumb}`}
              aria-pressed={index === images.length}
              aria-label={`Video: ${project.video.title}`}
              onClick={() => setIndex(images.length)}
            >
              <span aria-hidden="true">▶ Video</span>
            </button>
          )}
        </div>
      )}
    </figure>
  );
}

/** True when a field has content to show: written, or a placeholder that is switched on. */
const shown = (value: Maybe<unknown>): boolean => !isPending(value) || contentConfig.showPendingFields;

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
 * The project inspector: the open state of the projects section.
 *
 * It is one panel sized to the space it is given, so on desktop a project
 * never runs off the screen. The header says what the project is; the tabs
 * hold everything else. A project with a screenshot opens on its overview,
 * image first; one without opens on its diagram. Only the tab body scrolls,
 * and only when a tab has more to say than fits.
 */
export function Inspector({ project, onClose, focusOnOpen = true }: { project: Project; onClose: () => void; focusOnOpen?: boolean }) {
  const [tab, setTab] = useState<Tab>(() => firstTab(project));
  const [stage, setStage] = useState<string | null>(null);
  const transition = useSystem((s) => s.transition);
  const anchor = useAnchor<HTMLElement>('inspector');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setTab(firstTab(project));
    setStage(null);
    // Move focus into the inspector so keyboard and screen-reader users land on it.
    // Not for the project shown by default on page load: that would pull focus down the page.
    if (focusOnOpen) headingRef.current?.focus({ preventScroll: true });
    // Keyed on the id: the project object itself is stable content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const activeStage = project.diagram.nodes.find((n) => n.id === stage);
  const lead = project.images?.[0];

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
      data-hue={Number(project.ref)}
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
                <span className="mono">Fig. {project.ref}</span>
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
                <p className={styles.stageHint}>
                  {/* In fit mode the figure caption moves here, so the drawing gets its height. */}
                  <span className={styles.hintCaption}>
                    <span className="mono">Fig. {project.ref}</span>
                    {project.diagram.caption}
                  </span>
                  <span className="mono">Select a part of the diagram to read about it</span>
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <div
            className={styles.overview}
            data-image={lead !== undefined}
            data-multi={(project.images?.length ?? 0) + (project.video ? 1 : 0) > 1}
            style={lead ? ({ '--ratio': lead.width / lead.height } as React.CSSProperties) : undefined}
          >
            {lead && <Media project={project} />}
            <div className={styles.prose}>
              <p>{project.description}</p>
              {shown(project.purpose) && (
                <>
                  <h4 className="mono">Purpose</h4>
                  {isPending(project.purpose) ? <Pending value={project.purpose} label="purpose" /> : <p>{project.purpose}</p>}
                </>
              )}
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
          <div className={styles.columns} data-single={!shown(project.challenges) && !shown(project.achievements)}>
            <div className={styles.prose}>
              <h4 className="mono">Implementation</h4>
              <ListOrPending value={project.implementation} label="implementation" />
            </div>
            {(shown(project.challenges) || shown(project.achievements)) && (
              <div className={styles.prose}>
                {shown(project.challenges) && (
                  <>
                    <h4 className="mono">Challenges</h4>
                    <ListOrPending value={project.challenges} label="challenges" />
                  </>
                )}
                {shown(project.achievements) && (
                  <>
                    <h4 className="mono">Outcomes</h4>
                    <ListOrPending value={project.achievements} label="outcomes" />
                  </>
                )}
              </div>
            )}
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
              <p className={styles.fine}>Select a technology to see it in the Technologies section.</p>
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
              <h4 className="mono">Sources</h4>
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
