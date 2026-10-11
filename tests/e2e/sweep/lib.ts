/*
 * The level sweep, run inside the page (imported by URL from m22-sweep.spec.ts) against a
 * loaded level session. It looks for the glitches playtests kept finding: faces that share a
 * plane and flicker, signs on top of each other or sunk into walls, people standing in the
 * furniture, respawn spots without floor.
 */
import { BufferAttribute, InstancedMesh, Mesh, Sprite, Vector3, type Material, type Object3D } from 'three';
import type { Physics } from '../../../src/engine/physics';
import type { EntitySpec } from '../../../src/entities/types';
import type { LevelDef } from '../../../src/world/level';

export interface Issue {
  kind: 'flicker' | 'sign-overlap' | 'sign-clipped' | 'npc' | 'respawn';
  at: [number, number, number];
  detail: string;
}

const r2 = (v: Vector3): [number, number, number] => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];

function shown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

// ---------------------------------------------------------------- flicker

interface Tri {
  /** 2D points in the plane's basis. */
  p: [number, number][];
  d: number;
  look: Look;
  mesh: number;
  centre: Vector3;
  min: [number, number];
  max: [number, number];
}

interface Look {
  kind: string;
  rgb: [number, number, number];
}

function lookOf(mat: Material, mesh: Mesh, i0: number): Look {
  const m = mat as Material & { color?: { r: number; g: number; b: number }; map?: { uuid: string } | null };
  const col = mesh.geometry.getAttribute('color') as BufferAttribute | undefined;
  const pat = mesh.geometry.getAttribute('pattern') as BufferAttribute | undefined;
  const rgb: [number, number, number] = col ? [col.getX(i0), col.getY(i0), col.getZ(i0)] : m.color ? [m.color.r, m.color.g, m.color.b] : [1, 1, 1];
  return { kind: `${m.type}${m.map ? ' textured' : ''}${pat ? ` pattern ${Math.round(pat.getX(i0))}` : ''}`, rgb };
}

/** Would these two, fighting over a pixel, visibly flicker? (Slightly different shades don't.) */
function clash(a: Look, b: Look): boolean {
  if (a.kind !== b.kind) return true;
  return Math.hypot(a.rgb[0] - b.rgb[0], a.rgb[1] - b.rgb[1], a.rgb[2] - b.rgb[2]) > 0.12;
}

const hex = (l: Look) => '#' + l.rgb.map((x) => Math.round(Math.min(1, x) * 255).toString(16).padStart(2, '0')).join('');

/** The overlap of two convex polygons (Sutherland–Hodgman), and its area. */
function overlap(a: [number, number][], b: [number, number][]): { poly: [number, number][]; area: number } {
  const ccw = (p: [number, number][]) => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % p.length];
      s += x1 * y2 - x2 * y1;
    }
    return s < 0 ? [...p].reverse() : p;
  };
  let out = ccw(a);
  const clip = ccw(b);
  for (let i = 0; i < clip.length && out.length; i++) {
    const [cx1, cy1] = clip[i];
    const [cx2, cy2] = clip[(i + 1) % clip.length];
    const inside = ([x, y]: [number, number]) => (cx2 - cx1) * (y - cy1) - (cy2 - cy1) * (x - cx1) >= -1e-9;
    const cross = (p: [number, number], q: [number, number]): [number, number] => {
      const a1 = cy2 - cy1;
      const b1 = cx1 - cx2;
      const c1 = a1 * cx1 + b1 * cy1;
      const a2 = q[1] - p[1];
      const b2 = p[0] - q[0];
      const c2 = a2 * p[0] + b2 * p[1];
      const det = a1 * b2 - a2 * b1;
      return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur));
    }
  }
  let s = 0;
  for (let i = 0; i < out.length; i++) {
    const [x1, y1] = out[i];
    const [x2, y2] = out[(i + 1) % out.length];
    s += x1 * y2 - x2 * y1;
  }
  return { poly: out, area: Math.abs(s) / 2 };
}

