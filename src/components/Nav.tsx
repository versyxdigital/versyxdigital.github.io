import { useEffect, useRef, useState } from 'react';
import { profile } from '../content';
import { systemClock } from '../field/fieldState';
import { sectionOrder, useSystem, type SectionId } from '../state/store';
import { accentRgb } from '../system/accent';
import { scroll, scrollToSection } from '../system/scroll';
import styles from './Nav.module.css';

const labels: Record<SectionId, string> = {
  hero: 'Home',
  about: 'About',
  clients: 'Our Clients',
  projects: 'Projects',
  tech: 'Technologies',
  contact: 'Contact',
};

/** Numbered by position on the page, so the numbers stay in step when a section is hidden. */
export const sectionMeta = Object.fromEntries(
  (Object.keys(labels) as SectionId[]).map((id) => [id, { index: String(Math.max(0, sectionOrder.indexOf(id))).padStart(2, '0'), label: labels[id] }]),
) as Record<SectionId, { index: string; label: string }>;

const links = sectionOrder.filter((id) => id !== 'hero');

/** Monogram: a single cube, drawn in the same isometric language as the field. */
function Mark() {
  return (
    <svg className={styles.mark} viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <path className={styles.markBody} d="M14 3.5 23 8.6v10.3L14 24 5 18.9V8.6z" fill="none" stroke="var(--line)" />
      <path className={styles.markTop} d="M14 3.5 23 8.6 14 13.7 5 8.6z" />
      <path className={styles.markSpine} d="M14 13.7V24" stroke="var(--blue)" />
      <circle className={styles.markDot} cx="14" cy="13.7" r="1.4" fill="var(--cyan)" />
    </svg>
  );
}

export function Nav() {
  const active = useSystem((s) => s.activeSection);
  const [open, setOpen] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);

  // The logo drifts through the same accent colours as the dot on the hero, in step with it.
  useEffect(() => {
    // Set on the page root too, so anything on the page can use the same drifting colour.
    const paint = (): void => {
      const rgb = accentRgb(systemClock());
      brandRef.current?.style.setProperty('--accent', rgb);
      document.documentElement.style.setProperty('--accent', rgb);
    };
    paint();
    const timer = window.setInterval(paint, 120);
    return () => window.clearInterval(timer);
  }, []);

  // Scroll progress on the rail, written straight to the DOM.
  useEffect(() => {
    let frame = 0;
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      const el = progressRef.current;
      if (el) el.style.transform = `scaleY(${scroll.page.toFixed(4)})`;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const go = (id: SectionId) => (event: React.MouseEvent) => {
    event.preventDefault();
    setOpen(false);
    scrollToSection(id);
    history.replaceState(null, '', id === 'hero' ? window.location.pathname + window.location.search : `#${id}`);
  };

  return (
    <>
      <header className={styles.bar}>
        <a ref={brandRef} className={styles.brand} href="#hero" onClick={go('hero')} aria-label={`${profile.name}, back to top`}>
          <Mark />
          <span className={styles.brandName}>{profile.name}</span>
        </a>

        <nav className={styles.links} aria-label="Sections">
          {links.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={go(id)}
              className={styles.link}
              aria-current={active === id ? 'true' : undefined}
            >
              <span className={`mono ${styles.linkIndex}`}>{sectionMeta[id].index}</span>
              {sectionMeta[id].label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          className={`mono ${styles.menuButton}`}
          aria-expanded={open}
          aria-controls="menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </header>

      <div id="menu" className={styles.menu} data-open={open} hidden={!open}>
        <nav aria-label="Sections, menu">
          {sectionOrder.map((id, i) => (
            <a
              key={id}
              ref={i === 0 ? firstLinkRef : undefined}
              href={`#${id}`}
              onClick={go(id)}
              className={styles.menuLink}
              aria-current={active === id ? 'true' : undefined}
            >
              <span className={`mono ${styles.linkIndex}`}>{sectionMeta[id].index}</span>
              {sectionMeta[id].label}
            </a>
          ))}
        </nav>
      </div>

      {/* Section rail. Decorative duplicate of the navigation above. */}
      <div className={styles.rail} aria-hidden="true">
        <span className={styles.railTrack}>
          <span ref={progressRef} className={styles.railProgress} />
        </span>
        {sectionOrder.map((id) => (
          <button
            key={id}
            type="button"
            tabIndex={-1}
            className={styles.railStop}
            data-active={active === id}
            onClick={() => scrollToSection(id)}
          >
            <span className={`mono ${styles.railLabel}`}>
              {sectionMeta[id].index} {sectionMeta[id].label}
            </span>
            <span className={styles.railTick} />
          </button>
        ))}
      </div>
    </>
  );
}
