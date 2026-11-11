import type { ReactNode } from 'react';
import type { ClientGlyphId } from '../content/clients';

/**
 * Mock-up symbols for the "Our clients" band, drawn here as inline SVG in the
 * site's line style. They are stand-ins designed for this site, not the
 * clients' own logos: give a client a real `logo` file in content/clients.ts
 * and it replaces its mock-up.
 */
const glyphs: Record<ClientGlyphId, ReactNode> = {
  wave: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M5.5 10c2.2-1.9 4.3 1.9 6.5 0s4.3-1.9 6.5 0M5.5 14.5c2.2-1.9 4.3 1.9 6.5 0s4.3-1.9 6.5 0" />
    </>
  ),
  roof: <path d="M2.5 12 12 3.5l9.5 8.5M5.5 10.2V20.5h13V10.2M10 20.5v-5.5h4v5.5" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" fill="currentColor" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </>
  ),
  block: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4.5" />
      <path d="M9 7.5v9M9 12.6l5.6-5.1M11.3 10.6l4 5.9" />
    </>
  ),
  pivot: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <path d="M14 10l4.6-4.6" />
    </>
  ),
  infinity: <path d="M6.6 8.4c-2.6 0-4.1 1.7-4.1 3.6s1.5 3.6 4.1 3.6c4 0 6.8-7.2 10.8-7.2 2.6 0 4.1 1.7 4.1 3.6s-1.5 3.6-4.1 3.6c-4 0-6.8-7.2-10.8-7.2z" />,
  gem: <path d="M6.5 4h11L21.5 9.5 12 21 2.5 9.5zM2.5 9.5h19M9 9.5 12 21l3-11.5M9 9.5 12 4l3 5.5" />,
  crescent: <path d="M19.5 14.6A8.6 8.6 0 1 1 9.4 4.5a6.9 6.9 0 0 0 10.1 10.1z" />,
};

export function ClientGlyph({ id }: { id: ClientGlyphId }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {glyphs[id]}
    </svg>
  );
}
