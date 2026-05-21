import { Container } from '../components/Container';
import { SectionHeader } from '../components/SectionHeader';
import { SettingsGroup } from '../components/SettingsList';

export function ExportSection() {
  return (
    <section id="export" className="relative z-[3] py-30 max-md:py-20 text-[var(--color-text)]">
      <Container className="relative z-[3]">
        <div className="grid items-center gap-12 text-center md:grid-cols-2 md:text-left">
          <div>
            <SectionHeader
              eyebrow="Share Anywhere"
              icon="fas fa-file-export"
              title="Export Documents"
              tip={
                <>
                  Tip: Configure exports via the{' '}
                  <i className="fas fa-sliders mx-1 text-[var(--color-accent)]" />
                  {' '}icon in the app toolbar.
                </>
              }
              subtitle="Export your work instantly"
            />

            <SettingsGroup
              title="HTML Export"
              items={[
                {
                  strong: 'Clean HTML',
                  body: "Export your markdown into simple, unstyled HTML that's ready for integration into any website or project.",
                },
                {
                  strong: 'Styled HTML',
                  body: 'Export with the preview CSS and other provider styles embedded, ensuring your content is exported exactly as it looks.',
                },
              ]}
            />
            <SettingsGroup
              title="PDF Export"
              items={[
                {
                  strong: 'Print to PDF',
                  body: 'Generate a polished PDF of your markdown directly from MKEditor, preserving fonts, colors, and spacing.',
                },
                {
                  strong: 'Custom Settings',
                  body: 'Apply background color, font size, and line spacing preferences to tailor your exported PDF to your needs.',
                },
              ]}
            />
          </div>

          <div className="media-glow relative block">
            <img
              src="/assets/img/export-settings.png"
              alt="Screenshot of MKEditor export settings"
              className="relative z-[1] mx-auto block h-auto max-w-full rounded-md border border-[var(--color-border-2)] shadow-lg"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
