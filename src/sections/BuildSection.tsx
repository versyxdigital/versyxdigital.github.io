import { Container } from '../components/Container';
import { GitGraph } from '../components/GitGraph';
import { SectionHeader } from '../components/SectionHeader';
import { Terminal } from '../components/Terminal';

export function BuildSection() {
  return (
    <section
      id="build"
      className="relative z-[3] border-t border-[var(--color-border-1)] py-30 max-md:py-20 text-[var(--color-text)]"
    >
      <Container className="relative z-[3] text-center">
        <SectionHeader
          eyebrow="Developer Path"
          icon="fas fa-code-branch"
          title="If you'd rather build from source"
          divider
          align="center"
        />

        <div className="mx-auto mt-2 grid max-w-[1080px] grid-cols-1 gap-5 md:grid-cols-2 max-[900px]:max-w-[560px]">
          <Terminal title="~/mkeditor — setup">
            <span className="t-comment"># Clone the repository</span>{'\n'}
            <span className="t-prompt">$</span> <span className="t-cmd">git clone https://github.com/versyxdigital/mkeditor.git</span>{'\n'}
            <span className="t-out">Cloning into 'mkeditor'...</span>{'\n'}
            {'\n'}
            <span className="t-comment"># Move in and install dependencies</span>{'\n'}
            <span className="t-prompt">$</span> <span className="t-cmd">cd mkeditor</span>{'\n'}
            <span className="t-prompt">$</span> <span className="t-cmd">npm install</span>{'\n'}
            <span className="t-out">added 1247 packages in 38s</span>
          </Terminal>

          <Terminal title="~/mkeditor — build">
            <span className="t-comment"># Build the editor bundle and Electron app</span>{'\n'}
            <span className="t-prompt">$</span> <span className="t-cmd">npm run build-editor</span>{'\n'}
            <span className="t-prompt">$</span> <span className="t-cmd">npm run build-app</span>{'\n'}
            {'\n'}
            <span className="t-comment"># Package an installer for your platform</span>{'\n'}
            <span className="t-prompt">$</span> <span className="t-cmd">npm run make-installer</span>{'\n'}
            {'\n'}
            <span className="t-comment"># Or run it locally with Electron</span>{'\n'}
            <span className="t-prompt">$</span> <span className="t-cmd">npm run serve-app</span>
          </Terminal>

          <div className="col-span-full mx-auto mt-14 max-w-[720px] border-t border-[var(--color-border-1)] pt-8 text-center">
            <span className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-[rgba(77,212,191,0.2)] bg-[rgba(77,212,191,0.08)] px-2.5 py-1 font-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-[var(--color-accent)]">
              Live State
            </span>
            <h3 className="m-0 mb-2 inline-flex items-center gap-2.5 font-sans text-[1.35rem] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--color-text)]">
              <i className="fa-solid fa-code-commit text-base text-[var(--color-accent)]" />
              Changelog
            </h3>
            <p className="m-0 font-mono text-[0.78rem] tracking-[-0.005em] text-[var(--color-text-dim)]">
              Fetched live from the GitHub API when this section scrolls into view.
            </p>
          </div>

          <GitGraph />
        </div>
      </Container>
    </section>
  );
}
