import { Container } from '../components/Container';
import { ZoomableImg } from '../components/ImageModal';
import { SectionHeader } from '../components/SectionHeader';

export function SettingsSection() {
  return (
    <section id="settings" className="relative z-[3] py-30 max-md:py-20 text-[var(--color-text)]">
      <Container className="relative z-[3] text-center md:text-left">
        <div className="mb-10 text-center">
          <SectionHeader
            eyebrow="Personalize"
            icon="far fa-window-restore"
            title="Configure Settings"
            tip={
              <>
                Tip: Open settings via the{' '}
                <i className="fas fa-cogs mx-1 text-[var(--color-accent)]" />
                {' '}icon in the app toolbar.
              </>
            }
            subtitle="Customize to your style"
            align="center"
          />
        </div>

        <div className="media-glow relative mx-auto max-w-[1080px]">
          <ZoomableImg
            src="/assets/img/settings.webp"
            alt="Screenshot of MKEditor settings"
            className="relative z-[1] mx-auto block h-auto max-w-full rounded-md border border-[var(--color-border-2)] shadow-lg transition-[transform,border-color] duration-250 hover:-translate-y-[3px] hover:border-[var(--color-border-3)]"
          />
        </div>
      </Container>
    </section>
  );
}
