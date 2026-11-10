import { useEffect, useMemo } from 'react';
import { Pending } from '../components/Pending';
import { Section } from '../components/Section';
import { TechChip } from '../components/TechChip';
import { earlierCareer, isPending, profile, roleById, roles, type Role } from '../content';
import { pulse, useAnchor, useConnections } from '../schematic/registry';
import { useSystem } from '../state/store';
import styles from './About.module.css';

const FIRST_YEAR = Math.min(...roles.map((r) => r.from));
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function RoleNode({ role, nowYear }: { role: Role; nowYear: number }) {
  const selected = useSystem((s) => s.selectedRole === role.id);
  const hovered = useSystem((s) => s.hoveredRole === role.id);
  const selectRole = useSystem((s) => s.selectRole);
  const hoverRole = useSystem((s) => s.hoverRole);
  const anchor = useAnchor<HTMLSpanElement>(`role:${role.id}`);
  // Grid columns: 1 = the undocumented lead-in, then one column per year.
  const start = role.from - FIRST_YEAR + 2;
  const end = (role.to ?? nowYear + 1) - FIRST_YEAR + 2;

  return (
    <button
      type="button"
      className={styles.role}
      data-track={role.track}
      data-selected={selected}
      data-hovered={hovered}
      data-current={role.to === null}
      style={{ gridColumn: `${start} / ${end}` }}
      aria-pressed={selected}
      onClick={() => selectRole(role.id)}
      onPointerEnter={() => hoverRole(role.id)}
      onPointerLeave={() => hoverRole(null)}
      onFocus={() => hoverRole(role.id)}
      onBlur={() => hoverRole(null)}
    >
      <span className={styles.roleOrg}>{role.organisation}</span>
      <span className={styles.trace} aria-hidden="true">
        <span ref={anchor} className={styles.traceNode} />
      </span>
      <span className={`mono ${styles.roleMeta}`}>
        {role.position} · {role.period}
      </span>
    </button>
  );
}

function RoleDetail() {
  const selectedId = useSystem((s) => s.selectedRole);
  const role = roleById.get(selectedId) ?? roles[0];
  const anchor = useAnchor<HTMLDivElement>('role-detail');
  if (!role) return null;
  return (
    <div className={styles.detail} aria-live="polite">
      <div ref={anchor} className={styles.detailInner} key={role.id}>
        <header className={styles.detailHead}>
          <div>
            <p className={`mono ${styles.detailPeriod}`}>{role.period}</p>
            <h3 className={styles.detailTitle}>
              {role.position} <span>· {role.organisation}</span>
            </h3>
          </div>
          <ul className={styles.sectors} aria-label="Sectors">
            {role.sectors.map((sector) => (
              <li key={sector} className="mono">
                {sector}
              </li>
            ))}
          </ul>
        </header>
        <p className={styles.detailSummary}>{role.summary}</p>
        <ol className={styles.exhibits}>
          {role.exhibits.map((exhibit, i) => (
            <li key={exhibit}>
              <span className={`mono ${styles.numeral}`} aria-hidden="true">
                {NUMERALS[i] ?? i + 1}
              </span>
              {exhibit}
            </li>
          ))}
        </ol>
        <div className={styles.detailTech}>
          <span className={`mono ${styles.detailTechLabel}`}>Technologies</span>
          {isPending(role.technologies) ? (
            <Pending value={role.technologies} label="role technologies" />
          ) : (
            <div className={styles.chips}>
              {role.technologies.map((id) => (
                <TechChip key={id} id={id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function About() {
  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(() => Array.from({ length: nowYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i), [nowYear]);
  const selectedRole = useSystem((s) => s.selectedRole);
  const employment = roles.filter((r) => r.track === 'employment').sort((a, b) => a.from - b.from);
  const venture = roles.filter((r) => r.track === 'venture');

  // The trace from the selected career node into its record.
  useConnections(
    () => [
      {
        id: 'about:role-link',
        from: { kind: 'anchor', id: `role:${selectedRole}`, side: 'c', gap: 0 },
        to: { kind: 'anchor', id: 'role-detail', side: 't', at: 0.06, gap: 0 },
        route: 'vhv',
        bend: 0.62,
        tone: 'cyan',
        level: (s) => (s.activeSection === 'about' ? 0.85 : 0),
        ambient: 6,
      },
      {
        id: 'about:head-link',
        from: { kind: 'anchor', id: 'head:about', side: 'b', gap: 5 },
        to: { kind: 'anchor', id: 'about:specs', side: 'l', at: 0, gap: 0 },
        route: 'vh',
        tone: 'blue',
        level: (s) => (s.activeSection === 'about' ? 0.32 : 0),
        ambient: 9,
      },
    ],
    [selectedRole],
  );

  useEffect(() => {
    pulse('about:role-link', { delay: 0.25 });
  }, [selectedRole]);

  const specs = useAnchor<HTMLDListElement>('about:specs');

  return (
    <Section
      id="about"
      index="01"
      label="About"
      meta="Operator record"
      title={
        <>
          Comfortable owning systems <em>end to end.</em>
        </>
      }
      lede={profile.about[0]}
    >
      <div className={styles.grid}>
        <div className={styles.side}>
          <div className={styles.copy} data-reveal>
            {profile.about.slice(1).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <dl ref={specs} className={styles.specs} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
            {profile.specs.map((spec) => (
              <div key={spec.label} className={styles.spec}>
                <dt className="mono">{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.career} data-reveal style={{ '--i': 2 } as React.CSSProperties}>
          <h3 className={`mono ${styles.careerTitle}`}>
            Career schematic
            <span>Select a node</span>
          </h3>

          <div className={styles.timeline} style={{ '--years': years.length } as React.CSSProperties}>
            <div className={styles.axis} aria-hidden="true">
              <span className={`mono ${styles.axisPre}`}>Earlier</span>
              {years.map((year) => (
                <span key={year} className={`mono ${styles.axisYear}`}>
                  {year}
                </span>
              ))}
            </div>

            <div className={styles.track}>
              <span className={`mono ${styles.trackLabel}`}>Employment</span>
              <span className={styles.earlier} title={earlierCareer.note}>
                <span className={styles.earlierTrace} aria-hidden="true" />
              </span>
              {employment.map((role) => (
                <RoleNode key={role.id} role={role} nowYear={nowYear} />
              ))}
            </div>

            <div className={styles.track}>
              <span className={`mono ${styles.trackLabel}`}>Independent</span>
              {venture.map((role) => (
                <RoleNode key={role.id} role={role} nowYear={nowYear} />
              ))}
            </div>
          </div>

          <p className={styles.earlierNote}>
            <span className="mono">{earlierCareer.label}</span>
            {earlierCareer.note}
          </p>

          <RoleDetail />
        </div>
      </div>
    </Section>
  );
}
