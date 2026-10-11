# Thistlewick: First Year

A browser 3D action-adventure in the spirit of early-2000s wizard-school PC games: third-person platforming in a crooked castle, with spells as puzzle tools. Game feel and the joy of exploring come before graphical fidelity. All names, characters and assets are original; do not borrow from existing franchises.

The design doc and milestone plan live in the first session's plan file; their substance is summarised under Milestones below.

## Commands

```bash
npm run dev          # Vite dev server on :5173 (debug HUD + tuning panel enabled)
npm run build        # typecheck + production build to dist/
npm run preview      # serve dist/
npm run check        # tsc --noEmit + eslint, must be clean before committing
npm run test:e2e     # Playwright on Chromium, Firefox and WebKit (starts its own Vite on :5199)
npx playwright test --project=chromium   # quicker single-browser run
```

Screenshots from e2e runs go to `tests/e2e/__shots__/` (gitignored). Look at them after each milestone.

## URL flags

- `?debug`: FPS/state readout and `window.__tw` in production builds. Both are always on in dev.
- `?test`: the simulation only advances through `__tw.advance(seconds)`, which makes tests deterministic. There's no title screen, and dialogues auto-advance (choices come from `__tw.choose(...)`, otherwise 0). It continues the saved game if there is one, otherwise starts a new one.
- `?test&new`: clears the save and starts a fresh game in the hub.
- `?level=<id>`: sandbox mode in that level (e.g. `gym`). Fresh state, the level's `grants`, and nothing is saved. The M0/M1 specs boot with `?test&level=gym`.

`window.__tw` (src/main.ts) provides:
- `state()`: mode, feet, vel, camera, `cameraInsideSolid`, stamina, sweets, current target, charging, checkpoint
- `input({x, y, jump})`: camera-relative virtual stick; pass `null` to release
- `pressJump()`, `teleport(x, y, z, facing?)`, `setCamera(yaw, pitch?)`, `advance(s)`
- `aimAt(x, y, z)`: point the crosshair at a world position; `cast(holdSeconds)`: click or hold-and-release
- `learn(spell)`, `signal(id)`
- `interact()`: press E on the focused object; `choose(...indices)` queues dialogue choices; `idle()` resolves when the running dialogue script ends
- `newGame()`, `continueGame()`, `save()`, `loadLevel(id, spawn)`
- `state()` also reports level, area, house, points, cards, secrets, known spells, the interact prompt and whether a dialogue is open
- `game`: the Game instance, for poking around

## Architecture

