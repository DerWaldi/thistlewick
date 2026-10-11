import {
  BufferGeometry,
  Color,
  ConeGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SWEETS, type SweetKind } from '../data/sweets';
import type { Tuning } from '../data/tuning';
import type { Physics } from '../engine/physics';
import type { PlayerController } from '../player/controller';
import type { GameState } from '../state/gameState';

interface Sweet {
  kind: SweetKind;
  /** Placed sweets have an id so collecting them is remembered. */
  id?: string;
  pos: Vector3;
  home: Vector3;
  vel: Vector3;
  /** Loose sweets (dropped by creatures) fall and bounce until they settle. */
  loose: boolean;
  magnet: boolean;
  phase: number;
  /** Seconds before a dropped sweet can be collected (so you see it pop out). */
  delay: number;
}

const MAX_PER_KIND = 400;

function sweetGeometry(kind: SweetKind): BufferGeometry {
  switch (kind) {
    case 'fizzwort':
      // A faceted drop.
      return new IcosahedronGeometry(0.16, 0);
    case 'bramble': {
      // A round bonbon with twisted wrapper ends.
      const ball = new SphereGeometry(0.17, 8, 6).toNonIndexed();
      const l = new ConeGeometry(0.1, 0.16, 5).toNonIndexed();
      l.rotateZ(Math.PI / 2);
      l.translate(0.24, 0, 0);
      const r = new ConeGeometry(0.1, 0.16, 5).toNonIndexed();
      r.rotateZ(-Math.PI / 2);
      r.translate(-0.24, 0, 0);
      [ball, l, r].forEach((g) => g.deleteAttribute('uv'));
      return mergeGeometries([ball, l, r])!;
    }
    case 'humbug':
      return new OctahedronGeometry(0.24, 0);
  }
}

/**
 * All sweets in a level, one instanced mesh per kind. Sweets bob and spin, get
 * pulled in by the magnet radius and are collected on touch.
 */
export class SweetField {
  private sweets: Sweet[] = [];
  private meshes = new Map<SweetKind, InstancedMesh>();
  private m = new Matrix4();
  private q = new Quaternion();
  private time = 0;

  constructor(
    scene: Object3D,
    private physics: Physics,
    private player: PlayerController,
    private state: GameState,
    private tuning: Tuning,
  ) {
    for (const kind of Object.keys(SWEETS) as SweetKind[]) {
      const def = SWEETS[kind];
      const mat = new MeshStandardMaterial({
        color: new Color(def.color),
        emissive: new Color(def.color),
        emissiveIntensity: kind === 'humbug' ? 0.55 : 0.3,
        roughness: 0.35,
        metalness: kind === 'humbug' ? 0.6 : 0.05,
        flatShading: true,
      });
      const mesh = new InstancedMesh(sweetGeometry(kind), mat, MAX_PER_KIND);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.meshes.set(kind, mesh);
    }
  }

  get remaining(): number {
    return this.sweets.length;
  }

  add(kind: SweetKind, pos: Vector3, id?: string): void {
    this.sweets.push({
      kind,
      id,
      pos: pos.clone(),
      home: pos.clone(),
      vel: new Vector3(),
      loose: false,
      magnet: false,
      phase: Math.random() * Math.PI * 2,
      delay: 0,
    });
  }

  /** Pop sweets out of something (a banished creature, an opened chest). */
  burst(kind: SweetKind, at: Vector3, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 1.5;
      this.sweets.push({
        kind,
        pos: at.clone(),
        home: at.clone(),
        vel: new Vector3(Math.cos(a) * s, 4.5 + Math.random() * 2, Math.sin(a) * s),
        loose: true,
        magnet: false,
        phase: Math.random() * Math.PI * 2,
        delay: 0.45,
      });
    }
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const target = new Vector3(this.player.pos.x, this.player.pos.y + 0.1, this.player.pos.z);
    const magnet = this.tuning.cast.magnetRadius * this.state.magnetScale;
    const canCollect = this.player.mode !== 'reset';
    this.sweets = this.sweets.filter((s) => {
      s.delay -= dt;
      if (s.loose) this.fall(s, dt);
      const d = s.pos.distanceTo(target);
      if (canCollect && s.delay <= 0) {
        if (d < 0.75) {
          this.state.collectSweet(s.kind, s.pos.clone(), s.id);
          return false;
        }
        // Only through open air: the Sweet Tooth Charm's reach mustn't pull sweets through hay
        // bales, hedges or walls.
        if (d < magnet && this.inSight(s.pos, target, d)) s.magnet = true;
      }
      if (s.magnet) {
        // Accelerate towards the player; quick enough to never feel like it's chasing you.
        const speed = Math.max(6, 16 - d * 3);
        s.pos.addScaledVector(target.clone().sub(s.pos).normalize(), Math.min(d, speed * dt));
        s.loose = false;
      }
      return true;
    });
  }

  private inSight(from: Vector3, to: Vector3, d: number): boolean {
    if (d < 0.9) return true;
    const dir = to.clone().sub(from).normalize();
    return !this.physics.raycast(from, dir, d - 0.4, this.player.collider, (c) => !this.physics.getInfo(c)?.seeThrough);
  }

  private fall(s: Sweet, dt: number): void {
    s.vel.y -= 18 * dt;
    const next = s.pos.clone().addScaledVector(s.vel, dt);
    const hit = this.physics.raycast(
      new Vector3(next.x, s.pos.y + 0.2, next.z),
      new Vector3(0, -1, 0),
      0.2 + Math.max(0, s.pos.y - next.y) + 0.2,
      this.player.collider,
    );
    if (hit && s.vel.y < 0) {
      next.y = hit.point.y + 0.3;
      s.vel.y *= -0.35;
      s.vel.x *= 0.6;
      s.vel.z *= 0.6;
      if (Math.abs(s.vel.y) < 0.8) {
        s.loose = false;
        s.home.copy(next);
      }
    }
    s.pos.copy(next);
    if (!s.loose) s.home.copy(s.pos);
  }

  frameUpdate(): void {
    const counts = new Map<SweetKind, number>();
    const scale = new Vector3(1, 1, 1);
    for (const s of this.sweets) {
      const mesh = this.meshes.get(s.kind)!;
      const i = counts.get(s.kind) ?? 0;
      if (i >= MAX_PER_KIND) continue;
      counts.set(s.kind, i + 1);
      const bob = s.loose || s.magnet ? 0 : Math.sin(this.time * 2.4 + s.phase) * 0.08;
      const p = new Vector3(s.pos.x, s.pos.y + bob, s.pos.z);
      this.q.setFromAxisAngle(new Vector3(0, 1, 0), this.time * 2 + s.phase);
      this.m.compose(p, this.q, scale);
      mesh.setMatrixAt(i, this.m);
    }
    for (const [kind, mesh] of this.meshes) {
      mesh.count = counts.get(kind) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
