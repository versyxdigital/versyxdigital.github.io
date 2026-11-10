# Versyx Digital — interactive studio site

The site for Versyx Digital, a small UK software studio, built as one connected system: a GPU-driven field of
cubes that behaves like a mathematical simulation, a schematic layer of live
traces and signals, a technology constellation and a project system explorer,
all driven by one interaction model.

Built with React, TypeScript, Vite, Three.js / React Three Fiber, custom GLSL,
GSAP and CSS Modules.

## Run it

```bash
npm install
npm run dev
```

Then open the address Vite prints (default `http://localhost:5173`).

```bash
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

The build uses a relative base path, so `dist/` can be served from any
sub-path (GitHub Pages, for example) without changes.

## Deploy

`.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on every push
to `main`. In the repository, set Settings → Pages → Source to "GitHub
Actions" once. The build uses a relative base path, so no configuration is
needed for a project page or a custom domain.

## Checks

```bash
npm run typecheck  # strict TypeScript
npm run lint       # ESLint
npm test           # 79 unit tests (Vitest)
npm run test:e2e   # browser smoke test against dist/ (needs Chrome or Edge installed)
npm run check      # all of the above, plus the build
```

`test:e2e` uses `playwright-core` with the Chrome or Edge already installed on
the machine; it does not download a browser. It writes screenshots to
`qa-screens/` (git-ignored).

## Editing content

Everything the site says lives in `src/content`. No component contains copy.

| File | What it holds |
| --- | --- |
| `profile.ts` | The studio: name, introduction, founder, contact details |
| `services.ts` | Services shown on the studio schematic |
| `technologies.ts` | Technologies, their category and structural relationships |
| `projects.ts` | Projects, their facts and their architecture diagrams |
| `config.ts` | Display switches, including `showPendingFields` |
| `graph.ts` | Derived relationships. Not edited by hand |

- **Add a technology:** add an entry to `technologies.ts`. List the ids it is
  structurally related to in `relates`. It appears in the constellation.
- **Add a project:** add an entry to `projects.ts` referencing technology ids.
  The constellation, catalogue and inspector pick it up. Its diagram is data:
  nodes on a grid, edges between them.
- **Add or describe a service:** edit `services.ts`. Tag a project to a
  service by adding the service id to the project's `services` list.
- **Fill a gap:** content the source material did not cover is a `pending(...)`
  value. Replace it with real content, or set `showPendingFields` to `false` in
  `config.ts` to hide every placeholder.

`npm test` validates every cross-reference, so a typo in an id fails the suite
rather than silently dropping a relationship.

## How it is put together

```
src/
  content/        Structured data and the derived relationship graph
  state/          The interaction store: intent in, highlight and field mode out
  system/         Director (choreography), scroll model, environment detection
  field/          Cube field: wave maths, shaders, camera rail, renderer, fallback
  schematic/      Trace routing, anchor registry, overlay canvas, the spine
  constellation/  Deterministic layout and the SVG graph
  projects/       Architecture diagram renderer and the inspector
  sections/       Hero, Studio (About.tsx), Technologies, Projects, Contact
  components/     Navigation, section frame, shared pieces
e2e/              Browser smoke test
scripts/          Visual QA helpers
```

The flow of an interaction:

1. A component records intent in the store (`hoverTech('python')`).
2. `resolveHighlight` derives what should be lit; every view reads that.
3. The director sees the change, fires a signal from the hovered element
   along a schematic trace, and where the trace reaches a via, the cube field
   ripples in the same tone.
4. Selecting a project or changing section changes the field's *mode*, a
   weighting of wave behaviours that is tweened so the surface morphs.

`DECISIONS.md` records why it is built this way.

## URL switches

| Query | Effect |
| --- | --- |
| `?nowebgl` | Use the static field rendering |
| `?reduced` | Behave as if reduced motion were requested |
| `?quality=high\|medium\|low` | Start at a specific quality tier |
| `?webgl=force` | Keep the WebGL field even on a software renderer |

## Accessibility and performance

- Semantic sections and headings, a skip link, visible focus throughout.
- The constellation is one tab stop; arrow keys move between nodes, Enter
  focuses one, Escape releases it. The project inspector takes focus when it
  opens and returns it when it closes.
- `prefers-reduced-motion` freezes the field and removes transitions; the
  site stays fully usable.
- Without WebGL (or on a software renderer) the field is drawn once as a
  static isometric plot from the same wave function.
- The field is one draw call with all motion in the vertex shader. Quality
  adapts to measured frame time and rendering pauses when the tab is hidden.
