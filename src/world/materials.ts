import { Color, MeshStandardMaterial } from 'three';

export const COLORS = {
  floor: '#b9a183',
  stone: '#a48d76',
  stoneLight: '#cdb89a',
  stoneDark: '#7d6a5e',
  ochre: '#c99a5b',
  moss: '#7f9a5a',
  wood: '#8a5a36',
  woodDark: '#5e3b22',
  roof: '#6b3f4f',
  plum: '#5d4470',
  ice: '#cfeefa',
  water: '#4f9fc4',
  lantern: '#ffcf7a',
  carpet: '#8a2a3a',
  plaster: '#e6d6b8',
  slate: '#5a5266',
};

/**
 * Surface patterns drawn in the shader from world position, selected per vertex
 * through the `pattern` attribute (geometry without it renders plain).
 *  - stone:  coursed blocks on walls, flagstones on floors
 *  - planks: wooden boards
 *  - grid:   faint 1 m greybox grid (feel gym)
 *  - plaster: plain with a gentle mottle
 */
export const PATTERN = { plain: 0, stone: 1, planks: 2, grid: 3, plaster: 4 } as const;
export type Pattern = keyof typeof PATTERN;

const VERT_DECL = /* glsl */ `
attribute float pattern;
varying float vPattern;
varying vec3 vWPos;
varying vec3 vWNormal;
`;
const VERT_BODY = /* glsl */ `
vPattern = pattern;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);
`;
const FRAG_DECL = /* glsl */ `
varying float vPattern;
varying vec3 vWPos;
varying vec3 vWNormal;
float twHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// Smooth value noise and a little fBm: weathering that doesn't repeat from block to block.
float twNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = twHash(i);
  float b = twHash(i + vec2(1.0, 0.0));
  float c = twHash(i + vec2(0.0, 1.0));
  float d = twHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float twFbm(vec2 p) { return twNoise(p) * 0.6 + twNoise(p * 2.7 + 7.3) * 0.3 + twNoise(p * 7.1 + 3.1) * 0.1; }
// Distance (m) from a cell's border, for bevels.
float twEdge(vec2 local, vec2 size) {
  vec2 d2 = min(local, 1.0 - local) * size;
  return min(d2.x, d2.y);
}
// Distance (m) to the nearest cell border, anti-aliased into a 0..1 mortar line.
float twLine(vec2 local, vec2 size, float width) {
  vec2 d2 = min(local, 1.0 - local) * size;
  float d = min(d2.x, d2.y);
  float aa = max(fwidth(d), 1e-4);
  return 1.0 - smoothstep(width - aa, width + aa, d);
}
`;
const FRAG_BODY = /* glsl */ `
{
  float pat = floor(vPattern + 0.5);
  vec3 n = abs(normalize(vWNormal));
  bool flat_ = n.y > 0.7;
  vec2 uv = flat_ ? vWPos.xz : (n.x > n.z ? vec2(vWPos.z, vWPos.y) : vec2(vWPos.x, vWPos.y));
  float fade = 1.0 - smoothstep(25.0, 60.0, length(vWPos - cameraPosition));
  // Large-scale weathering on everything: no two stretches of wall quite alike.
  float weather = twFbm(uv * 0.32 + vec2(n.x * 17.0, n.z * 31.0));
  if (pat > 0.5) {
    float tint = 1.0;
    float line = 0.0;
    float shade = 1.0;
    vec3 hue = vec3(1.0);
    if (pat < 1.5) {
      // Stone: bevelled blocks on walls, flagstones underfoot, each a shade of its own.
      vec2 size = flat_ ? vec2(1.3, 0.95) : vec2(0.85, 0.42);
      float row = floor(uv.y / size.y);
      float off = mod(row, 2.0) * 0.5 * size.x;
      vec2 cell = vec2(floor((uv.x + off) / size.x), row);
      vec2 local = vec2(fract((uv.x + off) / size.x), fract(uv.y / size.y));
      float h = twHash(cell);
      tint = 0.86 + 0.18 * h;
      hue = vec3(1.0 + 0.05 * (h - 0.5), 1.0, 1.0 - 0.06 * (h - 0.5));
      line = twLine(local, size, 0.022);
      float e = twEdge(local, size);
      shade = mix(0.8, 1.0, smoothstep(0.02, flat_ ? 0.14 : 0.08, e));
      // Pitted faces: fine speckle and a soft chisel mottle.
      shade *= 0.96 + 0.06 * twHash(floor(uv * 26.0)) + 0.04 * (twNoise(uv * 5.0 + cell * 3.1) - 0.5);
    } else if (pat < 2.5) {
      // Planks along whichever horizontal axis is longer in world space, with grain and nails.
      vec2 size = vec2(2.4, 0.24);
      float row = floor(uv.y / size.y);
      float off = twHash(vec2(row, 3.0)) * size.x;
      vec2 cell = vec2(floor((uv.x + off) / size.x), row);
      vec2 local = vec2(fract((uv.x + off) / size.x), fract(uv.y / size.y));
      float h = twHash(cell);
      tint = 0.84 + 0.2 * h;
      hue = vec3(1.0 + 0.04 * (h - 0.5), 1.0 - 0.02 * (h - 0.5), 1.0 - 0.05 * (h - 0.5));
      line = twLine(local, size, 0.012);
      float grain = sin(local.y * 38.0 + twNoise(vec2(uv.x * 0.9, local.y * 6.0 + h * 9.0)) * 7.0 + h * 20.0);
      shade = 0.95 + 0.05 * grain;
      // Darker, worn ends and a nail at each.
      float endD = min(local.x, 1.0 - local.x) * size.x;
      shade *= mix(0.86, 1.0, smoothstep(0.0, 0.12, endD));
      vec2 nail = vec2(endD - 0.06, (local.y - 0.5) * size.y);
      shade *= mix(0.55, 1.0, smoothstep(0.012, 0.022, length(nail)));
    } else if (pat < 3.5) {
      vec3 fw = max(fwidth(vWPos), vec3(1e-4));
      vec3 g = abs(fract(vWPos - 0.5) - 0.5) / fw + n * 1e4;
      line = (1.0 - min(min(g.x, g.y), min(g.z, 1.0))) * 0.5;
    } else {
      // Plaster: a soft mottle and the odd stain.
      tint = 0.95 + 0.07 * twFbm(uv * 1.6);
      shade = mix(0.9, 1.0, smoothstep(0.25, 0.45, twNoise(uv * 0.7 + 11.0)));
    }
    diffuseColor.rgb *= mix(vec3(1.0), hue * tint * shade, fade);
    diffuseColor.rgb *= 1.0 - line * 0.34 * fade;
    diffuseColor.rgb *= mix(1.0, 0.9 + 0.16 * weather, fade);
  } else {
    // Plain surfaces only get a faint wash of weathering.
    diffuseColor.rgb *= mix(1.0, 0.95 + 0.08 * weather, fade);
  }
  // Soft contact shadow where walls meet ground-level floors (a cheap stand-in for AO).
  if (abs(vWNormal.y) < 0.5) {
    float h = vWPos.y;
    diffuseColor.rgb *= mix(0.68, 1.0, smoothstep(-0.05, 0.9, h));
  }
}
`;

/** Vertex-coloured, flat-shaded standard material with optional per-vertex surface patterns. */
export function worldMaterial(opts: { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number } = {}): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color('#ffffff'),
    vertexColors: true,
    flatShading: true,
    roughness: opts.roughness ?? 0.92,
    metalness: opts.metalness ?? 0,
  });
  if (opts.emissive) {
    m.emissive = new Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_BODY);
  };
  m.customProgramCacheKey = () => 'tw-world';
  return m;
}
