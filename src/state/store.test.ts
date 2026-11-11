import { beforeEach, describe, expect, it } from 'vitest';
import { fieldModes } from '../field/modes';
import { resolveHighlight, resolveVisualMode, selectHighlight, useSystem } from './store';

const intent = {
  activeSection: 'hero' as const,
  hoveredTech: null,
  selectedTech: null,
  hoveredProject: null,
  selectedProject: null,
  hoveredService: null,
};

describe('visual mode', () => {
  it('follows the active section by default', () => {
    expect(resolveVisualMode({ ...intent, activeSection: 'contact' })).toBe('section:contact');
  });

  it('adopts a project’s field signature while it is inspected in the projects section', () => {
    const expected = {
      mkeditor: 'project:scan',
      vigil: 'project:rings',
      homecounties: 'project:blocks',
      aldervast: 'project:island',
      edcs: 'project:stars',
      omg: 'project:steps',
      wssh: 'project:rings',
    } as const;
    for (const [project, mode] of Object.entries(expected)) {
      expect(resolveVisualMode({ ...intent, activeSection: 'projects', selectedProject: project })).toBe(mode);
    }
  });

  it('returns to the section mode once the visitor scrolls away from an open project', () => {
    expect(resolveVisualMode({ ...intent, activeSection: 'about', selectedProject: 'wssh' })).toBe('section:about');
  });

  it('focuses the lattice on a selected technology', () => {
    expect(resolveVisualMode({ ...intent, activeSection: 'tech', selectedTech: 'python' })).toBe('focus:tech');
  });

  it('always resolves to a mode the field knows', () => {
    for (const section of ['hero', 'about', 'tech', 'projects', 'contact'] as const) {
      for (const selectedProject of [null, 'mkeditor', 'homecounties', 'aldervast', 'edcs', 'omg', 'wssh', 'missing']) {
        for (const selectedTech of [null, 'python']) {
          expect(fieldModes[resolveVisualMode({ activeSection: section, selectedProject, selectedTech })]).toBeDefined();
        }
      }
    }
  });
});

describe('highlight', () => {
  it('is inactive with no intent', () => {
    const h = resolveHighlight(intent);
    expect(h.active).toBe(false);
    expect(h.techs.size).toBe(0);
  });

  it('lights a hovered technology, its relations and the projects using it', () => {
    const h = resolveHighlight({ ...intent, hoveredTech: 'python' });
    expect(h.primaryTech).toBe('python');
    expect(h.techs.has('python')).toBe(true);
    expect(h.techs.has('tornado')).toBe(true);
    expect(h.techs.has('paramiko')).toBe(true);
    expect(h.techs.has('laravel')).toBe(false);
    expect([...h.projects].sort()).toEqual(['homecounties', 'wssh']);
  });

  it('lets hover take precedence over selection', () => {
    expect(resolveHighlight({ ...intent, selectedTech: 'python', hoveredTech: 'php' }).primaryTech).toBe('php');
  });

  it('leaves the technology graph alone when a project is chosen', () => {
    const h = resolveHighlight({ ...intent, selectedProject: 'mkeditor', hoveredProject: 'wssh' });
    expect(h.active).toBe(false);
    expect(h.techs.size).toBe(0);
    expect(h.projects.size).toBe(0);
  });

  it('lights the projects that exemplify a hovered service, and their technologies', () => {
    const h = resolveHighlight({ ...intent, hoveredService: 'apis' });
    expect(h.active).toBe(true);
    expect([...h.projects]).toEqual(['vigil', 'edcs']);
    expect(h.techs.has('laravel')).toBe(true);
  });

  it('stays quiet for a service with nothing in the public catalogue', () => {
    expect(resolveHighlight({ ...intent, hoveredService: 'consulting' }).active).toBe(false);
  });
});

describe('store', () => {
  beforeEach(() => {
    useSystem.setState({ hoveredTech: null, selectedTech: null, hoveredProject: null, selectedProject: null, hoveredService: null });
  });

  it('clears hover when a technology is selected, so the selection owns the focus', () => {
    useSystem.getState().hoverTech('python');
    useSystem.getState().selectTech('python');
    expect(useSystem.getState().hoveredTech).toBeNull();
    expect(useSystem.getState().selectedTech).toBe('python');
  });

  it('does not notify subscribers when nothing changed', () => {
    let calls = 0;
    const unsubscribe = useSystem.subscribe(() => calls++);
    useSystem.getState().hoverTech(null);
    useSystem.getState().setActiveSection(useSystem.getState().activeSection);
    unsubscribe();
    expect(calls).toBe(0);
  });

  it('shares one memoised highlight per intent', () => {
    useSystem.getState().hoverTech('python');
    const first = selectHighlight(useSystem.getState());
    expect(selectHighlight(useSystem.getState())).toBe(first);
    useSystem.getState().hoverTech('php');
    expect(selectHighlight(useSystem.getState())).not.toBe(first);
  });
});
