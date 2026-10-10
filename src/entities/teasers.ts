import RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { RuneMarker } from '../spells/runes';
import type { SpellHit, SpellTarget } from '../spells/targets';
import { paint } from '../world/builder';
import { COLORS, worldMaterial } from '../world/materials';
import type { Entity, SpecOf, WorldContext } from './types';
import { mergeChildren } from '../world/merge';

/**
 * Targets for spells taught in later lessons: a locked chest (Latchkin) and a
 * vine curtain blocking an archway (Cindersnap). Until you know the spell they
 * show a greyed rune; once learned, they work.
 */
export class Teaser implements Entity, SpellTarget {
  readonly spell;
  readonly marker: RuneMarker;
  readonly radius = 0.8;
  private collider: RAPIER.Collider | null = null;
  private group = new Group();
  private lid: Group | null = null;
  private vines: Group | null = null;
  private done = false;
  private anim = 0;
  private readonly center: Vector3;

  constructor(
    private spec: SpecOf<'teaser'>,
    private ctx: WorldContext,
  ) {
    this.spell = spec.spell;
    const [x, y, z] = spec.pos;
    this.group.position.set(x, y, z);
    this.group.rotation.y = spec.yaw;
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), spec.yaw);
    if (spec.prop === 'chest') {
      this.center = new Vector3(x, y + 0.45, z);
      this.buildChest();
      this.collider = ctx.physics.addStaticBox(this.center, new Vector3(0.6, 0.45, 0.42), q);
    } else if (spec.prop === 'marker') {
      // Just a rune hanging over something (a pool to freeze, a rope to burn later).
      this.center = new Vector3(x, y, z);
    } else {
      this.center = new Vector3(x, y + 1.5, z);
      this.buildVines();
      this.collider = ctx.physics.addStaticBox(this.center, new Vector3(1.5, 1.5, 0.25), q, { noGrab: true });
    }
    ctx.scene.add(this.group);
    this.marker = new RuneMarker(ctx.scene, spec.spell, 0.7);
    this.marker.sprite.position.copy(this.center).add(new Vector3(0, spec.prop === 'chest' ? 0.9 : spec.prop === 'marker' ? 0.6 : 0.4, 0));
    ctx.targets.add(this);
  }

  private buildChest(): void {
    const mat = worldMaterial();
    const base = new Mesh(paint(new BoxGeometry(1.2, 0.6, 0.84).toNonIndexed(), '#7a4a26', true), mat);
    base.position.y = 0.3;
    const bands = new Mesh(paint(new BoxGeometry(1.24, 0.1, 0.88).toNonIndexed(), '#3a3340', true), mat);
    bands.position.y = 0.5;
    this.lid = new Group();
    this.lid.position.set(0, 0.6, -0.42);
    const lidMesh = new Mesh(paint(new CylinderGeometry(0.42, 0.42, 1.2, 8, 1, false, 0, Math.PI).toNonIndexed(), '#8a5a36', true), mat);
    // Half-cylinder (theta 0..π covers +X) laid on its side: axis along X, dome up.
    lidMesh.rotation.z = Math.PI / 2;
    lidMesh.position.z = 0.42;
    this.lid.add(lidMesh);
    const lock = new Mesh(
      new BoxGeometry(0.2, 0.24, 0.08),
      new MeshStandardMaterial({ color: '#c99a3e', metalness: 0.7, roughness: 0.35 }),
    );
    lock.position.set(0, 0.5, 0.44);
    [base, bands, lidMesh].forEach((m) => (m.castShadow = true));
    this.group.add(base, bands, this.lid, lock);
    mergeChildren(this.group);
  }

  private buildVines(): void {
    this.vines = new Group();
    const vine = new MeshStandardMaterial({ color: '#4f7a34', flatShading: true, roughness: 0.9 });
    const leaf = new MeshStandardMaterial({ color: '#79a84a', flatShading: true, roughness: 0.9 });
    const thorn = new MeshStandardMaterial({ color: '#a33a5a', flatShading: true });
    for (let i = 0; i < 9; i++) {
      const x = -1.35 + i * 0.34;
      const h = 2.6 + Math.sin(i * 2.3) * 0.3;
      const strand = new Mesh(new CylinderGeometry(0.05, 0.08, h, 5), vine);
      strand.position.set(x, 3 - h / 2, Math.sin(i * 1.7) * 0.08);
      strand.rotation.z = Math.sin(i * 3.1) * 0.06;
      strand.castShadow = true;
      this.vines.add(strand);
      for (let j = 0; j < 4; j++) {
        const l = new Mesh(new ConeGeometry(0.1, 0.24, 4), j % 3 === 2 ? thorn : leaf);
        l.position.set(x + (j % 2 ? 0.08 : -0.08), 2.7 - j * 0.6 - (i % 2) * 0.3, 0.06);
        l.rotation.z = j % 2 ? -1 : 1;
        this.vines.add(l);
      }
    }
    // A simple stone arch around the curtain.
    const stone = worldMaterial();
    for (const side of [-1, 1]) {
      const post = new Mesh(paint(new BoxGeometry(0.5, 3.4, 0.7).toNonIndexed(), COLORS.stoneDark, true), stone);
      post.position.set(side * 1.75, 1.7, 0);
      post.castShadow = true;
      this.group.add(post);
    }
    const top = new Mesh(paint(new BoxGeometry(4, 0.5, 0.7).toNonIndexed(), COLORS.stoneDark, true), stone);
    top.position.y = 3.25;
    this.group.add(top, this.vines);
    mergeChildren(this.vines);
    mergeChildren(this.group);
  }

  aimPoint(out: Vector3): Vector3 {
    return out.copy(this.center);
  }
  enabled(): boolean {
    return !this.done;
  }
  owns(c: RAPIER.Collider): boolean {
    return !!this.collider && c.handle === this.collider.handle;
  }

  onSpell(_hit: SpellHit): void {
    this.done = true;
    this.ctx.targets.remove(this);
    if (this.spec.prop === 'chest') {
      this.ctx.sweets.burst('bramble', this.center.clone().add(new Vector3(0, 0.4, 0)), 2);
      this.ctx.sweets.burst('fizzwort', this.center.clone().add(new Vector3(0, 0.4, 0)), 5);
    } else if (this.collider) {
      this.ctx.physics.world.removeCollider(this.collider, false);
      this.ctx.fx.burst(this.center, 30, new Color('#ff8a3c'), 3, 0.2, 2);
    }
  }

  frameUpdate(dt: number): void {
    if (!this.done) return;
    this.anim = Math.min(1, this.anim + dt * 1.5);
    if (this.lid) this.lid.rotation.x = -MathUtils.lerp(0, 1.9, this.anim);
    if (this.vines) {
      this.vines.scale.y = 1 - this.anim;
      this.vines.position.y = 3 * this.anim;
      if (this.anim >= 1) this.vines.visible = false;
    }
  }
}
