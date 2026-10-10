import { BoxGeometry, CylinderGeometry } from 'three';
import type { NpcLook } from '../../entities/types';
import type { LevelBuilder, V3 } from '../../world/builder';
import type { LevelDef } from '../../world/level';
import { COLORS } from '../../world/materials';
import { banner, bush, chandelier, deco, Glow, rug, signboard, slab, wall, wallTorch } from '../../world/props';
import type { SpeakerId } from '../characters';

/**
 * The Final Examinations: one long hall running north, a section set by each professor.
 * Each section opens with an antechamber (the professor, a checkpoint, a briefing) and
 * ends at a dividing wall (1 m thick, centred on the section's last z) with a gate.
 *
 *   Entrance         z 0..8      the door back up to the First Floor
 *   I   Gorse        z 8..34     a chasm (z 19..26) with a 2 m deep trough down the middle
 *                                (x -1..1, z 19..25): push three blocks north into it to
 *                                bridge it. Beyond, a Rattlecoat (charged hits), two Gnarlings
 *   II  Quince       z 34..60    a pillar with padlocks on three faces, relocking after 6 s;
 *                                the gate needs all three open at once. Two Snapcaskets
 *   III Hopgood      z 60..86    moss pad up to the west ledge (5); a toadstool flings you
 *                                over to the east ledge (9, x 0.5..10.5); its rune tile needs a CHARGED
 *                                bounce (or a held jump) up to the seal shelf (17)
 *   IV  Lamplough    z 86..112   dark. Glimmer stones over a chasm (z 92..104): one lamp at
 *                                the edge, one on a pillar halfway, 6 s each; then a wall
 *                                (z 107) whose false middle fades in the glow of a lamp on
 *                                either side; the gate opens while both lamps burn together
 *   V   Ashcombe     z 112..138  Snapweed beds; a rope-hung drawbridge over the moat
 *                                (z 127..131); four braziers in order, 9 s each
 *   VI  Coldharbour  z 138..164  a pool (z 142..158): two crabs on stepping stones to the
 *                                island (x -5.5..-0.5, z 148..151); a floe knocked north from
 *                                the bank stops at the post beside it; a charged freeze to the
 *                                far bank, where a third crab guards the gate
 *   VII Underbough   z 164..190  a chasm (z 170..184): the ferry floats home after 3 s under
 *                                a pendulum; the basket waits up by the seal shelf (9):
 *                                call it from the landing and ride it up
 *   The Thistle Hall z 190..207  the Brass Examiner (a boss: jump its slams, then break the seal
 *                                on its chest with the spell its rune shows, six times), the
 *                                Golden Thistle caged on the plinth until it falls; behind the
 *                                plinth, a door down to the Lantern Hall (open once the year is done)
 *   Every room also has a Hexling or a Sootling of its own.
 */
export const EXAMS: LevelDef = {
  id: 'exams',
  name: 'The Final Examinations',
  spawns: { default: { pos: [0, 0, 2], yaw: 0 } },
  areas: [
    { id: 'entrance', name: 'The Final Examinations', min: [-10.5, -20, -1], max: [10.5, 20, 8] },
    { id: 'gorse', name: 'I. Practical Charms', min: [-10.5, -20, 8], max: [10.5, 20, 34] },
    { id: 'quince', name: 'II. Locks & Latches', min: [-10.5, -20, 34], max: [10.5, 20, 60] },
    { id: 'hopgood', name: 'III. Leaps & Bounds', min: [-10.5, -20, 60], max: [10.5, 25, 86] },
    { id: 'lamplough', name: 'IV. Illumination', min: [-10.5, -20, 86], max: [10.5, 20, 112], ambience: 'dark' },
    { id: 'ashcombe', name: 'V. Hearth & Flame', min: [-10.5, -20, 112], max: [10.5, 20, 138] },
    { id: 'coldharbour', name: 'VI. Frosts & Waters', min: [-10.5, -20, 138], max: [10.5, 20, 164] },
    { id: 'underbough', name: 'VII. Airs & Graces', min: [-10.5, -20, 164], max: [10.5, 25, 190] },
    { id: 'thistle', name: 'The Thistle Hall', min: [-10.5, -20, 190], max: [10.5, 20, 207] },
  ],
  intro: { script: 'examsIntro', unlessFlag: 'exams-entered' },
  music: 'exams',
  build,
};

