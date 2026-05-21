import { useEffect, useRef } from 'react';
import { REGIONS, SNIPPETS } from '../data/snippets';

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 2.2);
}

function animate(duration: number, onStep: (t: number) => void, onDone?: () => void) {
  const start = performance.now();
  function frame(now: number) {
    const t = Math.min(1, (now - start) / duration);
    onStep(t);
    if (t < 1) requestAnimationFrame(frame);
    else if (onDone) onDone();
  }
  requestAnimationFrame(frame);
}

type Slot = {
  svg: SVGSVGElement;
  clip: SVGRectElement;
  pre: SVGTSpanElement;
  body: SVGTSpanElement;
  post: SVGTSpanElement;
  text: SVGTextElement;
  caret: SVGRectElement;
  region: number;
};

export function HeroTyping() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const N_SLOTS = window.innerWidth < 700 ? 7 : window.innerWidth < 1100 ? 12 : 18;
    const usedRegions = new Set<number>();
    let snippetCursor = Math.floor(Math.random() * SNIPPETS.length);

    function pickFreeRegion() {
      const free: number[] = [];
      for (let i = 0; i < REGIONS.length; i++) if (!usedRegions.has(i)) free.push(i);
      if (!free.length) return -1;
      return free[Math.floor(Math.random() * free.length)];
    }

    function nextSnippet() {
      snippetCursor = (snippetCursor + 1 + Math.floor(Math.random() * (SNIPPETS.length - 1))) % SNIPPETS.length;
      return SNIPPETS[snippetCursor];
    }

    function createSlot(i: number): Slot {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.classList.add('hero-type');
      svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
      svg.setAttribute('viewBox', '0 0 400 26');
      svg.innerHTML =
        `<defs><clipPath id="mdtype-${i}">` +
          `<rect class="hero-type-clip" x="0" y="0" width="0" height="26"></rect>` +
        `</clipPath></defs>` +
        `<g clip-path="url(#mdtype-${i})">` +
          `<text x="0" y="19" class="hero-type-text">` +
            `<tspan class="md-syn md-pre"></tspan>` +
            `<tspan class="md-body"></tspan>` +
            `<tspan class="md-syn md-post"></tspan>` +
          `</text>` +
        `</g>` +
        `<rect class="hero-type-caret" x="0" y="6" width="1.6" height="16"></rect>`;
      container!.appendChild(svg);
      return {
        svg,
        clip: svg.querySelector('.hero-type-clip') as SVGRectElement,
        pre: svg.querySelector('.md-pre') as SVGTSpanElement,
        body: svg.querySelector('.md-body') as SVGTSpanElement,
        post: svg.querySelector('.md-post') as SVGTSpanElement,
        text: svg.querySelector('text') as SVGTextElement,
        caret: svg.querySelector('.hero-type-caret') as SVGRectElement,
        region: -1,
      };
    }

    function placeSlot(slot: Slot) {
      if (slot.region >= 0) usedRegions.delete(slot.region);
      const idx = pickFreeRegion();
      if (idx < 0) return false;
      usedRegions.add(idx);
      slot.region = idx;
      const r = REGIONS[idx];
      slot.svg.style.top = r.top + '%';
      if (r.side === 'left') {
        slot.svg.style.left = r.off + '%';
        slot.svg.style.right = '';
      } else {
        slot.svg.style.right = r.off + '%';
        slot.svg.style.left = '';
      }
      return true;
    }

    function fillSnippet(slot: Slot) {
      const s = nextSnippet();
      slot.pre.textContent = s.pre || '';
      slot.body.textContent = s.body || '';
      slot.post.textContent = s.post || '';
    }

    function measureWidth(slot: Slot) {
      try {
        const w = slot.text.getBBox().width;
        return Math.max(40, Math.ceil(w + 3));
      } catch {
        return 220;
      }
    }

    const timeouts: number[] = [];
    let cancelled = false;

    function runCycle(slot: Slot) {
      if (cancelled) return;
      fillSnippet(slot);
      if (!placeSlot(slot)) {
        timeouts.push(window.setTimeout(() => runCycle(slot), 1200));
        return;
      }
      slot.svg.classList.remove('is-erasing');
      slot.clip.setAttribute('x', '0');
      slot.clip.setAttribute('width', '0');
      slot.caret.setAttribute('x', '0');
      slot.svg.setAttribute('viewBox', '0 0 600 26');

      requestAnimationFrame(() => {
        if (cancelled) return;
        const w = measureWidth(slot);
        slot.svg.setAttribute('viewBox', `0 0 ${w} 26`);
        slot.svg.style.width = w + 'px';

        const typeDur = 900 + w * 9;
        animate(
          typeDur,
          (t) => {
            const cur = w * easeOut(t);
            slot.clip.setAttribute('width', String(cur));
            slot.caret.setAttribute('x', String(cur));
          },
          () => {
            const hold = 1700 + Math.random() * 1400;
            timeouts.push(window.setTimeout(() => {
              if (cancelled) return;
              slot.svg.classList.add('is-erasing');
              const eraseDur = 900 + w * 3;
              animate(
                eraseDur,
                (t) => {
                  const e = easeOut(t);
                  const x = w * e;
                  const cw = Math.max(0, w - x);
                  slot.clip.setAttribute('x', String(x));
                  slot.clip.setAttribute('width', String(cw));
                },
                () => {
                  timeouts.push(window.setTimeout(() => runCycle(slot), 400 + Math.random() * 900));
                },
              );
            }, hold));
          },
        );
      });
    }

    const slots: Slot[] = [];
    for (let i = 0; i < N_SLOTS; i++) slots.push(createSlot(i));
    slots.forEach((s, i) => {
      timeouts.push(window.setTimeout(() => runCycle(s), i * 650 + Math.random() * 400));
    });

    return () => {
      cancelled = true;
      timeouts.forEach((t) => window.clearTimeout(t));
      while (container!.firstChild) container!.removeChild(container!.firstChild);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
    />
  );
}
