import { useMemo } from 'react';
import type { Diagram as DiagramData, DiagramEdge, DiagramNode, Side, Tone } from '../content';
import { route, toPath, type Pt, type RouteStyle } from '../schematic/routing';
import styles from './Diagram.module.css';

const CELL_W = 184;
const CELL_H = 98;
const NODE_H = 54;
const GAP_X = 24;
const PAD = 10;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxOf = (node: DiagramNode): Box => {
  const span = node.span ?? 1;
  return {
    x: PAD + node.col * CELL_W + GAP_X / 2,
    y: PAD + node.row * CELL_H + (CELL_H - NODE_H) / 2,
    w: span * CELL_W - GAP_X,
    h: NODE_H,
  };
};

const port = (box: Box, side: Side): Pt => {
  switch (side) {
    case 'l':
      return { x: box.x, y: box.y + box.h / 2 };
    case 'r':
      return { x: box.x + box.w, y: box.y + box.h / 2 };
    case 't':
      return { x: box.x + box.w / 2, y: box.y };
    case 'b':
      return { x: box.x + box.w / 2, y: box.y + box.h };
  }
};

const horizontal = (side: Side): boolean => side === 'l' || side === 'r';

interface EdgeGeometry {
  d: string;
  length: number;
  label: { x: number; y: number; anchor: 'middle' | 'start' };
}

function edgePath(edge: DiagramEdge, boxes: Map<string, Box>): EdgeGeometry | null {
  const from = boxes.get(edge.from);
  const to = boxes.get(edge.to);
  if (!from || !to) return null;
  const fromSide = edge.fromSide ?? 'r';
  const toSide = edge.toSide ?? 'l';
  const a = port(from, fromSide);
  const b = port(to, toSide);
  let style: RouteStyle;
  if (horizontal(fromSide) && horizontal(toSide)) style = 'hvh';
  else if (!horizontal(fromSide) && !horizontal(toSide)) style = 'vhv';
  else style = horizontal(fromSide) ? 'hv' : 'vh';
  const pts = route(a, b, style, 0.5, 6);
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  // The label sits on the first run: above a horizontal wire, beside a vertical one.
  const first = pts[0]!;
  const second = pts[1] ?? first;
  const vertical = Math.abs(second.x - first.x) < 0.5;
  const mid = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  const label = vertical ? { x: mid.x + 9, y: mid.y + 3, anchor: 'start' as const } : { x: mid.x, y: mid.y - 7, anchor: 'middle' as const };
  return { d: toPath(pts), length, label };
}

interface DiagramProps {
  diagram: DiagramData;
  tone: Tone;
  /** Unique prefix for SVG ids. */
  id: string;
  /** Non-interactive, dimmed rendering used as a preview. */
  preview?: boolean;
  activeStage?: string | null;
  onStage?: (id: string | null) => void;
}

/**
 * Architecture diagram for a project, generated from its content data.
 * Nodes are stages the visitor can inspect; edges are routed like the site's
 * schematic traces and carry travelling signals in the direction of data flow.
 */
export function Diagram({ diagram, tone, id, preview = false, activeStage = null, onStage }: DiagramProps) {
  const boxes = useMemo(() => new Map(diagram.nodes.map((n) => [n.id, boxOf(n)])), [diagram]);
  const edges = useMemo(
    () => diagram.edges.map((edge) => ({ edge, geometry: edgePath(edge, boxes) })).filter((e) => e.geometry !== null),
    [diagram, boxes],
  );
  const width = diagram.cols * CELL_W + PAD * 2;
  const height = diagram.rows * CELL_H + PAD * 2;
  const marker = `${id}-arrow`;

  return (
    <svg
      className={styles.diagram}
      viewBox={`0 0 ${width} ${height}`}
      data-tone={tone}
      data-preview={preview}
      role={preview ? 'img' : 'group'}
      aria-label={diagram.caption}
    >
      <defs>
        <marker id={marker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M1 1 7 4 1 7" className={styles.arrow} />
        </marker>
      </defs>

      <g aria-hidden="true">
        {edges.map(({ edge, geometry }, i) => {
          if (!geometry) return null;
          const touchesActive = activeStage !== null && (edge.from === activeStage || edge.to === activeStage);
          const seconds = Math.max(1.6, geometry.length / 70);
          return (
            <g
              key={`${edge.from}-${edge.to}`}
              className={styles.edge}
              data-dashed={edge.dashed === true}
              data-active={touchesActive}
              style={{ '--stage': Math.max(boxes.get(edge.from)?.x ?? 0, boxes.get(edge.to)?.x ?? 0) / CELL_W } as React.CSSProperties}
            >
              <path d={geometry.d} className={styles.wire} markerEnd={`url(#${marker})`} markerStart={edge.duplex ? `url(#${marker})` : undefined} />
              {!preview && (
                <path
                  d={geometry.d}
                  pathLength={100}
                  className={styles.flow}
                  style={{ animationDuration: `${seconds}s`, animationDelay: `${-(i * 0.47) % seconds}s` }}
                />
              )}
              {!preview && edge.duplex && (
                <path
                  d={geometry.d}
                  pathLength={100}
                  className={`${styles.flow} ${styles.flowReverse}`}
                  style={{ animationDuration: `${seconds * 1.3}s`, animationDelay: `${-(i * 0.83) % seconds}s` }}
                />
              )}
              {edge.label && !preview && (
                <text className={styles.edgeLabel} x={geometry.label.x} y={geometry.label.y} textAnchor={geometry.label.anchor}>
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {diagram.nodes.map((node) => {
        const box = boxes.get(node.id);
        if (!box) return null;
        const active = activeStage === node.id;
        const interactive = !preview && onStage !== undefined;
        return (
          <g
            key={node.id}
            className={styles.node}
            data-kind={node.kind}
            data-optional={node.optional === true}
            data-active={active}
            style={{ '--stage': node.col } as React.CSSProperties}
            transform={`translate(${box.x} ${box.y})`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? active : undefined}
            aria-label={interactive ? `${node.label}${node.sub ? `, ${node.sub}` : ''}` : undefined}
            onClick={interactive ? () => onStage(active ? null : node.id) : undefined}
            onKeyDown={
              interactive
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onStage(active ? null : node.id);
                    }
                  }
                : undefined
            }
          >
            <rect className={styles.box} width={box.w} height={box.h} />
            {/* Kind markers: stores carry a double rule, sources a heavy leading edge. */}
            {node.kind === 'store' && <path className={styles.mark} d={`M0 5H${box.w}M0 ${box.h - 5}H${box.w}`} />}
            {node.kind === 'source' && <path className={styles.markHeavy} d={`M0 0V${box.h}`} />}
            {node.kind === 'surface' && <path className={styles.markHeavy} d={`M${box.w} 0V${box.h}`} />}
            <path className={styles.corner} d={`M0 7V0H7M${box.w - 7} ${box.h}H${box.w}V${box.h - 7}`} />
            <text className={styles.nodeLabel} x={12} y={node.sub ? 23 : 31}>
              {node.label}
            </text>
            {node.sub && (
              <text className={styles.nodeSub} x={12} y={40}>
                {node.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
