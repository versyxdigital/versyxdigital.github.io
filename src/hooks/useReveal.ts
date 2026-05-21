import { useEffect, useRef } from 'react';

export type RevealKind = 'fade' | 'up' | 'left' | 'right';

export function useReveal<T extends HTMLElement>(kind: RevealKind = 'fade') {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.setAttribute('data-reveal', kind);

    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-in', 'true');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute('data-in', 'true');
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [kind]);

  return ref;
}
