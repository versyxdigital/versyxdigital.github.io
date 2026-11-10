import { Suspense, lazy, useEffect } from 'react';
import { Nav } from './components/Nav';
import { FieldFallback } from './field/FieldFallback';
import { SchematicOverlay } from './schematic/SchematicOverlay';
import { Spine } from './schematic/Spine';
import { About } from './sections/About';
import { Contact } from './sections/Contact';
import { Hero } from './sections/Hero';
import { Projects } from './sections/Projects';
import { Technologies } from './sections/Technologies';
import { useSystem } from './state/store';
import { startDirector } from './system/director';
import { detectWebgl, initialQuality, prefersReducedMotion, reducedMotionQuery } from './system/env';
import { initScroll } from './system/scroll';
import styles from './App.module.css';

// three.js and the field renderer load as their own chunk, after first paint.
const FieldCanvas = lazy(() => import('./field/FieldCanvas'));

export function App() {
  const webgl = useSystem((s) => s.webgl);
  const reducedMotion = useSystem((s) => s.reducedMotion);

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
        <Projects />
        <Technologies />
        <Contact />
      </main>
      <Spine />
      <SchematicOverlay />
    </>
  );
}
