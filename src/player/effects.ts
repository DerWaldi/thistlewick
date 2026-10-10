import {
  CircleGeometry,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from 'three';
import type { EventBus } from '../engine/events';
import type { Physics } from '../engine/physics';
import { FOOT_OFFSET, type PlayerController } from './controller';

/**
 * A soft blob shadow straight below the player. Even with real shadows, this is
 * what lets you judge where you'll land.
 */
export class BlobShadow {
  private mesh: Mesh;
  constructor(
    scene: Object3D,
    private physics: Physics,
    private player: PlayerController,
  ) {
    const mat = new MeshBasicMaterial({ color: '#1a0f1f', transparent: true, opacity: 0.45, depthWrite: false });
    this.mesh = new Mesh(new CircleGeometry(0.42, 20), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 1;
    // Push towards the camera in depth to avoid z-fighting with the floor.
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
    scene.add(this.mesh);
  }

  /** Hidden along with the player (title screen). */
  hidden = false;

  update(alpha: number): void {
    const p = this.player;
    if (this.hidden) {
      this.mesh.visible = false;
      return;
    }
    const pos = new Vector3().lerpVectors(p.prevPos, p.pos, alpha);
    const hit = this.physics.raycast(pos, new Vector3(0, -1, 0), 30, p.collider);
    if (!hit || p.mode === 'reset') {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.position.copy(hit.point).addScaledVector(hit.normal, 0.02);
    this.mesh.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), hit.normal);
    const height = hit.distance - FOOT_OFFSET;
    const s = MathUtils.clamp(1 - height * 0.08, 0.45, 1);
    this.mesh.scale.setScalar(s);
    (this.mesh.material as MeshBasicMaterial).opacity = 0.45 * MathUtils.clamp(1 - height * 0.05, 0.3, 1);
  }
}

interface Particle {
  pos: Vector3;
  vel: Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: Color;
}

/** Pooled puffs for dust, splashes and sparkles, drawn as one instanced mesh. */
export class Puffs {
  private mesh: InstancedMesh;
  private particles: Particle[] = [];
  private readonly max = 160;
  private m = new Matrix4();
  private q = new Quaternion();

  constructor(scene: Object3D, events: EventBus, player: PlayerController) {
    const mat = new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, transparent: true, opacity: 0.85 });
    this.mesh = new InstancedMesh(new IcosahedronGeometry(1, 0), mat, this.max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    const dust = new Color('#e8d4b4');
    events.on('land', ({ pos, impact }) => {
      if (impact > 4) this.burst(pos, Math.min(14, Math.round(impact)), dust, 2.2, 0.16);
    });
    events.on('jump', ({ pos }) => this.burst(pos, 5, dust, 1.2, 0.12));
    events.on('skid', ({ pos }) => {
      const back = new Vector3(-player.vel.x, 0, -player.vel.z).normalize();
      this.burst(pos.clone().addScaledVector(back, -0.2), 6, dust, 1.5, 0.13);
    });
    events.on('bounce', ({ pos }) => this.burst(pos, 14, new Color('#b8f0a0'), 3.5, 0.14));
    events.on('splash', ({ pos }) => this.burst(pos, 22, new Color('#bfe6ff'), 4.5, 0.15, 5));
    events.on('ledgeClimb', ({ pos }) => this.burst(pos, 4, dust, 1, 0.1));
  }

  burst(at: Vector3, n: number, color: Color, speed: number, size: number, up = 1.2): void {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random() * 0.5);
      this.particles.push({
        pos: at.clone().add(new Vector3(0, 0.05, 0)),
        vel: new Vector3(Math.cos(a) * s, up * (0.4 + Math.random()), Math.sin(a) * s),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.3,
        size: size * (0.7 + Math.random() * 0.6),
        color,
      });
    }
  }

  update(dt: number): void {
    if (dt <= 0) return;
    let n = 0;
    this.particles = this.particles.filter((p) => (p.life += dt) < p.maxLife);
    for (const p of this.particles) {
      p.vel.multiplyScalar(Math.exp(-5 * dt));
      p.vel.y -= 2 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const t = p.life / p.maxLife;
      const s = p.size * (0.6 + t * 1.2) * (1 - t * t);
      this.m.compose(p.pos, this.q, new Vector3(s, s, s));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