const STONE = '#9a8a7a';
const FLOOR = '#7a6a5e';
const VOID = '#141016';

const LOOKS: Record<string, NpcLook> = {
  gorse: { robe: '#a0522d', scarf: '#c99a3e', trim: '#f3e4c4', hat: '#5e3b22', hatStyle: 'none', hair: '#e8e2d0', hairStyle: 'bald', beard: true, skin: '#e2a982', scale: 1.3 },
  quince: { robe: '#2f5a6a', scarf: '#c99a3e', trim: '#f3e4c4', hat: '#24323f', hatStyle: 'tall', hair: '#8a3a22', hairStyle: 'bun', glasses: true, scale: 1.2 },
  hopgood: { robe: '#3f7a4a', scarf: '#e8c25a', trim: '#b0362f', hat: '#b0362f', hatStyle: 'cap', hair: '#d9822e', hairStyle: 'wild', scale: 1.2 },
  lamplough: { robe: '#2a3a5a', scarf: '#bfe8ff', trim: '#e8e2d0', hat: '#1e2638', hatStyle: 'tall', hair: '#e8e2d0', hairStyle: 'long', beard: true, glasses: true, scale: 1.2 },
  ashcombe: { robe: '#8a2a1a', scarf: '#ff8a3c', trim: '#e8c25a', hat: '#3a1a12', hatStyle: 'pointy', hair: '#b8b0a8', hairStyle: 'bun', scale: 1.15 },
  coldharbour: { robe: '#2f4f6a', scarf: '#cfeefa', trim: '#e8f6fc', hat: '#1e3040', hatStyle: 'tall', hair: '#f0f0f0', hairStyle: 'long', glasses: true, scale: 1.15 },
  underbough: { robe: '#6a7a9a', scarf: '#e8f0ff', trim: '#c8d8f0', hat: '#4a5a7a', hatStyle: 'pointy', hair: '#b86a3a', hairStyle: 'wild', scale: 1.1 },
  wendlebury: { robe: '#5d4470', scarf: '#c99a3e', trim: '#f3e4c4', hat: '#3b2c55', hair: '#e8e8e8', hairStyle: 'bun', glasses: true, scale: 1.25 },
};

interface SectionOpts {
  z0: number;
  z1: number;
  height: number;
  who: SpeakerId;
  numeral: string;
  title: string;
  /** Signals that open the gate out. */
  gate: string[];
  /** Floor holes (x0, x1, z0, z1). */
  holes?: [number, number, number, number][];
  floorColor?: string;
}

/**
 * A section's shell: side walls, a ceiling, the dividing wall with the gate at its far
 * end, and the antechamber with the professor, a checkpoint and the briefing.
 */
function section(b: LevelBuilder, flames: Glow, o: SectionOpts): void {
  const { z0, z1, height: h } = o;
  b.floor(-10.5, 10.5, z0, z1, { color: o.floorColor ?? FLOOR, holes: o.holes });
  wall(b, 'z', -11, z0, z1, h, { color: STONE });
  wall(b, 'z', 11, z0, z1, h, { color: STONE });
  wall(b, 'x', z1, -10.5, 10.5, h, { color: STONE, holes: [{ from: -1.8, to: 1.8, top: 3.4 }] });
  slab(b, -11.5, 11.5, z0, z1 + 0.5, h + 0.5, 0.5, COLORS.stoneDark);
  b.add(
    { type: 'npc', speaker: o.who, pos: [-8, 0, z0 + 2.2], yaw: Math.PI / 2, look: LOOKS[o.who], talk: `exam-${o.who}` },
    { type: 'checkpoint', pos: [8, 0, z0 + 2.2], yaw: -Math.PI / 2, zone: { min: [-10, -1, z0 + 0.5], max: [10, 4, z0 + 4] } },
    { type: 'trigger', flag: `exam-brief-${o.who}`, script: `exam-${o.who}`, min: [-10, -1, z0 + 0.5], max: [10, 4, z0 + 3] },
    { type: 'gate', pos: [0, 0, z1], yaw: 0, width: 3.2, height: 3.2, when: o.gate },
  );
  signboard(b, `${o.numeral}. ${o.title.toUpperCase()}`, [0, 4.4, z0 + 0.56], 0);
  // Dressed in the professor's colours: banners high on both walls, a rug by the lectern.
  const robe = LOOKS[o.who].robe ?? STONE;
  const by = h > 12 ? 12 : h - 2.6;
  for (const z of [z0 + 8, z1 - 7]) {
    banner(b, [-10.45, by, z], Math.PI / 2, robe, '#e8c25a', 1.4, 3.4);
    banner(b, [10.45, by, z], -Math.PI / 2, robe, '#e8c25a', 1.4, 3.4);
  }
  rug(b, [0, 0, z0 + 2.2], 7, 2.6, robe, '#c99a3e');
  for (let z = z0 + 2; z < z1; z += 4) deco(b, new BoxGeometry(21, 0.4, 0.4), [0, h - 0.2, z], COLORS.woodDark);
  wallTorch(b, flames, [-10.45, 2.8, z0 + 2.2], Math.PI / 2);
  wallTorch(b, flames, [10.45, 2.8, z0 + 2.2], -Math.PI / 2);
}