/** Opaque faces facing the same way in the same plane, overlapping, but drawn differently. */
function flicker(root: Object3D, physics: Physics): Issue[] {
  const planes = new Map<string, Tri[]>();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  let meshIndex = 0;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || mesh instanceof InstancedMesh || !shown(mesh)) return;
    const mat = mesh.material as Material;
    if (Array.isArray(mat) || mat.transparent || !mat.depthWrite || !mat.visible || !mat.depthTest) return;
    const pos = mesh.geometry.getAttribute('position');
    if (!pos) return;
    const index = mesh.geometry.index;
    const count = index ? index.count : pos.count;
    const mi = meshIndex++;
    for (let t = 0; t < count; t += 3) {
      const [i0, i1, i2] = [0, 1, 2].map((k) => (index ? index.getX(t + k) : t + k));
      a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      n.subVectors(b, a).cross(c.clone().sub(a));
      const area = n.length() / 2;
      if (area < 1e-3) continue;
      n.normalize();
      // Only roughly axis-aligned faces: those are the walls, floors and sills that clash.
      const ax = Math.abs(n.x) > 0.999 ? 0 : Math.abs(n.y) > 0.999 ? 1 : Math.abs(n.z) > 0.999 ? 2 : -1;
      if (ax < 0) continue;
      const sign = Math.sign(n.getComponent(ax));
      const d = a.getComponent(ax);
      const [u, v] = ax === 0 ? ['y', 'z'] : ax === 1 ? ['x', 'z'] : ['x', 'y'];
      const p = [a, b, c].map((q) => [q[u as 'x'], q[v as 'x']] as [number, number]);
      const key = `${ax}${sign}|${Math.round(d / 0.001)}`;
      const list = planes.get(key) ?? [];
      list.push({
        p,
        d,
        look: lookOf(mat, mesh, i0),
        mesh: mi,
        centre: a.clone().add(b).add(c).divideScalar(3),
        min: [Math.min(p[0][0], p[1][0], p[2][0]), Math.min(p[0][1], p[1][1], p[2][1])],
        max: [Math.max(p[0][0], p[1][0], p[2][0]), Math.max(p[0][1], p[1][1], p[2][1])],
      });
      planes.set(key, list);
    }
  });
  const found = new Map<string, Issue>();
  for (const [key, tris] of planes) {
    // Faces a hair either side of a bucket edge still clash: compare with the next bucket up.
    const [axis, q] = key.split('|');
    const next = planes.get(`${axis}|${Number(q) + 1}`) ?? [];
    const all = [...tris, ...next];
    const grid = new Map<string, number[]>();
    all.forEach((t, i) => {
      for (let gx = Math.floor(t.min[0]); gx <= Math.floor(t.max[0]); gx++)
        for (let gy = Math.floor(t.min[1]); gy <= Math.floor(t.max[1]); gy++) {
          const k = `${gx},${gy}`;
          const cell = grid.get(k) ?? [];
          cell.push(i);
          grid.set(k, cell);
        }
    });
    const seen = new Set<number>();
    for (const cell of grid.values()) {
      for (let i = 0; i < cell.length; i++)
        for (let j = i + 1; j < cell.length; j++) {
          const [ti, tj] = [all[cell[i]], all[cell[j]]];
          // Pairs within one bucket are found there; across buckets only one way round.
          if (cell[i] >= tris.length && cell[j] >= tris.length) continue;
          if (!clash(ti.look, tj.look) || Math.abs(ti.d - tj.d) > 0.0005) continue;
          const pk = Math.min(cell[i], cell[j]) * 1e6 + Math.max(cell[i], cell[j]);
          if (seen.has(pk)) continue;
          seen.add(pk);
          if (ti.max[0] <= tj.min[0] || tj.max[0] <= ti.min[0] || ti.max[1] <= tj.min[1] || tj.max[1] <= ti.min[1]) continue;
          const { poly, area } = overlap(ti.p, tj.p);
          if (area < 0.01) continue;
          // Back in 3D, and only if you could see it: a face pressed against a wall or floor
          // (a rug's underside, the back of a panel) can't flicker at anyone.
          const ax = Number(axis[0]);
          const nrm = axis[1] === '-' ? -1 : 1;
          const to3 = ([u, v]: [number, number], lift: number) => {
            const w = ti.d + nrm * lift;
            return ax === 0 ? new Vector3(w, u, v) : ax === 1 ? new Vector3(u, w, v) : new Vector3(u, v, w);
          };
          const mid: [number, number] = [poly.reduce((t, q) => t + q[0], 0) / poly.length, poly.reduce((t, q) => t + q[1], 0) / poly.length];
          const probes = [mid, ...poly.map(([u, v]) => [u * 0.8 + mid[0] * 0.2, v * 0.8 + mid[1] * 0.2] as [number, number])];
          if (probes.every((q) => physics.pointInsideSolid(to3(q, 0.02)))) continue;
          // Nor one facing a sealed sliver (a few centimetres under the next floor up).
          if (probes.every((q) => physics.pointInsideSolid(to3(q, 0.3)))) continue;
          // An underside only shows if there's somewhere to stand below it, a little way down
          // (a ceiling, an overhang), not resting on the floor or hanging over the void.
          if (axis === '1-1') {
            const below = physics.raycast(to3(mid, 0.05), new Vector3(0, -1, 0), 40);
            if (!below || below.distance < 0.3) continue;
          }
          const at = to3(mid, 0);
          const where = `${Math.round(at.x * 2) / 2},${Math.round(at.y * 2) / 2},${Math.round(at.z * 2) / 2}`;
          const prev = found.get(where);
          if (!prev) found.set(where, { kind: 'flicker', at: r2(at), detail: `${'xyz'[Number(axis[0])]}${axis[1] === '-' ? '-' : '+'} face: ${ti.look.kind} ${hex(ti.look)} vs ${tj.look.kind} ${hex(tj.look)}, ${area.toFixed(2)} m²` });
        }
    }
  }
  return [...found.values()];
}

