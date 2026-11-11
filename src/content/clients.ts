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
export interface Client {
  name: string;
  /** Imported SVG file. */
  logo?: string;
}

// Names given by Chris Rowles on 2026-11-11.
export const clients: Client[] = [
  { name: 'Ganges Lounge' },
  { name: 'Amwah Property' },
  { name: 'Milton Keynes Council' },
  { name: 'Korben' },
  { name: 'Pivotal IQ' },
  { name: 'Mistress Infinity Productions' },
  { name: 'Platinum Desires' },
];
