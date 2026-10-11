import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * Foe models from public/models/*.glb (made for Thistlewick with Claude from the project's
 * concept art; see ASSETS.md). Each file holds one mesh per colour, but inside those meshes the
 * shapes are still separate: we split them into "islands" (connected pieces), so each foe can
 * hand every piece to the moving part it belongs to (a jaw, a leg, a wing) by where it sits.
 * The foes keep their own procedural animation; the model only replaces how they look. If a
 * file fails to load, they fall back to their code-built bodies.
 */

export type ModelName = 'rattlecoat' | 'snapweed' | 'embercrab' | 'sootling' | 'hexling' | 'examiner';

/** One connected piece of a model, in the model's own space (+Z forward, feet at y 0). */
export interface Island {
  geo: BufferGeometry;
  /** The material's name in the file ('mat_rrggbb', 'glow_rrggbb' or 'wing_…'). */
  mat: string;
  color: Color;
  /** Unlit in the file: a light source (eyes, lava, gems). */
  glow: boolean;
  /** Has its own texture (the Hexling's wings): drawn with its original material. */
  material?: Material;
  center: Vector3;
  min: Vector3;
  max: Vector3;
}

const NAMES: ModelName[] = ['rattlecoat', 'snapweed', 'embercrab', 'sootling', 'hexling', 'examiner'];
const cache = new Map<ModelName, Island[]>();

/** Fetch and split every foe model; resolves even if some fail (those foes keep their code bodies). */
export async function loadModels(base = import.meta.env.BASE_URL): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    NAMES.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`${base}models/${name}.glb`);
        gltf.scene.updateMatrixWorld(true);
        const out: Island[] = [];
        gltf.scene.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          const mat = m.material as MeshStandardMaterial;
          const textured = !!mat.map;
          for (const geo of split(m.geometry)) {
            geo.applyMatrix4(m.matrixWorld);
            geo.computeBoundingBox();
            const box = geo.boundingBox!;
            out.push({
              geo,
              mat: mat.name,
              color: mat.color.clone(),
              glow: mat.name.startsWith('glow_') || (mat as unknown as { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial === true,
              material: textured ? mat : undefined,
              center: box.getCenter(new Vector3()),
              min: box.min.clone(),
              max: box.max.clone(),
            });
          }
        });
        cache.set(name, out);
      } catch (err) {
        console.warn(`model ${name} not loaded, using the built-in one`, err);
      }
    }),
  );
}

export function modelIslands(name: ModelName): Island[] | null {
  return cache.get(name) ?? null;
}

/** Split a geometry into its connected pieces (vertices that share a position are joined). */
function split(src: BufferGeometry): BufferGeometry[] {
  const geo = src.index ? src.toNonIndexed() : src.clone();
  const pos = geo.getAttribute('position');
  const n = pos.count;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const j = seen.get(key);
    if (j === undefined) seen.set(key, i);
    else join(i, j);
  }
  for (let t = 0; t < n; t += 3) {
    join(t, t + 1);
    join(t + 1, t + 2);
  }
  const groups = new Map<number, number[]>();
  for (let t = 0; t < n; t += 3) {
    const r = find(t);
    let list = groups.get(r);
    if (!list) groups.set(r, (list = []));
    list.push(t);
  }
  const names = Object.keys(geo.attributes);
  return [...groups.values()].map((tris) => {
    const g = new BufferGeometry();
    for (const name of names) {
      const a = geo.getAttribute(name);
      const arr = new Float32Array(tris.length * 3 * a.itemSize);
      let k = 0;
      for (const t of tris) for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) arr[k++] = a.getComponent(t + v, c);
      g.setAttribute(name, new BufferAttribute(arr, a.itemSize));
    }
    return g;
  });
}

/** Where each piece goes: a part (an existing pivot group), and optionally a material of its own. */
export interface Placement {
  part: Object3D;
  /** Use this material (e.g. a visor whose glow the foe animates) instead of the shared ones. */
  material?: Material;
}

/**
 * Dress a foe in a model. `toRoot` takes model space into the foe's root space (scale, offset);
 * `place` hands each piece to a part, or drops it (null). Pieces are merged per part and
 * material and re-expressed in each part's own space, so the foe's animation of its parts
 * moves them. Every mesh the foe built for itself under `root` is removed first, except `keep`.
 * Returns the solid material (for hit flashes and tints).
 */
export function dressWith(
  root: Object3D,
  islands: Island[],
  toRoot: Matrix4,
  place: (i: Island) => Placement | null,
  keep: Object3D[] = [],
  opts: { roughness?: number; metalness?: number } = {},
): MeshStandardMaterial {
  const keepSet = new Set(keep);
  const old: Object3D[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && !keepSet.has(o)) old.push(o);
  });
  for (const o of old) o.removeFromParent();

  const solid = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0.15 });
  const glow = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  const buckets = new Map<Object3D, Map<Material, BufferGeometry[]>>();
  for (const isl of islands) {
    const p = place(isl);
    if (!p) continue;
    const material = p.material ?? isl.material ?? (isl.glow ? glow : solid);
    const geo = isl.geo.clone().applyMatrix4(toRoot);
    // Into the part's own space (as it stands now, at rest).
    const partInRoot = rootInv.clone().multiply(p.part.matrixWorld);
    geo.applyMatrix4(partInRoot.invert());
    if (!isl.material) {
      const n = geo.getAttribute('position').count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) isl.color.toArray(col, i * 3);
      geo.setAttribute('color', new BufferAttribute(col, 3));
      geo.deleteAttribute('uv');
    }
    let byMat = buckets.get(p.part);
    if (!byMat) buckets.set(p.part, (byMat = new Map()));
    const list = byMat.get(material) ?? [];
    list.push(geo);
    byMat.set(material, list);
  }
  for (const [part, byMat] of buckets) {
    for (const [material, geos] of byMat) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeVertexNormals();
      const mesh = new Mesh(merged, material);
      mesh.castShadow = !(material as MeshBasicMaterial).isMeshBasicMaterial;
      part.add(mesh);
    }
  }
  return solid;
}
