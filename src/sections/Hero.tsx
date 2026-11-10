import { useRef } from 'react';
import { profile } from '../content';
import { field } from '../field/fieldState';
import { interference, travel } from '../field/waveMath';
import { pulse, useAnchor, useConnections } from '../schematic/registry';
import { useSystem } from '../state/store';
import { signed, useLiveText } from '../system/liveText';
import { scrollToSection } from '../system/scroll';
import styles from './Hero.module.css';

/** Field cells the hero's annotations are attached to (world x, z). */
const CELL_ROLE = { x: 4.5, z: 15.5 };
const CELL_A = { x: 19.5, z: 3.5 };
const CELL_B = { x: 29.5, z: 19.5 };

const formatLat = (lat: number): string => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
const formatLon = (lon: number): string => `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;

export function Hero() {
  const webgl = useSystem((s) => s.webgl);
  const hovered = useRef(false);
  const roleAnchor = useAnchor<HTMLSpanElement>('hero:role');
  const annotA = useAnchor<HTMLDivElement>('hero:annot-a');
  const annotB = useAnchor<HTMLDivElement>('hero:annot-b');

  // Traces from the hero's type to specific cubes. Their ends ride the wave.
  useConnections(() => {
    const inHero = (active: string): boolean => active === 'hero';
    return [
      {
        id: 'hero:role',
        from: { kind: 'anchor', id: 'hero:role', side: 'r', gap: 10 },
        to: { kind: 'field', ...CELL_ROLE },
        route: 'hv',
        tone: 'cyan',
        level: (s) => (inHero(s.activeSection) ? (hovered.current ? 1 : 0.45) : 0),
        ambient: 7,
        ripple: 0.8,
      },
      {
        id: 'hero:annot-a',
        from: { kind: 'anchor', id: 'hero:annot-a', side: 'b', at: 0, gap: 8 },
        to: { kind: 'field', ...CELL_A },
        route: 'vh',
        tone: 'blue',
        level: (s) => (inHero(s.activeSection) ? 0.34 : 0),
        ambient: 11,
        ripple: 0.5,
      },
      {
        id: 'hero:annot-b',
        from: { kind: 'anchor', id: 'hero:annot-b', side: 'b', at: 0, gap: 8 },
        to: { kind: 'field', ...CELL_B },
        route: 'vh',
        tone: 'violet',
        level: (s) => (inHero(s.activeSection) ? 0.34 : 0),
        ambient: 13,
        ripple: 0.5,
      },
    ];
  }, []);

  const travelValue = useLiveText<HTMLSpanElement>(() =>
    signed(field.params.travel * travel(CELL_A.x, CELL_A.z, field.phase, field.params.freq)),
  );
  const interfValue = useLiveText<HTMLSpanElement>(() =>
    signed(field.params.interf * interference(CELL_B.x, CELL_B.z, field.phase, field.params.freq)),
  );
  const phaseValue = useLiveText<HTMLSpanElement>(() => field.phase.toFixed(1).padStart(6, '0'));
  const instancesValue = useLiveText<HTMLSpanElement>(() => field.instances.toLocaleString('en-GB'));

  const energise = (): void => {
    hovered.current = true;
    pulse('hero:role', { ripple: 1.1 });
  };

  const go = (id: 'projects' | 'contact') => (event: React.MouseEvent) => {
    event.preventDefault();
    scrollToSection(id);
  };

  return (
    <section id="hero" className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.inner}>
        <p className={`mono ${styles.eyebrow}`}>
          <span>00 — Index</span>
          <span className={styles.coords}>
            {formatLat(profile.location.lat)} · {formatLon(profile.location.lon)}
          </span>
        </p>

        <h1 id="hero-title" className={styles.name}>
          <span className={styles.line}>
            <span>Chris</span>
          </span>
          <span className={styles.line}>
            <span>Rowles</span>
          </span>
        </h1>

        <p
          className={styles.role}
          onPointerEnter={energise}
          onPointerLeave={() => {
            hovered.current = false;
          }}
        >
          <span className={styles.roleText}>
            {profile.role} <span className={styles.at}>at</span> {profile.organisation}
          </span>
          <span ref={roleAnchor} className={styles.roleNode} aria-hidden="true" />
        </p>

        <p className={styles.intro}>{profile.intro}</p>

        <div className={styles.actions}>
          <a className={styles.action} href="#projects" onClick={go('projects')}>
            <span className={styles.actionNode} aria-hidden="true" />
            Inspect the systems
          </a>
          <a className={`${styles.action} ${styles.actionQuiet}`} href="#contact" onClick={go('contact')}>
            <span className={styles.actionNode} aria-hidden="true" />
            Get in touch
          </a>
        </div>
      </div>

      {/* Annotations pinned to live cells of the field. Decorative: values are simulation telemetry. */}
      {webgl === 'ok' && (
        <div className={styles.annotations} aria-hidden="true">
          <div ref={annotA} className={`mono ${styles.annotation} ${styles.annotA}`}>
            <span className={styles.annotKey}>Travelling Σ</span>
            <span ref={travelValue} className={styles.annotValue} />
          </div>
          <div ref={annotB} className={`mono ${styles.annotation} ${styles.annotB}`}>
            <span className={styles.annotKey}>Interference Σ</span>
            <span ref={interfValue} className={styles.annotValue} />
          </div>
        </div>
      )}

      <div className={styles.foot}>
        <p className={`mono ${styles.hint}`}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" />
            <path d="M8 0v3.5M8 12.5V16M0 8h3.5M12.5 8H16" stroke="currentColor" />
          </svg>
          <span className={styles.hintFine}>Move across the field. It responds.</span>
          <span className={styles.hintCoarse}>Scroll. The field follows.</span>
        </p>
        {webgl === 'ok' && (
          <p className={`mono ${styles.telemetry}`} aria-hidden="true">
            <span>
              <span ref={instancesValue} /> cubes
            </span>
            <span>1 draw call</span>
            <span>
              t <span ref={phaseValue} />
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
