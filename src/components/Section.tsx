import type { ReactNode } from 'react';
import { useAnchor } from '../schematic/registry';
import type { SectionId } from '../state/store';
import styles from './Section.module.css';
import { useReveal } from './useReveal';

interface SectionProps {
  id: SectionId;
  /** Two-digit section index shown in the rule, e.g. "01". */
  index: string;
  /** Short mono label, e.g. "About". */
  label: string;
  /** Omit when the section places its own heading (it must then render an element with id `<id>-title`). */
  title?: ReactNode;
  lede?: ReactNode;
  /** Right-hand annotation in the rule. */
  meta?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared frame for every section after the hero: a measured rule carrying the
 * section identifier, then the title. The rule's index marker is a schematic
 * anchor, so sections can route traces from their heading into their content.
 */
export function Section({ id, index, label, title, lede, meta, children, className }: SectionProps) {
  const ref = useReveal<HTMLElement>();
  const anchor = useAnchor<HTMLSpanElement>(`head:${id}`);
  return (
    <section id={id} ref={ref} className={`${styles.section} ${className ?? ''}`} aria-labelledby={`${id}-title`}>
      <div className={styles.inner}>
        <header className={styles.header} data-bare={title === undefined}>
          <div className={styles.rule} data-reveal>
            <span className={`mono ${styles.index}`}>
              <span ref={anchor} className={styles.node} aria-hidden="true" />
              {index}
            </span>
            <span className={`mono ${styles.label}`}>{label}</span>
            <span className={styles.ticks} aria-hidden="true" />
            {meta && <span className={`mono ${styles.meta}`}>{meta}</span>}
          </div>
          {title !== undefined && (
            <div className={styles.heading}>
              <h2 id={`${id}-title`} className={styles.title} data-reveal style={{ '--i': 1 } as React.CSSProperties}>
                {title}
              </h2>
              {lede && (
                <p className={styles.lede} data-reveal style={{ '--i': 2 } as React.CSSProperties}>
                  {lede}
                </p>
              )}
            </div>
          )}
        </header>
        {children}
      </div>
    </section>
  );
}
