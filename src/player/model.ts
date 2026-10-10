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
  hat?: string;
}

const mat = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
  new MeshStandardMaterial({ color: new Color(color), flatShading: true, roughness: 0.85, ...extra });

function part(geo: BufferGeometry, material: MeshStandardMaterial): Mesh {
  const m = new Mesh(geo, material);
  m.castShadow = true;
  return m;
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
  const skinC = '#f0c9a0';
  const hatC = look.hat ?? '#4f3a73';
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

  // Feet peek out under the robe.
  const footGeo = tint(new BoxGeometry(0.14, 0.1, 0.24), '#3a2617');
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
  head.position.y = 1.18;
  torso.add(head);
  const headMesh = part(tint(new IcosahedronGeometry(0.22, 1), skinC), skin);
  head.add(headMesh);
  const eyeGeo = tint(new SphereGeometry(0.03, 6, 4), '#1b120c');
  const eyeL = part(eyeGeo, eye);
  eyeL.position.set(0.08, 0.03, 0.195);
  const eyeR = part(eyeGeo, eye);
  eyeR.position.set(-0.08, 0.03, 0.195);
  const nose = part(tint(new SphereGeometry(0.035, 5, 4), skinC), skin);
  nose.position.set(0, -0.02, 0.22);
  head.add(eyeL, eyeR, nose);

  // Crooked hat: brim, cone, and a bent tip that jiggles.
  const hat = new Group();
  hat.position.y = 0.13;
  hat.rotation.z = 0.12;
  head.add(hat);
  const brim = part(tint(new CylinderGeometry(0.34, 0.36, 0.03, 10), hatC), hatMat);
  const band = part(new CylinderGeometry(0.205, 0.215, 0.05, 10), trim);
  band.position.y = 0.04;
  const cone = part(tint(new CylinderGeometry(0.11, 0.21, 0.32, 9), hatC), hatMat);
  cone.position.y = 0.17;
  hat.add(brim, band, cone);
  const hatTip = new Group();
  hatTip.position.y = 0.33;
  hatTip.rotation.z = -0.35;
  hatTip.rotation.x = -0.2;
  const tipMesh = part(tint(new ConeGeometry(0.11, 0.3, 9), hatC), hatMat);
  tipMesh.position.y = 0.14;
  hatTip.add(tipMesh);
  hat.add(hatTip);

  // Arms with sleeves; the right hand holds a wand.
  const armGeo = tint(new CylinderGeometry(0.07, 0.1, 0.42, 6), robeC);
  const handGeo = tint(new IcosahedronGeometry(0.06, 0), skinC);
  const makeArm = (side: number) => {
    const g = new Group();
    g.position.set(0.24 * side, 0.92, 0);
    const sleeve = part(armGeo, robe);
    sleeve.position.y = -0.19;
    const hand = part(handGeo, skin);
    hand.position.y = -0.42;
    g.add(sleeve, hand);
    g.rotation.z = 0.18 * side;
    return g;
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);
  torso.add(armL, armR);
  const wand = part(tint(new CylinderGeometry(0.012, 0.02, 0.36, 5), '#7a4a26'), wood);
  wand.position.set(0, -0.44, 0.13);
  wand.rotation.x = Math.PI / 2 - 0.25;
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
