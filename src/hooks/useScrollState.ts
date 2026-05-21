import { useEffect, useState } from 'react';

export function useScrollState(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('main-section');
    const onScroll = () => {
      setScrolled(window.scrollY > threshold);
      if (hero) {
        const heroBottom = hero.offsetTop + hero.offsetHeight;
        setPastHero(window.scrollY > heroBottom);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return { scrolled, pastHero };
}
