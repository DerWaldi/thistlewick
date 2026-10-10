import { Mesh, type BufferGeometry, type Group, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collapse a group's direct mesh children into one mesh per material, baking their
 * local transforms. Children listed in `keep` (animated parts) are left alone.
 * Props built from many primitives otherwise cost one draw call per primitive.
 */
export function mergeChildren(group: Group, keep: Object3D[] = []): void {
  const byMat = new Map<Material, Mesh[]>();
  for (const child of [...group.children]) {
    if (!(child instanceof Mesh) || keep.includes(child) || child.children.length) continue;
    const mat = child.material as Material;
    if (Array.isArray(child.material)) continue;
    const list = byMat.get(mat) ?? [];
    list.push(child);
    byMat.set(mat, list);
  }
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const geos: BufferGeometry[] = meshes.map((m) => {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
      return g;
    });
    // Only merge geometries with matching attribute sets (vertex-coloured vs not).
    const withColor = geos.filter((g) => g.getAttribute('color'));
    const without = geos.filter((g) => !g.getAttribute('color'));
    const castShadow = meshes.some((m) => m.castShadow);
    for (const set of [withColor, without]) {
      if (!set.length) continue;
      const merged = new Mesh(set.length === 1 ? set[0] : mergeGeometries(set)!, mat);
      merged.castShadow = castShadow;
      merged.receiveShadow = true;
      group.add(merged);
    }
    for (const m of meshes) group.remove(m);
  }
}
