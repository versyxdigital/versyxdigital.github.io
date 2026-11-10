import { useEffect } from 'react';
import { Pending } from '../components/Pending';
import { Section } from '../components/Section';
import { isPending, profile, projectById, projectsOfService, serviceById, services, type Service } from '../content';
import { pulse, useAnchor, useConnections } from '../schematic/registry';
import { useSystem } from '../state/store';
import { scrollToSection } from '../system/scroll';
import styles from './About.module.css';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function ServiceNode({ service, last }: { service: Service; last: boolean }) {
  const selected = useSystem((s) => s.selectedService === service.id);
  const hovered = useSystem((s) => s.hoveredService === service.id);
  const selectService = useSystem((s) => s.selectService);
  const hoverService = useSystem((s) => s.hoverService);
  const anchor = useAnchor<HTMLSpanElement>(`service:${service.id}`);

  return (
    <button
      type="button"
      className={styles.node}
      data-selected={selected}
      data-hovered={hovered}
      data-last={last}
      aria-pressed={selected}
      onClick={() => selectService(service.id)}
      onPointerEnter={() => hoverService(service.id)}
      onPointerLeave={() => hoverService(null)}
      onFocus={() => hoverService(service.id)}
      onBlur={() => hoverService(null)}
    >
      <span className={`mono ${styles.nodeTag}`}>{service.tag}</span>
      <span className={styles.trace} aria-hidden="true">
        <span ref={anchor} className={styles.traceNode} />
      </span>
      <span className={styles.nodeName}>{service.short}</span>
    </button>
  );
}

function ServiceRecord() {
  const selectedId = useSystem((s) => s.selectedService);
  const selectProject = useSystem((s) => s.selectProject);
  const service = serviceById.get(selectedId) ?? services[0];
  const anchor = useAnchor<HTMLDivElement>('service-record');
  if (!service) return null;
  const examples = projectsOfService(service.id);

  return (
    <div className={styles.detail} aria-live="polite">
      <div ref={anchor} className={styles.detailInner} key={service.id}>
        <p className={`mono ${styles.detailTag}`}>Service · {service.tag}</p>
        <h3 className={styles.detailTitle}>{service.name}</h3>
        {isPending(service.summary) ? (
          <div className={styles.detailPending}>
            <Pending value={service.summary} label="service description" />
          </div>
        ) : (
          <p className={styles.detailSummary}>{service.summary}</p>
        )}

        {/* Evidence and examples sit side by side, so the record stays short. */}
        <div className={styles.recordCols} data-single={service.record.length === 0}>
          {service.record.length > 0 && (
            <div>
              <h4 className={`mono ${styles.blockLabel}`}>On record</h4>
              <ol className={styles.exhibits}>
                {service.record.map((line, i) => (
                  <li key={line}>
                    <span className={`mono ${styles.numeral}`} aria-hidden="true">
                      {NUMERALS[i] ?? i + 1}
                    </span>
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <h4 className={`mono ${styles.blockLabel}`}>In the catalogue</h4>
            {examples.length > 0 ? (
              <ul className={styles.examples}>
                {examples.map((id) => {
                  const project = projectById.get(id);
                  if (!project) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => {
                          selectProject(id);
                          scrollToSection('projects');
                        }}
                      >
                        <span className="mono">{project.ref}</span>
                        <span className={styles.exampleName}>{project.name}</span>
                        <span className={styles.arrow} aria-hidden="true">
                          →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.muted}>Nothing in the public catalogue is tagged to this service yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function About() {
  const selectedService = useSystem((s) => s.selectedService);

  // The trace from the selected service node into its record.
  useConnections(
    () => [
      {
        id: 'about:service-link',
        from: { kind: 'anchor', id: `service:${selectedService}`, side: 'b', gap: 3 },
        to: { kind: 'anchor', id: 'service-record', side: 't', at: 0.04, gap: 0 },
        route: 'vhv',
        bend: 0.82,
        tone: 'cyan',
        level: (s) => (s.activeSection === 'about' ? 0.85 : 0),
        ambient: 6,
      },
    ],
    [selectedService],
  );

  useEffect(() => {
    pulse('about:service-link', { delay: 0.25 });
  }, [selectedService]);

  return (
    <Section
      id="about"
      index="01"
      label="Studio"
      meta={`Est. ${profile.established} · ${profile.location}`}
      title={
        <>
          A small and focused <em>software studio.</em>
        </>
      }
      lede={profile.about[0]}
    >
      <div className={styles.grid}>
        <div className={styles.side}>
          <div className={styles.copy} data-reveal>
            {profile.about.slice(1).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <dl className={styles.specs} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
            {profile.specs.map((spec) => (
              <div key={spec.label} className={styles.spec}>
                <dt className="mono">{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.founder} data-reveal style={{ '--i': 2 } as React.CSSProperties}>
            {profile.founder.note}{' '}
            {profile.founder.links.map((link, i) => (
              <span key={link.href}>
                {i > 0 && ' · '}
                <a href={link.href} target="_blank" rel="noreferrer noopener">
                  {link.label}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              </span>
            ))}
          </p>
        </div>

        <div className={styles.schematic} data-reveal style={{ '--i': 2 } as React.CSSProperties}>
          <h3 className={`mono ${styles.schematicTitle}`}>
            What we do
            <span>Select a node</span>
          </h3>

          <div className={styles.bus} style={{ '--count': services.length } as React.CSSProperties}>
            {services.map((service, i) => (
              <ServiceNode key={service.id} service={service} last={i === services.length - 1} />
            ))}
          </div>

          <ServiceRecord />
        </div>
      </div>
    </Section>
  );
}
