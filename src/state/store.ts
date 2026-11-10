import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  projectById,
  projectsUsing,
  relatedTo,
  techsOfRole,
  type FieldSignature,
  type ProjectId,
  type RoleId,
  type TechCategory,
  type TechId,
} from '../content';

/**
 * The central interaction model.
 *
 * Every visual system (cube field, schematic overlay, constellation, project
 * explorer, navigation) reads from this store and nothing else. Components
 * only ever *set* intent here ("this technology is hovered"); the visual
 * consequences are derived below and orchestrated by system/director.ts.
 */

export type SectionId = 'hero' | 'about' | 'tech' | 'projects' | 'contact';
export const sectionOrder: readonly SectionId[] = ['hero', 'about', 'tech', 'projects', 'contact'];

export type Quality = 'high' | 'medium' | 'low';
export type WebglStatus = 'pending' | 'ok' | 'unavailable';
/** Coarse phase of the current choreography. */
export type Transition = 'idle' | 'focusing' | 'inspecting' | 'releasing';

export type VisualMode = `section:${SectionId}` | `project:${FieldSignature}` | 'focus:tech';

export interface SystemState {
  activeSection: SectionId;
  hoveredTech: TechId | null;
  selectedTech: TechId | null;
  hoveredProject: ProjectId | null;
  selectedProject: ProjectId | null;
  hoveredRole: RoleId | null;
  selectedRole: RoleId;
  categoryFilter: TechCategory | null;
  transition: Transition;
  quality: Quality;
  reducedMotion: boolean;
  webgl: WebglStatus;

  setActiveSection: (section: SectionId) => void;
  hoverTech: (tech: TechId | null) => void;
  selectTech: (tech: TechId | null) => void;
  hoverProject: (project: ProjectId | null) => void;
  selectProject: (project: ProjectId | null) => void;
  hoverRole: (role: RoleId | null) => void;
  selectRole: (role: RoleId) => void;
  setCategoryFilter: (category: TechCategory | null) => void;
  setTransition: (transition: Transition) => void;
  setQuality: (quality: Quality) => void;
  setReducedMotion: (reduced: boolean) => void;
  setWebgl: (status: WebglStatus) => void;
}

export const useSystem = create<SystemState>()(
  subscribeWithSelector((set) => ({
    activeSection: 'hero',
    hoveredTech: null,
    selectedTech: null,
    hoveredProject: null,
    selectedProject: null,
    hoveredRole: null,
    selectedRole: 'sentrybay',
    categoryFilter: null,
    transition: 'idle',
    quality: 'high',
    reducedMotion: false,
    webgl: 'pending',

    setActiveSection: (activeSection) => set((s) => (s.activeSection === activeSection ? s : { activeSection })),
    hoverTech: (hoveredTech) => set((s) => (s.hoveredTech === hoveredTech ? s : { hoveredTech })),
    selectTech: (selectedTech) =>
      set((s) => (s.selectedTech === selectedTech ? s : { selectedTech, hoveredTech: selectedTech ? null : s.hoveredTech })),
    hoverProject: (hoveredProject) => set((s) => (s.hoveredProject === hoveredProject ? s : { hoveredProject })),
    selectProject: (selectedProject) => set((s) => (s.selectedProject === selectedProject ? s : { selectedProject })),
    hoverRole: (hoveredRole) => set((s) => (s.hoveredRole === hoveredRole ? s : { hoveredRole })),
    selectRole: (selectedRole) => set({ selectedRole }),
    setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
    setTransition: (transition) => set({ transition }),
    setQuality: (quality) => set({ quality }),
    setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    setWebgl: (webgl) => set({ webgl }),
  })),
);

type Intent = Pick<
  SystemState,
  'activeSection' | 'hoveredTech' | 'selectedTech' | 'hoveredProject' | 'selectedProject' | 'hoveredRole'
>;

/** The mathematical behaviour the cube field should currently adopt. */
export function resolveVisualMode(state: Pick<Intent, 'activeSection' | 'selectedProject' | 'selectedTech'>): VisualMode {
  if (state.selectedProject && state.activeSection === 'projects') {
    const project = projectById.get(state.selectedProject);
    if (project) return `project:${project.signature}`;
  }
  if (state.selectedTech && state.activeSection === 'tech') return 'focus:tech';
  return `section:${state.activeSection}`;
}

/** The technology the interface is currently "about": hover wins over selection. */
export const focusedTech = (state: Pick<Intent, 'hoveredTech' | 'selectedTech'>): TechId | null =>
  state.hoveredTech ?? state.selectedTech;

export const focusedProject = (state: Pick<Intent, 'hoveredProject' | 'selectedProject'>): ProjectId | null =>
  state.hoveredProject ?? state.selectedProject;

export interface Highlight {
  /** Technologies that should be illuminated. Empty set means "no emphasis anywhere". */
  techs: ReadonlySet<TechId>;
  /** The single technology at the centre of the emphasis, if any. */
  primaryTech: TechId | null;
  projects: ReadonlySet<ProjectId>;
  /** True when anything is emphasised, i.e. unrelated elements should recede. */
  active: boolean;
}

const EMPTY: Highlight = { techs: new Set(), primaryTech: null, projects: new Set(), active: false };

/**
 * Derives what should be illuminated from the current intent.
 * Single source of truth for the constellation, the project index, the
 * inspector's technology chips and the career schematic.
 */
export function resolveHighlight(state: Intent): Highlight {
  const tech = focusedTech(state);
  if (tech) {
    return {
      techs: new Set([tech, ...relatedTo(tech)]),
      primaryTech: tech,
      projects: new Set(projectsUsing(tech)),
      active: true,
    };
  }
  const projectId = focusedProject(state);
  if (projectId) {
    const project = projectById.get(projectId);
    if (project) return { techs: new Set(project.technologies), primaryTech: null, projects: new Set([projectId]), active: true };
  }
  if (state.hoveredRole) {
    const techs = techsOfRole(state.hoveredRole);
    if (techs.length > 0) return { techs: new Set(techs), primaryTech: null, projects: new Set(), active: true };
  }
  return EMPTY;
}

const highlightKey = (s: Intent): string =>
  `${s.hoveredTech}|${s.selectedTech}|${s.hoveredProject}|${s.selectedProject}|${s.hoveredRole}`;

let cachedKey = '';
let cachedHighlight: Highlight = EMPTY;

/** Memoised selector so every subscriber shares one Highlight instance per intent. */
export function selectHighlight(state: SystemState): Highlight {
  const key = highlightKey(state);
  if (key !== cachedKey) {
    cachedKey = key;
    cachedHighlight = resolveHighlight(state);
  }
  return cachedHighlight;
}

export const selectVisualMode = (state: SystemState): VisualMode => resolveVisualMode(state);
