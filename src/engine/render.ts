import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';

const SHADOW_MAP = 4096;
/** Half-size of the sun's shadow area (m). Big enough that roofs over the player's surroundings cast. */
const SHADOW_HALF = 36;
const UP = new Vector3(0, 1, 0);

export const PALETTE = {
  skyTop: '#3a3a78',
  skyHorizon: '#f2a65a',
  skyBottom: '#5a3c5e',
  fog: '#c98f74',
  sun: '#ffd49a',
  hemiSky: '#ffe2b8',
  hemiGround: '#5b4466',
};

/** Renderer, scene, camera, warm sunset lighting and a gradient sky dome. */
export class Renderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly sun: DirectionalLight;
  private readonly hemi: HemisphereLight;
  private readonly sunOffset = new Vector3(-21, 33, -15);
  private sky: Mesh;
  private hills: Mesh;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    // Count draw calls across all post-processing passes (reset per frame in draw()).
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.camera = new PerspectiveCamera(60, 1, 0.1, 400);

    this.scene.fog = new Fog(new Color(PALETTE.fog), 45, 150);
    this.hemi = new HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.3);
    this.scene.add(this.hemi);

    this.sun = new DirectionalLight(PALETTE.sun, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    const s = this.sun.shadow.camera;
    s.left = -SHADOW_HALF;
    s.right = SHADOW_HALF;
    s.top = SHADOW_HALF;
    s.bottom = -SHADOW_HALF;
    s.near = 1;
    s.far = 110;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.045;
    this.scene.add(this.sun, this.sun.target);

    this.sky = this.buildSky();
    this.scene.add(this.sky);
    this.hills = this.buildHills();
    this.scene.add(this.hills);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Daylight for the castle, or the dark for places underground: a dim cold fill and
   * close black fog, so lamps and torches do the lighting. 'dim' is underground too, but
   * with a brighter cold fill and further fog, for places that aren't about lamps (the
   * Cisterns), where pitch dark just made them hard to read.
   */
  setAmbience(kind: 'day' | 'dark' | 'dim', instant = true): void {
    const target = kind === 'day' ? 0 : 1;
    const dim = kind === 'dim' ? 1 : 0;
    if (!instant && target === this.darkTarget && dim === this.dimTarget) return;
    this.darkTarget = target;
    this.dimTarget = dim;
    if (instant) {
      this.dark = this.darkTarget;
      this.dim = this.dimTarget;
    }
    this.applyAmbience();
  }

  /** Ease towards the target ambience (walking down into the Undercroft, say). */
  updateAmbience(dt: number): void {
    if (this.dark === this.darkTarget && this.dim === this.dimTarget) return;
    this.dark = MathUtils.damp(this.dark, this.darkTarget, 2.5, dt);
    if (Math.abs(this.dark - this.darkTarget) < 0.01) this.dark = this.darkTarget;
    this.dim = MathUtils.damp(this.dim, this.dimTarget, 2.5, dt);
    if (Math.abs(this.dim - this.dimTarget) < 0.01) this.dim = this.dimTarget;
    this.applyAmbience();
  }

  private dark = 0;
  private darkTarget = 0;
  private dim = 0;
  private dimTarget = 0;
  private applyAmbience(): void {
    const k = this.dark;
    const d = this.dim;
    const under = (dark: string, dim: string) => new Color(dark).lerp(new Color(dim), d);
    const mix = (a: string, b: Color) => new Color(a).lerp(b, k);
    this.hemi.color.copy(mix(PALETTE.hemiSky, under('#6a7aa8', '#9cb2d4')));
    this.hemi.groundColor.copy(mix(PALETTE.hemiGround, under('#1a1420', '#3a3a4c')));
    this.hemi.intensity = MathUtils.lerp(1.3, 1.05 + d * 0.55, k);
    this.sun.intensity = MathUtils.lerp(2.4, 0, k);
    const fog = this.scene.fog as Fog;
    fog.color.copy(mix(PALETTE.fog, under('#0c0a12', '#141c28')));
    fog.near = MathUtils.lerp(45, 6 + d * 8, k);
    fog.far = MathUtils.lerp(150, 34 + d * 26, k);
    this.sky.visible = k < 0.6;
    this.hills.visible = k < 0.6;
  }

  private skyTime = 0;

  private buildSky(): Mesh {
    const mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new Color(PALETTE.skyTop) },
        horizon: { value: new Color(PALETTE.skyHorizon) },
        bottom: { value: new Color(PALETTE.skyBottom) },
        sunDir: { value: this.sunOffset.clone().normalize() },
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform float time;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.7, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, 0.25, -h));
          // Sun: a soft disc and a wide warm glow.
          float s = max(dot(d, sunDir), 0.0);
          c += vec3(1.0, 0.75, 0.45) * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 1.6);
          // Drifting sunset clouds, lit peach on top, plum underneath.
          if (h > 0.0) {
            vec2 uv = d.xz / (h + 0.18) * 1.6 + vec2(time * 0.012, time * 0.004);
            float n = fbm(uv);
            float cover = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.55, 0.9, h));
            float lit = smoothstep(0.45, 0.85, fbm(uv + sunDir.xz * 0.15));
            vec3 cloud = mix(vec3(0.42, 0.28, 0.42), vec3(1.0, 0.72, 0.52), lit) + pow(s, 6.0) * 0.4;
            c = mix(c, cloud, cover * 0.85);
          }
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const m = new Mesh(new SphereGeometry(300, 24, 12), mat);
    m.frustumCulled = false;
    m.renderOrder = -1;
    return m;
  }

  /**
   * Keep the shadow frustum centred on the player. The centre is snapped to whole
   * shadow-map texels in the light's own frame, so shadow edges don't crawl or
   * shimmer as you walk.
   */
  followShadow(target: Vector3): void {
    const fwd = this.sunOffset.clone().normalize().negate();
    const right = new Vector3().crossVectors(fwd, UP).normalize();
    const up = new Vector3().crossVectors(right, fwd);
    const texel = (SHADOW_HALF * 2) / SHADOW_MAP;
    const snap = (v: number) => Math.round(v / texel) * texel;
    const c = right
      .clone()
      .multiplyScalar(snap(target.dot(right)))
      .addScaledVector(up, snap(target.dot(up)))
      .addScaledVector(fwd, target.dot(fwd));
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).add(this.sunOffset);
    this.sky.position.copy(this.camera.position);
    this.hills.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.skyTime += 1 / 60;
    (this.sky.material as ShaderMaterial).uniforms.time.value = this.skyTime;
  }

  /** A ring of low hills and far towers on the horizon (no fog: an atmospheric silhouette). */
  private buildHills(): Mesh {
    const segs = 96;
    const pos: number[] = [];
    const R = 260;
    const heightAt = (a: number) =>
      14 + Math.sin(a * 3) * 7 + Math.sin(a * 7 + 1.3) * 4 + Math.sin(a * 13 + 0.4) * 2 + (Math.sin(a * 2.2) > 0.85 ? 18 : 0);
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const p0 = [Math.cos(a0) * R, -5, Math.sin(a0) * R];
      const p1 = [Math.cos(a1) * R, -5, Math.sin(a1) * R];
      const q0 = [Math.cos(a0) * R, heightAt(a0), Math.sin(a0) * R];
      const q1 = [Math.cos(a1) * R, heightAt(a1), Math.sin(a1) * R];
      pos.push(...p0, ...q0, ...p1, ...p1, ...q0, ...q1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    const m = new Mesh(g, new MeshBasicMaterial({ color: new Color('#6e4a6e'), fog: false, side: DoubleSide }));
    m.renderOrder = -0.5;
    m.frustumCulled = false;
    return m;
  }

  quality: 'high' | 'low' = 'high';

  /** Fancy: crisp pixels and big shadow map. Fast: native-ish resolution, smaller shadows. */
  setQuality(q: 'high' | 'low'): void {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio, 1.5) : 1);
    const size = q === 'high' ? SHADOW_MAP : SHADOW_MAP / 2;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Bloom (lanterns, windows, runes, the Star) plus a warm grade and vignette. */
  private buildComposer(): void {
    const size = this.renderer.getDrawingBufferSize(new Vector2());
    const rt = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(this.renderer, rt);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(size.x, size.y), 0.42, 0.55, 0.9);
    composer.addPass(this.bloom);
    composer.addPass(
      new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.55 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse; uniform float uVignette; varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
            c.rgb = mix(vec3(l), c.rgb, 1.1);                                    // a touch more colour
            c.rgb += vec3(0.010, 0.005, -0.003) * (1.0 - smoothstep(0.0, 0.4, l)); // warm the shadows
            vec2 d = vUv - 0.5;
            c.rgb *= 1.0 - dot(d, d) * uVignette;
            gl_FragColor = c;
          }`,
      }),
    );
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  draw(): void {
    this.renderer.info.reset();
    if (this.quality === 'high') {
      if (!this.composer) this.buildComposer();
      this.composer!.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
