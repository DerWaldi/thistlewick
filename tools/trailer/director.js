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
    #hud, #crosshair, #charge-ring, #area-banner, #interact-prompt, #toasts, #hurt-flash,
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
    #dialogue.show { bottom: 96px !important; transform: translate(-50%, 0) scale(1.6) !important; transform-origin: 50% 100%; }
    #trailer .narr { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; opacity: 0;
      font-size: 62px; font-style: italic; color: #fbe8c0; text-shadow: 0 3px 0 #2b1d14, 0 0 30px rgba(0, 0, 0, 0.9); }
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
    <div class="narr"></div><div class="cap"></div><div class="spell"><b></b><span></span></div><div class="shade"></div><div class="bars"></div>`;
  document.body.appendChild(ui);
  const el = (s) => ui.querySelector(s);
  const ramp = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  /** 0→1 over [in0, in1], holds, 1→0 over [out0, out1]. */
  const fade = (t, in0, in1, out0, out1) => Math.min(ramp(t, in0, in1), 1 - ramp(t, out0, out1));
  const smooth = (x) => x * x * (3 - 2 * x);
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

  function captions({ logo = 0, tag = '', url = '', cap = '', capA = 0, narr = '', narrA = 0, spell = null, spellA = 0, shade = 0 }) {
    el('.narr').textContent = narr;
    el('.narr').style.opacity = narrA;
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

  /** Someone speaks, in the game's own dialogue box (closed again when the next shot begins). */
  function talk(when, speaker, text) {
    at(when, () => {
      g.dialogue.autoAdvance = false;
      void g.dialogue.run([{ speaker, text }]);
    });
  }
  function hush() {
    for (let i = 0; i < 6 && g.dialogue.isOpen; i++) g.dialogue.press();
    g.dialogue.autoAdvance = true;
  }

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

  // Positions: Wendlebury stands at (3, 0, 7) facing (-0.92, -0.39); you stop 1.6 m in front.
  const W = { x: 3, z: 7, fx: -0.92, fz: -0.39 };
  const WP = [W.x + W.fx * 1.6, 0, W.z + W.fz * 1.6];

  const shots = [
    // ================================================================ I. Arrival
    {
      name: 'dawn',
      dur: 8,
      music: 'title',
      async setup() {
        g.state.house = 'bramblecote';
        await load('grounds');
        tw.teleport(0, 0, -6, Math.PI);
        hidePlayer = true;
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-22, 3.5, -82], [-6, 5, -40], k), mix([0, 7, 2], [0, 8, 0], k), 50);
        return {
          narr: t < d * 0.5 ? 'You are a young wizard at Thistlewick...' : '...a school of magic in the most crooked castle you have ever seen.',
          narrA: t < d * 0.5 ? fade(t, d * 0.12, d * 0.22, d * 0.4, d * 0.48) : fade(t, d * 0.52, d * 0.62, d - 1, d - 0.3),
          shade: 1 - ramp(t, 0, d * 0.15),
        };
      },
    },
    {
      name: 'arrive',
      dur: 5,
      async setup() {
        await load('hub', 'fromGrounds');
        hidePlayer = false;
        tw.teleport(0, 0, 1.4, 0);
        tw.setCamera(0, -0.05);
        tw.input({ y: 0.6 });
      },
      frame(t, d) {
        const p = session().player.feet;
        const k = smooth(t / d);
        cam([p.x - 0.8 + k * 1.6, 1.2 + k * 1.6, Math.max(0.6, p.z - 2.2)], [0, 2.4 + k * 1.2, p.z + 10], 58);
        return {};
      },
    },
    {
      name: 'welcome',
      dur: 5,
      async setup() {
        await load('hub');
        tw.input(null);
        tw.teleport(...WP, Math.atan2(-W.fx, -W.fz));
        talk(0.4, 'wendlebury', 'Ah! There you are. Welcome to Thistlewick, dear. Mind the third step, it bites.');
      },
      frame(t, d) {
        const k = smooth(t / d);
        const back = 1.7 - k * 0.4;
        cam([WP[0] + W.fx * back - W.fz * 0.75, 1.75, WP[2] + W.fz * back + W.fx * 0.75], [W.x, 1.75, W.z], 46);
        return {};
      },
    },
    {
      name: 'sorting',
      dur: 5,
      async setup() {
        await load('hub');
        tw.teleport(-4.9, 0, 9, -Math.PI / 2);
        talk(0.5, 'lantern', 'I see... bold and stubborn... yes. Yes! You belong in... BRAMBLECOTE!');
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-4.2, 1.1, 11.8], [-4.8, 1.3, 11.2], k), [-6.4, 1.5, 9.2], 48);
        return {};
      },
    },
    // ================================================================ II. Lessons
    {
      name: 'gallery',
      dur: 3,
      async setup() {
        hush();
        await load('hub');
        hidePlayer = true;
        tw.teleport(38.5, 3, 30, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([38.5, 5, 25.5], [38.5, 5.4, 29], k), [38.5, 4.6, 52], 55);
        return { narr: 'Attend lessons. Learn spells.', narrA: fade(t, 0.3, 0.8, d - 0.7, d - 0.15), shade: 0.25 };
      },
    },
    {
      name: 'gorse',
      dur: 4,
      async setup() {
        await load('classroom');
        hidePlayer = false;
        tw.teleport(0, 0, 9.8, 0);
        talk(0.3, 'gorse', 'Three targets, three good thwacks! Aim, and flick. Hold it if you like a bit of oomph.');
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([2.2, 2.4, 8.4], [1.7, 2.5, 9], k), [0, 1.8, 11.6], 46);
        return {};
      },
    },
    {
      name: 'quince',
      dur: 3.6,
      async setup() {
        hush();
        await load('quince');
        tw.teleport(0, 0, 10.4, 0);
        talk(0.3, 'quince', 'A locked door is only a question. Latchkin is a very polite answer.');
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-2.6, 1.5, 8.8], [-2.1, 1.7, 9.4], k), [0, 1.9, 12.2], 46);
        return {};
      },
    },
    {
      name: 'lamplough',
      dur: 3.6,
      async setup() {
        hush();
        await load('lamplough');
        tw.teleport(-1.5, 0, 12.4, 0);
        talk(0.3, 'lamplough', 'Lamps go out, my dear. Plan ahead, and never stand on glimmerstone when the light is flickering.');
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([0.9, 1.5, 11], [0.5, 1.7, 11.6], k), [-1.5, 1.9, 14.2], 46);
        return {};
      },
    },
    // ================================================================ III. The trials
    {
      name: 'thwackwort',
      dur: 4,
      music: 'dungeon',
      async setup() {
        hush();
        await load('trial');
        // The old garden: the Rattlecoat guarding the gate, and a charged Thwackwort.
        tw.teleport(0, 0, 63.6, 0);
        tw.advance(0.3);
        scheduleCast(0.6, [0, 1.2, 68], 1.1);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-5.5, 1.6, 62.5], [-5, 1.9, 63.5], k), [0, 1.2, 66.5], 50);
        return { narr: '...and defeat the monsters of the dungeons.', narrA: fade(t, 0.2, 0.7, d - 0.8, d - 0.2) };
      },
    },
    {
      name: 'latchkin',
      dur: 3.2,
      async setup() {
        await load('vault');
        tw.teleport(0, 0, 51.5, 0);
        tw.advance(0.3);
        scheduleCast(0.7, [-3.2, 1.8, 53.9]);
      },
      frame(t, d) {
        cam(mix([0.2, 2.1, 52.0], [-0.4, 2.0, 52.5], smooth(t / d)), [-3.2, 1.6, 54.0], 42);
        return spellCap('latchkin', t, d);
      },
    },
    {
      name: 'glimmerwick',
      dur: 3.6,
      async setup() {
        await load('catacombs');
        tw.teleport(0, 0, 10.4, 0);
        tw.advance(0.3);
        scheduleCast(0.5, [2.6, 2.1, 10.2], 0.9);
      },
      frame(t, d) {
        cam(mix([-3.2, 2.6, 8.2], [-2.6, 2.4, 9.6], smooth(t / d)), [0.4, 0.2, 15], 55);
        return { narr: 'Solve puzzles...', narrA: fade(t, 0.2, 0.6, d - 0.7, d - 0.15), ...spellCap('glimmerwick', t, d) };
      },
    },
    {
      name: 'springwell',
      dur: 3.6,
      async setup() {
        await load('tower');
        tw.teleport(0, 17.5, 11.8, 0);
        tw.advance(0.3);
        scheduleCast(0.3, [0, 17.7, 15.2], 0.8);
        at(1.2, () => {
          tw.setCamera(0, -0.2);
          tw.input({ y: 1, jump: true });
        });
        at(1.9, () => tw.input({ y: 0.4, jump: true }));
        at(2.9, () => tw.input(null));
      },
      frame(t, d) {
        const p = session().player.feet;
        cam([5.4, 19.2 + Math.min(p.y - 17.5, 5) * 0.5, 8.6], [0, p.y + 0.8, Math.max(14.5, p.z)], 62);
        return { narr: '...run and jump through perilous passages...', narrA: fade(t, 0.2, 0.6, d - 0.7, d - 0.15), ...spellCap('springwell', t, d) };
      },
    },
    {
      name: 'rimewhistle',
      dur: 3.4,
      async setup() {
        await load('coldharbour');
        tw.teleport(-2, 0, 8, 0);
        tw.advance(0.3);
        scheduleCast(0.4, [-6, -0.5, 8], 0.6);
        at(1.6, () => {
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
      dur: 3.6,
      async setup() {
        await load('underbough');
        tw.teleport(5.3, 1.2, 6, Math.PI / 2);
        tw.advance(0.4);
        scheduleCast(0.4, [4.85, 2.5, 5.55]);
      },
      frame(t, d) {
        const p = session().player.feet;
        cam(mix([1.2, 2.2, 1.8], [1.5, 3.4, 2.2], smooth(t / d)), [p.x, p.y + 0.6, p.z], 55);
        return spellCap('thistledown', t, d);
      },
    },
    {
      name: 'sootling',
      dur: 3.4,
      async setup() {
        await load('trial');
        // The Sootling's Leap: the bombardier on the far ledge, lobbing.
        tw.teleport(0, 0, 127, 0);
        tw.advance(0.4);
        const s = entities('Sootling')[0];
        if (s) s.reload = 0.2;
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([0.2, 3.1, 127.4], [0.9, 3.3, 128.6], k), [5.5, 2.6, 135.2], 50);
        return {};
      },
    },
    {
      name: 'hexling',
      dur: 3,
      async setup() {
        await load('vault');
        // The Counting House: a Hexling over the coin heaps (you're just behind the camera).
        hidePlayer = true;
        tw.teleport(0, 0, 129.5, 0);
        tw.advance(0.6);
        const h = entities('Hexling')[0];
        if (h) h.reload = 0.15;
      },
      frame(t) {
        const h = entities('Hexling')[0].pos;
        cam([-2.4, 1.4, 127.2], [h.x, h.y - 0.4, h.z], 52 - t * 1.5);
        return {};
      },
    },
    {
      name: 'crabs',
      dur: 3,
      async setup() {
        await load('catacombs');
        // The Ember Crypt: crabs lobbing fire across the dark.
        tw.teleport(0, 0, 83, 0);
        tw.advance(0.8);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-3.6, 1.5, 81], [-2.6, 1.8, 82.2], k), [0, 0.7, 88.4], 50);
        return {};
      },
    },
    // ================================================================ IV. The castle
    {
      name: 'court',
      dur: 4.4,
      music: 'title',
      async setup() {
        await load('hub');
        tw.teleport(-6, 0, 38, 0);
        tw.setCamera(0.5, -0.1);
        tw.input({ y: 1 });
        at(1.6, () => tw.pressJump());
        at(3.3, () => tw.pressJump());
      },
      frame(t, d) {
        const p = session().player.feet;
        const k = smooth(t / d);
        cam([p.x + 6 - k * 2, p.y + 4, p.z - 6 + k * 2], [p.x, p.y + 1, p.z + 2.5], 55);
        return { narr: 'Discover the mysteries of the castle.', narrA: fade(t, 0.5, 1.1, d - 1, d - 0.3) };
      },
    },
    {
      name: 'clocktower',
      dur: 4,
      async setup() {
        await load('hub');
        tw.input(null);
        hidePlayer = true;
        tw.teleport(0, 0, 50, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([2.5, 1.4, 44], [1, 3.2, 47.5], k), [0, 14 + k * 8, 64], 58);
        return {};
      },
    },
    {
      name: 'library',
      dur: 4,
      async setup() {
        await load('upper');
        hidePlayer = true;
        tw.teleport(-20, 0, 24, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-34.6, 6.9, 10.5], [-33.4, 7.5, 13.5], k), [-29, 3.4, 36], 60);
        return {};
      },
    },
    {
      name: 'leads',
      dur: 4,
      async setup() {
        await load('upper');
        tw.teleport(0, 7.2, 70, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-24, 11, 57], [-17, 13, 61], k), [4, 8.5, 77], 58);
        return {};
      },
    },
    {
      name: 'woods',
      dur: 4,
      async setup() {
        await load('woods');
        tw.teleport(0, 8, 50.6, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-10, 12, 47], [-8, 13.5, 51], k), [2, 9, 64], 56);
        return {};
      },
    },
    // ================================================================ V. The Examinations
    {
      name: 'exams',
      dur: 4,
      music: 'exams',
      async setup() {
        await load('exams');
        tw.teleport(0, 0, 4, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([0, 2.4, 1.5], [0, 3, 8], k), [0, 2.4, 40], 55);
        return { narr: 'Will you master the Final Examinations?', narrA: fade(t, 0.4, 1, d - 0.8, d - 0.2), shade: 0.2 };
      },
    },
    {
      name: 'examiner',
      dur: 7,
      async setup() {
        await load('exams');
        hidePlayer = false;
        tw.teleport(-1, 0, 199, 0);
        g.state.flags.add('exam-boss-woken');
        world().held.clear();
        tw.advance(0.4);
        at(1.5, () => tw.input({ x: 0, y: -1 }));
        at(2.5, () => tw.input({ x: 0.6, y: -0.2 }));
        at(4.3, () => tw.input({ x: -0.5, y: 0.3 }));
      },
      frame(t, d) {
        const b = entities('Examiner')[0].pos;
        const k = smooth(t / d);
        cam(mix([-7.5, 1.6, 193], [6.5, 2.4, 194], k), [b.x * 0.7, 3.2, b.z * 0.7 + 197 * 0.3], 58);
        return {};
      },
    },
    // ================================================================ VI. The Cup
    {
      name: 'cup',
      dur: 4.5,
      music: 'title',
      async setup() {
        await load('hub');
        tw.input(null);
        hidePlayer = true;
        Object.assign(g.state.housePoints, { bramblecote: 420, mallowmere: 380, nettleby: 350, yarrowdown: 395 });
        tw.teleport(-6, 0, 13, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-6.4, 1.2, 9.6], [-6.8, 2.2, 15.8], k), [-10, 1.6, 13], 50);
        return { narr: 'Will your house win the Cup?', narrA: fade(t, 0.5, 1.1, d - 0.9, d - 0.2) };
      },
    },
    {
      name: 'end',
      dur: 7,
      async setup() {
        await load('grounds');
        hidePlayer = true;
        tw.teleport(0, -3, -24, 0);
      },
      frame(t, d) {
        const k = smooth(t / d);
        cam(mix([-7, 2, -34], [-4, 4, -24], k), [0, 8, 2], 52);
        return {
          logo: fade(t, 0.5, 1.6, d + 3, d + 4),
          tag: 'The world of Thistlewick is waiting for you!',
          url: 'thistlewick.sebastian-murgul.com',
          shade: 0.4 + 0.6 * ramp(t, d - 0.9, d),
        };
      },
    },
  ];

  /**
   * Cuts: which shots, how long each runs, and (where it differs) the music cue on it. A shot's
   * camera moves, captions and fades scale to the length it's given.
   */
  /** Music cues for the full cut (by shot), where they differ from the shots' own. */
  const MUSIC = { thwackwort: null, court: null, glimmerwick: 'dungeon', end: 'title' };
  const CUTS = {
    full: [
      // You, the castle, the welcome, the sorting.
      'dawn', 'arrive', 'welcome', 'sorting',
      // Attend lessons, learn spells.
      'gallery', 'gorse', 'quince', 'lamplough', 'latchkin', 'rimewhistle', 'thistledown',
      // Discover the mysteries of the castle.
      'court', 'clocktower', 'library', 'leads', 'woods',
      // Puzzles, passages and monsters in the dungeons.
      'glimmerwick', 'springwell', 'thwackwort', 'sootling', 'hexling', 'crabs',
      // The exams, and the world waiting.
      'exams', 'examiner', 'end',
    ].map((name) => ({ name, ...(MUSIC[name] !== undefined ? { music: MUSIC[name] } : {}) })),
    // About 30 s: arrival and welcome, four spells, a foe, the castle, the Examiner, the title.
    short: [
      { name: 'dawn', dur: 5 },
      { name: 'welcome', dur: 3.2 },
      { name: 'gallery', dur: 2.2 },
      { name: 'rimewhistle', dur: 2.4 },
      { name: 'court', dur: 3 },
      { name: 'glimmerwick', dur: 2.4, music: 'dungeon' },
      { name: 'springwell', dur: 2.6 },
      { name: 'thwackwort', dur: 2.6, music: null },
      { name: 'exams', dur: 2.6 },
      { name: 'examiner', dur: 3.2, music: null },
      { name: 'end', dur: 4.6, music: 'title' },
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
      hush();
      // The player is in shot unless a shot hides them.
      hidePlayer = false;
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
