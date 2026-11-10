/**
 * Content model.
 *
 * Every fact rendered by the site comes from the files in this folder.
 * Projects and experience entries reference technologies by stable id;
 * relationships (tech -> projects, tech -> roles) are *derived* in graph.ts
 * and never duplicated in components.
 *
 * Fields the existing site does not document are modelled as `Pending`
 * rather than invented. See content/config.ts for how they are displayed.
 */

export type TechId = string;
export type ProjectId = string;
export type RoleId = string;

export type TechCategory = 'language' | 'frontend' | 'backend' | 'data' | 'infra' | 'tooling';

/** Where a fact was taken from. Shown in the UI as a provenance tag. */
export type Source =
  | 'site' // https://sentrychris.github.io
  | 'repository' // public README / docs of the linked repository
  | 'derived'; // computed from other content

/** A content slot the source material does not cover yet. */
export interface Pending {
  pending: true;
  /** What should be supplied here. */
  note: string;
}

export type Maybe<T> = T | Pending;

export const pending = (note: string): Pending => ({ pending: true, note });
export const isPending = <T>(value: Maybe<T>): value is Pending =>
  typeof value === 'object' && value !== null && (value as Pending).pending === true;

export interface CategoryMeta {
  id: TechCategory;
  label: string;
  /** Short mono tag used in technical labels. */
  tag: string;
  /** Signal tone used across field, schematic and constellation. */
  tone: Tone;
  blurb: string;
}

/** The three illumination tones of the system. Index is shared with the shaders. */
export type Tone = 'cyan' | 'blue' | 'violet';

export type TechRole =
  | 'language'
  | 'framework'
  | 'library'
  | 'runtime'
  | 'protocol'
  | 'datastore'
  | 'platform'
  | 'tool'
  | 'practice';

export interface Technology {
  id: TechId;
  name: string;
  category: TechCategory;
  role: TechRole;
  /** Neutral, factual one-liner about the technology itself. */
  summary: string;
  /** Verified note on how Chris uses it. Absent when the source material is silent. */
  usage?: string;
  /** Structural ecosystem relationships (built on / runs on / pairs with). */
  relates?: TechId[];
  /** Listed in the skills section of the existing site, or only seen in a project / role. */
  origin: 'skills' | 'project' | 'experience';
}

export interface Role {
  id: RoleId;
  organisation: string;
  position: string;
  /** Inclusive start year. */
  from: number;
  /** End year, or null when current. */
  to: number | null;
  period: string;
  sectors: string[];
  summary: string;
  /** Verified highlights, quoted from the existing site. */
  exhibits: string[];
  /** Technologies the source material explicitly ties to this role. */
  technologies: Maybe<TechId[]>;
  /** Parallel track on the career schematic. */
  track: 'employment' | 'venture';
}

export interface ProjectLink {
  label: string;
  href: string;
  kind: 'live' | 'source' | 'docs';
}

export type DiagramNodeKind = 'source' | 'process' | 'store' | 'transport' | 'surface' | 'external';

export interface DiagramNode {
  id: string;
  label: string;
  /** Mono sub-label: technology or protocol. */
  sub?: string;
  kind: DiagramNodeKind;
  /** Grid position (column, row). Fractions are allowed. */
  col: number;
  row: number;
  /** Column span in grid units. */
  span?: number;
  /** What this stage does. Shown when the stage is inspected. */
  detail: string;
  /** Technologies that implement this stage. */
  tech?: TechId[];
  optional?: boolean;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  /** Draws signals travelling both ways. */
  duplex?: boolean;
  /** Exit / entry sides. Defaults to right -> left. */
  fromSide?: Side;
  toSide?: Side;
}

export type Side = 'l' | 'r' | 't' | 'b';

export interface Diagram {
  /** What the diagram depicts. */
  caption: string;
  cols: number;
  rows: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** Mathematical behaviour the cube field adopts while the project is inspected. */
export type FieldSignature = 'rings' | 'scan' | 'stars';

export interface Project {
  id: ProjectId;
  /** Catalogue reference, e.g. SYS-01. */
  ref: string;
  name: string;
  /** Short classification, e.g. "System monitoring". */
  kind: string;
  tagline: string;
  description: string;
  purpose: Maybe<string>;
  challenges: Maybe<string[]>;
  implementation: Maybe<string[]>;
  achievements: Maybe<string[]>;
  /** Short verified facts shown as a data sheet. */
  facts: { label: string; value: string }[];
  technologies: TechId[];
  links: ProjectLink[];
  diagram: Diagram;
  signature: FieldSignature;
  /** Why the field behaves this way for this project. */
  signatureNote: string;
  tone: Tone;
  sources: Source[];
}

export interface Profile {
  name: string;
  role: string;
  organisation: string;
  /** Hero statement. */
  statement: string;
  intro: string;
  about: string[];
  specs: { label: string; value: string }[];
  location: { label: string; lat: number; lon: number };
  availability: string;
  contact: {
    /** Stored split so the address is not harvested from the bundle. */
    email: { user: string; domain: string };
    note: string;
    links: { label: string; display: string; href: string }[];
  };
  ndaNote: string;
}
