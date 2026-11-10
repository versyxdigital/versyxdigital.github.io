import { MAX_RIPPLES, RIPPLE_LIFETIME, RIPPLE_SPEED } from './waveMath';

/**
 * GLSL for the cube field.
 *
 * The whole simulation runs in the vertex shader: every cube evaluates the
 * same height function from its cell position, so the CPU uploads nothing per
 * frame except a handful of uniforms. The height function mirrors
 * waveMath.ts term for term — keep the two in sync.
 */

const f = (n: number): string => (Number.isInteger(n) ? `${n}.0` : `${n}`);

const waveFunctions = /* glsl */ `
#define MAX_RIPPLES ${MAX_RIPPLES}
#define TAU 6.283185307179586

uniform float uPhase;
uniform float uClock;
uniform float uAmp;
uniform float uFreq;
uniform float uOrder;
uniform float uTravel;
uniform float uInterf;
uniform float uRings;
uniform float uScan;
uniform float uStars;
uniform vec2 uFocus;
uniform vec4 uRipple[MAX_RIPPLES];
uniform float uRippleTone[MAX_RIPPLES];
uniform vec3 uCursor;

const vec3 CYAN = vec3(0.153, 0.863, 0.922);
const vec3 BLUE = vec3(0.196, 0.482, 1.0);
const vec3 VIOLET = vec3(0.549, 0.451, 0.910);

vec3 toneColour(float tone) {
  return tone < 0.5 ? CYAN : (tone < 1.5 ? BLUE : VIOLET);
}

float travel(vec2 p, float t, float f) {
  float a1 = 0.35 + 0.25 * sin(t * 0.013);
  float a2 = 2.1 + 0.3 * sin(t * 0.017 + 1.3);
  float a3 = 4.4 + 0.2 * sin(t * 0.011 + 2.1);
  return 0.5 * sin(dot(p, vec2(cos(a1), sin(a1))) * 0.19 * f - t * 0.62)
       + 0.32 * sin(dot(p, vec2(cos(a2), sin(a2))) * 0.31 * f - t * 0.81 + 1.7)
       + 0.18 * sin(dot(p, vec2(cos(a3), sin(a3))) * 0.53 * f - t * 1.13 + 4.1);
}

float interference(vec2 p, float t, float f) {
  vec2 s1 = 22.0 * vec2(cos(t * 0.021), sin(t * 0.027));
  vec2 s2 = 26.0 * vec2(cos(t * 0.017 + 2.4), sin(t * 0.023 + 1.1));
  vec2 s3 = 18.0 * vec2(cos(-t * 0.019 + 4.0), sin(t * 0.015 + 3.3));
  float k = 0.55 * f;
  return (sin(length(p - s1) * k - t * 1.25)
        + sin(length(p - s2) * k - t * 1.25)
        + sin(length(p - s3) * k * 1.21 - t * 1.4)) / 3.0;
}

float rings(vec2 p, float t) {
  float d = length(p - uFocus);
  float env = pow(0.5 + 0.5 * sin(d * 0.105 - t * 0.475), 3.0);
  return 1.4 * sin(d * 0.42 - t * 1.9) * env / (1.0 + d * 0.02);
}

float scan(vec2 p, float t) {
  const float K = 0.8;
  float row = floor(p.y * K / TAU + 0.5);
  float ridge = 0.5 + 0.5 * cos(p.y * K);
  ridge *= ridge;
  float words = 0.5 + 0.5 * sin(p.x * 0.5 - t * 1.2 + row * 1.7);
  float carriageX = mod(t * 7.0 + row * 13.0, 150.0) - 75.0;
  float carriage = exp(-pow((p.x - carriageX) * 0.16, 2.0));
  return ridge * (0.25 + 0.55 * smoothstep(0.3, 0.6, words) + 0.9 * carriage) - 0.35;
}

float spiral(vec2 p, float t) {
  float r = length(p);
  return 0.5 + 0.5 * sin(2.0 * atan(p.y, p.x) - log(r + 1.0) * 3.2 + t * 0.12);
}

float baseHeight(vec2 p) {
  float h = 0.0;
  if (uTravel > 0.0001) h += uTravel * travel(p, uPhase, uFreq);
  if (uInterf > 0.0001) h += uInterf * interference(p, uPhase, uFreq);
  if (uRings > 0.0001) h += uRings * rings(p, uPhase);
  if (uScan > 0.0001) h += uScan * scan(p, uPhase);
  if (uStars > 0.0001) h += uStars * (spiral(p, uPhase) * 0.3 - 0.25);
  h *= uAmp;
  const float q = 2.2;
  return h + (floor(h * q + 0.5) / q - h) * uOrder;
}

/* Height of all active ripples; accumulates their colour and energy into tone. */
float rippleHeight(vec2 p, inout vec4 tone) {
  float h = 0.0;
  for (int i = 0; i < MAX_RIPPLES; i++) {
    vec4 r = uRipple[i];
    float age = uClock - r.z;
    if (age <= 0.0 || age >= ${f(RIPPLE_LIFETIME)} || r.w == 0.0) continue;
    float u = length(p - r.xy) - age * ${f(RIPPLE_SPEED)};
    float sigma = 2.2 + age * 0.9;
    float env = exp(-(u * u) / (2.0 * sigma * sigma)) * exp(-age * 0.55);
    h += r.w * env * cos(u * 1.15);
    float e = abs(r.w) * env;
    tone += vec4(toneColour(uRippleTone[i]) * e, e);
  }
  return h;
}

float cursorHeight(vec2 p) {
  if (uCursor.z <= 0.001) return 0.0;
  float d = length(p - uCursor.xy);
  return uCursor.z * 0.55 * exp(-(d * d) / 26.0) * (0.75 + 0.25 * cos(d * 0.9 - uClock * 2.4));
}

float surface(vec2 p) {
  vec4 unused = vec4(0.0);
  return baseHeight(p) + rippleHeight(p, unused) + cursorHeight(p);
}
`;

