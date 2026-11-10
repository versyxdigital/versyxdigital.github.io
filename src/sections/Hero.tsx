import { useEffect, useRef } from 'react';
import { profile } from '../content';
import { field, projectFieldPoint } from '../field/fieldState';
import { interference, travel } from '../field/waveMath';
import { pulse, registerAnchor, useConnections, useAnchor } from '../schematic/registry';
import { useSystem } from '../state/store';
import { signed, useLiveText } from '../system/liveText';
import { scroll, scrollToSection } from '../system/scroll';
import styles from './Hero.module.css';

/** Field cells the hero's annotations are attached to (world x, z). */
const CELL_ROLE = { x: 4.5, z: 15.5 };
const CELL_A = { x: 19.5, z: 3.5 };
const CELL_B = { x: 16.5, z: 17.5 };

export function Hero() {
  const webgl = useSystem((s) => s.webgl);
  const hovered = useRef(false);
  const roleAnchor = useAnchor<HTMLSpanElement>('hero:role');
  const originAnchor = useAnchor<HTMLSpanElement>('hero:origin');
  const sectionRef = useRef<HTMLElement>(null);
  const annotA = useRef<HTMLDivElement>(null);
  const annotB = useRef<HTMLDivElement>(null);

  // Annotations float beside the cells they describe: each label follows its
  // cube's projected position, so the composition holds at any viewport size.
  useEffect(() => {
    if (webgl !== 'ok') return;
    registerAnchor('hero:annot-a', annotA.current);
    registerAnchor('hero:annot-b', annotB.current);
    const labels = [
      { el: annotA.current, cell: CELL_A, dx: 54, dy: -84 },
      { el: annotB.current, cell: CELL_B, dx: -214, dy: -66 },
    ];
    let frame = 0;
    const place = (): void => {
      frame = requestAnimationFrame(place);
      const section = sectionRef.current;
      if (!section || useSystem.getState().activeSection !== 'hero') return;
      const origin = section.getBoundingClientRect();
      for (const label of labels) {
        if (!label.el || label.el.offsetParent === null) continue;
        const p = projectFieldPoint(label.cell.x, label.cell.z);
        label.el.style.opacity = p.visible ? '1' : '0';
        if (p.visible) {
          label.el.style.transform = `translate3d(${(p.x - origin.left + label.dx).toFixed(1)}px, ${(p.y - origin.top + label.dy).toFixed(1)}px, 0)`;
        }
      }
    };
    frame = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(frame);
      registerAnchor('hero:annot-a', null);
      registerAnchor('hero:annot-b', null);
    };
  }, [webgl]);

  // Traces from the hero's type to specific cubes. Their ends ride the wave.
  useConnections(() => {
    // Present while the hero is on screen, fading out over the first part of its exit.
    const presence = (active: string): number => (active === 'hero' ? Math.max(0, 1 - scroll.heroExit * 2.4) : 0);
    return [
      {
        id: 'hero:role',
        from: { kind: 'anchor', id: 'hero:role', side: 'r', gap: 10 },
        to: { kind: 'field', ...CELL_ROLE },
        route: 'hv',
        tone: 'cyan',
        level: (s) => presence(s.activeSection) * (hovered.current ? 1 : 0.45),
        ambient: 7,
        ripple: 0.8,
      },
      {
        id: 'hero:annot-a',
        from: { kind: 'anchor', id: 'hero:annot-a', side: 'b', at: 0, gap: 0 },
        to: { kind: 'field', ...CELL_A },
        route: 'hv',
        tone: 'blue',
        level: (s) => presence(s.activeSection) * 0.34,
        ambient: 11,
        ripple: 0.5,
      },
      {
        id: 'hero:annot-b',
        from: { kind: 'anchor', id: 'hero:annot-b', side: 'b', at: 1, gap: 0 },
        to: { kind: 'field', ...CELL_B },
        route: 'hv',
        tone: 'violet',
        level: (s) => presence(s.activeSection) * 0.34,
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
    <section id="hero" ref={sectionRef} className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.inner}>
        <p className={`mono ${styles.eyebrow}`}>
          <span>00 — Index</span>
          <span className={styles.coords}>
            Est. {profile.established} · {profile.location}
          </span>
        </p>

        <h1 id="hero-title" className={styles.name}>
          {profile.name.split(' ').map((word) => (
            <span key={word} className={styles.line}>
              <span>{word}</span>
            </span>
          ))}
        </h1>

        <p
          className={styles.role}
          onPointerEnter={energise}
          onPointerLeave={() => {
            hovered.current = false;
          }}
        >
          <span className={styles.roleText}>
            <span>{profile.descriptor}</span>
            <span className={styles.founder}>
              <span className={styles.at}>
                <span className={styles.sep}>· </span>founded by
              </span>{' '}
              {profile.founder.name}
            </span>
          </span>
          <span ref={roleAnchor} className={styles.roleNode} aria-hidden="true" />
        </p>

        <p className={styles.intro}>{profile.intro}</p>

        <div className={styles.actions}>
          <a className={styles.action} href="#projects" onClick={go('projects')}>
            <span className={styles.actionNode} aria-hidden="true" />
            Inspect our systems
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
          <div ref={annotA} className={`mono ${styles.annotation}`}>
            <span className={styles.annotKey}>Travelling Σ</span>
            <span ref={travelValue} className={styles.annotValue} />
          </div>
          <div ref={annotB} className={`mono ${styles.annotation}`}>
            <span className={styles.annotKey}>Interference Σ</span>
            <span ref={interfValue} className={styles.annotValue} />
          </div>
        </div>
      )}

      <div className={styles.foot}>
        <p className={`mono ${styles.hint}`}>
          <span ref={originAnchor} className={styles.hintIcon} aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16">
              <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" />
              <path d="M8 0v3.5M8 12.5V16M0 8h3.5M12.5 8H16" stroke="currentColor" />
            </svg>
          </span>
          {webgl === 'ok' ? (
            <>
              <span className={styles.hintFine}>Move across the field. It responds.</span>
              <span className={styles.hintCoarse}>Scroll. The field follows.</span>
            </>
          ) : (
            <span>Scroll to explore the system.</span>
          )}
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
