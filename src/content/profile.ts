import type { Profile } from './types';

/** Source: https://sentrychris.github.io/ (hero, about, specifications, contact). */
export const profile: Profile = {
  name: 'Chris Rowles',
  role: 'Lead Developer',
  organisation: 'SentryBay',
  statement: 'Software systems, owned end to end.',
  intro:
    'Twelve-plus years building, testing and maintaining software and web applications across frontend, backend and infrastructure. I inherit complex legacy systems, bring them back up to standard, and ship clean, well-tested code on top.',
  about: [
    'Most of the work has been hands-on across the full stack: frontend, backend and infrastructure. The rest has been leading teams through reviews, mentoring and architectural decisions.',
    'A proven track record of inheriting complex legacy systems, bringing them back up to standard, and shipping clean, well-tested code on top.',
    'Polyglot by necessity, opinionated by experience. I also ship things in my spare time.',
  ],
  specs: [
    { label: 'Based', value: 'United Kingdom' },
    { label: 'Role', value: 'Lead Developer' },
    { label: 'Experience', value: '12+ years' },
    { label: 'Stack', value: 'Polyglot · web-first' },
    { label: 'Open to', value: 'Lead · Senior · Consulting' },
  ],
  location: { label: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  availability: 'Open to lead engineering roles, senior IC roles and consulting.',
  contact: {
    email: { user: 'christopher.rowles', domain: 'outlook.com' },
    note: 'Quickest replies are by email; everything else also reaches me.',
    links: [
      { label: 'GitHub', display: 'github.com/sentrychris', href: 'https://github.com/sentrychris' },
      {
        label: 'LinkedIn',
        display: 'linkedin.com/in/chris-rowles',
        href: 'https://linkedin.com/in/chris-rowles',
      },
    ],
  },
  ndaNote: 'Most production work is under NDA. The open systems are catalogued here; reach out for the rest.',
};