function build(b: LevelBuilder): void {
  b.killY = -15;
  const flames = new Glow();

  // ================================================================ entrance (z -1..8)
  b.floor(-10.5, 10.5, -0.5, 8, { color: FLOOR });
  wall(b, 'x', -1, -11.5, 11.5, 9, { color: STONE, holes: [{ from: -1.25, to: 1.25, top: 3.5 }] });
  wall(b, 'z', -11, -0.5, 8, 9, { color: STONE });
  wall(b, 'z', 11, -0.5, 8, 9, { color: STONE });
  slab(b, -11.5, 11.5, -1.5, 8, 9.5, 0.5, COLORS.stoneDark);
  b.add({ type: 'door', pos: [0, 0, -0.45], yaw: 0, width: 2.4, height: 3.4, to: { level: 'upper', spawn: 'fromExams' }, label: 'The First Floor' });
  for (const [i, c] of ['#b0362f', '#4f7fb8', '#3f7a4a', '#d9922e'].entries()) {
    banner(b, [i < 2 ? -10.45 : 10.45, 6, 2.5 + (i % 2) * 3], i < 2 ? Math.PI / 2 : -Math.PI / 2, c, '#e8c25a', 1.4, 3.6);
  }
  signboard(b, 'THE FINAL EXAMINATIONS\nSeven professors. One year. Good luck.', [0, 5.2, -0.44], 0);
  rug(b, [0, 0, 4], 3, 6, '#7a2a2a', '#c99a3e');
  wallTorch(b, flames, [-2.2, 2.6, -0.45], 0);
  wallTorch(b, flames, [2.2, 2.6, -0.45], 0);

  gorse(b, flames);
  quince(b, flames);
  hopgood(b, flames);
  lamplough(b, flames);
  ashcombe(b, flames);
  coldharbour(b, flames);
  underbough(b, flames);
  thistleHall(b, flames);
  finale(b);

  flames.finish(b, '#ffb060');
  b.finish();
}

// ---------------------------------------------------------------- I. Gorse (z 8..34)