// ---------------------------------------------------------------- signs

interface Sign {
  text: string;
  centre: Vector3;
  /** Plane signs face this way; sprites (labels) face the camera. */
  normal: Vector3 | null;
  tangent: Vector3;
  hw: number;
  hh: number;
}

function signs(root: Object3D, physics: Physics): Issue[] {
  const list: Sign[] = [];
  root.traverse((o) => {
    if (o.userData.sign === undefined || !shown(o)) return;
    const centre = o.getWorldPosition(new Vector3());
    const s = o.getWorldScale(new Vector3());
    if (o instanceof Sprite) {
      list.push({ text: o.userData.sign, centre, normal: null, tangent: new Vector3(1, 0, 0), hw: s.x / 2, hh: s.y / 2 });
      return;
    }
    const geo = (o as Mesh).geometry;
    geo.computeBoundingBox();
    const size = geo.boundingBox!.getSize(new Vector3());
    const q = o.getWorldQuaternion(new (o.quaternion.constructor as new () => typeof o.quaternion)());
    list.push({
      text: o.userData.sign,
      centre,
      normal: new Vector3(0, 0, 1).applyQuaternion(q),
      tangent: new Vector3(1, 0, 0).applyQuaternion(q),
      hw: (size.x * s.x) / 2,
      hh: (size.y * s.y) / 2,
    });
  });
  const out: Issue[] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [A, B] = [list[i], list[j]];
      const d = B.centre.clone().sub(A.centre);
      if (Math.abs(d.y) >= A.hh + B.hh - 0.02) continue;
      let overlaps: boolean;
      if (A.normal && B.normal) {
        // Plane signs: only if they face the same way and stand within a metre of each other.
        if (Math.abs(A.normal.dot(B.normal)) < 0.9) overlaps = d.length() < Math.max(A.hw, B.hw) * 0.6;
        else overlaps = Math.abs(d.dot(A.normal)) < 1 && Math.abs(d.dot(A.tangent)) < A.hw + B.hw - 0.02;
      } else {
        overlaps = Math.hypot(d.x, d.z) < A.hw + B.hw - 0.02;
      }
      if (overlaps) out.push({ kind: 'sign-overlap', at: r2(A.centre), detail: `"${A.text}" and "${B.text}"` });
    }
  // A sign's face (or a label) mustn't be inside a wall or roof.
  for (const s of list) {
    const front = s.normal ? s.normal.clone().multiplyScalar(0.04) : new Vector3();
    const probes = [[0, 0], [-0.85, -0.8], [0.85, -0.8], [-0.85, 0.8], [0.85, 0.8]];
    for (const [u, v] of probes) {
      const p = s.centre.clone().add(front).addScaledVector(s.tangent, u * s.hw).add(new Vector3(0, v * s.hh, 0));
      if (physics.pointInsideSolid(p)) {
        out.push({ kind: 'sign-clipped', at: r2(p), detail: `"${s.text}" runs into something solid` });
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- people and respawns

function people(physics: Physics, def: LevelDef, specs: EntitySpec[]): Issue[] {
  const out: Issue[] = [];
  const clear = (what: string, x: number, y: number, z: number) => {
    // An NPC's own body is a solid capsule on its spot: the rays start inside it.
    const notSelf = (c: { translation(): { x: number; z: number } }) => {
      const t = c.translation();
      return Math.hypot(t.x - x, t.z - z) > 0.05;
    };
    // A person-sized body: nothing solid within 0.3 m round it at knee and chest height,
    for (const h of [0.5, 1.3])
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        if (physics.raycast(new Vector3(x, y + h, z), new Vector3(Math.sin(a), 0, Math.cos(a)), 0.3, undefined, notSelf)) {
          out.push({ kind: 'npc', at: [x, y, z], detail: `${what}: something solid within 0.3 m at ${h} m` });
          return;
        }
      }
    // and floor right under its feet.
    if (!physics.raycast(new Vector3(x, y + 0.5, z), new Vector3(0, -1, 0), 0.8)) out.push({ kind: 'npc', at: [x, y, z], detail: `${what}: no floor` });
  };
  for (const [name, spot] of Object.entries(def.npcSpots ?? {})) clear(`npc spot ${name}`, ...spot.pos);
  for (const s of specs) {
    if (s.type === 'npc') clear(`npc ${s.speaker}`, ...s.pos);
    if (s.type === 'wanderer') {
      s.path.forEach((p, i) => {
        clear(`wanderer ${s.speaker} stop ${i}`, ...p);
        // Their walk to the next stop mustn't go through anything.
        const q = s.path[(i + 1) % s.path.length];
        const from = new Vector3(p[0], p[1] + 0.6, p[2]);
        const to = new Vector3(q[0], q[1] + 0.6, q[2]).sub(from);
        const len = to.length();
        if (len > 0.01 && Math.abs(q[1] - p[1]) < 0.3) {
          const hit = physics.raycast(from, to.normalize(), len);
          if (hit) out.push({ kind: 'npc', at: r2(hit.point), detail: `wanderer ${s.speaker} walks into something between stops ${i} and ${(i + 1) % s.path.length}` });
        }
      });
    }
    if (s.type === 'checkpoint') {
      // The respawn spot (1.3 m in front of the lectern) needs room to stand and floor.
      const at = new Vector3(s.pos[0] + Math.sin(s.yaw) * 1.3, s.pos[1], s.pos[2] + Math.cos(s.yaw) * 1.3);
      if (physics.capsuleBlocked(at.clone().add(new Vector3(0, 0.95, 0)), 0.45, 0.3)) out.push({ kind: 'respawn', at: r2(at), detail: 'checkpoint respawn spot is blocked' });
      else if (!physics.raycast(at.clone().add(new Vector3(0, 0.3, 0)), new Vector3(0, -1, 0), 0.8)) out.push({ kind: 'respawn', at: r2(at), detail: 'checkpoint respawn spot has no floor' });
    }
  }
  return out;
}

export function sweepLevel(root: Object3D, physics: Physics, def: LevelDef, specs: EntitySpec[]): Issue[] {
  return [...flicker(root, physics), ...signs(root, physics), ...people(physics, def, specs)];
}