```
src/main.ts            boot: title screen (Continue/New Game), pointer lock, tuning panel, test API
src/game.ts            long-lived shell: renderer, input, sfx, HUD, dialogue, album, GameState, autosave,
                       level loading with fades, dialogue scripts
src/session.ts         LevelSession: everything for one loaded level (physics world, builder, entities,
                       player, camera, caster, interactables, areas); dispose() tears it all down
src/engine/            loop (fixed 60 Hz + interpolated render), input, physics (Rapier wrapper +
                       ColliderInfo metadata), render (renderer, sky, sun), events (typed bus), sfx, debug
src/player/            controller (kinematic character), camera (orbit + spring arm + shoulder offset), model
                       (procedural student), animator (procedural animation incl. cast pose), effects (blob
                       shadow, puffs), health (stamina, damage, faint → checkpoint)
src/spells/            caster (soft-lock targeting, tap/charge, bolts), targets (SpellTarget interface +
                       registry), runes (procedural rune glyphs + floating markers)
src/entities/          level objects: pushBlock (resetOn), mechanisms (knockSwitch: plate/book/target/bell,
                       timed/latch/persist; plate; gate; checkpoint), gnarling, rattlecoat (needs charged hits; wakes when hit, when you enter its arena or when its room's
                       Gnarlings are gone, then braces and charges from 4–13 m; won't step off ledges; stays
                       beaten only with `persist`, so trial ones come back on a reload),
                       locks (padlock: relock/persist/orbit; chest/box/cabinet with card + sweets; drawbridge;
                       vaultDoor), snapcasket (Latchkin locks it, then Thwackwort; its `spell` changes),
                       springs (springPad: moss/mushroom/mattress/rune; springy for `duration` s after
                       Springwell, a charged cast launches higher, `fling` throws you sideways),
                       glimmer (wickLamp: Glimmerwick lights it for `duration` s, charged = 1.5x reach;
                       glimmerBlock: solid only inside a lit glow; illusionWall: fades in the glow),
                       fire (burnable: vines/briar/cobweb/hay/rope, burns away on Cindersnap, briars hurt,
                       `persist` in the castle, `fireproofUntil` signals; brazier: lit by Cindersnap, `group`
                       + `order` must be lit in turn, a wrong one or a timeout puts the group out and sets
                       `<group>:fail`; dropper: a crate on a rope that falls to `floorY` on its signals;
                       burnable 'ice' is a block Cindersnap melts),
                       ice (iceSheet: a water patch Rimewhistle freezes for `duration` s, or
                       `chargedDuration` when charged; slippery, temporary, see-through, and not a
                       target while frozen; waterfall: freezes into a climbable pillar at its foot;
                       floe: an ice raft Thwackwort slides until it bumps something, rideable, `resetOn`),
                       air (skyLift: a platform/basket/crate Thistledown floats between `from` and `to`
                       by casting at its feather-stone post; carries riders, `startAt`, `returnAfter`;
                       pendulum: a swinging bob that knocks you back),
                       creatures (snapweed: rooted, rears back then bites everything in `radius`, the
                       player and Gnarlings (anything in `ctx.creatures`); Cindersnap burns it.
                       emberCrab: patrols, lobs fireballs when it can see you; Thwackwort flips it
                       for a moment, Rimewhistle freezes it into a standable ice block, Thwackwort
                       then shatters it; its target spell switches with state and what you know),
                       foes (hexling: a flying bad fairy circling her patch, hex orbs that drift after
                       you, a Thwackwort knocks her down, a second banishes; sootling: lobs fuse bombs
                       that land, fizz and blow up, kick a bomb back with Thwackwort and it lands on
                       him, thwack him twice to banish), boss (examiner: the Brass Examiner, six seals
                       broken by six spells while its fists are stuck after a slam you must jump),
                       wanderer (pupils walking a loop, chatting), quests (questItem + ! / ? markers),
                       teasers (targets for spells not yet learned), hubObjects (cards, secrets, tapestry,
                       bookshelf, npc, sorting lantern, doors, hourglasses, spring pad), lessonObjects
                       (trigger, Thistle Star), sweets (instanced SweetField); types.ts holds the
                       EntitySpec union and WorldContext
src/world/             builder (level DSL: geometry + entity specs), world (spawns specs via a factory map,
                       steps entities), signals (named on/off wires), level (LevelDef), props (walls with
                       holes, slabs, windows, shelves, portraits, banners, chandeliers, plants), materials,
                       merge (draw-call merging)
src/state/             GameState (stamina, sweets, spells, house + points, cards, secrets, collected ids,
                       flags, upgrades + purchases, checkpoint); save.ts (versioned localStorage save with
                       migrations); options.ts (player settings, stored separately)
src/data/              all content: spells, sweets, houses (+ sorting questions, point values), cards,
                       characters (speakers), dialogues (scripts), portraits, tuning, levels/ (index.ts registry),
                       objectives (the next goal + compass waypoints), quests (errands), students (wanderers),
                       atlas (where every placed card and secret is, for Snoop's Map)
src/ui/                hud, dialogue (typewriter + keyboard choices), album, shop (Crumbleton's Cupboard),
                       menu (title/pause/options/credits), portraits (procedural painter), cardArt, style.css
tests/e2e/             Playwright specs; helpers.ts has boot() and shot()
```

### Frame order

Each fixed step runs in this order:
1. `level.fixedUpdate`, then `world.fixedUpdate`: movers and push blocks compute their delta. Descending ones move now.
2. `player.update`, then `health.update`
3. `level.applyMovers`, then `world.lateFixedUpdate`: ascending and horizontal movers and blocks move now.
4. `physics.step`

Each render frame then runs the camera, animator, level and entity visuals, caster (targeting needs the fresh camera), particles, shadow, HUD and draw, all interpolated with `alpha`.