export const vertexShader = /* glsl */ `
attribute vec2 aCell;
attribute float aSeed;

uniform float uCell;
uniform float uTwist;

varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vFaceN;
varying vec3 vNormal;
varying vec2 vSlope;
varying vec4 vRipple;
varying float vH;
varying float vSeed;
varying float vDepth;
varying float vSpike;
varying float vCursorE;

${waveFunctions}

const float COLUMN_DEPTH = 7.0;

void main() {
  vec2 p = aCell;
  vec4 tone = vec4(0.0);
  float h0 = baseHeight(p) + rippleHeight(p, tone) + cursorHeight(p);

  // Isolated "star" columns: a per-cube term, so it stays out of the surface function.
  float spike = 0.0;
  if (uStars > 0.0001) {
    float arm = spiral(p, uPhase);
    spike = uStars * uAmp * step(0.925, aSeed) * smoothstep(0.35, 0.9, arm)
          * (1.6 + 0.6 * sin(uPhase * 0.9 + aSeed * 40.0)) * exp(-length(p) * 0.012);
  }
  float h = h0 + spike;

#ifdef FIELD_NEIGHBOURS
  vec2 slope = vec2(surface(p + vec2(uCell, 0.0)) - h0, surface(p + vec2(0.0, uCell)) - h0) / uCell;
#else
  vec2 slope = vec2(0.0);
#endif

  // Columns yaw slightly with the local gradient: coordinated, never random.
  float yaw = clamp((slope.x - slope.y) * 0.6, -1.0, 1.0) * 0.17 * uTwist;
  float c = cos(yaw);
  float s = sin(yaw);
  float foot = uCell * 0.86;
  vec2 xz = vec2(c * position.x - s * position.z, s * position.x + c * position.z) * foot;
  float depth = (0.5 - position.y) * COLUMN_DEPTH;
  vec3 world = vec3(p.x + xz.x, h - depth, p.y + xz.y);

  vWorld = world;
  vLocal = position;
  vFaceN = normal;
  vNormal = vec3(c * normal.x - s * normal.z, normal.y, s * normal.x + c * normal.z);
  vSlope = slope;
  vRipple = tone;
  vH = h0;
  vSeed = aSeed;
  vDepth = depth;
  vSpike = spike;
  float dc = length(p - uCursor.xy);
  vCursorE = uCursor.z * exp(-(dc * dc) / 40.0);

  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
uniform vec3 uBg;
uniform vec3 uBase;
uniform float uPhase;
uniform float uAmp;
uniform float uGlow;
uniform float uDim;
uniform vec2 uFadeCenter;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uFogStart;
uniform float uFogDensity;

varying vec3 vWorld;
varying vec3 vLocal;
varying vec3 vFaceN;
varying vec3 vNormal;
varying vec2 vSlope;
varying vec4 vRipple;
varying float vH;
varying float vSeed;
varying float vDepth;
varying float vSpike;
varying float vCursorE;

const vec3 CYAN = vec3(0.153, 0.863, 0.922);
const vec3 BLUE = vec3(0.196, 0.482, 1.0);
const vec3 VIOLET = vec3(0.549, 0.451, 0.910);
const vec3 L_KEY = vec3(-0.5145, 0.8027, 0.3011);
const vec3 L_RIM = vec3(0.7083, 0.2530, -0.6577);

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 n = normalize(vNormal);
  float top = step(0.5, vFaceN.y);
  vec2 p = vWorld.xz;

  // ── Defined geometric edges, anti-aliased in screen space ──────────
  vec2 a = abs(vLocal.xz);
  float eT = max(a.x, a.y);
  float edgeTop = smoothstep(0.455 - fwidth(eT), 0.455, eT);
  float u = abs(abs(vFaceN.x) > 0.5 ? vLocal.z : vLocal.x);
  float edgeVert = smoothstep(0.455 - fwidth(u), 0.455, u) * exp(-vDepth * 0.7);
  float edgeRim = 1.0 - smoothstep(0.0, 0.07 + fwidth(vDepth), vDepth);
  float edge = mix(max(edgeVert, edgeRim), edgeTop, top);

  // ── Lighting: one cool key, one deep-blue rim. Tops follow the macro surface. ──
  vec3 ns = normalize(vec3(-vSlope.x, 1.5, -vSlope.y));
  float topLit = 0.30 + 0.95 * max(dot(ns, L_KEY), 0.0);
  float keySide = max(dot(n, L_KEY), 0.0);
  float rimSide = max(dot(n, L_RIM), 0.0);
  float sideLit = (0.07 + 0.50 * keySide + 0.16 * rimSide) * exp(-vDepth * 0.5);
  float lit = mix(sideLit, topLit, top);
  // Troughs sit in their neighbours' shadow.
  float trough = mix(0.5, 1.0, smoothstep(-0.9, 0.7, vH / max(uAmp, 0.35)));
  vec3 col = uBase * (0.82 + 0.36 * vSeed) * lit * trough;
  col += vec3(0.020, 0.040, 0.085) * rimSide * (1.0 - top) * exp(-vDepth * 0.6);

  // ── Illumination travelling with the wave ──────────────────────────
  float crest = smoothstep(0.12, 0.95, vH / max(uAmp, 0.35));
  float band = pow(0.5 + 0.5 * sin(dot(p, vec2(0.8, 0.6)) * 0.055 - uPhase * 0.33), 3.0);
  float ph = 0.5 + 0.5 * sin(dot(p, vec2(-0.5, 0.866)) * 0.03 + uPhase * 0.07);
  vec3 tone = mix(CYAN, BLUE, smoothstep(0.0, 0.55, ph));
  tone = mix(tone, VIOLET, smoothstep(0.55, 1.0, ph));
  float energy = uGlow * crest * (0.34 + 0.66 * band) + vSpike * 0.42;
  vec3 glow = tone * energy + vRipple.rgb * 1.0 + CYAN * vCursorE * 0.2;

  col += vec3(0.40, 0.50, 0.62) * edge * mix(0.05, 0.085, top);
  col += glow * edge * 1.25;
  col += glow * mix(0.36 * exp(-vDepth * 1.3), 0.2, top);

  // ── Emerge from, and dissolve into, the page background ────────────
  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, length(p - uFadeCenter));
  float camDist = length(vWorld - cameraPosition);
  fade *= exp(-max(camDist - uFogStart, 0.0) * uFogDensity);
  // The nearest cubes recede as well, so the field floats in darkness on every side.
  fade *= mix(0.3, 1.0, smoothstep(uFogStart * 0.62, uFogStart * 0.98, camDist));
  col = mix(uBg, col, clamp(fade * uDim, 0.0, 1.0));

  // Dither: near-black gradients band badly without it.
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
