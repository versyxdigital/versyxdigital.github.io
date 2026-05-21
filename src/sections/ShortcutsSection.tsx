import { Container } from '../components/Container';
import { ZoomableImg } from '../components/ImageModal';
import { SectionHeader } from '../components/SectionHeader';

export function ShortcutsSection() {
  return (
    <section id="shortcuts" className="relative z-[3] py-30 max-md:py-20 text-[var(--color-text)]">
      <Container className="relative z-[3] text-center md:text-left">
        <div className="mb-10 text-center">
          <SectionHeader
            eyebrow="Move Faster"
            icon="fas fa-line-chart"
            title="Editor Shortcuts"
            tip={
              <>
                Tip: View shortcuts via the{' '}
                <i className="fas fa-question-circle mx-1 text-[var(--color-accent)]" />
                {' '}icon in the app toolbar.
              </>
            }
            align="center"
          />
        </div>
        <div className="media-glow relative mx-auto max-w-[1080px]">
          <ZoomableImg
            src="/assets/img/shortcuts.png"
            alt="Screenshot of MKEditor shortcuts"
            className="relative z-10 mx-auto block h-auto max-w-full rounded-md border border-[var(--color-border-2)] shadow-lg transition-[transform,border-color] duration-250 hover:-translate-y-[3px] hover:border-[var(--color-border-3)]"
          />
        </div>
      </Container>
    </section>
  );
}
