import type { ReactNode } from 'react';
import type { ServiceId } from '../content';
import styles from './ServiceVisual.module.css';

/**
 * A small animated line drawing for each service, shown beside its
 * description. Decorative: the text next to it says what the service is, so
 * the drawings are hidden from assistive technology.
 */

type Tone = 'cyan' | 'blue' | 'violet';

/** A wire, with a signal travelling along it. */
function Wire({ d, tone = 'cyan', dur = 2.8, begin = 0, dashed = false }: { d: string; tone?: Tone; dur?: number; begin?: number; dashed?: boolean }) {
  return (
    <>
      <path className={styles.wire} d={d} data-dashed={dashed} />
      {/* Hidden until its journey starts: a signal with a delay would otherwise wait in the drawing's top-left corner. */}
      <circle r="2.6" className={styles.pulse} data-tone={tone} visibility="hidden">
        <set attributeName="visibility" to="visible" begin={`${begin}s`} fill="freeze" />
        <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={d} />
      </circle>
    </>
  );
}

function Label({ x, y, children, anchor = 'start' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text className={styles.label} x={x} y={y} textAnchor={anchor}>
      {children}
    </text>
  );
}

/** A labelled box. */
function Box({ x, y, w, h = 24, children, hot = false }: { x: number; y: number; w: number; h?: number; children?: ReactNode; hot?: boolean }) {
  return (
    <g>
      <rect className={styles.box} data-hot={hot} x={x} y={y} width={w} height={h} />
      {children !== undefined && (
        <text className={styles.boxText} x={x + w / 2} y={y + h / 2 + 3.5} textAnchor="middle">
          {children}
        </text>
      )}
    </g>
  );
}

/** Interface, services, infrastructure: a request travelling the whole way through. */
function WebApps() {
  return (
    <>
      <Label x={14} y={38}>
        Interface
      </Label>
      <rect className={styles.box} x={14} y={50} width={120} height={122} />
      <path className={styles.wire} d="M14 66 H134" />
      <circle className={styles.dot} cx={24} cy={58} r={2} />
      <circle className={styles.dot} cx={32} cy={58} r={2} />
      <circle className={styles.dot} cx={40} cy={58} r={2} />
      <rect className={styles.fill} x={24} y={76} width={58} height={7} />
      <rect className={styles.fillHot} x={24} y={92} width={100} height={30} />
      <rect className={styles.fill} x={24} y={131} width={46} height={30} />
      <rect className={styles.fill} x={78} y={131} width={46} height={30} />

      <Label x={178} y={38}>
        Services
      </Label>
      <Box x={178} y={52} w={76} h={28} />
      <Box x={178} y={97} w={76} h={28} hot />
      <Box x={178} y={142} w={76} h={28} />
      <path className={styles.wire} d="M216 80 V97 M216 125 V142" />

      <Label x={298} y={38}>
        Infrastructure
      </Label>
      <path className={styles.box} d="M298 62 a38 9 0 0 1 76 0 v36 a38 9 0 0 1 -76 0 z" />
      <path className={styles.wire} d="M298 62 a38 9 0 0 0 76 0 M298 80 a38 9 0 0 0 76 0" />
      <rect className={styles.box} x={298} y={128} width={76} height={44} />
      <path className={styles.wire} d="M298 150 H374" />
      <circle className={styles.dotHot} cx={308} cy={139} r={2} />
      <circle className={styles.dot} cx={308} cy={161} r={2} />
      <rect className={styles.fill} x={318} y={136} width={44} height={6} />
      <rect className={styles.fill} x={318} y={158} width={30} height={6} />

      <Wire d="M134 111 H178" />
      <Wire d="M254 66 H276 V80 H298" tone="blue" begin={0.7} />
      <Wire d="M254 156 H276 V150 H298" tone="violet" begin={1.4} />
    </>
  );
}

/** One hub, with everything that talks through it. */
function Apis() {
  const left: [number, string][] = [
    [44, 'Web'],
    [112, 'Mobile'],
    [180, 'Desktop'],
  ];
  const right: [number, string][] = [
    [44, 'Data'],
    [112, 'Services'],
    [180, 'Partners'],
  ];
  return (
    <>
      {left.map(([y, name], i) => (
        <g key={name}>
          <Box x={14} y={y - 13} w={76} h={26}>
            {name}
          </Box>
          <Wire d={`M90 ${y} L174 ${112 + (y - 112) * 0.18}`} tone={i === 1 ? 'cyan' : 'blue'} begin={i * 0.6} dur={2.4} />
        </g>
      ))}
      {right.map(([y, name], i) => (
        <g key={name}>
          <Box x={310} y={y - 13} w={76} h={26}>
            {name}
          </Box>
          <Wire d={`M226 ${112 + (y - 112) * 0.18} L310 ${y}`} tone={i === 1 ? 'cyan' : 'violet'} begin={0.3 + i * 0.6} dur={2.4} />
        </g>
      ))}
      <circle className={styles.ring} cx={200} cy={112} r={26} />
      <circle className={styles.hub} cx={200} cy={112} r={26} />
      <text className={styles.hubText} x={200} y={116} textAnchor="middle">
        API
      </text>
    </>
  );
}