function gorse(b: LevelBuilder, flames: Glow): void {
  section(b, flames, { z0: 8, z1: 34, height: 8, who: 'gorse', numeral: 'I', title: 'Practical Charms', gate: ['ex-rattle'], holes: [[-10.5, 10.5, 19, 26]] });
  // The trough down the middle of the chasm, 2 m deep and a block wide. The far lip can't
  // be grabbed, so jumping down and climbing out is no short cut.
  b.box([0, -7, 22], [2, 10, 6], { color: COLORS.stoneDark });
  b.box([0, -2, 25.5], [21, 4, 1], { color: FLOOR, info: { noGrab: true } });
  b.box([0, -14, 22.5], [21, 0.5, 7], { color: VOID, noCollide: true });
  b.add(
    { type: 'pushBlock', pos: [0, 0, 14], resetOn: 'ex-bell', sunkSignal: 'ex-g1' },
    { type: 'pushBlock', pos: [-4, 0, 16], resetOn: 'ex-bell' },
    { type: 'pushBlock', pos: [4, 0, 16], resetOn: 'ex-bell' },
    { type: 'knockSwitch', id: 'ex-bell', pos: [-10.4, 1.8, 13], yaw: Math.PI / 2, style: 'bell', timed: 1 },
    { type: 'rattlecoat', id: 'ex-rattle', pos: [0, 0, 31], yaw: Math.PI, arena: { min: [-10.5, -1, 26.5], max: [10.5, 6, 33.5] } },
    { type: 'gnarling', pos: [-6, 0, 30], wander: 2.5 },
    { type: 'gnarling', pos: [6, 0, 30], wander: 2.5 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-6, 0.6, 11.5], to: [6, 0.6, 11.5], count: 5 },
    { type: 'trigger', flag: 'exam-hint-gorse', script: 'exam-gorse-hint', min: [-10, -1, 12], max: [10, 4, 19], unlessSignals: ['ex-g1'], delay: 45, perVisit: true },
  );
  signboard(b, 'Ring to reset the blocks', [-10.44, 3.6, 13], Math.PI / 2);
  for (const z of [18.95, 26.05]) deco(b, new BoxGeometry(21, 0.06, 0.12), [0, 0.03, z], '#c99a3e');
}

// ---------------------------------------------------------------- II. Quince (z 34..60)

function quince(b: LevelBuilder, flames: Glow): void {
  section(b, flames, { z0: 34, z1: 60, height: 8, who: 'quince', numeral: 'II', title: 'Locks & Latches', gate: ['ex-q1', 'ex-q2', 'ex-q3'] });
  // The pillar, a padlock on its south, east and north faces. Low walls stop you seeing
  // round it from one spot.
  b.box([0, 3.5, 48], [3, 7, 3], { color: COLORS.stoneLight, info: { noGrab: true } });
  for (const [x, z, w, d] of [
    [-5, 43, 6, 0.6],
    [5.5, 53.5, 5, 0.6],
    [7, 45.5, 0.6, 5],
    [-6.5, 51, 0.6, 6],
  ]) {
    b.box([x, 1.2, z], [w, 2.4, d], { color: STONE, info: { noGrab: true } });
  }
  b.add(
    { type: 'padlock', id: 'ex-q1', pos: [0, 1.9, 46.45], yaw: Math.PI, relock: 6 },
    { type: 'padlock', id: 'ex-q2', pos: [1.55, 1.9, 48], yaw: Math.PI / 2, relock: 6 },
    { type: 'padlock', id: 'ex-q3', pos: [0, 1.9, 49.55], yaw: 0, relock: 6 },
    { type: 'snapcasket', id: 'ex-snap1', pos: [-4, 0, 47], yaw: 0, wander: 3 },
    { type: 'snapcasket', id: 'ex-snap2', pos: [4, 0, 56], yaw: Math.PI, wander: 3 },
    { type: 'chest', id: 'ex-chest-quince', pos: [9, 0, 39], yaw: -Math.PI / 2, sweets: [['bramble', 3]] },
    { type: 'sweetLine', kind: 'fizzwort', from: [-8, 0.6, 57.5], to: [8, 0.6, 57.5], count: 5 },
    { type: 'trigger', flag: 'exam-hint-quince', script: 'exam-quince-hint', min: [-10, -1, 38], max: [10, 4, 59], unlessSignals: ['ex-q1'], delay: 60, perVisit: true },
  );
}

// ---------------------------------------------------------------- III. Hopgood (z 60..86)

