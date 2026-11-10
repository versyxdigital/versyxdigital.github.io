import { roles } from './experience';
import { projects } from './projects';
import { categories, technologies } from './technologies';
import {
  isPending,
  type CategoryMeta,
  type Project,
  type ProjectId,
  type Role,
  type RoleId,
  type TechCategory,
  type TechId,
  type Technology,
} from './types';

/**
 * Relationship graph derived from the content files.
 *
 * Nothing here is authored by hand: add a project, technology or role to the
 * content files and the constellation, project explorer and career schematic
 * pick the new relationships up from this module.
 */

export interface TechEdge {
  id: string;
  a: TechId;
  b: TechId;
  /** Declared ecosystem relationship (built on / runs on / pairs with). */
  structural: boolean;
  /** Projects in which both technologies appear. */
  projects: ProjectId[];
  /** 1 for a purely structural link, +1 for each shared project. */
  weight: number;
}

const byId = <T extends { id: string }>(items: T[]): Map<string, T> => new Map(items.map((item) => [item.id, item]));

export const techById: ReadonlyMap<TechId, Technology> = byId(technologies);
export const projectById: ReadonlyMap<ProjectId, Project> = byId(projects);
export const roleById: ReadonlyMap<RoleId, Role> = byId(roles);
export const categoryById: ReadonlyMap<TechCategory, CategoryMeta> = new Map(categories.map((c) => [c.id, c]));

const edgeKey = (a: TechId, b: TechId): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

function buildEdges(): TechEdge[] {
  const edges = new Map<string, TechEdge>();
  const ensure = (a: TechId, b: TechId): TechEdge => {
    const key = edgeKey(a, b);
    let edge = edges.get(key);
    if (!edge) {
      const [first, second] = a < b ? [a, b] : [b, a];
      edge = { id: key, a: first, b: second, structural: false, projects: [], weight: 0 };
      edges.set(key, edge);
    }
    return edge;
  };

  for (const tech of technologies) {
    for (const other of tech.relates ?? []) {
      if (other === tech.id || !techById.has(other)) continue;
      ensure(tech.id, other).structural = true;
    }
  }

  // Shared projects strengthen an existing structural link. They do not create
  // new edges on their own: a project is shown as a highlighted set instead.
  for (const project of projects) {
    for (const edge of edges.values()) {
      if (project.technologies.includes(edge.a) && project.technologies.includes(edge.b)) {
        edge.projects.push(project.id);
      }
    }
  }

  for (const edge of edges.values()) edge.weight = (edge.structural ? 1 : 0) + edge.projects.length;
  return [...edges.values()].sort((x, y) => x.id.localeCompare(y.id));
}

export const techEdges: readonly TechEdge[] = buildEdges();

function buildIndex<K extends string, V>(pairs: Iterable<[K, V]>): Map<K, V[]> {
  const index = new Map<K, V[]>();
  for (const [key, value] of pairs) {
    const list = index.get(key);
    if (list) list.push(value);
    else index.set(key, [value]);
  }
  return index;
}

const projectsByTechIndex = buildIndex<TechId, ProjectId>(
  projects.flatMap((p) => p.technologies.map((t): [TechId, ProjectId] => [t, p.id])),
);

const rolesByTechIndex = buildIndex<TechId, RoleId>(
  roles.flatMap((r) => (isPending(r.technologies) ? [] : r.technologies.map((t): [TechId, RoleId] => [t, r.id]))),
);

const neighbourIndex = buildIndex<TechId, TechId>(
  techEdges.flatMap((e): [TechId, TechId][] => [
    [e.a, e.b],
    [e.b, e.a],
  ]),
);

export const projectsUsing = (tech: TechId): ProjectId[] => projectsByTechIndex.get(tech) ?? [];
export const rolesUsing = (tech: TechId): RoleId[] => rolesByTechIndex.get(tech) ?? [];
/** Technologies joined to `tech` by a structural relationship. */
export const neighboursOf = (tech: TechId): TechId[] => neighbourIndex.get(tech) ?? [];

/** Technologies that share at least one project with `tech`. */
export function coUsedWith(tech: TechId): TechId[] {
  const out = new Set<TechId>();
  for (const pid of projectsUsing(tech)) {
    for (const t of projectById.get(pid)?.technologies ?? []) if (t !== tech) out.add(t);
  }
  return [...out];
}

/** Everything meaningfully related to `tech`: structural neighbours plus project co-usage. */
export function relatedTo(tech: TechId): TechId[] {
  return [...new Set([...neighboursOf(tech), ...coUsedWith(tech)])];
}

export const techsOfRole = (role: RoleId): TechId[] => {
  const entry = roleById.get(role);
  return entry && !isPending(entry.technologies) ? entry.technologies : [];
};

/**
 * Connectivity of a technology: structural links + projects + roles.
 * Used for node prominence. It measures how connected a node is in the
 * published material — it is not a skill score.
 */
export function degreeOf(tech: TechId): number {
  return neighboursOf(tech).length + projectsUsing(tech).length + rolesUsing(tech).length;
}

export interface IntegrityIssue {
  where: string;
  message: string;
}

/** Validates every cross-reference in the content. Run by the test-suite. */
export function checkIntegrity(): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const seen = new Set<string>();
  for (const tech of technologies) {
    if (seen.has(tech.id)) issues.push({ where: `technology:${tech.id}`, message: 'duplicate id' });
    seen.add(tech.id);
    if (!categoryById.has(tech.category)) issues.push({ where: `technology:${tech.id}`, message: `unknown category ${tech.category}` });
    for (const other of tech.relates ?? []) {
      if (!techById.has(other)) issues.push({ where: `technology:${tech.id}`, message: `relates to unknown technology ${other}` });
      if (other === tech.id) issues.push({ where: `technology:${tech.id}`, message: 'relates to itself' });
    }
  }
  for (const project of projects) {
    for (const t of project.technologies) {
      if (!techById.has(t)) issues.push({ where: `project:${project.id}`, message: `unknown technology ${t}` });
    }
    const nodeIds = new Set(project.diagram.nodes.map((n) => n.id));
    if (nodeIds.size !== project.diagram.nodes.length) issues.push({ where: `project:${project.id}`, message: 'duplicate diagram node id' });
    for (const node of project.diagram.nodes) {
      for (const t of node.tech ?? []) {
        if (!techById.has(t)) issues.push({ where: `project:${project.id}/${node.id}`, message: `unknown technology ${t}` });
        else if (!project.technologies.includes(t))
          issues.push({ where: `project:${project.id}/${node.id}`, message: `diagram uses ${t} which the project does not list` });
      }
      if (node.col < 0 || node.col + (node.span ?? 1) > project.diagram.cols || node.row < 0 || node.row > project.diagram.rows - 1)
        issues.push({ where: `project:${project.id}/${node.id}`, message: 'diagram node outside grid' });
    }
    for (const edge of project.diagram.edges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to))
        issues.push({ where: `project:${project.id}`, message: `diagram edge ${edge.from} -> ${edge.to} references unknown node` });
    }
  }
  for (const role of roles) {
    if (isPending(role.technologies)) continue;
    for (const t of role.technologies) {
      if (!techById.has(t)) issues.push({ where: `role:${role.id}`, message: `unknown technology ${t}` });
    }
  }
  return issues;
}
