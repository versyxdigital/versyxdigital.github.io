import { useScrollState } from '../hooks/useScrollState';

export function ScrollTopButton() {
  const { pastHero } = useScrollState();
  if (!pastHero) return null;

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-7 right-7 z-[1050] inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-2)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-md backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-3)] hover:bg-[var(--color-surface-2)]"
    >
      <i className="fa-solid fa-arrow-up text-sm leading-none" />
    </button>
  );
}
