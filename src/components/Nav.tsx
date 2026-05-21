import { useScrollState } from '../hooks/useScrollState';
import { Container } from './Container';
import { SUPPORT_URL } from '../data/site';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#ai', label: 'AI' },
  { href: '#settings', label: 'Settings' },
  { href: '#export', label: 'Export' },
  { href: '#shortcuts', label: 'Shortcuts' },
  { href: '#web', label: 'Web' },
];

export function Nav() {
  const { scrolled } = useScrollState();

  return (
    <nav
      className={[
        'fixed inset-x-0 top-0 z-[100] border-b transition-[background,backdrop-filter,border-color,padding] duration-200 ease-out',
        scrolled
          ? 'bg-[rgba(9,9,11,0.72)] backdrop-blur-md backdrop-saturate-150 border-[var(--color-border-1)] py-2.5'
          : 'bg-transparent border-transparent py-3.5',
      ].join(' ')}
    >
      <Container className="flex items-center justify-between gap-6">
        <a href="/" className="inline-flex items-center gap-2.5 text-[0.95rem] font-semibold text-[var(--color-text)]">
          <img src="/logo.png" alt="MKEditor logo." width={36} height={36} className="h-7 w-7 rounded-md" />
        </a>

        <ul className="m-0 flex list-none items-center gap-1.5 p-0">
          {LINKS.map(({ href, label }) => (
            <li key={href} className="max-[880px]:hidden">
              <a
                href={href}
                className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              >
                {label}
              </a>
            </li>
          ))}
          <li className="ml-1.5 max-[880px]:ml-0">
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener"
              aria-label="Support MKEditor"
              title="Support MKEditor"
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(240,168,104,0.5)] bg-[rgba(240,168,104,0.10)] py-1 pl-1 pr-3 text-[var(--color-coffee)] transition-[background,border-color,color] duration-150 ease-out hover:border-[rgba(240,168,104,0.8)] hover:bg-[rgba(240,168,104,0.22)] hover:text-[var(--color-coffee-hi)]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(240,168,104,0.4)] bg-[rgba(240,168,104,0.18)] text-base leading-none">
                <i className="fa-solid fa-mug-hot block leading-none" />
              </span>
              <span className="whitespace-nowrap font-mono text-[0.72rem] tracking-wide">Donate a coffee</span>
            </a>
          </li>
        </ul>
      </Container>
    </nav>
  );
}
