import type { AnchorHTMLAttributes } from 'react';

type Variant = 'default' | 'ghost' | 'accent';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  iconClass: string;
  label: string;
  sub: string;
  variant?: Variant;
  download?: boolean;
};

const variantClasses: Record<Variant, string> = {
  default: 'bg-[var(--color-surface)] border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-3)]',
  ghost: 'bg-transparent border-dashed border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-3)]',
  accent: 'bg-[rgba(77,212,191,0.10)] border-[rgba(77,212,191,0.30)] hover:bg-[rgba(77,212,191,0.18)] hover:border-[rgba(77,212,191,0.45)]',
};

export function DownloadPill({ iconClass, label, sub, variant = 'default', className = '', ...rest }: Props) {
  return (
    <a
      {...rest}
      className={[
        'inline-flex items-center gap-3 rounded-md border min-w-[160px] px-4 py-2.5 text-left text-[var(--color-text)] transition-all duration-200 hover:-translate-y-px',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      <i className={`${iconClass} flex-shrink-0 text-[1.35rem] text-[var(--color-text)]`} />
      <div className="min-w-0 leading-[1.2]">
        <p className="m-0 text-sm font-semibold tracking-[-0.01em] text-[var(--color-text)]">{label}</p>
        <p className="mt-0.5 font-mono text-[0.7rem] text-[var(--color-text-dim)]">{sub}</p>
      </div>
    </a>
  );
}
