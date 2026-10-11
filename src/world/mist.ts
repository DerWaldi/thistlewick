import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  Points,
  PointsMaterial,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three';
import type { Animated } from './builder';

const mistTime = { value: 0 };

const VERTEX = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  varying float vCamDist;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    vCamDist = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uLayer;
  uniform float uBase;
  uniform float uAlpha;
  uniform vec3 uDeep;
  uniform vec3 uSwirl;
  uniform vec3 uGlint;
  uniform float uWall;
  uniform float uTop;
  varying vec3 vWorld;
  varying float vCamDist;
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
  void main() {
    // Walls get haze rising up them: noise on the wall plane, fading out with height.
    vec2 p = (uWall > 0.5 ? vec2(vWorld.x + vWorld.z, vWorld.y * 1.6) : vWorld.xz) * 0.3 + uLayer * 7.3;
    float t = uTime * 0.045 * (1.0 + uLayer * 0.35);
    // Domain-warped noise: slow curling wisps rather than a scrolling texture.
    vec2 q = vec2(fbm(p + vec2(t, -t * 0.7)), fbm(p + vec2(5.2 - t * 0.6, 1.3 + t * 0.4)));
    float n = fbm(p + q * 1.6 + vec2(t * 0.4, t * 0.25));
    float wisp = smoothstep(0.3, 0.8, n);
    vec3 col = mix(uDeep, uSwirl, wisp * 0.85);
    col += uGlint * pow(wisp, 3.0) * 0.22;
    float a = clamp(uBase + wisp * uAlpha, 0.0, 1.0);
    if (uWall > 0.5) a = smoothstep(uTop + 1.4, uTop - 2.4, vWorld.y) * (0.55 + wisp * 0.4);
    // Fade out right in front of the camera instead of slicing through the lens.
    a *= smoothstep(0.4, 2.6, vCamDist);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const DEEP = new Color('#1d1636');
const SWIRL = new Color('#6b58a6');
const GLINT = new Color('#a8e2f0');

/** Layers from the top down: thin wisps above, near-opaque haze at the bottom to hide the drop. */
const LAYERS: { dy: number; base: number; alpha: number }[] = [
  { dy: 0, base: 0.0, alpha: 0.38 },
  { dy: -0.9, base: 0.05, alpha: 0.45 },
  { dy: -2.0, base: 0.25, alpha: 0.5 },
  { dy: -3.4, base: 0.94, alpha: 0.06 },
];

/**
 * Magical mist filling the bottom of a pit, so a fall looks like sinking into a glowing
 * haze instead of a black hole. Layered, animated noise planes plus drifting sparkles.
 */
export function buildMist(minX: number, maxX: number, minZ: number, maxZ: number, top: number): { object: Group; animated: Animated } {
  const group = new Group();
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const material = (layer: number, base: number, alpha: number, wall: boolean) => {
    const mat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uLayer: { value: layer },
          uBase: { value: base },
          uAlpha: { value: alpha },
          uDeep: { value: DEEP },
          uSwirl: { value: SWIRL },
          uGlint: { value: GLINT },
          uWall: { value: wall ? 1 : 0 },
          uTop: { value: top },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true,
      side: DoubleSide,
    });
    mat.uniforms.uTime = mistTime;
    return mat;
  };
  LAYERS.forEach((l, i) => {
    const m = new Mesh(new PlaneGeometry(w + 0.4, d + 0.4), material(i, l.base, l.alpha, false));
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, top + l.dy, cz);
    // Draw the bottom layer first, so the wisps above blend over it.
    m.renderOrder = 2 + (LAYERS.length - i) * 0.01;
    group.add(m);
  });
  // Haze creeping up the pit's sides, so its walls sink into the mist instead of standing in it.
  const H = 4.2;
  const sides: [number, number, number, number][] = [
    [cx, minZ + 0.05, w, 0],
    [cx, maxZ - 0.05, w, 0],
    [minX + 0.05, cz, d, Math.PI / 2],
    [maxX - 0.05, cz, d, Math.PI / 2],
  ];
  sides.forEach(([x, z, len, yaw], i) => {
    const m = new Mesh(new PlaneGeometry(len, H), material(5 + i, 0, 0, true));
    m.position.set(x, top - 2.6 + H / 2, z);
    m.rotation.y = yaw;
    m.renderOrder = 2.1;
    group.add(m);
  });

  // Sparkles rising out of the haze and fading as they climb.
  const count = Math.min(140, Math.max(16, Math.round(w * d * 0.18)));
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = minX + Math.random() * w;
    pos[i * 3 + 2] = minZ + Math.random() * d;
    seeds[i] = Math.random() * 100;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  // Additive, so a darker vertex colour is a fainter sparkle: they fade in and out as they rise.
  const fade = new Float32Array(count * 3);
  geo.setAttribute('color', new BufferAttribute(fade, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(230,220,255,1)');
  grad.addColorStop(0.35, 'rgba(170,150,240,0.5)');
  grad.addColorStop(1, 'rgba(170,150,240,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const sparkMat = new PointsMaterial({ size: 0.14, map: new CanvasTexture(c), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.85, vertexColors: true });
  sparkMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', 'gl_PointSize = min(gl_PointSize, 7.0);\n#include <fog_vertex>');
  };
  const sparks = new Points(geo, sparkMat);
  sparks.frustumCulled = false;
  sparks.renderOrder = 3;
  group.add(sparks);
  const base = Float32Array.from(pos);
  const RISE = 4;

  return {
    object: group,
    animated: {
      update: (_dt, t) => {
        mistTime.value = t;
        for (let i = 0; i < count; i++) {
          const s = seeds[i];
          const h = (t * 0.35 + s) % RISE;
          pos[i * 3] = base[i * 3] + Math.sin(t * 0.7 + s) * 0.3;
          pos[i * 3 + 1] = top - 1.2 + h;
          pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.6 + s * 1.7) * 0.3;
          const f = Math.sin((h / RISE) * Math.PI);
          fade[i * 3] = fade[i * 3 + 1] = fade[i * 3 + 2] = f * f;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        sparkMat.opacity = 0.65 + Math.sin(t * 1.3) * 0.15;
      },
    },
  };
}