function hopgood(b: LevelBuilder, flames: Glow): void {
  section(b, flames, { z0: 60, z1: 86, height: 21, who: 'hopgood', numeral: 'III', title: 'Leaps & Bounds', gate: ['ex-h3'] });
  // West ledge (top 5), east ledge (top 9), the seal shelf (top 17) above the east ledge's
  // north end. None can be grabbed: Hopgood wants bouncing, not climbing.
  b.box([-8, 2.5, 72], [5, 5, 8], { color: COLORS.stoneLight, info: { noGrab: true } });
  b.box([5.5, 4.5, 74.5], [10, 9, 9], { color: COLORS.stoneLight, info: { noGrab: true } });
  b.box([8, 8.5, 82.5], [5, 17, 5], { color: COLORS.stoneLight, info: { noGrab: true } });
  b.add(
    { type: 'springPad', pos: [-3.6, 0, 72], radius: 1.1, style: 'moss', duration: 6 },
    { type: 'springPad', pos: [-7.5, 5, 74.5], radius: 1, style: 'mushroom', height: 0.7, duration: 6, fling: { yaw: Math.PI / 2, speed: 10.5 } },
    { type: 'springPad', pos: [8, 9, 77.8], radius: 1, style: 'rune', duration: 6, fling: { yaw: 0, speed: 3 } },
    { type: 'plate', id: 'ex-h3', pos: [8, 17, 83.5], latch: true },
    { type: 'sweetLine', kind: 'fizzwort', from: [-9.5, 5.6, 69], to: [-9.5, 5.6, 75], count: 3 },
    { type: 'sweetLine', kind: 'fizzwort', from: [9.5, 9.6, 71], to: [9.5, 9.6, 77], count: 3 },
    { type: 'sweet', kind: 'humbug', pos: [6.5, 17.6, 83.5] },
    { type: 'trigger', flag: 'exam-hint-hopgood', script: 'exam-hopgood-hint', min: [0.5, 8, 70], max: [10.5, 12, 79], unlessSignals: ['ex-h3'], delay: 20, perVisit: true },
  );
  signboard(b, 'The seal is on the top shelf.\nCharge it, or hold that jump!', [5.44, 12.5, 82.5], -Math.PI / 2);
}

// ---------------------------------------------------------------- IV. Lamplough (z 86..112, dark)

function lamplough(b: LevelBuilder, flames: Glow): void {
  section(b, flames, { z0: 86, z1: 112, height: 8, who: 'lamplough', numeral: 'IV', title: 'Illumination', gate: ['ex-l3', 'ex-l4'], holes: [[-10.5, 10.5, 92, 104]], floorColor: '#4a4450' });
  b.box([0, -14, 98], [21, 0.5, 12], { color: VOID, noCollide: true });
  // The pillar halfway, with the second lamp on it.
  b.box([4, -7, 98], [2, 14, 2], { color: COLORS.stoneLight });
  const stones: [number, number][] = [
    [-0.4, 93.6],
    [0.8, 95.6],
    [2.4, 97.4],
    [5.6, 99.6],
    [4.8, 101.6],
    [3.2, 103.2],
  ];
  b.add(
    { type: 'wickLamp', pos: [-1.6, 0, 90.8], radius: 6.5, duration: 6, light: true },
    { type: 'wickLamp', pos: [4.3, 0, 97.7], radius: 6.5, duration: 6, light: true },
    ...stones.map(([x, z]) => ({ type: 'glimmerBlock' as const, pos: [x, -0.15, z] as V3, size: [1.5, 0.3, 1.5] as V3 })),
    { type: 'checkpoint', pos: [-8, 0, 105], yaw: Math.PI / 2, zone: { min: [-10, -1, 104.3], max: [10, 4, 106.4] } },
    // A wall across with a false middle that fades in the glow of either lamp beside it,
    // one each side (so nobody gets shut in behind it); the gate opens only while both burn.
    { type: 'wickLamp', id: 'ex-l3', pos: [2.6, 0, 105.3], radius: 3.4, duration: 9 },
    { type: 'wickLamp', id: 'ex-l4', pos: [-2.4, 0, 108.8], radius: 3.4, duration: 9 },
    { type: 'illusionWall', pos: [0, 1.6, 107], size: [3.2, 3.2, 0.6], color: STONE },
    { type: 'trigger', flag: 'exam-hint-lamplough', script: 'exam-lamplough-hint', min: [-10, -1, 104.3], max: [10, 4, 106.6], unlessSignals: ['ex-l3'], delay: 25, perVisit: true },
    { type: 'trigger', flag: 'exam-hint-lamplough2', script: 'exam-lamplough-hint2', min: [-10, -1, 107.4], max: [10, 4, 111.5], unlessSignals: ['ex-l3', 'ex-l4'], delay: 10, perVisit: true },
  );
  b.box([-6.35, 1.6, 107], [8.3, 3.2, 0.6], { color: STONE });
  b.box([6.35, 1.6, 107], [8.3, 3.2, 0.6], { color: STONE });
  b.box([0, 5.6, 107], [21, 4.8, 0.6], { color: STONE });
}

