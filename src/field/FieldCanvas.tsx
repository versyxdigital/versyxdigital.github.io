import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { useSystem, type Quality } from '../state/store';
import { qualitySettings } from '../system/env';
import { CubeField } from './CubeField';
import styles from './field.module.css';

const lower: Record<Quality, Quality | null> = { high: 'medium', medium: 'low', low: null };

/**
 * Adaptive quality. Watches real frame times in short windows of wall-clock
 * time and steps the field down a tier when the device cannot hold a smooth
 * rate. Windows are timed, not counted in frames, so a device running at a
 * few frames per second is corrected in seconds rather than minutes.
 *
 * It never steps back up, which avoids oscillating between tiers. If even the
 * lowest tier cannot reach a usable rate, the WebGL field is retired in
 * favour of the static rendering.
 */
function QualityGovernor() {
  const stats = useRef({ frames: 0, elapsed: 0, warmup: 1.2, strikes: 0 });
  useFrame((_, delta) => {
    const s = stats.current;
    // A gap this long is a tab switch or a resume, not a slow frame.
    if (delta > 1) return;
    if (s.warmup > 0) {
      s.warmup -= delta;
      return;
    }
    s.frames++;
    s.elapsed += delta;
    if (s.elapsed < WINDOW_SECONDS) return;
    const average = s.elapsed / s.frames;
    s.frames = 0;
    s.elapsed = 0;

    if (average > 1 / 14) s.strikes += 2; // far too slow: act on this window alone
    else if (average > 1 / 42) s.strikes += 1;
    else s.strikes = Math.max(0, s.strikes - 1);
    if (s.strikes < 2) return;

    const state = useSystem.getState();
    const next = lower[state.quality];
    s.strikes = 0;
    s.warmup = 1;
    if (next) state.setQuality(next);
    else if (average > 1 / 14) state.setWebgl('unavailable');
  });
  return null;
}

const WINDOW_SECONDS = 1.5;

export default function FieldCanvas() {
  const quality = useSystem((s) => s.quality);
  const reducedMotion = useSystem((s) => s.reducedMotion);
  const setWebgl = useSystem((s) => s.setWebgl);
  const [hidden, setHidden] = useState(() => document.hidden);

  useEffect(() => {
    const onVisibility = (): void => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const frameloop = hidden ? 'never' : reducedMotion ? 'demand' : 'always';

  return (
    <div className={styles.field} aria-hidden="true">
      <Canvas
        flat
        linear
        dpr={[1, qualitySettings[quality].dpr]}
        frameloop={frameloop}
        camera={{ fov: 36, near: 0.5, far: 260, position: [-13, 12.5, 38] }}
        gl={{ antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#060606', 1);
          const canvas = gl.domElement;
          canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            setWebgl('unavailable');
          });
          setWebgl('ok');
        }}
      >
        <CubeField quality={quality} />
        {!reducedMotion && <QualityGovernor />}
      </Canvas>
    </div>
  );
}
