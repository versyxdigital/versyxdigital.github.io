# Morning report

Session of 2026-11-10. Project: `C:\Users\chris\workspace\rowles-portfolio`.

The site is built, runs locally, and passes every automated check. Nothing was
pushed, deployed or published. The repository is local only, with 8 commits on
`main` and a clean working tree.

## How to run it

```bash
cd C:\Users\chris\workspace\rowles-portfolio
npm install        # already done; only needed on a fresh clone
npm run dev        # then open the address it prints
```

```bash
npm run build      # production build to dist/
npm run preview    # serve dist/
npm run check      # types, lint, 73 unit tests, build, 69 browser checks
```

`npm run check` needs Chrome or Edge installed for the browser step. It does
not download a browser.

## What was implemented

**The cube field.** 15,376 cubes on the high tier, drawn in one call from one
instanced box. All motion is computed in the vertex shader from each cube's
cell position: three travelling waves whose headings drift so the pattern
never loops, three orbiting point sources that interfere, radial ripples,
a cursor swell, and terracing. Lighting, edge lines, colour propagation and
the fade into darkness are in the fragment shader. The camera follows a rail
with one pose per section, interpolated by scroll.

**Field modes.** Each section and each project gives the field a different
behaviour, and the surface morphs between them. Hero: travelling waves with
interference. Technologies: a terraced interference lattice. Contact: a
settled lattice. Vigil: concentric pulses from one origin. MKEditor: ruled
rows with a travelling carriage. ED:CS: isolated columns along spiral arms.

**Schematic overlay.** Components declare connections between named anchors.
One canvas routes chamfered orthogonal traces between their live positions
every frame, so they hold through scroll and resize. Traces can end on DOM
elements, on constellation nodes, or on a specific cube in the field, where
the end rides the wave. A spine trace joins every section heading.

**The rule that ties it together.** A signal travels along a trace as a pulse.
Where the trace reaches a via it becomes a ripple of the same colour in the
field. Hovering a technology, a project or a career node all use it.

**Technology constellation.** 43 technologies, 36 structural links, 6 groups,
each with its own glyph. Hover lights a node, its relations and the projects
using it, and dims the rest. Selecting pulls its neighbourhood into a ring
around it. Category filters regroup the network. Layout is a deterministic
function, not a force simulation. On narrow screens it switches to a compact
canvas with larger touch spacing.

**Project system explorer.** A catalogue, a standby bay that previews whichever
system is under the cursor, and an inspector. Each project has an architecture
diagram generated from data, with signals flowing along the wires and stages
you can select. Detail is split across Overview, Engineering, and Stack and
links.

**Career schematic.** Roles on a real time axis in two parallel tracks, since
Versyx Digital runs alongside employment. The selected role is wired to its
record.

**Contact.** Traces converge on the email node, then leave it down one bus
that drops into the field.

**One interaction model.** A zustand store holds intent. Two pure functions
derive what is lit and how the field behaves. A director module turns state
changes into choreography. Components never talk to each other directly.

**Content model.** Everything rendered comes from `src/content`. Relationships
are derived, so adding a project or technology updates every view.

## What is working

- All five sections, at desktop, tablet and phone widths.
- Field, overlay, constellation and explorer responding to each other.
- Keyboard: skip link, visible focus, arrow keys through the constellation,
  Enter to focus, Escape to release, focus moved into and out of the inspector.
- Reduced motion: the field holds still and transitions are removed.
- No WebGL, or a software renderer: a static isometric plot of the same wave
  function replaces the field. The rest of the site is unaffected.
- Adaptive quality: three tiers, stepping down on measured frame time.

## What was tested

| Check | Result |
| --- | --- |
| TypeScript, strict | Pass |
| ESLint | Pass, no warnings |
| Unit tests (Vitest) | 73 of 73 |
| Production build | Pass |
| Browser smoke test | 69 of 69 |
| axe-core, WCAG A and AA | No violations, with colour contrast excluded (see below) |
| Frame rate, high tier, 1440×900 | 60 to 61 fps |