// ---------------------------------------------------------------- V. Ashcombe (z 112..138)

function ashcombe(b: LevelBuilder, flames: Glow): void {
  section(b, flames, { z0: 112, z1: 138, height: 8, who: 'ashcombe', numeral: 'V', title: 'Hearth & Flame', gate: ['ex-b4'], holes: [[-10.5, 10.5, 127, 131]], floorColor: '#8a7a5e' });
  b.pool(-10.5, 10.5, 127, 131, -0.7, -3);
  b.add(
    { type: 'snapweed', pos: [-4, 0, 119.5], radius: 2.3 },
    { type: 'snapweed', pos: [4, 0, 121.5], radius: 2.3 },
    { type: 'snapweed', pos: [-0.5, 0, 124.5], radius: 2.3 },
    // A drawbridge over the moat, held up by its rope.
    { type: 'drawbridge', pos: [0, 0, 127], yaw: 0, length: 4, width: 2.4, when: ['ex-rope'] },
    { type: 'burnable', id: 'ex-rope', style: 'rope', pos: [1.7, 2.4, 126.4], size: [0.16, 2.6, 0.16] },
    // Four braziers, in order, 9 s each. The hedge stops you seeing them all from one spot.
    { type: 'brazier', id: 'ex-b1', pos: [-8.5, 0, 133], group: 'exam', order: 1, duration: 9 },
    { type: 'brazier', id: 'ex-b2', pos: [8.5, 0, 136.5], group: 'exam', order: 2, duration: 9 },
    { type: 'brazier', id: 'ex-b3', pos: [-8.5, 0, 136.5], group: 'exam', order: 3, duration: 9 },
    { type: 'brazier', id: 'ex-b4', pos: [8.5, 0, 133], group: 'exam', order: 4, duration: 9 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-9, 0.6, 115], to: [-9, 0.6, 125], count: 4 },
    { type: 'trigger', flag: 'exam-hint-ashcombe', script: 'exam-ashcombe-hint', min: [-10, -1, 131.5], max: [10, 4, 137.4], unlessSignals: ['ex-b4'], delay: 40, perVisit: true },
  );
  b.cylinder([1.7, 1.6, 126.4], 0.12, 3.2, COLORS.woodDark, undefined, 6);
  b.box([0, 1.4, 135], [5, 2.8, 0.8], { invisible: true, info: { noGrab: true } });
  for (let i = 0; i < 6; i++) {
    bush(b, -2.1 + i * 0.84, 135, 1.5, i + 3);
    bush(b, -2.1 + i * 0.84 + 0.4, 135, 1.3, i + 11, 1.2);
  }
  b.box([0, 0.15, 135], [5.4, 0.3, 1.2], { color: COLORS.stoneDark });
}

// ---------------------------------------------------------------- VI. Coldharbour (z 138..164)

