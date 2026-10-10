import { Color, MeshStandardMaterial } from 'three';

export const COLORS = {
  floor: '#b9a183',
  stone: '#a48d76',
  stoneLight: '#cdb89a',
  stoneDark: '#7d6a5e',
  ochre: '#c99a5b',
  moss: '#7f9a5a',
  wood: '#8a5a36',
  roof: '#6b3f4f',
  plum: '#5d4470',
  ice: '#cfeefa',
  water: '#4f9fc4',
  lantern: '#ffcf7a',
};

/**
 * Vertex-coloured, flat-shaded standard material with optional faint 1 m world-space
 * grid lines (useful for judging distances in greybox levels).
 */
export function worldMaterial(opts: { grid?: boolean; roughness?: number } = {}): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color('#ffffff'),
    vertexColors: true,
    flatShading: true,
    roughness: opts.roughness ?? 0.92,
    metalness: 0,
  });
  if (!opts.grid) return m;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGridPos;\nvarying vec3 vGridNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGridPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGridNormal = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGridPos;\nvarying vec3 vGridNormal;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 n = abs(normalize(vGridNormal));
          vec3 fw = max(fwidth(vGridPos), vec3(1e-4));
          vec3 g = abs(fract(vGridPos - 0.5) - 0.5) / fw + n * 1e4;
          float line = 1.0 - min(min(g.x, g.y), min(g.z, 1.0));
          float fade = 1.0 - smoothstep(18.0, 45.0, length(vGridPos - cameraPosition));
          diffuseColor.rgb *= 1.0 - line * 0.16 * fade;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'world-grid';
  return m;
}
