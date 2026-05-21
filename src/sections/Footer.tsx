import { Container } from '../components/Container';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-[3] border-t border-[var(--color-border-1)] bg-[var(--color-bg)] py-16 pb-12 text-sm text-[var(--color-text)]">
      <Container>
        <div className="grid items-end gap-12 md:grid-cols-2">
          <div className="text-[var(--color-text-muted)]">
            <img
              src="/assets/img/icon.png"
              alt="MKEditor logo"
              width={32}
              height={32}
              className="mb-4 block h-8 w-8 rounded-md object-contain"
            />
            <div>
              Open source software. Made with &nbsp;❤️&nbsp; by{' '}
              <a
                href="https://chris.rowles.info"
                className="text-[var(--color-text)] underline underline-offset-[3px] decoration-[var(--color-border-2)] hover:text-[var(--color-accent)]"
              >
                Chris@Versyx
              </a>{' '}
              · ©{year}
            </div>
          </div>

          <div className="flex flex-col gap-2 justify-self-start md:justify-self-end text-left md:text-right font-mono tracking-[-0.005em] text-[var(--color-text-muted)]">
            <span className="mb-2 font-sans text-base font-semibold tracking-[-0.01em] text-[var(--color-text)]">
              ☕ Would you like to hire me?
            </span>
            <hr className="my-1 h-px border-0 bg-[var(--color-border-1)] opacity-100" />
            <span>
              Email:{' '}
              <a
                href="mailto:christopher.rowles@outlook.com"
                className="text-[var(--color-text)] underline underline-offset-[3px] decoration-[var(--color-border-2)] hover:text-[var(--color-accent)]"
              >
                christopher.rowles@outlook.com
              </a>
            </span>
            <span>
              Web:{' '}
              <a
                href="https://chris.rowles.info"
                className="text-[var(--color-text)] underline underline-offset-[3px] decoration-[var(--color-border-2)] hover:text-[var(--color-accent)]"
              >
                https://chris.rowles.info
              </a>
            </span>
            <span>
              Phone:{' '}
              <a
                href="tel:07522267722"
                className="text-[var(--color-text)] underline underline-offset-[3px] decoration-[var(--color-border-2)] hover:text-[var(--color-accent)]"
              >
                +44(0)7522 267 722
              </a>
            </span>
            <div className="mt-2.5 flex items-center justify-start gap-3.5 md:justify-end">
              <a
                href="https://github.com/sentrychris/"
                aria-label="Github"
                className="text-[var(--color-text-dim)] transition-transform duration-150 hover:-translate-y-0.5 hover:text-[var(--color-text)]"
              >
                <i className="fa-brands fa-square-github" style={{ fontSize: '1.4rem' }} />
              </a>
              <a
                href="https://www.linkedin.com/in/chris-rowles/"
                aria-label="LinkedIn"
                className="text-[var(--color-text-dim)] transition-transform duration-150 hover:-translate-y-0.5 hover:text-[var(--color-text)]"
              >
                <i className="fa-brands fa-linkedin" style={{ fontSize: '1.4rem' }} />
              </a>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
