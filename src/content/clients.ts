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
  /** Imported SVG file: the client's own logo. Replaces the text wordmark. */
  logo?: string;
  /**
   * How the name is set while there is no logo file. These are plain type
   * treatments so the row reads as a strip of marks; they are not the clients' logos.
   */
  mark?: 'serif' | 'caps' | 'heavy' | 'mono' | 'light' | 'tight';
}

// Names given by Chris Rowles on 2026-11-11.
export const clients: Client[] = [
  { name: 'Ganges Lounge', mark: 'serif' },
  { name: 'Amwah Property', mark: 'caps' },
  { name: 'Milton Keynes Council', mark: 'tight' },
  { name: 'Korben', mark: 'heavy' },
  { name: 'Pivotal IQ', mark: 'mono' },
  { name: 'Mistress Infinity Productions', mark: 'light' },
  { name: 'Platinum Desires', mark: 'caps' },
  { name: 'Temptations UK', mark: 'serif' },
];
