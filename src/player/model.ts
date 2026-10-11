import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeChildren } from '../world/merge';

/** Named parts the animator drives. */
export interface StudentRig {
  root: Group; // positioned at the feet, rotated to face
  body: Group; // squash/stretch + lean pivot (at the feet)
  torso: Group;
  head: Group;
  hat: Group;
  hatTip: Group;
  armL: Group;
  armR: Group;
  footL: Mesh;
  footR: Mesh;
  scarfTail: Group;
  wandTip: Mesh;
  /** Recolour the scarf (house colours). */
  setScarf(color: string, trim: string): void;
}

export interface StudentLook {
  scarf?: string;
  trim?: string;
  robe?: string;
  /** Hat colour. */
  hat?: string;
  hatStyle?: 'pointy' | 'tall' | 'cap' | 'none';
  skin?: string;
  hair?: string;
  hairStyle?: 'tufts' | 'long' | 'bun' | 'wild' | 'bald';
  beard?: boolean;
  glasses?: boolean;
}

const mat = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
  new MeshStandardMaterial({ color: new Color(color), flatShading: true, roughness: 0.85, ...extra });

function part(geo: BufferGeometry, material: MeshStandardMaterial): Mesh {
  const m = new Mesh(geo, material);
  m.castShadow = true;
  return m;
}

/** Merge [geometry, x, y, z] parts into one geometry. */
function mergeParts(parts: [BufferGeometry, number, number, number][]): BufferGeometry {
  const geos = parts.map(([g, x, y, z]) => {
    const n = (g.index ? g.toNonIndexed() : g).translate(x, y, z);
    n.deleteAttribute('uv');
    return n;
  });
  return mergeGeometries(geos)!;
}

/** Bake a flat colour into a geometry (parts sharing one vertex-coloured material can merge). */
function tint(geo: BufferGeometry, color: string): BufferGeometry {
  const c = new Color(color);
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new BufferAttribute(arr, 3));
  return geo;
}

/**
 * A low-poly first-year built from primitives: robe, round head, crooked hat,
 * house scarf and wand. Faces +Z. Total height ≈ 1.6 m (hat tip ≈ 2.0 m).
 */
