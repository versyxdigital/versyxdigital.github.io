/**
 * Clients shown in the "Our clients" band above the footer.
 *
 * Real clients only, each named with their permission. The band stays hidden
 * while this list is empty, so add names here and it appears.
 *
 * A client can have an SVG logo: put the file in src/assets/clients/, import it
 * here and pass it as `logo`. Logos are shown in white to match the greyscale
 * theme, whatever colours the file uses. Without a logo the name is set as text.
 *
 *   import exampleLogo from '../assets/clients/example.svg';
 *   export const clients: Client[] = [{ name: 'Example Ltd', logo: exampleLogo }, { name: 'Another Ltd' }];
 */
import mkccLogo from '../assets/clients/milton-keynes-city-council.svg';

export interface Client {
  name: string;
  /** Imported SVG file: the client's own logo. Replaces the text wordmark. */
  logo?: string;
  /**
   * How the name is set while there is no logo file. These are plain type
   * treatments so the row reads as a strip of marks; they are not the clients' logos.
   */
  mark?: 'serif' | 'caps' | 'heavy' | 'mono' | 'light' | 'tight';
  /** Mock-up symbol drawn beside the name (see sections/ClientGlyph.tsx). Not the client's own logo. */
  glyph?: ClientGlyphId;
}

export type ClientGlyphId = 'wave' | 'roof' | 'grid' | 'block' | 'pivot' | 'infinity' | 'gem' | 'crescent';

// Names given by Chris Rowles on 2026-11-11.
export const clients: Client[] = [
  { name: 'Ganges Lounge', mark: 'serif', glyph: 'wave' },
  { name: 'Amwah Property', mark: 'caps', glyph: 'roof' },
  // Logo file supplied by Chris Rowles. The logo reads "Milton Keynes City Council".
  { name: 'Milton Keynes City Council', logo: mkccLogo },
  { name: 'Korben', mark: 'heavy', glyph: 'block' },
  { name: 'Pivotal IQ', mark: 'mono', glyph: 'pivot' },
  { name: 'Mistress Infinity Productions', mark: 'light', glyph: 'infinity' },
  { name: 'Platinum Desires', mark: 'caps', glyph: 'gem' },
  { name: 'Darkside UK', mark: 'serif', glyph: 'crescent' },
];
