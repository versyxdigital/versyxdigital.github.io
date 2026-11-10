import { sectionOrder, useSystem, type SectionId } from '../state/store';

/**
 * Scroll model.
 *
 * `scroll.progress` is a continuous section index (0 = hero … 4 = contact),
 * read by the camera rig every frame. The discrete active section is pushed
 * to the store only when it changes. Native scrolling is never intercepted.
 */
export const scroll = {
  /** Continuous section index. */
  progress: 0,
  /** 0..1 over the whole document. */
  page: 0,
  /** Signed scroll velocity in viewport heights per second, smoothed. */
  velocity: 0,
  /** How far the hero has scrolled away, 0..1. */
  heroExit: 0,
};

let tops: number[] = [];
let lastY = 0;
let lastT = 0;
let heroExit = -1;

function measure(): void {
  tops = sectionOrder.map((id) => {
    const el = document.getElementById(id);
    return el ? el.getBoundingClientRect().top + window.scrollY : 0;
  });
}

function update(): void {
  const vh = window.innerHeight || 1;
  const y = window.scrollY;
  const probe = y + vh * 0.56;
  let index = 0;
  for (let i = 0; i < tops.length; i++) if (probe >= (tops[i] ?? 0)) index = i;
  const start = tops[index] ?? 0;
  const end = tops[index + 1] ?? document.documentElement.scrollHeight;
  const frac = Math.min(1, Math.max(0, (probe - start) / Math.max(1, end - start)));
  scroll.progress = Math.min(sectionOrder.length - 1, index + frac);

  const max = Math.max(1, document.documentElement.scrollHeight - vh);
  scroll.page = Math.min(1, Math.max(0, y / max));

  const now = performance.now();
  const dt = Math.max(1, now - lastT) / 1000;
  const v = (y - lastY) / vh / dt;
  scroll.velocity += (v - scroll.velocity) * 0.25;
  lastY = y;
  lastT = now;

  // How far the hero has scrolled away, 0..1. Drives its scroll-linked exit in CSS.
  const heroEnd = tops[1] ?? vh;
  const exit = Math.min(1, Math.max(0, y / Math.max(1, heroEnd * 0.85)));
  if (Math.abs(exit - heroExit) > 0.002) {
    heroExit = exit;
    scroll.heroExit = exit;
    document.documentElement.style.setProperty('--hero-exit', exit.toFixed(3));
  }

  const active: SectionId = sectionOrder[index] ?? 'hero';
  useSystem.getState().setActiveSection(active);
}

/** Starts scroll tracking. Returns a disposer. */
export function initScroll(): () => void {
  measure();
  update();
  const onScroll = (): void => update();
  const onResize = (): void => {
    measure();
    update();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  // Layout shifts after fonts and lazy content settle.
  const observer = new ResizeObserver(onResize);
  observer.observe(document.body);
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    observer.disconnect();
  };
}

export function scrollToSection(id: SectionId): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = useSystem.getState().reducedMotion;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}
