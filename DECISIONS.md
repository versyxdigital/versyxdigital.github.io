# Decisions

Significant architectural and design decisions, with the reasoning. Newest last.

## 1. The whole field simulation runs in the vertex shader

The cube field is one `InstancedBufferGeometry` (one box, N² instances) and one
`ShaderMaterial`. Each cube evaluates the wave function from its cell position
in the vertex shader. The CPU uploads a few dozen uniforms per frame and
nothing per cube, so there is one draw call and no per-frame buffer traffic.

Rejected: animating instance matrices on the CPU (15,000 matrix writes and an
upload every frame), and a physically simulated height field in a float
render target (more machinery, harder to make deterministic, no real visual
gain for analytic waves).

## 2. The wave function exists twice, deliberately

`src/field/waveMath.ts` is a CPU mirror of the GLSL in `src/field/shaders.ts`.
This is duplication with a purpose: DOM-space systems need to ask "how high is
the surface at (x, z) right now?" so that schematic traces can end on a cube
and ride the wave with it, the cursor reticle can read out a real height, and
the non-WebGL fallback can draw the same surface. Unit tests guard the pairing
(shared constants, declared uniforms, matching varyings).

## 3. Modes are weights, not scenes

Every field behaviour (travelling waves, interference, concentric pulses, ruled
rows, spiral "star" columns, terracing) is a basis term. A mode is a set of
weights. Changing section or opening a project tweens the weights, so the
surface morphs continuously and never cuts. Wave phase is integrated on the
CPU (`phase += dt * speed`), so a speed change cannot make the wave jump.

## 4. One interaction store, one director

Components only record intent in the zustand store ("this technology is
hovered"). `resolveHighlight` and `resolveVisualMode` derive what should be lit
and how the field should behave. `system/director.ts` is the only module that
turns state changes into choreography. This is what keeps the visual systems
coherent: no component talks to the field or to another component directly.

High-frequency values (wave phase, tweened parameters, ripples, camera
projection) live in a plain mutable module, `field/fieldState.ts`, not in the
store, so nothing that changes every frame can trigger a React render.

## 5. One rule connects the systems: a pulse becomes a ripple

A signal travels along a schematic trace as a pulse. When it reaches a via (a
point where the trace drops to the field layer) it becomes a radial wave of
the same tone in the cube field. Hovering a technology, a project or a career
node, and selecting a project, all go through this one mechanism.

## 6. Schematic overlay is a 2D canvas driven by a registry

Components declare connections between named anchors (`useAnchor`,
`useConnections`). A single fixed canvas resolves anchor positions from live
element rectangles every frame and routes orthogonal, chamfered traces between
them. Traces therefore stay attached through scroll, resize and layout change,
and endpoints can be DOM elements, SVG nodes inside the constellation, or
world positions on the field.

Rejected: SVG paths per connection (many attribute writes per scroll frame and
awkward glow), and CSS-only decorative lines (cannot follow real positions,
which the brief explicitly asks for).

Long cross-column traces switch themselves off on single-column layouts
(`system/viewport.ts`), where they would cut across text.

## 7. Constellation layout is designed, not simulated

`constellation/layout.ts` is a deterministic function: each category owns a
region, members ring a hub, languages take the centre and lean toward the
groups they underpin, then a fixed-iteration relaxation removes overlaps. The
same function produces the overview, the category-filter and the focused
arrangements, so transitions are every node easing to its next position.

Rejected: a force-directed simulation. The brief asks for a layout that feels
designed and does not move unpredictably, and a pure function is testable.

Node size follows role and connectivity in the published material. It is
labelled as such in the UI and is not a proficiency score.

## 8. Content is data, relationships are derived

Everything rendered comes from `src/content`. Projects and roles reference
technologies by id; `content/graph.ts` derives edges, project usage, role
usage and connectivity. Adding a project or a technology updates the
constellation, the explorer and the career schematic without touching a
component. `checkIntegrity()` validates every cross-reference and runs in the
test suite.

## 9. Nothing is invented; gaps are marked

The existing site documents three roles (from 2019), three projects and a
skills list. Where it is silent the content model uses an explicit `Pending`
value, shown as a clearly marked placeholder (`content/config.ts` can hide
them). Architecture diagrams contain only components described on the site or
in the public READMEs of the linked repositories. The pre-2019 career is drawn
as an undocumented dashed lead-in, not filled in.

Technology descriptions separate a neutral `summary` (what the thing is) from
`usage` (how it was used), and `usage` is only set where a source says so.

## 10. Typeface: Geist and Geist Mono, self-hosted

A precise grotesque with a matching monospace, both variable, bundled through
Fontsource so there is no third-party font request. The mono carries section
identifiers, coordinates and live readouts; the sans carries everything read
as prose.

## 11. Technical labels show real values

Small readouts (travelling and interference sums at specific cells, wave
phase, cube count, cursor coordinates and height, field mode) are taken from
the running simulation and written to the DOM by one shared low-frequency
loop (`system/liveText.ts`). No decorative fake numbers.

## 12. Adaptive quality steps down, never up

Three tiers (124², 92², 64² cubes, with DPR caps 1.75 / 1.5 / 1.25). A first
guess comes from device hints; a governor then watches real frame times in
1.5-second windows and drops a tier after two slow windows, or immediately
after one very slow window. It never raises quality, which avoids
oscillating. If the lowest tier still cannot reach about 14 fps, the WebGL
field is retired and the static rendering takes over.

The windows are measured in wall-clock time, not frames. An earlier
frame-counted version never reacted on a renderer running at 3 fps, because
its warm-up alone took half a minute. `scripts/quality.mjs` reproduces that
case on Chrome's software rasteriser: high to static in about eight seconds.

Software rasterisers (SwiftShader, llvmpipe) are detected up front and given
the static rendering directly. The field also stops rendering when the tab is
hidden, and renders on demand only under reduced motion.

## 13. Browser testing through installed Chrome

`playwright-core` drives the Chrome or Edge already on the machine, so no
browser binary is downloaded. `e2e/smoke.mjs` serves the production build and
checks rendering, cross-system interaction, three viewport sizes, reduced
motion and the no-WebGL path, plus axe-core for WCAG A/AA.

## 14. Email address is assembled at runtime

The existing site stores the address split to avoid harvesting. The new site
keeps that: user and domain are separate strings and the `mailto:` is built on
click.
