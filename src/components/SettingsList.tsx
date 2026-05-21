import type { ReactNode } from 'react';

type Item = { strong: string; body: ReactNode };

export function SettingsGroup({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="border-t border-[var(--color-border-1)] py-6 first-of-type:border-t-0 first-of-type:pt-2">
      <h4 className="m-0 mb-3.5 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)]">
        {title}
      </h4>
      <ul className="m-0 list-none p-0 text-left">
        {items.map(({ strong, body }, i) => (
          <li
            key={i}
            className="relative mb-3.5 pl-[22px] text-[0.92rem] leading-[1.65] text-[var(--color-text-muted)]"
          >
            <span
              aria-hidden
              className="absolute left-0 top-[0.78em] h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]"
              style={{ boxShadow: '0 0 0 3px rgba(77, 212, 191, 0.12)' }}
            />
            <strong className="mr-0.5 font-semibold text-[var(--color-text)]">{strong}</strong>
            {' '}- {body}
          </li>
        ))}
      </ul>
    </div>
  );
}
