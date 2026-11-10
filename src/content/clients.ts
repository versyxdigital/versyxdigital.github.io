/**
 * Clients shown in the "Our clients" band above the footer.
 *
 * Real clients only, each named with their permission. The band stays hidden
 * while this list is empty, so add names here and it appears.
 *
 *   export const clients: Client[] = [{ name: 'Example Ltd' }];
 */
export interface Client {
  name: string;
}

export const clients: Client[] = [];
