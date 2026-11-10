# Morning report

Session of 2026-11-10. Project: `C:\Users\chris\workspace\rowles-portfolio`.

The site is built, runs locally, and passes every automated check. Nothing was
pushed, deployed or published. The repository is local only, with all work
committed on `main` and a clean working tree.

**The site is now about Versyx Digital, not about Chris Rowles personally.**
It was first built as a personal portfolio from the original brief. Two later
messages changed that: a list of six projects to show, and a request to make
the content about the studio. Both are done. The first section of this report
covers that change; the rest describes the site as it now stands.

## How to run it

```bash
cd C:\Users\chris\workspace\rowles-portfolio
npm install        # already done; only needed on a fresh clone
npm run dev        # then open the address it prints
```

```bash
npm run build      # production build to dist/
npm run preview    # serve dist/
npm run check      # types, lint, 79 unit tests, build, 80 browser checks
```

`npm run check` needs Chrome or Edge installed for the browser step. It does
not download a browser.

## What changed for Versyx Digital

**Identity.** The hero, navigation, page title and footer say Versyx Digital.
The line under the name reads "Software studio · founded by Chris Rowles". The
introduction is your description of the studio, almost word for word.

**Studio section.** The career timeline is gone, along with the SentryBay and
Go Deploy Labs roles. In its place is a schematic of the five services you
listed. Selecting one shows what is on record about it and which catalogued
projects are examples of it.

**Six projects.** The catalogue holds exactly the six you listed, in your
order. Each has an architecture diagram drawn only from its own site or
README, and its own field behaviour:

| Ref | Project | Diagram shows | Field behaviour |
| --- | --- | --- | --- |
| SYS-01 | MKEditor | Document pipeline, desktop shell, AI assistant | Ruled rows |
| SYS-02 | The Home Counties | The raid loop, hideout to extraction | Street plan |
| SYS-03 | Aldervast | One authoritative server, three ways to run it | Island |
| SYS-04 | ED:CS | Ingest into the catalogue, and the read path out | Catalogue of systems |
| SYS-05 | OMG | Lexer to virtual machine, self-hosted compiler, native path | Pipeline stages |
| SYS-06 | wssh | Browser terminal to remote shell | Signal pulses |

**Vigil was removed.** It was on your existing site but not in your list, so I
took it out. Say if you want it back; it is one entry in
`src/content/projects.ts`, and the old one is in the git history.

**Technologies.** Seven were added from the new project stacks: Rust, C,
GDScript, Godot, xterm.js, Alpine.js and Paramiko. Guacamole was removed with
the Go Deploy role. The graph now has 49 nodes.

## Decisions for you to check

These are judgement calls I made to keep moving. Each is quick to change.

- **Service descriptions.** You gave the list of services, not descriptions.
  For web applications, consulting and bug fixing I wrote one line each and
  quoted supporting statements from your existing site. APIs and AI-integrated
  workflows have nothing published to draw on, so they show a "Pending" block.
  Edit `src/content/services.ts`.
- **Which projects illustrate which service.** My tagging: MKEditor for web
  applications and AI; ED:CS for web applications and APIs; wssh for web
  applications. The two games and OMG are not tagged to a service.
- **The technology graph still starts from your personal skills list.** That
  list came from your own site, not from a Versyx source. It is labelled "From
  the founder's published skills" in the UI. Trim it in
  `src/content/technologies.ts` if the studio's list should be narrower.
- **Contact details.** The email is the one published on the MKEditor site.
  The links are the Versyx Digital GitHub organisation and your LinkedIn. That
  page also publishes a phone number and `chris.rowles.info`; I left both out.
- **"Open to new projects and consulting."** My wording, replacing "open to
  lead and senior roles", which no longer fits a company site.
- **Home Counties and Aldervast purpose.** Neither site says why the game is
  being made, so "Purpose" is pending for both.
- **Folder and package name.** Still `rowles-portfolio`, as you specified the
  folder. The package description was updated.

## Readability, fit and mobile pass

Requested after the studio version: undo the two changes made in response to
the inspiration images, make content fit and read better, and make sure it
works on mobile.

**Reverted.** Lit crests are edge-lit again, as in the first build. The
constellation has no instrument rings and no node halos.

**Easier to read.**

- Every content section now sits on a dark scrim, so body text is always set
  against near-black. The field stays visible as texture, and at full strength
  in the hero and below the contact details.
- Secondary and tertiary text colours are lighter, and small labels went from
  11px to 12px.
- Constellation labels hold a readable size however small the graph is drawn.
  Before, they shrank with it to about 7px on a laptop or phone.
- Diagram type is larger, and every node label was checked to fit its box.
- Panels (service record, technology record, standby bay) are more opaque.

**Fits better.**

- On short laptop screens (1280×720, 1366×768) the whole hero now fits in the
  first screen.
- The six-column OMG diagram uses narrower cells so it fits beside the
  catalogue without shrinking its type.

**Mobile.**

- Diagrams are drawn at full size and pan sideways. Under each one is a row of
  stage buttons, so every stage can be inspected without panning.
- The founder credit in the hero no longer breaks mid-name.
- In a focused constellation view only the inner ring is labelled on a phone;
  the record below lists everything connected.
- Traces that only make sense between side-by-side columns stay off on
  single-column layouts.

