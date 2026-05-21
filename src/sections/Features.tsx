import { Container } from '../components/Container';
import { SectionHeader } from '../components/SectionHeader';

type Feature = { icon: string; title: string; body: string };

const FEATURES: Feature[] = [
  {
    icon: 'far fa-file-code',
    title: 'CommonMark Support',
    body: 'Write markdown with confidence, with extra features for alerts, syntax highlighting, codeblock copying, and more.',
  },
  {
    icon: 'far fa-eye',
    title: 'Live Preview',
    body: 'Built-in, resizable HTML preview enhanced with beautiful custom CSS, letting you see output in real time.',
  },
  {
    icon: 'far fa-pen-to-square',
    title: 'Fully Configurable',
    body: 'Switch between light and dark mode, toggle word-wrap, and export your markdown to clean HTML or PDF.',
  },
  {
    icon: 'fa-solid fa-wand-magic-sparkles',
    title: 'AI Assistance',
    body: 'Bring Claude, GPT, or a local Ollama model into the editor. Workspace-aware, with read/write tools and your keys kept secure.',
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="relative z-10 border-t border-b border-[var(--color-border-1)] text-center text-[var(--color-text)] py-30 max-md:py-20"
      style={{
        background:
          'linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.015) 50%, transparent)',
      }}
    >
      <Container className="relative z-[3]">
        <SectionHeader
          eyebrow="MKEditor"
          icon="fas fa-rocket"
          title="Feature Overview"
          divider
          align="center"
        />

        <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="feature-card-wash relative h-full overflow-hidden rounded-md border border-[var(--color-border-1)] bg-[var(--color-surface)] p-7 text-left transition-[border-color,background,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)]"
            >
              <div className="relative z-[1] mb-6 inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--color-border-2)] bg-[var(--color-surface-2)] text-[1.05rem] text-[var(--color-accent)]">
                <i className={f.icon} />
              </div>
              <h3 className="relative z-[1] mb-2.5 font-sans text-[1.05rem] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
                {f.title}
              </h3>
              <p className="relative z-[1] text-[0.92rem] leading-[1.6] text-[var(--color-text-muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
