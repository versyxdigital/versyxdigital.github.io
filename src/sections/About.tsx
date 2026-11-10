import { Fragment, useEffect, useRef } from 'react';
import { Pending } from '../components/Pending';
import { Section } from '../components/Section';
import { isPending, profile, serviceById, services, type Service } from '../content';
import { pulse, useAnchor, useConnections } from '../schematic/registry';
import { useSystem } from '../state/store';
import { useMediaQuery } from '../system/useMediaQuery';
import { widerThan } from '../system/viewport';
import styles from './About.module.css';
import { ServiceVisual } from './ServiceVisual';

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
  const service = serviceById.get(selectedId) ?? services[0];
  const anchor = useAnchor<HTMLDivElement>('service-record');
  if (!service) return null;

  return (
    <div className={styles.detail} aria-live="polite">
      <div ref={anchor} className={styles.detailInner} key={service.id}>
        <div className={styles.detailText}>
          <p className={`mono ${styles.detailTag}`}>Service {service.tag}</p>
          <h3 className={styles.detailTitle}>{service.name}</h3>
          {isPending(service.summary) ? (
            <div className={styles.detailPending}>
              <Pending value={service.summary} label="service description" />
            </div>
          ) : (
            <p className={styles.detailSummary}>{service.summary}</p>
          )}
        </div>
        {/* A drawing of the service, filling the rest of the panel. */}
        <div className={styles.detailVisual}>
          <ServiceVisual id={service.id} />
        </div>
      </div>
    </div>
  );
}

export function About() {
  const selectedService = useSystem((s) => s.selectedService);
  // On a phone the record opens in place, directly under the service that was
  // tapped, so reading one and choosing the next never means scrolling back up.
  const narrow = useMediaQuery('(max-width: 720px)');
  const busRef = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);

  // Opening one record closes another above it, which moves everything up.
  // Keep the service that was just tapped on screen, under the navigation bar.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!narrow) return;
    const frame = requestAnimationFrame(() => {
      const node = busRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.top < 76 || rect.top > window.innerHeight * 0.7) {
        node.scrollIntoView({ behavior: useSystem.getState().reducedMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedService, narrow]);

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
        // Side by side only: on a phone the record sits directly under its service.
        level: (s) => (s.activeSection === 'about' && widerThan(720) ? 0.85 : 0),
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
      label="About"
      meta={`Est. ${profile.established} · ${profile.location}`}
      title={
        <>
          What we <em>do.</em>
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
            Our services
            <span>Select a service</span>
          </h3>

          <div ref={busRef} className={styles.bus} style={{ '--count': services.length } as React.CSSProperties}>
            {services.map((service, i) => (
              <Fragment key={service.id}>
                <ServiceNode service={service} last={i === services.length - 1} />
                {narrow && selectedService === service.id && <ServiceRecord />}
              </Fragment>
            ))}
          </div>

          {!narrow && <ServiceRecord />}
        </div>
      </div>
    </Section>
  );
}