`scripts/audit.mjs` walks the site at six sizes (1280×720, 1366×768,
1920×1080, 768×1024, 390×844, 360×740), screenshots every section and the
main interactive states, and reports clipped text, anything off-screen and
diagram labels that spill their boxes. It reports none. I also read through
the screenshots at laptop, tablet and phone sizes.

The seventeen inspiration images informed the first build only through three
of them; the other fourteen arrived later, and the two changes they prompted
have been reverted as above.

## What was implemented

**The cube field.** 15,376 cubes on the high tier, drawn in one call from one
instanced box. All motion is computed in the vertex shader from each cube's
cell position. Lighting, edge lines, colour propagation and the fade into
darkness are in the fragment shader. The camera follows a rail with one pose
per section, interpolated by scroll.

**Field modes.** Each section and each project gives the field a different
behaviour, and the surface morphs between them. There are eight basis
behaviours: travelling waves, interference, concentric pulses, ruled rows,
spiral star columns, a street plan, an island and a staircase.

**Schematic overlay.** Components declare connections between named anchors.
One canvas routes chamfered orthogonal traces between their live positions
every frame, so they hold through scroll and resize. Traces can end on DOM
elements, on constellation nodes, or on a specific cube in the field. A spine
trace joins every section heading.

**The rule that ties it together.** A signal travels along a trace as a pulse.
Where the trace reaches a via it becomes a ripple of the same colour in the
field. Hovering a technology, a project or a service all use it.

**Technology constellation.** 49 technologies in 6 groups, each with its own
glyph. Hover lights a node, its relations and the projects using it. Selecting
pulls its neighbourhood into a ring. Category filters regroup the network.
Layout is a deterministic function, not a force simulation.

**Project system explorer.** A catalogue, a standby bay that previews whichever
system is under the cursor, and an inspector with a data-driven architecture
diagram, selectable stages, and detail split across three tabs.

**One interaction model.** A zustand store holds intent. Two pure functions
derive what is lit and how the field behaves. A director module turns state
changes into choreography.

**Content model.** Everything rendered comes from `src/content`. Relationships
are derived, so adding a project, technology or service updates every view.

## What is working

- All five sections, at desktop, tablet and phone widths.
- Field, overlay, constellation, service schematic and explorer responding to
  each other.
- Keyboard: skip link, visible focus, arrow keys through the constellation,
  focus moved into and out of the inspector.
- Reduced motion: the field holds still and transitions are removed.
- No WebGL, or a software renderer: a static isometric plot of the same wave
  function replaces the field.
- Adaptive quality: three tiers, stepping down on measured frame time.

## What was tested

| Check | Result |
| --- | --- |
| TypeScript, strict | Pass |
| ESLint | Pass, no warnings |
| Unit tests (Vitest) | 79 of 79 |
| Production build | Pass |
| Browser smoke test | 80 of 80 |
| Fit audit, six viewport sizes | No problems reported |
| axe-core, WCAG A and AA | No violations, with colour contrast excluded (see below) |
| Frame rate, high tier, 1440×900 | 60 to 61 fps |

The browser test runs the production build in headless Chrome at 1440×900,
820×1180 and 390×844, plus reduced motion and no WebGL. It opens all six
projects and confirms each draws its diagram and gives the field a distinct
behaviour.

**How visual checks were done.** I took screenshots through headless Chrome,
which used the machine's real GPU (RTX 3060 Ti), and inspected them across
many states, including each new project and each new field behaviour. Frame
rate was measured in the page. I did not watch the animation in a visible
window: the in-app browser pane was hidden and throttled. So motion quality is
verified by measurement and still frames, not by eye.

## What remains incomplete

Content no source provides. Each is a marked `pending` slot in `src/content`:

- Descriptions for the APIs and AI-integrated workflows services.
- Purpose for The Home Counties and Aldervast.
- Engineering challenges for MKEditor, The Home Counties and Aldervast.
- Outcomes or metrics for MKEditor, The Home Counties, ED:CS and wssh.

Set `showPendingFields` to `false` in `src/content/config.ts` to hide them.

Not built:

- No social share image. The page has Open Graph text tags only.
- No project screenshots or game footage. Both games have strong imagery on
  their own sites; this design uses diagrams instead and links out.
- No client list, testimonials or case studies. Nothing published to base
  them on.

## Known issues

- **Only Chromium was tested.** Firefox and Safari, including iOS Safari, are
  untested.
- **No real phone or tablet was used.** Mobile results come from Chrome's
  device emulation.
- **Contrast over the field is not machine-checked.** Text colours meet AA
  against the page background, and the field is lowered behind text sections,
  but a lit crest can pass behind a line of copy.
- **No screen reader pass.**
- **Diagrams pan sideways on phones.** They are drawn at full size so the type
  is readable; the stage buttons under each one avoid the need to pan.
- **The three.js chunk is about 249 kB gzipped.** It loads after first paint.
- **`npm audit` reports 10 moderate findings**, all in the ESLint toolchain.
  Production dependencies report none.
- **Project facts can go stale.** Version numbers and counts for the two games
  (Aldervast 1.14.2, raid figures for The Home Counties) were read from their
  sites on 2026-11-10 and both are in active development.

## Recommended next steps

1. Open it in a normal browser and judge the motion by eye.
2. Go through "Decisions for you to check" above.
3. Fill the pending content, or hide it.
4. Test in Firefox and Safari, and on a real phone.
5. Add a share image, and decide whether the games should show imagery.
6. Choose where to host it. `dist/` works from any path as built.