/** A plan on a drawing grid, with one part under review. */
function Consulting() {
  const grid: ReactNode[] = [];
  for (let x = 20; x <= 380; x += 30) grid.push(<path key={`x${x}`} className={styles.grid} d={`M${x} 20 V200`} />);
  for (let y = 20; y <= 200; y += 30) grid.push(<path key={`y${y}`} className={styles.grid} d={`M20 ${y} H380`} />);
  return (
    <>
      {grid}
      <path className={styles.wire} d="M36 44 H250 M36 39 V49 M250 39 V49" />
      <Label x={143} y={36} anchor="middle">
        Architecture
      </Label>
      <Box x={36} y={64} w={90} h={38}>
        Front end
      </Box>
      <Box x={160} y={64} w={90} h={38}>
        Back end
      </Box>
      <Box x={160} y={142} w={90} h={38} hot>
        Hosting
      </Box>
      <Wire d="M126 83 H160" dur={2.2} />
      <Wire d="M205 102 V142" tone="blue" dur={2.2} begin={0.8} />
      <circle className={styles.review} cx={205} cy={161} r={40} />
      <path className={styles.wireHot} d="M245 161 H286" />
      <rect className={styles.box} x={286} y={122} width={98} height={78} />
      <Label x={296} y={138}>
        Review
      </Label>
      {[152, 168, 184].map((y, i) => (
        <g key={y}>
          <rect className={styles.tick} x={296} y={y - 6} width={9} height={9} />
          <path className={styles.check} d={`M298 ${y - 1.5} l2.2 2.4 l3.8 -4.6`} style={{ animationDelay: `${i * 0.5}s` }} />
          <rect className={styles.fill} x={312} y={y - 4} width={[56, 40, 50][i]} height={5} />
        </g>
      ))}
    </>
  );
}

/** A fault found in the code, fixed and tested. */
function BugFixing() {
  const rows = [118, 86, 150, 104, 64, 132, 96];
  return (
    <>
      <rect className={styles.box} x={14} y={28} width={236} height={172} />
      <path className={styles.wire} d="M14 46 H250" />
      <circle className={styles.dot} cx={25} cy={37} r={2} />
      <circle className={styles.dot} cx={33} cy={37} r={2} />
      <circle className={styles.dot} cx={41} cy={37} r={2} />
      <rect className={styles.bugRow} x={22} y={111} width={220} height={17} />
      {rows.map((w, i) => (
        <g key={i}>
          <text className={styles.lineNo} x={38} y={67 + i * 20} textAnchor="end">
            {i + 1}
          </text>
          <rect className={i === 3 ? styles.bugLine : styles.fill} x={50 + (i % 3 === 1 ? 12 : 0)} y={60 + i * 20} width={w} height={6} />
        </g>
      ))}
      <path className={styles.scan} d="M18 0 H246" />

      <path className={styles.wire} d="M292 62 V164" />
      <circle r="2.6" className={styles.pulse} data-tone="cyan">
        <animateMotion dur="3s" repeatCount="indefinite" path="M292 62 V164" />
      </circle>
      {[
        [62, 'Found'],
        [113, 'Fixed'],
        [164, 'Tested'],
      ].map(([y, name], i) => (
        <g key={name}>
          <circle className={styles.step} cx={292} cy={y as number} r={6} style={{ animationDelay: `${i}s` }} />
          <text className={styles.boxText} x={308} y={(y as number) + 3.5}>
            {name}
          </text>
        </g>
      ))}
    </>
  );
}

/** Work goes in, a model does a step with your tools, and a checked result comes out. */
function Ai() {
  return (
    <>
      <Label x={20} y={66}>
        Your work
      </Label>
      <path className={styles.box} d="M20 78 H62 L76 92 V150 H20 Z" />
      <path className={styles.wire} d="M62 78 V92 H76" />
      <rect className={styles.fill} x={29} y={102} width={38} height={5} />
      <rect className={styles.fill} x={29} y={114} width={30} height={5} />
      <rect className={styles.fill} x={29} y={126} width={36} height={5} />

      <Wire d="M76 112 H170" />
      <circle className={styles.ring} cx={200} cy={112} r={30} />
      <circle className={styles.ring} cx={200} cy={112} r={30} style={{ animationDelay: '1.3s' }} />
      <circle className={styles.hub} cx={200} cy={112} r={30} />
      <path className={styles.spark} d="M200 94 L204.5 107.5 L218 112 L204.5 116.5 L200 130 L195.5 116.5 L182 112 L195.5 107.5 Z" />
      <Label x={200} y={66} anchor="middle">
        AI
      </Label>

      <Wire d="M200 142 V172" tone="violet" dashed dur={2} begin={0.5} />
      <Box x={158} y={172} w={84} h={26}>
        Your tools
      </Box>

      <Wire d="M230 112 H272 V57 H306" tone="blue" begin={0.9} />
      <Wire d="M230 112 H306" begin={1.3} />
      <Wire d="M230 112 H272 V167 H306" tone="violet" begin={1.7} />
      <Box x={306} y={44} w={78} h={26}>
        Draft
      </Box>
      <Box x={306} y={99} w={78} h={26} hot>
        Review
      </Box>
      <Box x={306} y={154} w={78} h={26}>
        Done
      </Box>
    </>
  );
}

const visuals: Record<ServiceId, (() => ReactNode) | undefined> = {
  webapps: WebApps,
  apis: Apis,
  consulting: Consulting,
  bugfixing: BugFixing,
  ai: Ai,
};

export function ServiceVisual({ id }: { id: ServiceId }) {
  const Visual = visuals[id];
  if (!Visual) return null;
  return (
    <svg className={styles.visual} viewBox="0 0 400 220" aria-hidden="true" focusable="false">
      <Visual />
    </svg>
  );
}
