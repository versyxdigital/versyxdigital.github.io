import { Container } from '../components/Container';
import { SectionHeader } from '../components/SectionHeader';
import { PLATFORMS } from '../data/site';

export function DownloadSection() {
  return (
    <section
      id="download"
      className="relative z-[3] border-t border-[var(--color-border-1)] py-30 max-md:py-20 text-center text-[var(--color-text)]"
    >
      <Container className="relative z-[3]">
        <SectionHeader
          eyebrow="Native Apps"
          icon="fas fa-download"
          title="Available for Desktop"
          divider
          align="center"
        />

        <div className="mx-auto mt-2 grid max-w-[1080px] gap-5 max-[900px]:max-w-[460px] max-[900px]:grid-cols-1 grid-cols-3">
          {PLATFORMS.map((p) => (
            <div
              key={p.key}
              className={`download-card download-card--${p.key} relative flex flex-col rounded-md border border-[var(--color-border-1)] p-7 pb-6 text-left transition-[border-color,transform] duration-200 hover:-translate-y-[3px] hover:border-[var(--color-border-2)]`}
              style={{
                background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg-elev) 100%)',
              }}
            >
              <div className="mb-6 flex items-center gap-3.5">
                <span
                  className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-2)] bg-[var(--color-surface-2)] text-[1.25rem] text-[var(--color-text)]"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
                >
                  <i className={p.iconClass} />
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <h3 className="m-0 font-sans text-[1.15rem] font-semibold leading-none tracking-[-0.015em] text-[var(--color-text)]">
                    {p.label}
                  </h3>
                  <span className="rounded-md border border-[var(--color-border-2)] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-[0.7rem] font-medium leading-none tracking-[0.02em] text-[var(--color-text-muted)]">
                    {p.format}
                  </span>
                </div>
              </div>
              <p className="mb-6 flex items-center gap-2 border-b border-dashed border-[var(--color-border-1)] pb-6 font-mono text-[0.74rem] tracking-[-0.005em] text-[var(--color-text-dim)]">
                <i className="fa-regular fa-clock text-[0.78rem] text-[var(--color-text-faint)]" />
                Last built: {p.builtOn}
              </p>
              <a
                href={p.href}
                download
                className="group inline-flex w-full items-center justify-between gap-2.5 rounded-md border border-[var(--color-text)] bg-[var(--color-text)] px-4 py-3 font-sans text-sm font-medium tracking-[-0.005em] text-[var(--color-bg)] transition-[background,color,border-color] duration-200 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-fg)]"
              >
                <span className="flex-1 text-left">{p.label} v{p.version}</span>
                <i className="fa-solid fa-arrow-down text-[0.85rem] transition-transform duration-200 group-hover:translate-y-0.5 group-active:translate-y-1" />
              </a>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
