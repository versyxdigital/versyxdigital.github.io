import { useRef } from 'react';
import { profile } from '../content';
import { pulse, useAnchor, useConnections } from '../schematic/registry';
import { useSystem } from '../state/store';
import { scroll, scrollToSection } from '../system/scroll';
import styles from './Hero.module.css';

/** The field cell the hero's trace is attached to (world x, z). */
const CELL_ROLE = { x: 4.5, z: 15.5 };

export function Hero() {
  const webgl = useSystem((s) => s.webgl);
  const hovered = useRef(false);
  const roleAnchor = useAnchor<HTMLSpanElement>('hero:role');
  const originAnchor = useAnchor<HTMLSpanElement>('hero:origin');

  // One trace from the hero's type to a specific cube. Its end rides the wave.
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
    ];
  }, []);

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
          <span>
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
          <span className={styles.roleText}>{profile.descriptor}</span>
          <span ref={roleAnchor} className={styles.roleNode} aria-hidden="true" />
        </p>

        <p className={styles.intro}>{profile.intro}</p>

        <div className={styles.actions}>
          <a className={styles.action} href="#projects" onClick={go('projects')}>
            <span className={styles.actionNode} aria-hidden="true" />
            See our projects
          </a>
          <a className={`${styles.action} ${styles.actionQuiet}`} href="#contact" onClick={go('contact')}>
            <span className={styles.actionNode} aria-hidden="true" />
            Get in touch
          </a>
        </div>
      </div>

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
              <span className={styles.hintFine}>Move your cursor. The background reacts.</span>
              <span className={styles.hintCoarse}>Scroll to explore.</span>
            </>
          ) : (
            <span>Scroll to explore.</span>
          )}
        </p>
      </div>
    </section>
  );
}
