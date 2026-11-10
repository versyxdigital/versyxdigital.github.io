import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { useSystem, type Quality } from '../state/store';
import { qualitySettings } from '../system/env';
import { CubeField } from './CubeField';
import styles from './field.module.css';

const lower: Record<Quality, Quality | null> = { high: 'medium', medium: 'low', low: null };

/**
 * Adaptive quality. Watches real frame times and steps the field down a tier
 * when the device cannot hold a smooth rate. It never steps back up, which
 * avoids oscillating between tiers.
 */
function QualityGovernor() {
  const stats = useRef({ frames: 0, total: 0, warmup: 90, strikes: 0 });
  useFrame((_, delta) => {
    const s = stats.current;
    if (s.warmup > 0) {
      s.warmup--;
      return;
    }
    // Ignore tab-switch hitches.
    if (delta > 0.25) return;
    s.frames++;
    s.total += delta;
    if (s.frames < 120) return;
    const average = s.total / s.frames;
    s.frames = 0;
    s.total = 0;
    if (average > 1 / 42) s.strikes++;
    else s.strikes = Math.max(0, s.strikes - 1);
    if (s.strikes >= 2) {
      const state = useSystem.getState();
      const next = lower[state.quality];
      if (next) {
        state.setQuality(next);
        s.strikes = 0;
        s.warmup = 120;
      }
    }
  });
  return null;
}

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
          gl.setClearColor('#050608', 1);
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
