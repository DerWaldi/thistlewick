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
  if (pat > 0.5) {
    vec3 n = abs(normalize(vWNormal));
    bool flat_ = n.y > 0.7;
    vec2 uv = flat_ ? vWPos.xz : (n.x > n.z ? vec2(vWPos.z, vWPos.y) : vec2(vWPos.x, vWPos.y));
    float fade = 1.0 - smoothstep(25.0, 60.0, length(vWPos - cameraPosition));
    float tint = 1.0;
    float line = 0.0;
    if (pat < 1.5) {
      // Stone: blocks on walls, flagstones underfoot.
      vec2 size = flat_ ? vec2(1.3, 0.95) : vec2(0.85, 0.42);
      float row = floor(uv.y / size.y);
      float off = mod(row, 2.0) * 0.5 * size.x;
      vec2 cell = vec2(floor((uv.x + off) / size.x), row);
      vec2 local = vec2(fract((uv.x + off) / size.x), fract(uv.y / size.y));
      tint = 0.88 + 0.16 * twHash(cell);
      line = twLine(local, size, 0.022);
    } else if (pat < 2.5) {
      // Planks along whichever horizontal axis is longer in world space.
      vec2 size = vec2(2.4, 0.24);
      float row = floor(uv.y / size.y);
      float off = twHash(vec2(row, 3.0)) * size.x;
      vec2 cell = vec2(floor((uv.x + off) / size.x), row);
      vec2 local = vec2(fract((uv.x + off) / size.x), fract(uv.y / size.y));
      tint = 0.86 + 0.18 * twHash(cell);
      line = twLine(local, size, 0.012);
    } else if (pat < 3.5) {
      vec3 fw = max(fwidth(vWPos), vec3(1e-4));
      vec3 g = abs(fract(vWPos - 0.5) - 0.5) / fw + n * 1e4;
      line = (1.0 - min(min(g.x, g.y), min(g.z, 1.0))) * 0.5;
    } else {
      tint = 0.94 + 0.08 * twHash(floor(uv * 1.7));
    }
    diffuseColor.rgb *= mix(1.0, tint, fade);
    diffuseColor.rgb *= 1.0 - line * 0.32 * fade;
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
