/*
 * The trailer's shot list, run inside the game page (a dev build in ?test mode, so the
 * simulation only moves when we step it). tools/trailer/record.mjs steps it frame by frame:
 * for each shot `begin(i)` sets the scene up, then `step(i, t)` plays one frame of it (input,
 * casts, a game-time step), places the cinematic camera, sets the captions and draws.
 * Shot timings are shared with the soundtrack (record.mjs reads `trailer.timeline()`).
 */
(() => {
  const FPS = 30;
  const tw = window.__tw;
  const g = tw.game;
  const V = g.renderer.camera.position.constructor;

  // ---------------------------------------------------------------- captions

  const css = document.createElement('style');
  css.textContent = `
    #hud, #crosshair, #charge-ring, #area-banner, #interact-prompt, #toasts, #hurt-flash, #dialogue,
    #boss-bar, #stats, #fade, #menu { display: none !important; }
    #trailer { position: fixed; inset: 0; pointer-events: none; font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif; }
    #trailer .shade { position: absolute; inset: 0; background: #0d0814; opacity: 0; }
    #trailer .vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 55%, rgba(10, 6, 16, 0.55) 100%); }
    #trailer .bars::before, #trailer .bars::after { content: ''; position: absolute; left: 0; right: 0; height: 64px; background: #000; }
    #trailer .bars::before { top: 0; } #trailer .bars::after { bottom: 0; }
    #trailer .logo { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-58%); text-align: center; opacity: 0;
      color: #f3e4c4; text-shadow: 0 4px 0 #2b1d14, 0 0 40px rgba(255, 190, 110, 0.7); }
    #trailer .logo .small { font-size: 30px; letter-spacing: 7px; text-transform: uppercase; opacity: 0.9; }
    #trailer .logo h1 { font-size: 168px; margin: 0; letter-spacing: 5px; font-style: italic; color: #fbe8c0; font-weight: bold; }
    #trailer .logo .sub { font-size: 42px; font-style: italic; color: #f2d48a; }
    #trailer .logo .url { font-size: 34px; margin-top: 46px; color: #fbe8c0; letter-spacing: 2px; }
    #trailer .logo .tag { font-size: 30px; margin-top: 18px; font-style: italic; color: #e8d2a6; }
    #trailer .cap { position: absolute; left: 0; right: 0; bottom: 120px; text-align: center; opacity: 0;
      font-size: 64px; font-style: italic; color: #fbe8c0; text-shadow: 0 3px 0 #2b1d14, 0 0 26px rgba(0, 0, 0, 0.8); }
    #trailer .spell { position: absolute; left: 110px; bottom: 120px; opacity: 0; color: #fbe8c0;
      text-shadow: 0 3px 0 #2b1d14, 0 0 22px rgba(0, 0, 0, 0.85); }
    #trailer .spell b { display: block; font-size: 72px; font-style: italic; }
    #trailer .spell span { display: block; font-size: 30px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.85; margin-top: 4px; }
    #trailer .spell::before { content: ''; position: absolute; left: -34px; top: 14px; bottom: 14px; width: 6px; border-radius: 3px; background: var(--rune, #f2d48a); box-shadow: 0 0 18px var(--rune, #f2d48a); }
  `;
  document.head.appendChild(css);
  const ui = document.createElement('div');
  ui.id = 'trailer';
  ui.innerHTML = `<div class="vignette"></div>
    <div class="logo"><div class="small">The Chronicles of</div><h1>Thistlewick</h1><div class="sub">~ First Year ~</div>
      <div class="tag"></div><div class="url"></div></div>
    <div class="cap"></div><div class="spell"><b></b><span></span></div><div class="shade"></div><div class="bars"></div>`;
  document.body.appendChild(ui);
  const el = (s) => ui.querySelector(s);
  const ramp = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  /** 0→1 over [in0, in1], holds, 1→0 over [out0, out1]. */
  const fade = (t, in0, in1, out0, out1) => Math.min(ramp(t, in0, in1), 1 - ramp(t, out0, out1));
  const smooth = (x) => x * x * (3 - 2 * x);
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

  function captions({ logo = 0, tag = '', url = '', cap = '', capA = 0, spell = null, spellA = 0, shade = 0 }) {
    el('.logo').style.opacity = logo;
    el('.logo .tag').textContent = tag;
    el('.logo .url').textContent = url;
    el('.cap').textContent = cap;
    el('.cap').style.opacity = capA;
    el('.spell').style.opacity = spell ? spellA : 0;
    if (spell) {
      el('.spell b').textContent = spell.name;
      el('.spell span').textContent = spell.what;
      el('.spell').style.setProperty('--rune', spell.color);
    }
    el('.shade').style.opacity = shade;
  }

  // ---------------------------------------------------------------- scene helpers

  const session = () => g.session;
  const world = () => g.session.world;
  const entities = (name) => world().entities.filter((e) => e.constructor.name === name);

  async function load(level, spawn = 'default') {
    tw.loadLevel(level, spawn);
    tw.advance(0.2);
    await tw.idle();
    // Room hints would pop up dialogues mid-shot: hold every trigger still.
    for (const e of world().entities) if (e.constructor.name === 'Trigger') world().held.add(e);
  }

  let look = null;
  /** The cinematic camera for this frame. */
  function cam(pos, at, fov = 50) {
    look = { pos, at, fov };
  }

  function draw() {
    // Nobody faints in a trailer.
    g.state.stamina = g.state.maxStamina;
    const c = g.renderer.camera;
    if (look) {
      c.position.set(...look.pos);
      c.lookAt(new V(...look.at));
      if (c.fov !== look.fov) {
        c.fov = look.fov;
        c.updateProjectionMatrix();
      }
    }
    session().rig.root.visible = !hidePlayer;
    g.renderer.draw();
  }

  let hidePlayer = false;
  let actions = [];
  /** Schedule `fn` at shot time `at` (seconds). */
  const at = (time, fn) => actions.push({ time, fn, done: false });

  // ---------------------------------------------------------------- the shots

  const SPELLS = {
    thwackwort: { name: 'Thwackwort', what: 'knock it flying', color: '#ff9a3a' },
    latchkin: { name: 'Latchkin', what: 'every lock opens', color: '#f0d020' },
    glimmerwick: { name: 'Glimmerwick', what: 'light reveals the hidden', color: '#9af4f4' },
    cindersnap: { name: 'Cindersnap', what: 'fire clears the way', color: '#ff5a3a' },
    springwell: { name: 'Springwell', what: 'bounce sky-high', color: '#8ef06a' },
    rimewhistle: { name: 'Rimewhistle', what: 'freeze the water', color: '#7ac4ff' },
    thistledown: { name: 'Thistledown', what: 'float on the air', color: '#d6a0ff' },
  };

  /** A spell shot: the caption slides in and out round its moment. */
  const spellCap = (key, t, dur) => ({ spell: SPELLS[key], spellA: fade(t, 0.15, 0.55, dur - 0.45, dur - 0.05) });

  /**
   * Cast: aim at a point, press, hold `hold` seconds of game time, release. The press happens
   * at shot time `when`; the frames keep rendering through it.
   */
  function scheduleCast(when, target, hold = 0) {
    at(when, () => {
      tw.aimAt(...target);
      g.input.setCast(true);
    });
    at(when + Math.max(1 / FPS, hold), () => g.input.setCast(false));
  }

  const shots = [
    {
      // The castle from the lake at evening: the title rises.
      name: 'title',
      dur: 6,
      music: 'title',
      async setup() {
        await load('grounds');
        tw.teleport(0, 0, -6, Math.PI);
        hidePlayer = true;
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-18, 6, -70], [-8, 4, -38], k), mix([0, 6, 2], [0, 7, 0], k), 52);
        return { logo: fade(t, d * 0.2, d * 0.43, d - 1.1, d - 0.2), shade: 1 - ramp(t, 0, d * 0.2) };
      },
    },
    {
      name: 'hall',
      dur: 5,
      async setup() {
        await load('hub');
        tw.teleport(0, 0, 9, 0);
        hidePlayer = false;
        tw.setCamera(0, -0.1);
        tw.input({ y: 0.55 });
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-5.5, 1.6, 2], [-3.5, 3.4, 9], k), mix([0, 2.2, 14], [0, 4.5, 26], k), 55);
        return { cap: 'A crooked castle full of secrets', capA: fade(t, 0.6, 1.2, d - 0.8, d - 0.1) };
      },
    },
    {
      name: 'court',
      dur: 5,
      async setup() {
        await load('hub');
        tw.input(null);
        tw.teleport(-6, 0, 38, 0);
        tw.setCamera(0.5, -0.1);
        tw.input({ y: 1 });
        at(1.6, () => tw.pressJump());
        at(3.4, () => tw.pressJump());
      },
      frame(t, d) {
        const p = session().player.feet;
        const k = smooth(t / d);
        cam([p.x + 6 - k * 2, p.y + 4, p.z - 6 + k * 2], [p.x, p.y + 1, p.z + 2.5], 55);
        return { cap: 'Run, climb and explore', capA: fade(t, 0.5, 1.1, d - 0.8, d - 0.1) };
      },
    },
    {
      name: 'spells-card',
      dur: 2.2,
      music: 'dungeon',
      async setup() {
        await load('hub');
        tw.input(null);
        tw.teleport(0, 0, 46, Math.PI);
        hidePlayer = true;
      },
      frame(t, d) {
        cam([0, 9 + t * 0.4, 30], [0, 3, 50], 55);
        return { cap: 'Learn seven spells', capA: fade(t, 0.1, 0.5, d - 0.5, d - 0.05), shade: 0.35 };
      },
    },
    {
      name: 'thwackwort',
      dur: 3.4,
      async setup() {
        await load('bestiary');
        hidePlayer = false;
        // The Gnarlings' room: one of them comes at you; a Thwackwort sends it tumbling.
        tw.teleport(-7, 0, 9, -Math.PI / 2);
        tw.advance(0.6);
        const gn = entities('Gnarling')[0];
        scheduleCast(1.1, [gn.pos.x, gn.pos.y + 0.2, gn.pos.z]);
        this.gn = gn;
      },
      frame(t, d) {
        const gn = this.gn.pos;
        cam([-6.2, 1.5, 12.2], [(gn.x - 7) / 2 - 0.5, 0.7, (gn.z + 9) / 2], 46);
        return spellCap('thwackwort', t, d);
      },
    },
    {
      name: 'latchkin',
      dur: 3.4,
      async setup() {
        await load('vault');
        tw.teleport(0, 0, 51.5, 0);
        tw.advance(0.3);
        scheduleCast(0.9, [-3.2, 1.8, 53.9]);
      },
      frame(t, d) {
        cam(mix([0.2, 2.1, 52.0], [-0.4, 2.0, 52.5], smooth(t / d)), [-3.2, 1.6, 54.0], 42);
        return spellCap('latchkin', t, d);
      },
    },
    {
      name: 'glimmerwick',
      dur: 3.8,
      async setup() {
        await load('catacombs');
        tw.teleport(0, 0, 10.4, 0);
        tw.advance(0.3);
        scheduleCast(0.7, [2.6, 2.1, 10.2], 0.9);
      },
      frame(t, d) {
        cam(mix([-3.2, 2.6, 8.2], [-2.6, 2.4, 9.6], smooth(t / d)), [0.4, 0.2, 15], 55);
        return spellCap('glimmerwick', t, d);
      },
    },
    {
      name: 'cindersnap',
      dur: 3.4,
      async setup() {
        // The vines over the court's west arch: they burn away, and through you go.
        await load('hub');
        hidePlayer = false;
        tw.teleport(12, 0, 46, Math.PI / 2);
        tw.advance(0.3);
        scheduleCast(0.7, [16.5, 1.75, 46]);
        at(2.3, () => {
          tw.setCamera(Math.PI / 2, -0.1);
          tw.input({ y: 0.8 });
        });
      },
      frame(t, d) {
        cam(mix([10.6, 2.2, 49.6], [11.4, 2.0, 49.2], smooth(t / d)), [16.2, 1.5, 45.6], 50);
        return spellCap('cindersnap', t, d);
      },
    },
    {
      name: 'springwell',
      dur: 4,
      async setup() {
        await load('tower');
        tw.teleport(0, 17.5, 11.8, 0);
        tw.advance(0.3);
        scheduleCast(0.4, [0, 17.7, 15.2], 0.8);
        at(1.5, () => {
          tw.setCamera(0, -0.2);
          tw.input({ y: 1, jump: true });
        });
        at(2.2, () => tw.input({ y: 0.4, jump: true }));
        at(3.2, () => tw.input(null));
      },
      frame(t, d) {
        // Beside the pad, rising after the player a little slower than they fly, so the bounce
        // reads as a bounce (they land on a ledge 10 m up).
        const p = session().player.feet;
        cam([4.6, 18.6 + (p.y - 17.5) * 0.65, 10.4], [0, p.y + 0.8, Math.max(14.5, p.z)], 62);
        return spellCap('springwell', t, d);
      },
    },
    {
      name: 'rimewhistle',
      dur: 3.8,
      async setup() {
        await load('coldharbour');
        tw.teleport(-2, 0, 8, 0);
        tw.advance(0.3);
        scheduleCast(0.5, [-6, -0.5, 8], 0.6);
        at(1.7, () => {
          tw.setCamera(-Math.PI / 2, -0.15);
          tw.input({ y: 1 });
        });
      },
      frame(t, d) {
        cam(mix([-4.5, 2.8, 3.2], [-6, 2.6, 3.6], smooth(t / d)), [-6, -0.2, 8.5], 55);
        return spellCap('rimewhistle', t, d);
      },
    },
    {
      name: 'thistledown',
      dur: 4,
      async setup() {
        await load('underbough');
        tw.input(null);
        tw.teleport(5.3, 1.2, 6, Math.PI / 2);
        tw.advance(0.4);
        scheduleCast(0.5, [4.85, 2.5, 5.55]);
      },
      frame(t, d) {
        const p = session().player.feet;
        cam(mix([1.2, 2.2, 1.8], [1.5, 3.4, 2.2], smooth(t / d)), [p.x, p.y + 0.6, p.z], 55);
        return spellCap('thistledown', t, d);
      },
    },
    {
      name: 'foes-card',
      dur: 2.2,
      async setup() {
        await load('bestiary');
        hidePlayer = true;
        tw.teleport(0, 0, 30, 0);
      },
      frame(t, d) {
        cam([0, 2 + t * 0.3, 24 + t], [0, 1.5, 60], 55);
        return { cap: 'Outwit the creatures of the trials', capA: fade(t, 0.1, 0.5, d - 0.5, d - 0.05), shade: 0.35 };
      },
    },
    {
      name: 'rattlecoat',
      dur: 3,
      async setup() {
        await load('bestiary');
        hidePlayer = false;
        tw.teleport(8.5, 0, 9, -Math.PI / 2);
        tw.advance(0.2);
      },
      frame(t, d) {
        const r = entities('Rattlecoat')[0].pos;
        cam(mix([6.5, 1.3, 4.5], [7, 1.4, 5.5], smooth(t / d)), [(r.x + 8.5) / 2, 1.2, (r.z + 9) / 2], 52);
        return {};
      },
    },
    {
      name: 'hexling',
      dur: 3,
      async setup() {
        await load('bestiary');
        tw.teleport(7, 0, 41, -Math.PI / 2);
        tw.advance(1.5);
        // Her first throw comes at a random moment; make it come early, on camera.
        entities('Hexling')[0].reload = 0.15;
      },
      frame(t) {
        const h = entities('Hexling')[0].pos;
        cam([5.6, 1.5, 38.6], [h.x, h.y - 0.3, h.z], 55 - t * 2);
        return {};
      },
    },
    {
      name: 'snapweed',
      dur: 2.6,
      async setup() {
        await load('bestiary');
        const w = entities('Snapweed')[0].base;
        tw.teleport(w.x - 2.4, 0, w.z, -Math.PI / 2);
        tw.advance(0.2);
        this.w = w;
      },
      frame() {
        const w = this.w;
        cam([w.x - 3, 1.6, w.z - 3.6], [w.x - 0.8, 1.1, w.z], 50);
        return {};
      },
    },
    {
      name: 'sootling',
      dur: 2.8,
      async setup() {
        await load('bestiary');
        const s = entities('Sootling')[0].pos;
        tw.teleport(s.x + 8.5, 0, s.z + 1, Math.PI / 2);
        tw.input(null);
        tw.advance(1.2);
        this.s = s;
      },
      frame(t) {
        const s = this.s;
        cam([s.x + 9.2, 2.4, s.z - 2.8], [s.x + 3.2, 1.8, s.z + 0.5], 48 - t);
        return {};
      },
    },
    {
      name: 'examiner',
      dur: 7.5,
      music: 'exams',
      async setup() {
        await load('bestiary');
        hidePlayer = false;
        tw.teleport(-1, 0, 77, 0);
        tw.advance(0.2);
        world().held.clear();
        tw.advance(0.2);
        // Walk up to it, so it winds up a slam, then back off out of the shockwave.
        tw.teleport(-1, 0, 82, 0);
        tw.advance(0.6);
        at(1.4, () => tw.input({ x: 0, y: -1 }));
        at(2.4, () => tw.input({ x: 0.6, y: -0.2 }));
        at(4.2, () => tw.input({ x: -0.5, y: 0.3 }));
      },
      frame(t, d) {
        const b = entities('Examiner')[0].pos;
        const k = smooth(t / d);
        cam(mix([-7, 2.2, 76.5], [6, 3, 77.5], k), [b.x * 0.7, 2.8, b.z * 0.7 + 79 * 0.3], 58);
        return { cap: 'Face the Final Examinations', capA: fade(t, 0.8, 1.4, d - 1.1, d - 0.4) };
      },
    },
    {
      name: 'grounds',
      dur: 5,
      music: 'title',
      async setup() {
        tw.input(null);
        await load('grounds');
        hidePlayer = true;
        tw.teleport(22, -3, -60, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([40, 5, -84], [30, 9, -50], k), mix([22, -2, -75], [0, 4, -8], k), 55);
        return { cap: 'Collect cards, find secrets, win the House Cup', capA: fade(t, 0.6, 1.2, d - 0.8, d - 0.1) };
      },
    },
    {
      name: 'end',
      dur: 6,
      async setup() {
        await load('hub');
        hidePlayer = true;
        tw.teleport(0, 0, 46, 0);
      },
      frame(t, d) {
        cam([0, 4 + t * 0.25, 38 + t * 0.6], [0, 9, 70], 55);
        return {
          logo: fade(t, 0.4, 1.4, d + 3, d + 4),
          tag: 'A whimsical wizard-school adventure. Free, in your browser.',
          url: 'thistlewick.sebastian-murgul.com',
          shade: 0.45 + 0.55 * ramp(t, d - 0.8, d),
        };
      },
    },
  ];

  /**
   * Cuts: which shots, how long each runs, and (where it differs) the music cue on it. A shot's
   * camera moves, captions and fades scale to the length it's given.
   */
  const CUTS = {
    full: shots.map((s) => ({ name: s.name })),
    // About 30 s: the title, five spells, a Hexling, the Examiner, the end card.
    short: [
      { name: 'title', dur: 4 },
      { name: 'spells-card', dur: 1.6 },
      { name: 'thwackwort', dur: 2.3 },
      { name: 'glimmerwick', dur: 2.6 },
      { name: 'cindersnap', dur: 2.6 },
      { name: 'springwell', dur: 2.9 },
      { name: 'rimewhistle', dur: 2.5 },
      { name: 'hexling', dur: 2.3 },
      { name: 'examiner', dur: 4.6, music: null },
      { name: 'end', dur: 4.5, music: 'title' },
    ],
  };
  let cut = CUTS.full.map((c) => ({ ...shots.find((s) => s.name === c.name), ...c }));

  let current = null;
  window.trailer = {
    FPS,
    useCut(name) {
      cut = CUTS[name].map((c) => ({ ...shots.find((s) => s.name === c.name), ...c }));
    },
    timeline() {
      let t = 0;
      return cut.map((s) => {
        const start = t;
        t += s.dur;
        return { name: s.name, start, dur: s.dur, music: s.music ?? null };
      });
    },
    async begin(i) {
      actions = [];
      look = null;
      // Nothing held over from the last shot (a stick still pushed walked people off their marks).
      tw.input(null);
      g.input.setCast(false);
      current = cut[i];
      g.renderer.setQuality('high');
      await current.setup.call(current);
      return { name: current.name, frames: Math.round(current.dur * FPS) };
    },
    step(i, f, render = true) {
      const s = cut[i];
      const t = f / FPS;
      for (const a of actions) {
        if (!a.done && t >= a.time) {
          a.done = true;
          a.fn();
        }
      }
      tw.advance(1 / FPS);
      const c = s.frame.call(s, t, s.dur) ?? {};
      if (!render) return;
      captions(c);
      draw();
    },
  };
})();
