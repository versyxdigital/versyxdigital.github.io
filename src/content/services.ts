import type { Service } from './types';

/**
 * The five services are the founder's own list. `record` holds statements
 * about that kind of work found in published material (the Versyx Digital
 * entry and the about section of https://sentrychris.github.io/). Where
 * nothing published describes a service, its summary is left pending rather
 * than written from imagination. Which projects exemplify a service is set on
 * the project (see projects.ts) and derived in graph.ts.
 */
export const services: Service[] = [
  {
    id: 'webapps',
    name: 'Web app design and development',
    short: 'Web apps',
    tag: '01',
    summary: 'From interface to infrastructure.',
    record: [
      'Assisting clients in modernising their web applications, improving performance and scalability.',
      'Hands-on across the full stack: frontend, backend and infrastructure.',
    ],
  },
  {
    id: 'apis',
    name: 'APIs',
    short: 'APIs',
    tag: '02',
    summary: 'Connecting systems, powering applications.',
    record: [],
  },
  {
    id: 'consulting',
    name: 'Consulting',
    short: 'Consulting',
    tag: '03',
    summary: 'Advice on web architecture and development practice.',
    record: ['Provided strategic consulting on web architecture and development best practices.'],
  },
  {
    id: 'bugfixing',
    name: 'Bug fixing',
    short: 'Bug fixing',
    tag: '04',
    summary: 'Taking on existing systems and getting them back to a dependable state.',
    record: ['A track record of inheriting complex legacy systems, bringing them back up to standard, and shipping clean, well-tested code on top.'],
  },
  {
    id: 'ai',
    name: 'AI-integrated workflows',
    short: 'AI workflows',
    tag: '05',
    summary: 'Making AI practical, purposeful and productive.',
    record: [],
  },
];
