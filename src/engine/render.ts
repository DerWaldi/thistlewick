import {
  ACESFilmicToneMapping,
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
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
  private readonly sunOffset = new Vector3(-14, 22, -10);
  private sky: Mesh;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.camera = new PerspectiveCamera(60, 1, 0.1, 400);

    this.scene.fog = new Fog(new Color(PALETTE.fog), 45, 150);
    this.scene.add(new HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.3));

    this.sun = new DirectionalLight(PALETTE.sun, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -24;
    s.right = 24;
    s.top = 24;
    s.bottom = -24;
    s.near = 1;
    s.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.sky = this.buildSky();
    this.scene.add(this.sky);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private buildSky(): Mesh {
    const mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new Color(PALETTE.skyTop) },
        horizon: { value: new Color(PALETTE.skyHorizon) },
        bottom: { value: new Color(PALETTE.skyBottom) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.7, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, 0.25, -h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const m = new Mesh(new SphereGeometry(300, 24, 12), mat);
    m.frustumCulled = false;
    m.renderOrder = -1;
    return m;
  }

  /** Keep the shadow frustum centred on the player so shadows stay crisp. */
  followShadow(target: Vector3): void {
    // Snap to texel-ish increments to avoid shimmering.
    const snap = 0.5;
    const x = Math.round(target.x / snap) * snap;
    const z = Math.round(target.z / snap) * snap;
    this.sun.target.position.set(x, target.y, z);
    this.sun.position.set(x + this.sunOffset.x, target.y + this.sunOffset.y, z + this.sunOffset.z);
    this.sky.position.copy(this.camera.position);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  draw(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
