import { Container } from '../components/Container';
import { ZoomableImg } from '../components/ImageModal';
import { SectionHeader } from '../components/SectionHeader';
import { SettingsGroup } from '../components/SettingsList';

export function AISection() {
  return (
    <section id="ai" className="relative z-[3] py-30 max-md:py-20 text-[var(--color-text)]">
      <Container className="relative z-[3]">
        <div className="grid items-center gap-12 text-center md:grid-cols-2 md:text-left">
          <div>
            <SectionHeader
              eyebrow="New in v4"
              icon="fa-solid fa-wand-magic-sparkles"
              title="AI Assistance"
              tip={
                <>
                  Tip: Open the assistant via the{' '}
                  <i className="fa-solid fa-comments mx-1 text-[var(--color-accent)]" />
                  {' '}icon in the app sidebar.
                </>
              }
              subtitle="Work with agents in your editor"
            />

            <SettingsGroup
              title="Configurable Providers"
              items={[
                {
                  strong: 'Anthropic, OpenAI & Ollama',
                  body: 'chat with Claude or GPT using your own API key, or stay fully offline against a local Ollama model.',
                },
                {
                  strong: 'Persisted chats',
                  body: 'every conversation is saved per-provider so you can pick up where you left off.',
                },
              ]}
            />
            <SettingsGroup
              title="Context-Aware & Capable"
              items={[
                {
                  strong: 'Active-file & selection aware',
                  body: "agents see the file you're editing and any text you've highlighted, so answers stay on-topic.",
                },
                {
                  strong: 'Read & write tools',
                  body: 'agents can read, list, and search across your workspace, and (with explicit approval) write or edit files for you.',
                },
              ]}
            />
            <SettingsGroup
              title="Secure by design"
              items={[
                {
                  strong: 'Encrypted key transport',
                  body: (
                    <>
                      provider API keys are encrypted and persisted on-disk with <code>safeStorage</code>.
                    </>
                  ),
                },
                {
                  strong: 'Workspace-scoped access',
                  body: 'every file operation resolves against the open workspace root; symlinks that try to escape are rejected.',
                },
              ]}
            />
          </div>

          <div className="media-glow relative block">
            <ZoomableImg
              src="/assets/img/ai-assistant.webp"
              alt="Screenshot of the MKEditor AI assistant sidebar"
              className="relative z-[1] mx-auto block h-auto max-w-full rounded-md border border-[var(--color-border-2)] shadow-lg transition-[transform,border-color] duration-250 hover:-translate-y-[3px] hover:border-[var(--color-border-3)]"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