export function buildStudent(look: StudentLook = {}): StudentRig {
  // Everything except the house-coloured scarf and the glowing wand tip shares one
  // vertex-coloured material, so each moving part merges into a single mesh.
  const vc = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  const robeC = look.robe ?? '#46395f';
  const robeDarkC = '#' + new Color(robeC).multiplyScalar(0.7).getHexString();
  const skinC = look.skin ?? '#f0c9a0';
  const hatC = look.hat ?? '#4f3a73';
  const hairC = look.hair ?? '#6a4424';
  const goldC = '#c99a3e';
  const shirtC = '#f3ead8';
  const robe = vc;
  const robeDark = vc;
  const skin = vc;
  const hatMat = vc;
  const boot = vc;
  const wood = vc;
  const eye = vc;
  const scarf = mat(look.scarf ?? '#7a6a5a');
  const trim = mat(look.trim ?? '#d9c18f');

  const root = new Group();
  const body = new Group();
  root.add(body);

  // Boots peek out under the robe: a sole, an upper and a rounded toe.
  const footGeo = mergeParts([
    [tint(new BoxGeometry(0.15, 0.03, 0.26), '#1e140c'), 0, -0.035, 0],
    [tint(new BoxGeometry(0.14, 0.08, 0.2), '#3a2617'), 0, 0.01, -0.02],
    [tint(new SphereGeometry(0.075, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1), '#4a3020'), 0, -0.02, 0.07],
  ]);
  const footL = part(footGeo, boot);
  footL.position.set(0.11, 0.05, 0.03);
  const footR = part(footGeo, boot);
  footR.position.set(-0.11, 0.05, 0.03);
  body.add(footL, footR);

  const torso = new Group();
  torso.position.y = 0.08;
  body.add(torso);

  const robeMesh = part(tint(new CylinderGeometry(0.2, 0.4, 0.95, 8, 1), robeC), robe);
  robeMesh.position.y = 0.5;
  const hem = part(tint(new CylinderGeometry(0.405, 0.42, 0.06, 8, 1), robeDarkC), robeDark);
  hem.position.y = 0.05;
  torso.add(robeMesh, hem);
  // The robe's front: an opening edged in gold, a shirt and tie at the collar,
  // a belt with a buckle and a little house crest on the chest.
  const front = (geo: BufferGeometry, color: string, x: number, y: number, z: number, tiltX = 0, rotZ = 0) => {
    const m = part(tint(geo, color), robe);
    m.position.set(x, y, z);
    m.rotation.set(tiltX, 0, rotZ);
    torso.add(m);
  };
  const lean = Math.atan2(0.2, 0.95); // robe flank slope
  // The opening runs from the hem up to the belt; above it a shirt V shows.
  for (const side of [-1, 1]) front(new BoxGeometry(0.025, 0.6, 0.02), goldC, side * 0.035, 0.33, 0.342, -lean);
  front(new BoxGeometry(0.045, 0.6, 0.02), robeDarkC, 0, 0.33, 0.337, -lean);
  front(new BoxGeometry(0.16, 0.22, 0.04), shirtC, 0, 0.84, 0.215, -lean);
  for (const side of [-1, 1]) front(new BoxGeometry(0.025, 0.3, 0.02), goldC, side * 0.09, 0.8, 0.245, -lean, side * 0.35);
  const tie = part(new BoxGeometry(0.05, 0.2, 0.03), scarf);
  tie.position.set(0, 0.79, 0.25);
  tie.rotation.x = -lean;
  torso.add(tie);
  front(new CylinderGeometry(0.29, 0.3, 0.07, 10), '#3a2617', 0, 0.62, 0);
  front(new BoxGeometry(0.09, 0.08, 0.03), goldC, 0, 0.62, 0.3);
  front(new BoxGeometry(0.05, 0.04, 0.035), '#3a2617', 0, 0.62, 0.3);
  front(new CylinderGeometry(0.42, 0.425, 0.03, 8), goldC, 0, 0.09, 0);
  const crest = part(new CylinderGeometry(0.045, 0.045, 0.02, 6).rotateX(Math.PI / 2), trim);
  crest.position.set(0.12, 0.82, 0.25);
  crest.rotation.set(-lean, 0.4, 0);
  torso.add(crest);

  // Scarf: a ring round the neck and a tail that swings behind.
  const scarfRing = part(new TorusGeometry(0.17, 0.065, 5, 10), scarf);
  scarfRing.rotation.x = Math.PI / 2;
  scarfRing.position.y = 0.98;
  torso.add(scarfRing);
  const scarfTail = new Group();
  scarfTail.position.set(0.08, 0.96, -0.15);
  const tail = part(new BoxGeometry(0.11, 0.42, 0.05), scarf);
  tail.position.y = -0.2;
  const stripe = part(new BoxGeometry(0.115, 0.05, 0.055), trim);
  stripe.position.y = -0.34;
  scarfTail.add(tail, stripe);
  torso.add(scarfTail);

  // Head.
  const head = new Group();
  head.position.y = 1.16;
  // A smaller head on the same body: young wizards, not toddlers.
  head.scale.setScalar(0.88);
  torso.add(head);
  // A longer face with a chin, so they read as young wizards rather than toddlers.
  const headMesh = part(tint(new IcosahedronGeometry(0.22, 1).scale(0.92, 1.1, 0.95), skinC), skin);
  head.add(headMesh);
  const add = (parent: Group, geo: BufferGeometry, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const m = part(tint(geo, color), eye);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  const browC = look.hairStyle === 'bald' || look.beard ? '#d8d2c4' : hairC;
  const lidC = new Color(skinC).multiplyScalar(0.82).getStyle();
  add(head, new SphereGeometry(0.1, 8, 5).scale(1, 0.55, 0.7), skinC, 0, -0.17, 0.08);
  // Almond eyes under heavy lids, level brows, a proper nose and a short mouth.
  for (const side of [-1, 1]) {
    add(head, new SphereGeometry(0.03, 8, 6).scale(1.15, 0.6, 0.45), '#f2ece2', side * 0.075, 0.03, 0.188);
    add(head, new SphereGeometry(0.017, 6, 4).scale(1, 1, 0.45), '#1b120c', side * 0.073, 0.028, 0.199);
    add(head, new BoxGeometry(0.075, 0.018, 0.03), lidC, side * 0.075, 0.048, 0.19, 0.25, 0, side * 0.08);
    add(head, new BoxGeometry(0.08, 0.022, 0.025), browC, side * 0.078, 0.085, 0.193, 0, 0, side * 0.12);
    add(head, new SphereGeometry(0.05, 6, 4).scale(0.5, 1, 0.8), skinC, side * 0.2, 0.01, 0);
  }
  add(head, new BoxGeometry(0.04, 0.08, 0.06), skinC, 0, -0.02, 0.21, -0.25, 0, 0);
  add(head, new BoxGeometry(0.06, 0.012, 0.012), '#6a3024', 0, -0.095, 0.192);
  // Hair: a fringe and tufts poking out under the hat, or long locks, a bun or a beard.
  const style = look.hairStyle ?? 'tufts';
  if (style !== 'bald') {
    add(head, new SphereGeometry(0.225, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), hairC, 0, 0.02, -0.01, -0.25);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + (i / 6) * 0.7) + Math.PI;
      const r = style === 'wild' ? 0.07 : 0.05;
      add(head, new IcosahedronGeometry(r, 0), hairC, Math.cos(a) * 0.2, 0.06 - Math.abs(i - 3) * 0.015, Math.sin(a) * 0.2 - 0.02, i, i * 2, 0);
    }
    for (let i = 0; i < 3; i++) add(head, new SphereGeometry(0.045, 6, 4).scale(1.2, 0.45, 0.6), hairC, -0.07 + i * 0.07, 0.15 - Math.abs(i - 1) * 0.015, 0.16, 0.3, 0, (i - 1) * 0.3);
  } else {
    for (const side of [-1, 1]) add(head, new IcosahedronGeometry(0.06, 0), hairC, side * 0.2, 0.05, -0.04);
  }
  if (style === 'long') add(head, new CylinderGeometry(0.2, 0.25, 0.4, 8, 1, true, Math.PI * 0.6, Math.PI * 0.8), hairC, 0, -0.12, 0);
  if (style === 'bun') add(head, new IcosahedronGeometry(0.1, 1), hairC, 0, 0.08, -0.22);
  if (look.beard) {
    add(head, new ConeGeometry(0.16, 0.38, 8).rotateX(Math.PI), hairC, 0, -0.2, 0.1, -0.35);
    for (const side of [-1, 1]) add(head, new SphereGeometry(0.05, 6, 4).scale(1.4, 0.6, 0.6), hairC, side * 0.05, -0.05, 0.21, 0, 0, side * 0.3);
  }
  if (look.glasses) {
    for (const side of [-1, 1]) add(head, new TorusGeometry(0.05, 0.007, 4, 12), '#3a2617', side * 0.08, 0.03, 0.215);
    add(head, new BoxGeometry(0.06, 0.008, 0.008), '#3a2617', 0, 0.035, 0.22);
  }

  // Crooked hat: brim, cone, and a bent tip that jiggles.
  const hat = new Group();
  hat.position.y = 0.13;
  hat.rotation.z = 0.12;
  head.add(hat);
  const hatStyle = look.hatStyle ?? 'pointy';
  const hatTip = new Group();
  hat.add(hatTip);
  if (hatStyle === 'pointy') {
    const brim = part(tint(new CylinderGeometry(0.34, 0.36, 0.03, 12), hatC), hatMat);
    const band = part(new CylinderGeometry(0.205, 0.215, 0.05, 10), trim);
    band.position.y = 0.04;
    const cone = part(tint(new CylinderGeometry(0.11, 0.21, 0.32, 9), hatC), hatMat);
    cone.position.y = 0.17;
    hat.add(brim, band, cone);
    // A brass buckle on the band and a darned patch on the crown.
    add(hat, new BoxGeometry(0.07, 0.055, 0.02), goldC, 0, 0.04, 0.21);
    add(hat, new BoxGeometry(0.04, 0.03, 0.025), hatC, 0, 0.04, 0.215);
    add(hat, new BoxGeometry(0.07, 0.06, 0.02), '#' + new Color(hatC).multiplyScalar(1.35).getHexString(), -0.13, 0.2, 0.07, 0, -1.1, 0.25);
    hatTip.position.y = 0.33;
    hatTip.rotation.z = -0.35;
    hatTip.rotation.x = -0.2;
    const tipMesh = part(tint(new ConeGeometry(0.11, 0.3, 9), hatC), hatMat);
    tipMesh.position.y = 0.14;
    hatTip.add(tipMesh);
    add(hatTip, new IcosahedronGeometry(0.03, 0), goldC, 0, 0.29, 0);
  } else if (hatStyle === 'tall') {
    hat.rotation.z = 0;
    add(hat, new CylinderGeometry(0.3, 0.3, 0.025, 14), hatC, 0, 0, 0);
    add(hat, new CylinderGeometry(0.17, 0.18, 0.34, 12), hatC, 0, 0.17, 0);
    add(hat, new CylinderGeometry(0.185, 0.185, 0.05, 12), goldC, 0, 0.04, 0);
    hatTip.position.y = 0.34;
  } else if (hatStyle === 'cap') {
    hat.rotation.z = 0.05;
    add(hat, new SphereGeometry(0.23, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hatC, 0, -0.02, 0);
    add(hat, new BoxGeometry(0.22, 0.02, 0.14), hatC, 0, -0.02, 0.25);
    add(hat, new IcosahedronGeometry(0.035, 0), goldC, 0, 0.21, 0);
    hatTip.position.y = 0.2;
  } else {
    hat.visible = false;
  }

  // Arms with sleeves; the right hand holds a wand.
  const armGeo = tint(new CylinderGeometry(0.07, 0.1, 0.42, 6), robeC);
  const handGeo = tint(new IcosahedronGeometry(0.06, 0), skinC);
  const cuffGeo = tint(new CylinderGeometry(0.105, 0.105, 0.05, 6), goldC);
  const makeArm = (side: number) => {
    const g = new Group();
    g.position.set(0.24 * side, 0.92, 0);
    const sleeve = part(armGeo, robe);
    sleeve.position.y = -0.19;
    const hand = part(handGeo, skin);
    hand.position.y = -0.42;
    const cuff = part(cuffGeo, robe);
    cuff.position.y = -0.38;
    g.add(sleeve, hand, cuff);
    g.rotation.z = 0.18 * side;
    return g;
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);
  torso.add(armL, armR);
  const wand = part(tint(new CylinderGeometry(0.012, 0.02, 0.36, 5), '#7a4a26'), wood);
  wand.position.set(0, -0.44, 0.13);
  wand.rotation.x = Math.PI / 2 - 0.25;
  const grip = part(tint(new CylinderGeometry(0.024, 0.022, 0.1, 6), '#4a2a16'), wood);
  grip.position.y = -0.12;
  const pommel = part(tint(new IcosahedronGeometry(0.028, 0), goldC), wood);
  pommel.position.y = -0.18;
  wand.add(grip, pommel);
  const wandTip = part(new SphereGeometry(0.025, 6, 4), mat('#fff3c4', { emissive: new Color('#ffd27a'), emissiveIntensity: 0.6 }));
  // Child of the wand at the thin (+Y) end of its axis, so it sits on the tip at any wand angle.
  wandTip.position.set(0, 0.18 + 0.012, 0);
  wand.add(wandTip);
  armR.add(wand);

  for (const g of [torso, head, hat, hatTip, armL, armR, scarfTail]) mergeChildren(g);

  const setScarf = (color: string, trimColor: string) => {
    scarf.color.set(color);
    trim.color.set(trimColor);
  };
  return { root, body, torso, head, hat, hatTip, armL, armR, footL, footR, scarfTail, wandTip, setScarf };
}
