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
npm run check      # types, lint, 79 unit tests, build, 90 browser checks
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

## Later content changes (2026-11-10, evening)

**The Home Counties is now about how it is built.** Its entry used to describe
game mechanics (the raid loop, traders, scavs). It was rewritten after reading
the game's own README, design notes and project files in
`C:\Users\chris\workspace\home-counties-v0.1.209`, which were only read.

- The diagram shows the build pipeline and the engine: map data, the Python
  map generator, the generated map file, the map builder, the navmesh, enemy
  AI, squad sync over Steam, the asset pipeline and the headless smoke test.
- Engineering lists real problems from the project's notes: keeping a
  generated map stable, pathfinding past Godot's 4,096-polygon search limit,
  the seven-second pipeline-compile stall and how it was removed, foliage
  hand-over without popping, and host-run enemies in co-op.
- Figures were counted from the project at v0.1.209: 140 scripts, about 62,500
  lines of GDScript, 66 shaders, 224 tool scripts, and a 7,200-line smoke
  test. They will drift as the game changes.
- Python was added to its technologies, for the map and asset tooling.

One thing I left out on purpose: the project's notes show it is developed with
an AI assistant. That could illustrate the "AI-integrated workflows" service,
but it is your call whether to say so publicly, so the site does not mention
it.

**Services on phones open in place.** On a phone, a service's record used to
sit below the whole list, so reading one and choosing the next meant scrolling
down and back up each time. Each service is now a row that opens its record
directly underneath it, with the next service visible below. Tablets and
desktop are unchanged.

**Removed at your request.**

- The "Field …" readout in the navigation bar.
- The travelling and interference markers pinned to the cube field in the hero.
- "founded by Chris Rowles" in the hero subtitle. The Studio section still
  credits you as founder.
- The "Field behaviour · …" block on every project's Stack tab. The field
  still changes behaviour when a project is opened; it is just no longer
  explained there.
- The "In use" block on every technology record, in the desktop panel and the
  phone view.
- The cursor reticle on the cube field, with its X, Z and H readout. Moving
  the cursor over the field still disturbs it.

**A mistake of mine, since fixed.** Between 20:32 and about 20:55 on
2026-11-10 this file was corrupted in the repository: one of my edits inserted
a sentence between every character. The site was not affected. The file was
rebuilt from the last good version in git and the edits re-applied.

## MKEditor site restored, ED:CS links trimmed

**MKEditor.** The product site that used to be at `/mkeditor` was lost when
this site was force-pushed over the old repository. It is restored at
`https://versyx.digital/mkeditor/`, including the web app at `/mkeditor/web/`.

It was not rebuilt from memory. A clone of the old repository, made a minute
before the force push, was still on disk at
`C:\Users\chris\workspace\versyxdigital.github.io` (commit `fb98a0f`,
"v4.1.0"). Its `docs/mkeditor` folder is exactly what GitHub served at
`/mkeditor`, and all 468 files were copied from it into `public/mkeditor/`.

Two files were changed, and only in their paths. The landing page loaded its
script, stylesheet, images, logo and favicon from the site root (`/assets/…`),
where the old repository kept an identical second copy. The root now belongs
to this site, so those 14 references point at the copy beside the page
(`/mkeditor/assets/…`). Everything else is byte-for-byte the original.

I compared old and new by serving both from disk: same title, same text, same
26 links, all 13 images loading, the same page height, no failed requests or
script errors, and a pixel-identical first screen, for both the landing page
and the web app. After deploying I checked the live pages too.

Things to know:

- **Keep that folder.** `C:\Users\chris\workspace\versyxdigital.github.io`
  is now the only copy of the old site's source and git history. Do not run
  `git pull` or `git reset` in it. Pushing its `main` to a new branch on
  GitHub (for example `legacy-mkeditor-site`) would make it safe.
- The restored site is the built output, not source. To change it, edit the
  source in that folder, rebuild, and copy `docs/mkeditor` across again.
- The MKEditor logo links to `/`, which used to be the same landing page and
  is now the Versyx Digital home page.
- Its `og:url` and canonical tags still name `versyxdigital.github.io`, which
  redirects to the custom domain.

**ED:CS.** The hosted site and API no longer run, so the live-site and
API-documentation links are gone. The project keeps a single Source button
(to `edcs-app`), its description says the hosted site is no longer running,
and its facts carry "Status: No longer hosted · source available".

## Technologies on phones: a layered stack

Feedback with a phone screenshot: the stack and tooling network did not fit
well on mobile. It showed 49 nodes with most of them unlabelled and the few
labels colliding. A graph of that many nodes cannot be made readable at that
width, so phones now get a different drawing of the same data.

**The layered stack.** Below 720px wide the Technologies section shows one
layer per group (Languages, Frontend, Backend, Data, Infra and Ops, Tooling
and engines), joined by a signal rail down the left. Every technology is
named and is a touch target at least 44px tall.

- Tap a technology and everything it connects to lights up, in whichever
  layers those sit. Unrelated ones recede.
- The rail energises between the layers involved and carries a pulse along
  it, and each connected layer's count changes to "2 linked" and so on.
- The technology's record opens in place, directly under its layer, with its
  projects as links. Before, the record was below the whole graph.