function coldharbour(b: LevelBuilder, flames: Glow): void {
  const W = -0.5;
  section(b, flames, { z0: 138, z1: 164, height: 9, who: 'coldharbour', numeral: 'VI', title: 'Frosts & Waters', gate: ['ex-crab3'], holes: [[-10.5, 10.5, 142, 158]] });
  b.pool(-10.5, 10.5, 142, 158, W, -3);
  // The island (x -5.5..-0.5, z 148..151).
  b.box([-3, -1.5, 149.5], [5, 3, 3], { color: COLORS.stone });
  const stones: [number, number][] = [
    [-5, 143.8],
    [-3, 146.2],
  ];
  for (const [x, z] of stones) b.box([x, (-3 + W - 0.3) / 2, z], [1.6, W - 0.3 + 3, 1.4], { color: COLORS.stoneDark });
  b.add(
    ...stones.map(([x, z], i) => ({ type: 'emberCrab' as const, id: `ex-crab${i + 1}`, pos: [x, W - 0.3, z] as V3, patrol: 0, range: 9, interval: 3.2 })),
    // From the bank: knock the floe north until the post stops it beside the island. Step
    // across from the island; a charged freeze then reaches the far bank.
    { type: 'floe', pos: [1.2, W, 146.4], size: [2.4, 2.4], resetOn: 'ex-floe-reset' },
    { type: 'knockSwitch', id: 'ex-floe-reset', pos: [-10.4, 1.8, 140.5], yaw: Math.PI / 2, style: 'bell', timed: 1 },
    { type: 'iceSheet', min: [-0.4, 153.7], max: [2, 158], y: W, duration: 1.2, chargedDuration: 6 },
    { type: 'checkpoint', pos: [-4.6, 0, 149.5], yaw: 0, zone: { min: [-5.5, -1, 148], max: [-0.5, 3, 151] } },
    { type: 'emberCrab', id: 'ex-crab3', pos: [5, 0, 160.5], patrol: 3, interval: 2.8 },
    { type: 'sweetLine', kind: 'fizzwort', from: [-4.5, 0.6, 150.5], to: [-1.5, 0.6, 150.5], count: 3 },
    { type: 'trigger', flag: 'exam-hint-coldharbour', script: 'exam-coldharbour-hint', min: [-5.5, -1, 148], max: [-0.5, 3, 151], unlessSignals: ['ex-crab3'], delay: 30, perVisit: true },
  );
  // The post catches the floe's corner at z 153.6: it stops beside the island, under the ice.
  b.box([2.7, -0.75, 154.6], [1.2, 2.5, 2], { color: COLORS.stoneLight });
}

// ---------------------------------------------------------------- VII. Underbough (z 164..190)

function underbough(b: LevelBuilder, flames: Glow): void {
  section(b, flames, { z0: 164, z1: 190, height: 21, who: 'underbough', numeral: 'VII', title: 'Airs & Graces', gate: ['ex-u2'], holes: [[-10.5, 10.5, 170, 184]] });
  b.box([0, -14, 177], [21, 0.5, 14], { color: VOID, noCollide: true });
  // The landing (x -8..-3.5, z 176..179) beyond the ferry, and the seal shelf (top 9).
  b.box([-5.75, -7, 177.5], [4.5, 14, 3], { color: COLORS.stoneLight });
  b.box([8, 4.5, 186.75], [5, 9, 5.5], { color: COLORS.stoneLight, info: { noGrab: true } });
  b.add(
    { type: 'skyLift', style: 'platform', from: [-6, 0, 171.3], to: [-6, 0, 174.7], size: [2.4, 2.4], returnAfter: 3, speed: 2.2 },
    { type: 'pendulum', pos: [-6, 9.4, 173], length: 8.4, swing: 0.42, period: 3, phase: 0.25, bob: 0.7 },
    { type: 'skyLift', style: 'basket', id: 'ex-u1', from: [-2.4, 0, 177.5], to: [4.4, 9, 186.5], size: [2, 2], startAt: 'to', speed: 2.6 },
    { type: 'plate', id: 'ex-u2', pos: [8.5, 9, 187], latch: true },
    { type: 'checkpoint', pos: [-7.4, 0, 178], yaw: Math.PI / 2, zone: { min: [-8, -1, 176], max: [-3.5, 3, 179] } },
    { type: 'sweetLine', kind: 'fizzwort', from: [7, 9.6, 185], to: [10, 9.6, 185], count: 2 },
    { type: 'trigger', flag: 'exam-hint-underbough', script: 'exam-underbough-hint', min: [-8, -1, 176], max: [-3.5, 3, 179], unlessSignals: ['ex-u1'], delay: 15, perVisit: true },
  );
}

// ---------------------------------------------------------------- the Thistle Hall (z 190..207)

