/**
 * Content model.
 *
 * Every fact rendered by the site comes from the files in this folder.
 * Projects reference technologies and services by stable id; relationships
 * (tech -> projects, service -> projects) are *derived* in graph.ts and never
 * duplicated in components.
 *
 * Fields the source material does not document are modelled as `Pending`
 * rather than invented. See content/config.ts for how they are displayed.
 */

export type TechId = string;
export type ProjectId = string;
export type ServiceId = string;

export type TechCategory = 'language' | 'frontend' | 'backend' | 'data' | 'infra' | 'tooling';

/** Where a fact was taken from. Shown in the UI as a provenance tag. */
export type Source =
  | 'brief' // stated by the studio's founder for this site
  | 'site' // the project's own public site, or https://sentrychris.github.io
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
  /** Verified note on how the studio uses it. Kept as a record; not shown in the interface. */
  usage?: string;
  /** Structural ecosystem relationships (built on / runs on / pairs with). */
  relates?: TechId[];
  /** Listed in the founder's published skills, or only seen in a project stack. */
  origin: 'skills' | 'project';
}

/** Something the studio offers. The list itself comes from the founder's brief. */
export interface Service {
  id: ServiceId;
  name: string;
  /** Short form used on the schematic. */
  short: string;
  /** Short mono tag, e.g. "API". */
  tag: string;
  /** What the service covers. Pending where no source describes it. */
  summary: Maybe<string>;
  /** Statements about this kind of work found in published material. */
  record?: string[];
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
export type FieldSignature = 'rings' | 'scan' | 'stars' | 'blocks' | 'island' | 'steps';

/** A screenshot that showcases a project. Convert new ones with scripts/webp.mjs. */
export interface ProjectImage {
  /** Imported asset URL. */
  src: string;
  /** A small version for the row of thumbnails. Falls back to `src`. */
  thumb?: string;
  /** What the screenshot shows, for people who cannot see it. */
  alt: string;
  /** Intrinsic size in pixels, so the page does not jump while it loads. */
  width: number;
  height: number;
  /** One short line shown under the image. */
  caption?: string;
}

/** A video that showcases a project, hosted on YouTube. */
export interface ProjectVideo {
  /** The id in the YouTube address, e.g. the part after /embed/. */
  youtubeId: string;
  title: string;
}

export interface Project {
  id: ProjectId;
  /** Number shown in the project list, e.g. 01. */
  ref: string;
  name: string;
  /** Short classification, e.g. "Markdown editor". */
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
  /** Services this project is a clear example of. */
  services: ServiceId[];
  links: ProjectLink[];
  /** Showcase screenshots, the lead one first. Projects without any open on their diagram instead. */
  images?: ProjectImage[];
  video?: ProjectVideo;
  diagram: Diagram;
  signature: FieldSignature;
  /** Why the field behaves this way for this project. A note for maintainers; not shown. */
  signatureNote: string;
  tone: Tone;
  sources: Source[];
}

export interface Profile {
  /** The studio. */
  name: string;
  /** One-line classification shown under the name. */
  descriptor: string;
  established: number;
  location: string;
  intro: string;
  about: string[];
  specs: { label: string; value: string }[];
  founder: {
    name: string;
    note: string;
    links: { label: string; href: string }[];
  };
  availability: string;
  contact: {
    /** Stored split so the address is not harvested from the bundle. */
    email: { user: string; domain: string };
    note: string;
    links: { label: string; display: string; href: string }[];
  };
  /** Shown above the project catalogue. */
  catalogueNote: string;
}
