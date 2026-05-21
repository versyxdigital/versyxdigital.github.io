import { Container } from '../components/Container';
import { DownloadPill } from '../components/DownloadPill';
import { HeroTyping } from '../components/HeroTyping';
import { ZoomableImg } from '../components/ImageModal';
import { PLATFORMS, REPO_URL, VERSION } from '../data/site';

export function Hero() {
  return (
    <section id="main-section" className="relative overflow-hidden text-center pt-40 pb-20 md:pt-40 md:pb-20 max-md:pt-32 max-md:pb-14">
      <HeroTyping />

      <Container className="relative z-[2]">
        <div className="mx-auto max-w-[780px]">
          <h1 className="mx-auto mb-6 flex items-center justify-center font-sans font-semibold text-[clamp(2.4rem,6vw,4.2rem)] leading-[1.04] tracking-[-0.04em] text-balance text-[var(--color-text)]">
            <img src="/assets/img/icon.png" alt="MKEditor logo" style={{ width: 100 }} />
          </h1>

          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-2)] bg-[var(--color-surface)] py-1 pl-2 pr-3 font-mono text-[0.78rem] font-medium tracking-[-0.005em] text-[var(--color-text-muted)]">
            <span
              className="h-[7px] w-[7px] rounded-full bg-[var(--color-accent)]"
              style={{ boxShadow: '0 0 0 3px rgba(77, 212, 191, 0.18)' }}
            />
            v4 now with AI
          </span>

          <p className="mx-auto mb-10 max-w-[56ch] text-balance text-center leading-[1.55] text-[clamp(1.05rem,1.4vw,1.2rem)] text-[var(--color-text-muted)]">
            Quickly and easily get started writing your markdown documents with MKEditor's rich set of features.
          </p>

          <div className="mb-4 flex flex-wrap justify-center gap-2.5">
            {PLATFORMS.map((p) => (
              <DownloadPill
                key={p.key}
                href={p.href}
                download
                iconClass={p.iconClass}
                label={p.label}
                sub={`${p.format.replace('.', '')} - v${p.version}`}
              />
            ))}
          </div>

          <div className="mb-8 flex justify-center">
            <DownloadPill
              href="/mkeditor/web"
              target="_blank"
              variant="ghost"
              iconClass="fa-solid fa-external-link"
              label="Launch MKEditor Web"
              sub={`v${VERSION}`}
            />
          </div>

          <div className="mx-auto inline-flex flex-col items-center gap-3.5">
            <small className="font-mono text-[0.82rem] text-[var(--color-text-dim)]">
              <span>MIT Licensed ·</span>{' '}
              <a
                href={REPO_URL}
                className="text-[var(--color-text-muted)] underline underline-offset-[3px] decoration-[var(--color-border-2)] hover:text-[var(--color-text)]"
              >
                Source on GitHub
              </a>
            </small>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a href={`${REPO_URL}/actions/workflows/tests.yml`}>
                <img
                  src={`${REPO_URL}/actions/workflows/tests.yml/badge.svg`}
                  alt="Github tests badge"
                  className="h-5 opacity-85 hover:opacity-100 transition-opacity"
                />
              </a>
              <a href={REPO_URL}>
                <img
                  src="https://img.shields.io/github/stars/versyxdigital/mkeditor"
                  alt="GitHub repository stars"
                  className="h-5 opacity-85 hover:opacity-100 transition-opacity"
                />
              </a>
            </div>
          </div>
        </div>

        <div className="relative mx-auto mt-20 max-w-[1100px] px-3 hero-showcase-glow">
          <div className="relative overflow-hidden rounded-lg border border-[var(--color-border-2)] bg-[var(--color-surface)] shadow-lg">
            <ZoomableImg
              src="/assets/img/demo-dark.webp"
              alt="A screenshot of MKEditor"
              className="mx-auto block h-auto max-w-full"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
