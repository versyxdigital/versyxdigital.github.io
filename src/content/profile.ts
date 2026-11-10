import type { Profile } from './types';

/**
 * Sources: the founder's description of the studio (given for this site), the
 * Versyx Digital entry on https://sentrychris.github.io/, the Versyx Digital
 * GitHub organisation, and the contact details published on the studio's
 * MKEditor site.
 */
export const profile: Profile = {
  name: 'Versyx Digital',
  descriptor: 'Software studio',
  established: 2019,
  location: 'United Kingdom',
  intro:
    'A small and focused UK studio, established in 2019. We specialise in web application design and development, APIs, consulting, bug fixing and AI-integrated workflows.',
  about: [
    'Bespoke development for clients across sectors, with a focus on consultation, infrastructure and frontend.',
    'We also build and contribute to open source. Every system in the catalogue below is ours, and most of them are open to read.',
  ],
  specs: [
    { label: 'Established', value: '2019' },
    { label: 'Based', value: 'United Kingdom' },
    { label: 'Shape', value: 'Small and focused' },
    { label: 'Founder', value: 'Chris Rowles' },
    { label: 'Open to', value: 'Projects · Consulting' },
  ],
  founder: {
    name: 'Chris Rowles',
    note: 'Founded and run by Chris Rowles, a developer with twelve-plus years across frontend, backend and infrastructure.',
    links: [
      { label: 'GitHub', href: 'https://github.com/sentrychris' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/chris-rowles' },
    ],
  },
  availability: 'Open to new projects and consulting.',
  contact: {
    email: { user: 'christopher.rowles', domain: 'outlook.com' },
    note: 'Quickest replies are by email.',
    links: [
      { label: 'GitHub', display: 'github.com/versyxdigital', href: 'https://github.com/versyxdigital' },
      { label: 'Founder', display: 'linkedin.com/in/chris-rowles', href: 'https://linkedin.com/in/chris-rowles' },
    ],
  },
  catalogueNote: 'The studio’s own systems, each open to inspect. Client work is not catalogued here.',
};