Unit tests cover content integrity, the derived graph, trace routing, the wave
functions, shader and CPU parity guards, the camera rail, constellation layout
and the interaction store.

The browser test runs the production build in headless Chrome at 1440×900,
820×1180 and 390×844, plus reduced motion and no WebGL. It checks that the
field renders and animates, that hover and selection propagate between
systems, that the inspector, tabs and stages work, and that nothing overflows
horizontally.

**How visual checks were done.** I took screenshots through headless Chrome,
which used the machine's real GPU (RTX 3060 Ti), and inspected them at all
three sizes across many states. Frame rate and frame-to-frame change were
measured in the page. I did not watch the animation in a visible window: the
in-app browser pane was hidden during the session and throttled to about
1.5 fps. So motion quality is verified by measurement and by still frames, not
by eye. It is worth a look in a real browser.

## What remains incomplete

Content the existing site does not provide. Each is a marked `pending` slot in
`src/content`, shown as a "Pending" block in the UI:

- Technology stacks for the SentryBay and Versyx Digital roles.
- Engineering challenges for Vigil and MKEditor.
- Outcomes or metrics for all three projects.
- Career before 2019. The site says 12+ years but lists roles from 2019, so
  the schematic shows an undocumented lead-in rather than invented history.

Set `showPendingFields` to `false` in `src/content/config.ts` to hide the
placeholders.

Not built:

- No social share image. The page has Open Graph text tags only.
- No project screenshots. The existing site uses them; this design uses
  architecture diagrams instead.

## Known issues

- **Only Chromium was tested.** Firefox and Safari, including iOS Safari, are
  untested. The shaders use standard WebGL2 features, so I expect them to
  work, but that is a guess.
- **No real phone or tablet was used.** Mobile results come from Chrome's
  device emulation.
- **Contrast over the field is not machine-checked.** axe cannot evaluate text
  over a moving canvas, so that rule was switched off. Text colours meet AA
  against the page background, and I lowered the field behind text sections,
  but a lit crest can pass behind a line of copy.
- **No screen reader pass.** Semantics and focus handling are in place and axe
  is clean, but nothing was listened to with NVDA or VoiceOver.
- **Diagrams need panning on phones.** They keep a 760px minimum width and
  scroll sideways, with a "Pan" hint.
- **The three.js chunk is about 249 kB gzipped.** It loads after first paint,
  so the text appears first and the field fades in.
- **`npm audit` reports 10 moderate findings**, all in the ESLint toolchain
  (`minimatch`). Production dependencies report none. The suggested fix
  downgrades ESLint, so I left it.
- **The Vigil diagram is drawn from the dashboard README only.** The collector
  documentation page would not load, so the diagram does not say which of
  Tornado and FastAPI serves which endpoint.

## Decisions worth checking

- **Hero statement.** "Software systems, owned end to end." is my wording,
  based on "Comfortable owning systems end-to-end" on your site. Change it in
  `src/content/profile.ts`.
- **Extra technologies.** Monaco, Electron and Webpack come from the MKEditor
  stack, and Guacamole from the Go Deploy entry. They are not in your skills
  list. Each is tagged with where it came from.
- **Repository facts.** Some project detail comes from the public READMEs, not
  from your site: Vigil's two modes, MKEditor's AI providers, ED:CS's A*
  routing and Frontier OAuth. Please check they are current.
- **Email.** Your address is shown as text and assembled at runtime, as on the
  existing site.

Full reasoning is in `DECISIONS.md`.

## Recommended next steps

1. Open it in a normal browser and judge the motion by eye.
2. Fill the pending content, or hide it.
3. Test in Firefox and Safari, and on a real phone.
4. Add a share image and decide whether you want project screenshots.
5. Choose where to host it. `dist/` works from any path as built.
