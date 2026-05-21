import { Container } from '../components/Container';
import { DownloadPill } from '../components/DownloadPill';
import { ZoomableImg } from '../components/ImageModal';
import { SectionHeader } from '../components/SectionHeader';
import { VERSION } from '../data/site';

export function WebSection() {
  return (
    <section id="web" className="relative z-[3] py-30 max-md:py-20 text-[var(--color-text)]">
      <Container className="relative z-[3]">
        <div className="grid items-center gap-12 text-center md:grid-cols-2 md:text-left">
          <div>
            <SectionHeader eyebrow="No Install Needed" icon="fas fa-globe" title="Powered by Web" />
            <p className="mb-4 max-w-[56ch] leading-[1.7] text-[var(--color-text-muted)]">
              MKEditor is also available as a fully-featured web application, allowing you to write,
              preview, and export markdown directly in your browser without installing the desktop app.
              The web version offers the same CommonMark support, live preview renderer, and export
              options as the Electron-based application.
            </p>
            <p className="mb-4 max-w-[56ch] leading-[1.7] text-[var(--color-text-muted)]">
              This makes it ideal for quick edits, collaborative sessions, or working on devices where
              installing software isn't possible. Simply visit the MKEditor web page to start writing
              instantly — no downloads, no setup, just open and go.
            </p>
            <p className="mb-4 max-w-[56ch] text-sm text-[var(--color-text-dim)]">
              <i className="fa-solid fa-circle-info me-1 text-[var(--color-accent)]" />
              The AI assistant is currently available on the desktop app only.
            </p>
            <div className="mt-7 flex justify-center md:justify-start">
              <DownloadPill
                href="/mkeditor/web"
                target="_blank"
                variant="accent"
                iconClass="fa-solid fa-external-link"
                label="Launch MKEditor Web"
                sub={`v${VERSION}`}
              />
            </div>
          </div>

          <div className="media-glow relative block pt-3 md:pt-0">
            <ZoomableImg
              src="/assets/img/demo-dark.webp"
              alt="A screenshot of MKEditor"
              className="relative z-[1] mx-auto block h-auto max-w-full rounded-md border border-[var(--color-border-2)] shadow-lg transition-[transform,border-color] duration-250 hover:-translate-y-[3px] hover:border-[var(--color-border-3)]"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
