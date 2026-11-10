import { pending, type Role } from './types';

/**
 * Source: https://sentrychris.github.io/ (experience section).
 * Summaries and exhibits are taken from the existing site. Technologies are
 * only attached where the source text names them.
 */
export const roles: Role[] = [
  {
    id: 'sentrybay',
    organisation: 'SentryBay',
    position: 'Lead Developer',
    from: 2022,
    to: null,
    period: '2022 — present',
    sectors: ['SaaS', 'Cybersecurity', 'Defence', 'NDA'],
    summary:
      'Development lead on consumer platforms. Owning architecture decisions, running parallel teams, and bringing legacy services up to standard while shipping new products.',
    exhibits: [
      'Currently leading development of web platforms and services.',
      'Led the implementation of AI-assisted workflows to increase productivity.',
      'Shipped Armored Client, a major product surface that drove a significant portion of the company’s growth.',
    ],
    technologies: pending('Stack is under NDA on the existing site. Add technology ids here if they can be published.'),
    track: 'employment',
  },
  {
    id: 'godeploy',
    organisation: 'Go Deploy Labs',
    position: 'Principal Developer',
    from: 2020,
    to: 2022,
    period: '2020 — 2022',
    sectors: ['LMS', 'Virtual labs', 'E-commerce', 'MCT'],
    summary:
      'Full-stack engineer across the estate. Enabled learners and mentors to run virtual labs for MCT and other certified courses.',
    exhibits: [
      'Redesigned the virtual lab instruction interface to improve user experience.',
      'Unified RDP through Guacamole for seamless lab access and mentor support.',
      'Drove the shift to Vue 3, improving frontend performance and maintainability.',
    ],
    technologies: ['vue', 'guacamole'],
    track: 'employment',
  },
  {
    id: 'versyx',
    organisation: 'Versyx Digital',
    position: 'Founder',
    from: 2019,
    to: null,
    period: '2019 — present',
    sectors: ['Agency', 'Consulting', 'Development', 'Design'],
    summary:
      'Bespoke development agency focused on consultation, infrastructure and frontend for clients across sectors. Also builds and contributes to open source projects.',
    exhibits: [
      'Assisted clients in modernising their web applications, improving performance and scalability.',
      'Provided strategic consulting on web architecture and development best practices.',
      'Contributed to open source projects, enhancing tools and libraries used by the community.',
    ],
    technologies: pending('Client stacks are not listed on the existing site.'),
    track: 'venture',
  },
];

/**
 * The existing site states 12+ years of experience but documents roles from
 * 2019 onward. The earlier period is represented on the schematic as an
 * undocumented segment rather than filled with invented history.
 */
export const earlierCareer = {
  label: 'Earlier roles',
  note: 'Not published on the existing site. The long version, with references, is available on request.',
} as const;