### Bouncing
- Bounce height = `jump.bounceHeight` (6.5 m) × the pad's scale (1 + 0.6 × charge for Springwell) × `bounceBoostScale` if jump is held on landing. Pressing jump within 0.25 s after a plain bounce also boosts it (walking onto a pad you can't already be holding jump). Teach charging out loud: players don't discover it on their own. Air time to a ledge ~1 m below the apex is about 0.85 s; plan horizontal gaps of 2.5–4.5 m for straight bounces.
- A `fling` sets your sideways velocity outright; until you land, air control steers around it (55%) instead of braking it. Tune flings by playing them (`__tw` + `pressJump`/`input`), not on paper.
- Pads that stand proud of the floor must be low enough to step on (≤ 0.36 m) or players have to jump onto them; prefer `rune` tiles where you walk on.

### Spells & targets
- Line of sight is the Latchkin puzzle: a padlock must be visible from the player's chest. Colliders with `seeThrough` (grilles, bars) block bodies but not spells. Mind the camera's pitch limit: targets high above the player can't be centred, so keep them low or let the player back off.
- Casting is context-sensitive. A `SpellTarget` names the one spell it reacts to, and the caster picks the best target in an aim cone around the crosshair (with line of sight).
- Clicking casts that target's spell. Holding the button charges it, if the spell is `chargeable`.
- If the player doesn't know the spell yet, the target shows a grey rune and casting says so.
- Spell *effects* live in the target's `onSpell`, not in the spell definition. A new spell therefore means: a `SPELLS` entry, a rune in `runes.ts`, and targets that respond to it.

