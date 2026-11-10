import { describe, expect, it } from 'vitest';
import {
  categories,
  checkIntegrity,
  coUsedWith,
  degreeOf,
  isPending,
  neighboursOf,
  profile,
  projects,
  projectsOfService,
  projectsUsing,
  relatedTo,
  services,
  techById,
  techsOfService,
  techEdges,
  technologies,
} from './index';

describe('content integrity', () => {
  it('has no dangling or duplicate references', () => {
    expect(checkIntegrity()).toEqual([]);
  });

  it('gives every category at least one technology', () => {
    for (const category of categories) {
      expect(technologies.some((t) => t.category === category.id)).toBe(true);
    }
  });

  it('keeps catalogue references unique and ordered', () => {
    const refs = projects.map((p) => p.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect([...refs].sort()).toEqual(refs);
  });

  it('gives every project a connected architecture diagram', () => {
    for (const project of projects) {
      const linked = new Set(project.diagram.edges.flatMap((e) => [e.from, e.to]));
      for (const node of project.diagram.nodes) expect(linked.has(node.id), `${project.id}/${node.id}`).toBe(true);
    }
  });

  it('never ships an empty field: content is either present or explicitly pending', () => {
    for (const project of projects) {
      for (const value of [project.challenges, project.implementation, project.achievements]) {
        if (isPending(value)) expect(value.note.length).toBeGreaterThan(10);
        else expect(value.length).toBeGreaterThan(0);
      }
    }
    for (const service of services) {
      if (isPending(service.summary)) expect(service.summary.note.length).toBeGreaterThan(10);
      else expect(service.summary.length).toBeGreaterThan(0);
    }
  });

  it('shows exactly the six requested projects, in the order given', () => {
    expect(projects.map((p) => p.id)).toEqual(['mkeditor', 'homecounties', 'aldervast', 'edcs', 'omg', 'wssh']);
  });

  it('gives every project at least one link and one verified fact', () => {
    for (const project of projects) {
      expect(project.links.length, project.id).toBeGreaterThan(0);
      expect(project.facts.length, project.id).toBeGreaterThan(0);
      for (const link of project.links) expect(link.href.startsWith('https://'), link.href).toBe(true);
    }
  });

  it('presents the studio, not an individual', () => {
    expect(profile.name).toBe('Versyx Digital');
    expect(profile.established).toBe(2019);
    expect(profile.founder.name).toBe('Chris Rowles');
  });

  it('stores the email address split, not as a harvestable string', () => {
    const { user, domain } = profile.contact.email;
    expect(user).not.toContain('@');
    expect(domain).not.toContain('@');
  });
});

describe('derived relationship graph', () => {
  it('derives project usage from project data', () => {
    expect(projectsUsing('typescript').sort()).toEqual(['edcs', 'mkeditor', 'omg']);
    expect(projectsUsing('godot').sort()).toEqual(['aldervast', 'homecounties']);
    expect(projectsUsing('postgresql')).toEqual([]);
  });

  it('derives which projects exemplify a service, and their technologies', () => {
    expect(projectsOfService('apis')).toEqual(['edcs']);
    expect(projectsOfService('ai')).toEqual(['mkeditor']);
    expect(projectsOfService('consulting')).toEqual([]);
    expect(techsOfService('apis')).toContain('laravel');
    expect(techsOfService('consulting')).toEqual([]);
  });

  it('builds symmetric, de-duplicated structural edges', () => {
    const ids = techEdges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const edge of techEdges) {
      expect(edge.a < edge.b).toBe(true);
      expect(neighboursOf(edge.a)).toContain(edge.b);
      expect(neighboursOf(edge.b)).toContain(edge.a);
      expect(techById.has(edge.a) && techById.has(edge.b)).toBe(true);
    }
  });

  it('weights an edge by structure plus shared projects', () => {
    const edge = techEdges.find((e) => e.id === 'laravel|php');
    expect(edge?.structural).toBe(true);
    expect(edge?.projects).toEqual(['edcs']);
    expect(edge?.weight).toBe(2);
  });

  it('relates technologies through structure and co-usage without self-links', () => {
    expect(coUsedWith('paramiko')).toContain('tornado');
    for (const tech of technologies) {
      expect(relatedTo(tech.id)).not.toContain(tech.id);
      expect(degreeOf(tech.id)).toBeGreaterThanOrEqual(0);
    }
  });
});
