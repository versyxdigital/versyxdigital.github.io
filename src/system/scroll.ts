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
  window.addEventListener('wheel', onWheel, { passive: false });
  // Layout shifts after fonts and lazy content settle.
  const observer = new ResizeObserver(onResize);
  observer.observe(document.body);
  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('wheel', onWheel);
    observer.disconnect();
  };
}

/** The screens where each section is exactly one screen tall (see global.css). */
const FIT = '(min-width: 1081px) and (min-height: 760px)';
let wheelLockedUntil = 0;

/** True when something under the pointer can still scroll its own content that way. */
function innerScrollerWants(target: EventTarget | null, deltaY: number): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.documentElement && el !== document.body) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 1) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') {
        const atTop = el.scrollTop <= 0;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * One movement of the wheel goes to the next or previous section. CSS snapping
 * alone pulls a short scroll back to where it started, which feels stuck.
 */
function onWheel(event: WheelEvent): void {
  if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  if (!window.matchMedia(FIT).matches || document.body.style.overflow === 'hidden') return;
  if (innerScrollerWants(event.target, event.deltaY)) return;
  event.preventDefault();
  const now = performance.now();
  if (now < wheelLockedUntil || Math.abs(event.deltaY) < 4) return;

  // The section currently filling the screen is the one whose top is nearest the top edge.
  let current = 0;
  let nearest = Infinity;
  sectionOrder.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const distance = Math.abs(el.getBoundingClientRect().top);
    if (distance < nearest) {
      nearest = distance;
      current = i;
    }
  });
  const next = sectionOrder[current + (event.deltaY > 0 ? 1 : -1)];
  // Long enough to swallow the tail of a trackpad swipe.
  wheelLockedUntil = now + 1000;
  if (next) scrollToSection(next);
}

export function scrollToSection(id: SectionId): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = useSystem.getState().reducedMotion;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}
