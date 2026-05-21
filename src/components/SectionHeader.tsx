import type { ReactNode } from 'react';

type Props = {
  eyebrow?: string;
  icon?: string;
  title: ReactNode;
  tip?: ReactNode;
  subtitle?: ReactNode;
  divider?: boolean;
  align?: 'center' | 'start';
  className?: string;
};

export function SectionHeader({
  eyebrow,
  icon,
  title,
  tip,
  subtitle,
  divider,
  align = 'start',
  className = '',
}: Props) {
  const alignCls = align === 'center' ? 'text-center' : 'text-center md:text-left';
  return (
    <div className={`${alignCls} ${className}`.trim()}>
      {eyebrow && (
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(77,212,191,0.2)] bg-[rgba(77,212,191,0.08)] px-2.5 py-1 font-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-[var(--color-accent)]">
          {eyebrow}
        </span>
      )}
      <h2 className="mb-3.5 font-sans text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--color-text)]">
        {icon && <i className={`${icon} me-2.5 text-[var(--color-accent)]`} />}
        {title}
      </h2>
      {divider && <div className="mx-auto mb-14 h-px w-10 bg-[var(--color-border-2)]" />}
      {tip && (
        <p className="mb-7 font-mono text-sm tracking-[-0.005em] text-[var(--color-text-dim)]">
          {tip}
        </p>
      )}
      {subtitle && (
        <h3 className="mb-7 font-sans text-[1.2rem] font-medium tracking-[-0.015em] text-[var(--color-text-muted)]">
          {subtitle}
        </h3>
      )}
    </div>
  );
}