function thistleHall(b: LevelBuilder, flames: Glow): void {
  b.floor(-10.5, 10.5, 190, 206.5, { color: '#8a6a4a' });
  wall(b, 'z', -11, 190, 206.5, 12, { color: STONE });
  wall(b, 'z', 11, 190, 206.5, 12, { color: STONE });
  wall(b, 'x', 207, -11.5, 11.5, 12, { color: STONE, holes: [{ from: -1.3, to: 1.3, top: 3.6 }] });
  slab(b, -11.5, 11.5, 190.5, 207.5, 12.5, 0.5, '#4a3226', 'planks');
  deco(b, new BoxGeometry(3, 0.03, 10), [0, 0.015, 195.5], COLORS.carpet);
  b.cylinder([0, 0.6, 202], 1, 1.2, COLORS.stoneLight, undefined, 10);
  deco(b, new CylinderGeometry(1.15, 1.15, 0.12, 10), [0, 1.26, 202], '#c99a3e');
  for (const [i, c] of ['#b0362f', '#4f7fb8', '#3f7a4a', '#d9922e'].entries()) {
    banner(b, [i < 2 ? -10.45 : 10.45, 7, 195 + (i % 2) * 6], i < 2 ? Math.PI / 2 : -Math.PI / 2, c, '#e8c25a', 1.6, 5);
  }
  b.add(
    { type: 'npc', speaker: 'wendlebury', pos: [-8.6, 0, 191.8], yaw: Math.PI / 2, look: LOOKS.wendlebury, talk: 'examWendlebury' },
    { type: 'star', id: 'exam-star', pos: [0, 2.6, 202], script: 'examComplete' },
  );
  for (const z of [194, 204]) {
    wallTorch(b, flames, [-10.45, 3, z], Math.PI / 2);
    wallTorch(b, flames, [10.45, 3, z], -Math.PI / 2);
  }
  chandelier(b, flames, 0, 10, 198, 1.8, true);
  // The way home, behind the plinth: straight down to the Lantern Hall once the year is done
  // (the rooms behind you lock themselves up again).
  b.add({ type: 'door', pos: [0, 0, 206.45], yaw: Math.PI, width: 2.4, height: 3.4, to: { level: 'hub', spawn: 'default' }, lockedUnless: 'year-complete', talk: 'examsHomeDoor', label: 'The Lantern Hall' });
  signboard(b, 'Home', [0, 4.4, 206.44], Math.PI);
}

/**
 * Appended last (ids follow build order): the foes that make each room harder, and the
 * finale: the Brass Examiner, and a cage over the Golden Thistle until it falls.
 */
function finale(b: LevelBuilder): void {
  b.add(
    { type: 'hexling', pos: [0, 0, 30], height: 4, radius: 3.5, interval: 3.4 },
    { type: 'hexling', pos: [0, 0, 52], height: 5, radius: 4, interval: 3.6 },
    { type: 'hexling', pos: [0, 0, 76], height: 9, radius: 3, interval: 3.4 },
    { type: 'hexling', pos: [2, 0, 98], height: 4, radius: 3, interval: 3.8 },
    { type: 'sootling', pos: [8, 0, 125.5], yaw: -Math.PI / 2, wander: 0.8, range: 16, interval: 3.8 },
    { type: 'hexling', pos: [0, 0, 150], height: 4, radius: 4, interval: 3.4 },
    { type: 'hexling', pos: [0, 0, 177], height: 6, radius: 3.5, interval: 3.6 },
    // The finale.
    { type: 'checkpoint', pos: [8.6, 0, 191.8], yaw: -Math.PI / 2, zone: { min: [-10, -1, 190.5], max: [10, 4, 193] } },
    { type: 'trigger', flag: 'exam-boss-woken', script: 'examBossIntro', min: [-10, -1, 190.5], max: [10, 4, 193.5] },
    { type: 'examiner', id: 'exam-boss', pos: [0, 0, 198], arena: { min: [-10.5, -1, 190.5], max: [10.5, 12, 206.5] }, wakeFlag: 'exam-boss-woken' },
    { type: 'gate', pos: [0, 0, 200.6], yaw: 0, width: 2.8, height: 3.6, when: ['exam-boss'] },
    { type: 'gate', pos: [0, 0, 203.4], yaw: 0, width: 2.8, height: 3.6, when: ['exam-boss'] },
    { type: 'gate', pos: [-1.4, 0, 202], yaw: Math.PI / 2, width: 2.8, height: 3.6, when: ['exam-boss'] },
    { type: 'gate', pos: [1.4, 0, 202], yaw: Math.PI / 2, width: 2.8, height: 3.6, when: ['exam-boss'] },
  );
}