- It reads the same shared state as the desktop graph, so choosing a
  technology from a project's stack tab arrives here already in focus, and
  the cube field still ripples when one is selected.

Tablets and desktops keep the network graph. The category filter row is not
shown on phones, because the layers are the categories.

Checked at 390×844 and 360×740 in Chrome's device emulation, not on a real
phone. The section is about three screens tall on a phone.

## Sections fit the screen, and type is larger

Feedback with a screenshot at 1905×945: the information was hard to read, and
sections did not fit the viewport. In that screenshot the type was small for a
1920-wide display and the Studio section ran off the bottom.

**Each section is now exactly one screen on desktop.** Hero, Studio,
Technologies, Projects and Contact each fill the viewport and nothing inside
runs past the bottom. Scrolling settles gently on section boundaries.

- **Studio.** A compact header, and the service record shows its evidence and
  its example projects side by side instead of stacked.
- **Technologies.** The graph is sized to the height left under the filters.
- **Projects.** The inspector is one panel sized to the screen. The
  architecture diagram is now the first of four tabs (Architecture, Overview,
  Engineering, Stack and links) and is scaled to the space it has. Only a
  tab's body scrolls, and only if it has more to say than fits. The catalogue
  is more compact: one line of classification per project, no stack line.

This applies when the window is at least 1081px wide and 760px tall. Below
that (phones, tablets, very short windows) sections flow at their natural
height as before, because the content cannot fit one screen there.

**Type is larger on large screens.** The base size scales from 16px on a small
laptop to 19px on a 1920-wide display, and everything follows it. Secondary
text is lighter again, and the scrim behind sections is darker.

`scripts/fit.mjs` measures this: at 1905×945, 1920×1080, 1536×864, 1440×900 and
1366×768 it visits every section and several project states and checks the
section is one screen tall with nothing overflowing. All 55 states fit.

**Trade-offs to know about.**

- The field is dimmer behind Studio, Technologies and Projects than in the
  first build. It is at full strength in the hero and below the contact
  details.
- Project classifications were shortened so they fit one line: for example
  "Extraction shooter", not "Extraction shooter · early access". The status is
  still in each project's facts.
- The "Client work" row was removed from the catalogue; the line above the
  catalogue already says it.
- At 1366×768, diagrams are drawn at about 85% size to fit.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub
Pages on every push to `main`, and can be run by hand from the Actions tab. It
type-checks, lints and runs the unit tests first, so a broken build does not
deploy.

**Deployed.** On your instruction I pushed `main` at 18:41 on 2026-11-10. The
workflow ran once and succeeded in 1m 32s (build 1m 9s, deploy 16s), and
GitHub reported the site at `versyx.digital`. Pages was already set to deploy
from GitHub Actions with the custom domain in place.

State when I checked straight afterwards:

- `http://versyx.digital/` serves this site: the right title, all five
  sections, six projects, and no failed requests.
- `https://versyx.digital/` failed with a certificate error. GitHub had not
  yet issued a certificate for the domain. This normally resolves itself
  within an hour of DNS being correct; then tick "Enforce HTTPS" in Settings →
  Pages. If it does not, remove and re-enter the custom domain there to
  restart the check.
- `versyxdigital.github.io/aldervast/` now redirects to
  `https://versyx.digital/aldervast/`, so it hits the same certificate error
  until the certificate exists.
- `versyx.digital/mkeditor/` returns 404. See below.

The run logged a deprecation warning: `actions/checkout@v4`,
`actions/setup-node@v4`, `actions/configure-pages@v5` and the artifact upload
target Node 20 and are being run on Node 24. It works today; the action
versions in `.github/workflows/deploy.yml` should be raised to their current
majors at some point.

From here every push to `main` deploys.

**DNS at GoDaddy.** For the apex domain, GitHub Pages uses four A records.
These are the addresses GitHub documents; confirm them against GitHub's
"Managing a custom domain" page before entering them.

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `versyxdigital.github.io` |

The `www` record is optional; with it, `www.versyx.digital` redirects to the
apex. Remove any GoDaddy "parked" A record or forwarding on `@`, or it will
conflict.

`public/CNAME` contains `versyx.digital` and is published with the site. With
a GitHub Actions deployment GitHub takes the domain from the Pages setting,
not from that file, so step 3 is the one that matters.

**A side effect to expect.** Because this repository is the organisation's
root Pages site, setting a custom domain on it also moves the project sites:
`versyxdigital.github.io/aldervast/` will redirect to
`versyx.digital/aldervast/`. Existing links keep working through the redirect.

The MKEditor site, which was returning 404 at this point, has since been
restored; see "MKEditor site restored" above. HTTPS on the custom domain is
also working now.

No base-path change was needed. The build uses a relative base, so it works
on the custom domain and at the github.io address.

Two things the workflow does not do. It does not run the browser smoke test,
because hosted runners have no GPU for the WebGL field. And publishing makes
the site public, including the pending placeholders and the contact email, so
check "Decisions for you to check" first.

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
| Browser smoke test | 90 of 90 |
| Fit audit, six viewport sizes | No problems reported |
| One-screen fit, five desktop sizes | All 55 states fit |
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
6. To publish, follow "Deploying to GitHub Pages" above.