### Levels
- A `LevelDef` (`src/world/level.ts`) has an id, a `build(b)` function, named `spawns` (must include `default`), named `areas` (boxes that share an id form one area), and optionally `grants`, `sandbox`, and an `intro` script.
- Register new levels in `src/data/levels/index.ts`.
- A `door` entity with `to: { level, spawn }` switches levels; the game fades out and in.
- Everything level-specific is created by `LevelSession` and torn down by its `dispose()`. Event listeners go on the session's scoped bus, so they're removed too.
- Every level file starts with a map comment. Keep it current.
- Levels: `hub`, then `classroom` (Gorse's lesson) and `trial` (the Thwackwort Trial); then the hub's Long Gallery leads to `quince` (Locks & Latches) and `vault` (the Latchkin Vaults), a padlocked door in Hollyhock Court's west cloister to `hopgood` (Leaps & Bounds) and `tower` (the Tumbledown Tower), and a spiral stair from the Lantern Hall (by the front doors) down to the Undercroft corridor, whose end door leads to `lamplough` (Illumination) and `catacombs` (the Lamplit Catacombs), and the Kitchen Yard (a new yard west of the castle, through the corner behind the court's west cloister) to `ashcombe` (Hearth & Flame) and `glasshouse` (the Overgrown Glasshouse). After Cindersnap the Lantern Hall's great doors open onto `grounds` (the Castle Grounds: terrace, lawn, lake with an island folly), where the boathouse leads to `coldharbour` (Frosts & Waters) and `cisterns` (the Flooded Cisterns). After Rimewhistle a door in the court's north wall opens on `clocktower` (the Clock Tower, seven flights round a shaft), at whose top is `underbough` (Airs & Graces, on the roof) and `clockworks` (the Great Clockworks). A door off the Lantern Hall gallery (east end) leads up to `upper` (the First Floor: the Long Hall, the Great Library with its mezzanine, stacks and Forbidden Section, the House Wing with the four common rooms, and the Leads, a rooftop parkour route). Once all seven lessons are done, an iron door beside the Long Hall's roof stair opens on `exams` (the Final Examinations): one long hall with a room set by each professor in lesson order, ending in the Thistle Hall, where the Golden Thistle (flag `year-complete`) awards the exam points, runs the House Cup ceremony and emits `yearComplete`, which shows the end-of-year summary above the credits. The exams can be replayed; the Thistle and placed sweets can't be farmed. Once Mabel asks for help (after Thistledown), the grounds' east gate opens on `woods` (the Old Woods), with a door home by the Old Oak. Plus the `gym` sandbox.
- Burning the vines over the court's east arch opens the Kitchen Orchard; Cindersnap thaws the frozen lock on the Well Yard gate (the alley east of the hall, kept for later quests). Rimewhistle freezes the court fountain, the lake path to the folly and the terrace spout up to the west tower balcony.
- Castle levels (`hub`, `grounds`, `clocktower`, `upper`, `exams`, `woods`) get every spell in sandbox runs.
- `LevelDef.npcSpots` names places kept free for NPCs: benches, firesides, window seats. Castle levels (`hub`, `grounds`, `upper`) have them; quests pick a spot by name.
- Errands (`src/data/quests.ts`): a fellow first-year waits at an npc spot once the quest's `after` lesson is done (`questGivers` appends their npc specs after the level's own, so ids stay stable), shows ! (on offer) or ? (found), and the lost thing is a `questItem` entity, only there while the errand is accepted. Progress is in flags `quest:<id>`, `quest:<id>:found`, `quest:<id>:done`; the script `quest-<id>` is generated from the data, and the pause menu lists open and finished errands. A new errand: a `QUESTS` entry, a speaker in `characters.ts`, and a `questItem` (plus whatever puzzle hides it) appended at the end of a level's build.
- The errands so far: Pip's kite (court walkway), Oswin's book (library bookcase tops, rune tile), Tilda's toad (the Old Wine Cellar under the hall, behind a false wall in the Undercroft corridor), Hattie's hat (the Well Yard dovecote climb), Ned's float (lake moorings, a charged freeze), Mabel's hedgehog (`woods`, the Old Woods through the grounds' east gate: thicket and Snapweeds, toadstools up to a ridge, a canopy with bridges, a swinging log and a called basket, a dark hollow log with a charged lamp, a frozen waterfall, the Old Oak with a padlocked root-gate, a charged bounce to a bough secret, a door home).
- Common-room doors are gates on `house-door-<house>`, which a `houseSeal` entity turns on only for the player's own house.
- Moving ground (movers, lifts, floes, ice) is `temporary`: never a respawn spot.
- Aiming: the camera pitches up at most ~0.55 rad, so a target high above must be cast at from further away (the shaft lift in the Clockworks is a puzzle built on that).
- Gnarlings won't come within 3.6 m of a lit brazier (`ctx.heat`, a `HeatField`), so standing by one keeps you safe.
- `signboard` text takes `\n` for a second line and widens the board for long lines.
- Introduce one new foe per room (the user asked for this): the Sootling debuts alone in the Thwackwort Trial's Leap, the Hexling alone in the Vaults' Counting House, each with a hint script that explains how to beat it; later trials may mix them.
- Spread classroom entrances round the castle (the user asked for this): each new teacher gets a new corner, not another door off the same corridor. Later teachers' doors use `afterLesson: '<previous spell>'`.
- `ambience: 'dark'` on a level or an area (the Undercroft area in the hub) drops to a dim cold fill and close black fog; lamps with `light: true` and torches do the lighting. Keep real point lights to ~8 (checkpoints and the Star have one each).

### Guidance
- `currentObjective(state)` (src/data/objectives.ts) is the story's next step: sort, then per lesson "<subject> with <teacher>", practice, the trial, report back; then the exams; then open errands. Each has `route`: waypoints per level (the first one not yet `passed` is the compass target); levels without one point at `WAY_OUT` (back towards the hall). The HUD shows it under the house chip with an arrow and distance (Options can hide it); the pause menu repeats it with directions. When a trial's Star or a classroom door moves, update ROUTES there.
- Wendlebury's opening explains the year (seven Stars, the exams, the House Cup) and the arrow; pupils (`students.ts`) drop progress-aware tips.

### Difficulty
- Every trial ends in a harder room built around the new foes before its Star: the Sootling's Leap (trial), the Counting House (vault), the Weathercock Run (tower), the Moth Ossuary (catacombs), the Hothouse Pool (glasshouse), the Sluice Canal (cisterns), the Mainspring (clockworks). The old Star chambers are passages now; Stars and exit doors were moved by replacing their specs in place (ids stay put) and the new rooms are appended last. `tests/e2e/m18-hard.spec.ts` plays each one.
- The exams have a foe in every room and the Brass Examiner in the Thistle Hall; the Golden Thistle is caged (four gates on `exam-boss`) until it falls (flag `down:exam-boss`).
- Gnarlings are quicker than they were (gnarling.ts constants). Frozen Ember Crabs are rough ice (not slippery): they're stepping stones, and crabs you need as stones have `reform` (a shattered one crawls back after that many seconds).
- First-time foe loot lands on the ground under the foe (or at your feet), never in a chasm. The Examiner keeps `avoid` distance from the caged plinth.
- One-way traps: every lift you can be knocked off of either floats home (`returnAfter`) or can be called from where you respawn.
- Foes that throw things need line of sight; give rooms cover. Hexlings high up are hard to aim at (camera pitch), which is part of the fight.

### Lessons (the core loop)
Each lesson is content, not engine work:
1. A classroom level with the teacher NPC, whose talk script teaches the spell (`state.learn`).
2. Practice targets (latched knock switches) and a `trigger` on their signals that sets a flag.
3. A door with `lockedUnless` that flag, leading to the trial level.
4. The trial level: rooms built around the spell, room `trigger`s with hint scripts, checkpoints, and a `star` whose script records `state.lessons` and awards points.
5. The teacher's script hands out a reward once the lesson is in `state.lessons`.
6. Hub content gated with `requires: '<spell>'` appears afterwards.
Progress lives in flags (`practice-done`, `practice-latchkin`, `down:<rattlecoat/snapcasket id>`, `trial-hint-*`, `vault-hint-*`...), so revisits are consistent.
Each lesson's later payoffs sit in the hub: Thwackwort raises the Long Gallery portcullis (a `persist` knock switch, flag `on:<id>`); Latchkin opens the court chest, the hall cabinet and the gallery store-room (a `persist` padlock, flag `unlocked:<id>`; chests are remembered in `collected`).
Doors enforce the flow: the classroom exit has `lockedDuring: '<spell>'` (no leaving mid-lesson) and the trial door `closedAfter: '<spell>'` (each trial runs once; `?level=trial` sandboxes still work for debugging). Nothing in a level may be farmable: placed sweets are remembered, and respawning Gnarlings only drop sweets the first time (`looted:<id>` flags).

### Progress & saving
- `GameState` is the single source of progress. Its helpers (`collectCard`, `findSecret`, `award`, `learn`...) emit events, and the HUD, sound and autosave react to those.
- Placed sweets get stable ids from build order (`<level>/<type><index>[.<n>]`) and are remembered in `collected`. **Inserting new sweet specs before existing ones changes their ids**, so append new ones in a level instead.
- Autosave runs on cards, secrets, checkpoints, learning a spell, level loads, and finished dialogue scripts; sweets and points are batched. Sandbox runs never save.
- To change the save shape, bump `VERSION` in `save.ts` and add a migration.

### Shop & upgrades
- Snoop's Map (60 sweets) adds a Map button to the pause menu: every level and room with its cards and secrets found/total, from `src/data/atlas.ts`. The atlas is generated from the levels; `tests/e2e/m19-map.spec.ts` fails when it's stale (regenerate it from the same scan).
- Stock lives in `src/data/shop.ts`. Effects come from `UPGRADE_EFFECTS` and are read through `GameState` getters (`chargeTimeScale`, `magnetScale`, `maxStamina`).
- Scripts can `openShop()`; the Tansy and Moss scripts do so once Thwackwort is learned.
- The world halts while the dialogue, shop, album or pause menu is open (`game.isHalted`).

### Menus, options, music
- While the world is halted the player `hold()`s (no velocity, idle pose) and frames render at alpha 1, so nothing jitters between frozen steps.
- `main.ts` drives the menus. The title is shown over a drifting hub backdrop (`game.showBackdrop()`, `titleMode`). Losing pointer lock mid-game opens the pause menu.
- Options: sensitivity, invert Y, music and effects volume, graphics (Fancy/Fast), the next-goal guide, FPS display, and rebindable keys (`options.keys`, read by `Input.bindings`; arrow keys always move). Bindings in force live in `liveKeys` (options.ts), which the dialogue, the shop and the HUD prompt read; rebinding swaps with an action that already has the key and refuses `RESERVED_KEYS`; leaving the screen cancels a pending rebind. A gamepad works too (`Input.pollGamepad`, once a frame; B closes the shop and album): left stick moves, right stick looks, A jumps / advances dialogue, X or RT casts (hold to charge), Y or B talks, Back opens the album, Start pauses. They're stored under `thistlewick.options`, and `game.applyOptions()` applies them.
- Fancy graphics adds bloom and grading, a pixel ratio up to 1.5 and a 4096 shadow map. If frames stay under about 42 fps for 4 s, the game drops to Fast once and shows a toast.
- Music: `engine/music.ts` sequences four original pieces live: the Thistlewick Waltz (hub, title), the Tumbling Vaults (trials), Mother Hazelrigg's Jig (`woods`) and The Examination (`exams`). `LevelDef.music` picks the mood. Moods cross-fade, and the music ducks during dialogue. A file at `public/music/<mood>.mp3` replaces the synthesised version, and should be logged in ASSETS.md.
- A `Song` is a list of `Section`s: bars of melody/bass/chords plus an `Arrangement` (lead instrument and octave shift, harp chords or arpeggio, bass style, counter-melody, chimes, ornaments, dynamics). The same bars come back re-orchestrated, so the loop takes about 1.5 minutes before it repeats. Bars get small random dynamics and grace notes.
- P saves a screenshot (with the dialogue box redrawn onto it) (`game.screenshot()`), stamped with level, area, position, facing and mode, for bug reports.

### Atmosphere props (`world/props.ts`)
- `lightShaft(from, dir, length, width)`: window light beams.
- `dustMotes(min, max, count)`: drifting dust.
- `grass(x0, x1, z0, z1, y, density)`: instanced swaying tufts.
- `b.mist(minX, maxX, minZ, maxZ, top)` (builder): glowing magical mist in a bottomless pit (layered noise, haze up the walls, rising sparkles). Sinking 2 m into it counts as a fall, so put it well below anything walkable. Every pit you can fall into should have one; no black holes.
- Water has animated glints and a lighter rim at grazing angles.
- The world material darkens vertical faces near y=0, as a cheap contact shadow.
- Set dressing (all merged into the level mesh, except cobwebs, which share one batched mesh per level): `rug`, `bench`, `table` (with candles into a `Glow`), `candlestick`, `pottedPlant`, `urn`, `bookStack`, `cauldron`, `armour`, `barrel`, `cobweb(corner, d1, d2)`, `rubble`, `wallTorch`, `ivy`, `mushrooms`, `bush`. Furniture gets invisible box colliders. Remember walls are 1 m thick centred on `at`, so faces sit at `at ± 0.5`.
- `wall(..., { cap })` adds an invisible, ungrabbable, camera-ignored extension on top of a boundary wall, so nobody hops onto it and out of the level. Use it on any outer wall whose top can be reached from a ledge, ruin or walkway.
- `portrait()` paints a `PortraitSpec` (oil-painting style: curtain, brushwork, varnish; optional `hairStyle`, `collar`, `expression`, `jewel`, `eyes`) into an ornate gilt frame with rosettes and a plaque.

### Dialogue
- Conversations are async scripts in `src/data/dialogues.ts`. They `say(lines)` (with optional `choices`) and may change progress; the Sorting Lantern, for example, sets your house.
- NPCs, doors, the lantern and the hourglasses are `Interactable`s: E triggers them, and the HUD shows the nearest prompt.

### Adding a level object
1. Add a variant to `EntitySpec` in `src/entities/types.ts`.
2. Write the class (implement `Entity`, and `SpellTarget` if it can be cast at).
3. Add one line to `FACTORIES` in `src/world/world.ts`.

Levels place objects with `b.add({ type: ..., ... })`. Objects talk to each other through `Signals` by id; for example, a switch sets `'yard-a'` and a gate opens `when: ['yard-a']`.

### Dev conveniences
- `?level=<id>` sandboxes know every spell taught up to that level's lesson (`spellsBy` in `src/data/lessons.ts`); the hub gets them all.
- `?resetTrial=<spell>` undoes a finished trial in the save (Star, sweets, chests, pests, hints come back; cards, secrets and teacher rewards stay). The lesson table in `src/data/lessons.ts` says what each trial leaves in a save; add new trials there.
- Trials run once, so cards missed inside one turn up at the Cupboard's Lost & Found (`LOST_AND_FOUND` in `src/data/shop.ts`) once its lesson is done.
- Ground that can vanish (glimmerstone) is `ColliderInfo.temporary`: never remembered as a safe respawn spot, and a respawn spot must still have ground under it.
- Spiral stairs: walk on an invisible helical ramp under visual-only steps.

## Conventions

- **Units:** metres and seconds. +Y is up. Yaw follows `forward = (sin yaw, 0, cos yaw)`; models face +Z.
- **Player position:** the controller stores the *capsule centre* in `pos`. Use `feet` / `FOOT_OFFSET` when you need the ground point.
- **Gameplay metadata:** colliders carry it through `physics.setInfo(collider, ColliderInfo)`. That covers surface, bounce, mover, noGrab and cameraIgnore. Extend `ColliderInfo` rather than keeping parallel maps.
- **Moving platforms:** these are *bodiless colliders* moved by hand. The player adds `mover.delta` itself and matches its vertical motion exactly; pressing down into the platform makes Rapier drop the horizontal part. Don't use kinematic rigid bodies for them: Rapier's character controller applies their velocity inconsistently. Push blocks use the same scheme.
- **Enemies:** they use sensor colliders, so the player's controller and the spell line-of-sight rays pass through them. Contact is handled by distance checks.
- **Draw calls:** props built from primitives should call `mergeChildren(group, animatedParts)`. Static decoration in levels goes into the merged level mesh via `b.geo(geometry, color, pattern)`. Lantern glass is batched automatically. Keep hub views under about 60 draws without shadows.
- **Surface patterns:** stone, planks, plaster and grid are drawn in the shader from world position (`materials.ts`), chosen per box with `pattern`. The builder's `defaultPattern` is 'stone' (the gym uses 'grid').
- **Lights:** keep point lights to about 8 per level, and never add or remove lights at runtime: that triggers shader recompiles, which hitch. Use `lantern(pos, 0, 0, false)` for unlit decorative lanterns.
- **Tests draw on demand:** in `?test` mode nothing renders unless asked. `shot()` calls `__tw.render()` first, so use it for screenshots.
- **Tests and triggers:** room triggers open dialogues, and dialogues freeze the player until the script ends. In tests, `await tw.idle()` after anything that might trigger one, or pre-set the trigger's flag.
- **Ledges must be flush:** the grab looks for a lip directly above a wall face, plus room to stand (at least about 0.9 m deep). Overhanging sills can't be grabbed.
- **Events:** communicate through the typed `EventBus`. Add new events to `GameEvents` in `src/engine/events.ts`. SFX, particles and animation subscribe to events and never poll.
- **Tuning:** all game-feel numbers live in `src/data/tuning.ts`. Edit them live in the panel (`` ` `` key); edits persist in localStorage (`thistlewick.tuning`). Use "Copy tuning JSON" to promote values to defaults.
- **Data-driven content:** levels are TS modules in `src/data/levels/` that call the `LevelBuilder` DSL (`box`, `ramp`, `stairs`, `cylinder`, `pool`, `mover`, `bouncePad`, `lantern`, `label`, `prop`) and finish with `b.finish()`, which merges static geometry into one draw call.
- **Visual style:** flat-shaded vertex colours with a warm palette (`COLORS` in `world/materials.ts`). Build from primitives. External assets must be CC0 and recorded in `ASSETS.md`.
- **Comments:** explain *why*, not what.

### Characters
`buildStudent(look)` (player/model.ts) builds every person: robe with gold-edged front, shirt and tie, belt and buckle, cuffs, crest, boots, a face with eyes, brows, ears, cheeks and a smile. `StudentLook` adds `skin`, `hair`, `hairStyle` (tufts/long/bun/wild/bald), `beard`, `glasses` and `hatStyle` (pointy/tall/cap/none). NPC `look` is a `StudentLook` plus `scale`.

## Milestones

| Milestone | Status | Contents |
|---|---|---|
| M0 Feel gym | done | Controller, camera, procedural student, gym, tuning panel, e2e harness |
| M1 Casting core | done | Spell targeting/aim assist/charge, Thwackwort, push blocks, switches, doors, health, checkpoints, sweets, HUD, Gnarling, SFX |
| M2 Hub | done | Level pipeline, Lantern Hall / Crooked Corridor / Hollyhock Court / Cupboard, secrets, cards & album, save, house sorting & points |
| M3 Lesson | done | Gorse's lesson, the Thwackwort Trial dungeon (~5 min), Thistle Star, a post-lesson hub secret |
| M4 Slice complete | done | Shop and upgrades, all 10 cards, 4 secrets, title/pause/options, music, visual pass, perf |
| Polish 1 | done | Sectioned music, wall caps against climbing out, P screenshots, painted portraits and gilt frames, detailed characters, set dressing in every room |
| M14 Errands & the Old Woods | done | A quest system (student givers with !/? markers, quest items, an errand log in the pause menu, rewards); six errands, each behind a new climb or spell puzzle: the court walkway, bookcase tops in the library, the Old Wine Cellar under the hall, the Well Yard dovecote, the lake moorings, and the Old Woods (a new level off the grounds); 3 new cards (37 total) |
| M15 Overnight polish | done | The next-goal guide with a compass and timetable; the Hexling and the Sootling; a hard last room in every trial; the Brass Examiner boss and a foe per exam room; richer procedural textures; pupils wandering the castle; two more errands (Wren's scarf, Otto's watch); Snoop's Map; rebindable keys and gamepad; music for the woods and the exams |
| M13 Final Exams | done | The Examination Hall off the First Floor: seven professors' rooms (block trough and Rattlecoat; three relocking padlocks at once; moss, fling and charged bounce; lamplit stones and a two-lamp false wall; Snapweeds, a rope drawbridge and four ordered braziers; crabs, a floe and a charged freeze; ferry, pendulum and a called basket), the Thistle Hall with the Golden Thistle, the House Cup and the ending screen |
| M12 The First Floor | done | A new storey up from the Lantern Hall gallery: the Long Hall, the Great Library (mezzanine by stair or book lift, glimmer stacks needing a charged lamp, the Forbidden Section behind a sliding bookshelf with a Snapweed and a chest), the House Wing (only your common room opens), the Leads (chimneys, ridge, a cistern to freeze or a tile to fling across, a crate lift and a bounce to the observatory lookout); 3 new cards (34); NPC spots in castle levels |
| M11 Enemies & longer trials | done | Snapweed and Ember Crab; a fifth/sixth room in five trials: the Clockwork Moat (moving platforms, Thwackwort Trial), the Strongroom (pendulums and relocking gates, Vaults), the Ember Crypt (glimmer stones under crab fire, Catacombs), the Snapweed Beds (Glasshouse), the Boiler Hall (frozen crabs as stepping stones, Cisterns) |
| M10 Thistledown | done | The Clock Tower (a new castle section off the court: seven flights round the clock's shaft, a floating-crate nook with a card); Underbough's rooftop (float a crate, ferry over the light-well, call a basket down); the Great Clockworks (pendulum gallery, a shaft of lifts incl. one you call from afar and a timed ferry under a pendulum, the Great Wheel, the Bell Chamber); 3 new cards (30 total); all seven spells taught |
| M9 Rimewhistle | done | The great doors open onto the Castle Grounds (a new outdoor level: terrace, lawn, lake, boathouse, island folly, balcony climb, hills); Coldharbour's boathouse (freeze the pool, climb frozen falls, charged ice for the dock); the Flooded Cisterns (ice patches over a canal, frozen-falls cliff, a floe-sliding ferry with a freeze-round step, a secret behind a waterfall, fire melts the ice wall and the frozen Star); the Well Yard thaws open; 3 new cards (27 total) |
| M8 Cindersnap | done | The Kitchen Yard (a new walled yard west of the castle, closing an edge you could fall off), Ashcombe's kitchen (cobweb, rope-and-crate, braziers in order), the Overgrown Glasshouse (briar maze with Gnarlings scared by fire, rope bridge and dropped crates, a timed four-brazier sequence round a planter, the Bramble Heart dried by braziers), the Kitchen Orchard behind the court's east arch, the Well Yard gated for later; 3 new cards (24 total); NPC prompts name the speaker |
| M7 Glimmerwick | done | Hopgood's door moved to the court; a spiral stair from the Lantern Hall down to the Undercroft (dark area ambience, a nook with a card); Lamplough's dark study; the Lamplit Catacombs (glimmer bridge with charged-only stones, false walls, four lamps at once); glimmer steps in the hall, a false wall in the Long Gallery; 4 new cards (21 total); Lost & Found; `?resetTrial`; sandbox spells |
| M6 Springwell | done | Hopgood's gym (padlocked off the Long Gallery), the Tumbledown Tower (toadstool stair, Bellfry with a timed gate and charged bounces, rooftop turret run to the spire), spring pads with fling, latching plates, the court balcony, 3 new cards (17 total) |
| M5 Latchkin | done | Long Gallery wing (portcullis, portraits, padlocked store-room), Madam Quince's class, the Latchkin Vaults (line-of-sight locks, Snapcaskets, relocking shutters, drawbridge, orbiting vault locks), castle payoffs, 4 new cards (14 total) |

Spell roster (data comes in M1+):
- Thwackwort (knockback)
- Latchkin (unlock)
- Glimmerwick (light)
- Cindersnap (fire)
- Springwell (bounce)
- Rimewhistle (ice)
- Thistledown (levitation)
