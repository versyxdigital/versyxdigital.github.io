import type { ReactNode } from 'react';

type Props = {
  title: string;
  children: ReactNode;
  wide?: boolean;
  scrollable?: boolean;
  status?: ReactNode;
  bodyId?: string;
};

export function Terminal({ title, children, wide, scrollable, status, bodyId }: Props) {
  return (
    <figure
      className={[
        'terminal-wash relative m-0 overflow-hidden rounded-md border border-[var(--color-border-2)] text-left transition-[transform,border-color] duration-200 hover:-translate-y-[3px] hover:border-[var(--color-border-3)]',
        wide ? 'col-span-full' : '',
      ].join(' ')}
      style={{
        background: 'rgba(15, 17, 21, 0.55)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        boxShadow:
          '0 30px 80px -30px rgba(0,0,0,0.6), 0 10px 30px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <figcaption
        className="relative z-[1] flex items-center gap-3 border-b px-3.5 py-3"
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <span className="inline-flex items-center gap-1.5" aria-hidden>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#ff5f57', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)', opacity: 0.9 }} />
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#febc2e', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)', opacity: 0.9 }} />
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#28c840', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)', opacity: 0.9 }} />
        </span>
        <span
          className={[
            'flex-1 font-mono text-[0.74rem] tracking-[-0.005em] text-[var(--color-text-dim)]',
            wide ? 'flex-none text-left' : 'text-center mr-12',
          ].join(' ')}
        >
          {title}
        </span>
        {status}
      </figcaption>
      <pre
        id={bodyId}
        className={[
          'relative z-[1] m-0 overflow-x-auto whitespace-pre p-6 font-mono text-[0.84rem] leading-[1.7] text-[var(--color-text)]',
          scrollable ? 'terminal-scroll' : '',
        ].join(' ')}
        style={{ tabSize: 2, background: 'transparent', textShadow: '0 1px 0 rgba(0,0,0,0.25)' }}
      >
        {children}
      </pre>
    </figure>
  );
}
