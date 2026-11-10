import type { Profile } from './types';

/**
 * Sources: the founder's description of the studio (given for this site), the
 * Versyx Digital entry on https://sentrychris.github.io/, the Versyx Digital
 * GitHub organisation, and the contact details published on the studio's
 * MKEditor site.
 */
export const profile: Profile = {
  name: 'Versyx Digital',
  descriptor: 'Design and development agency',
  established: 2019,
  location: 'United Kingdom',
  intro:
    'A small and focused UK agency, established in 2019. We design and build web applications and APIs, and offer consulting, bug fixing and AI-integrated workflows.',
  about: [
    'Bespoke development for clients across sectors, with a focus on consultation, infrastructure and frontend.',
    'We also build and contribute to open source. Every project shown further down is our own, and most have their source code public.',
  ],
  specs: [
    { label: 'Established', value: '2019' },
    { label: 'Based', value: 'United Kingdom' },
    { label: 'Size', value: 'Small and focused' },
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
    email: { user: 'hello', domain: 'versyx.digital' },
    note: 'Quickest replies are by email.',
    links: [
      { label: 'GitHub', display: 'github.com/versyxdigital', href: 'https://github.com/versyxdigital' },
      { label: 'Telephone', display: '+44 7522 267 722', href: 'tel:+447522267722' },
    ],
  },
  catalogueNote: 'Projects we have built ourselves. Select one to see what it is and how it works. Client work is not shown here.',
};
