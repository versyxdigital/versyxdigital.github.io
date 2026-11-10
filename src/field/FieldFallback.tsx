import { useMemo } from 'react';
import styles from './field.module.css';
import { fieldModes, pickParams } from './modes';
import { baseHeight, cellSeed } from './waveMath';

const GRID = 34;
const TILE_W = 26;
const TILE_H = 13;
const LIFT = 15;

/**
 * Non-WebGL fallback.
 *
 * When a WebGL context is unavailable (or lost) the site still shows the
 * field: the same height function, sampled once on a coarse grid and drawn as
 * a static isometric plot. It is not a picture of the effect — it is the same
 * mathematics through a simpler renderer.
 */
export function FieldFallback() {
  const tiles = useMemo(() => {
    const params = pickParams(fieldModes['section:hero']);
    const phase = 14;
    const out: { key: string; top: string; left: string; right: string; glow: number; shade: number }[] = [];
    // Painter's order: far rows first.
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const x = (i - GRID / 2) * 3;
        const z = (j - GRID / 2) * 3;
        const h = baseHeight(x, z, phase, params);
        const cx = (i - j) * (TILE_W / 2) + (GRID * TILE_W) / 2;
        const cy = (i + j) * (TILE_H / 2) - h * LIFT + 90;
        const w = TILE_W / 2 - 1.2;
        const t = TILE_H / 2 - 0.6;
        const d = 30;
        out.push({
          key: `${i}-${j}`,
          top: `M${cx} ${cy - t}L${cx + w} ${cy}L${cx} ${cy + t}L${cx - w} ${cy}Z`,
          left: `M${cx - w} ${cy}L${cx} ${cy + t}V${cy + t + d}L${cx - w} ${cy + d}Z`,
          right: `M${cx + w} ${cy}L${cx} ${cy + t}V${cy + t + d}L${cx + w} ${cy + d}Z`,
          glow: Math.max(0, Math.min(1, (h / params.amp - 0.25) * 1.4)),
          shade: 0.82 + 0.36 * cellSeed(i, j),
        });
      }
    }
    return out;
  }, []);

  const width = GRID * TILE_W;
  const height = GRID * TILE_H + 200;

  return (
    <div className={styles.fallback} aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMax meet">
        {tiles.map((tile) => (
          <g key={tile.key}>
            <path d={tile.left} fill="#0a0d12" />
            <path d={tile.right} fill="#07090c" />
            <path
              d={tile.top}
              fill={`rgb(${Math.round(22 * tile.shade)}, ${Math.round(28 * tile.shade)}, ${Math.round(36 * tile.shade)})`}
              stroke={tile.glow > 0.05 ? `rgba(39, 220, 235, ${(0.15 + tile.glow * 0.75).toFixed(2)})` : 'rgba(110, 130, 150, 0.16)'}
              strokeWidth="0.7"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
