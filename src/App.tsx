import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { Nav } from './components/Nav';
import { FieldFallback } from './field/FieldFallback';
import { SchematicOverlay } from './schematic/SchematicOverlay';
import { Spine } from './schematic/Spine';
import { About } from './sections/About';
import { Hero } from './sections/Hero';
import { useSystem, type SectionId } from './state/store';
import { startDirector } from './system/director';
import { detectWebgl, initialQuality, prefersReducedMotion, reducedMotionQuery } from './system/env';
import { initScroll } from './system/scroll';
import styles from './App.module.css';

// three.js and the field renderer load as their own chunk, after first paint.
const FieldCanvas = lazy(() => import('./field/FieldCanvas'));

// The sections below the first two screens are their own downloads, fetched
// once the page has painted, so the opening screen has less code to wait for.
const Projects = lazy(() => import('./sections/Projects').then((m) => ({ default: m.Projects })));
const Technologies = lazy(() => import('./sections/Technologies').then((m) => ({ default: m.Technologies })));
const Contact = lazy(() => import('./sections/Contact').then((m) => ({ default: m.Contact })));

/** Holds a section's place (and its id, for links and scrolling) until its code arrives. */
function Later({ id, ready, children }: { id: SectionId; ready: boolean; children: ReactNode }) {
  const placeholder = <section id={id} className={styles.placeholder} aria-hidden="true" />;
  return ready ? <Suspense fallback={placeholder}>{children}</Suspense> : placeholder;
}

export function App() {
  const webgl = useSystem((s) => s.webgl);
  const reducedMotion = useSystem((s) => s.reducedMotion);
  const [below, setBelow] = useState(false);

  // Fetch the lower sections as soon as the browser is idle, or straight away
  // if the visitor scrolls or arrived on a link to one of them.
  useEffect(() => {
    const start = (): void => setBelow(true);
    if (window.location.hash.length > 1) {
      start();
      return;
    }
    const idle = 'requestIdleCallback' in window;
    const handle = idle ? window.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 400);
    window.addEventListener('scroll', start, { once: true, passive: true });
    return () => {
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      window.removeEventListener('scroll', start);
    };
  }, []);

  useEffect(() => {
    const state = useSystem.getState();
    state.setQuality(initialQuality());
    state.setReducedMotion(prefersReducedMotion());
    state.setWebgl(detectWebgl() ? 'ok' : 'unavailable');

    const media = window.matchMedia(reducedMotionQuery);
    const onMotion = (): void => useSystem.getState().setReducedMotion(prefersReducedMotion());
    media.addEventListener('change', onMotion);

    const stopScroll = initScroll();
    const stopDirector = startDirector();
    return () => {
      media.removeEventListener('change', onMotion);
      stopScroll();
      stopDirector();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [reducedMotion]);

  return (
    <>
      <a className="skip-link" href="#about">
        Skip to content
      </a>
      {webgl === 'ok' && (
        <Suspense fallback={null}>
          <FieldCanvas />
        </Suspense>
      )}
      {webgl === 'unavailable' && <FieldFallback />}
      <div className={styles.vignette} aria-hidden="true" />
      <Nav />
      <main className={styles.main}>
        <Hero />
        <About />
        <Later id="projects" ready={below}>
          <Projects />
        </Later>
        <Later id="tech" ready={below}>
          <Technologies />
        </Later>
        <Later id="contact" ready={below}>
          <Contact />
        </Later>
      </main>
      <Spine />
      <SchematicOverlay />
    </>
  );
}
