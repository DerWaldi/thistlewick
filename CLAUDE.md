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
                       timed/latch; plate; gate; checkpoint), gnarling, rattlecoat (needs charged hits),
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
                       characters (speakers), dialogues (scripts), portraits, tuning, levels/ (index.ts registry)
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

### Spells & targets
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
- Levels: `hub`, then `classroom` (Gorse's lesson), then `trial` (the Thwackwort Trial), then back. Plus the `gym` sandbox.

### Lessons (the core loop)
Each lesson is content, not engine work:
1. A classroom level with the teacher NPC, whose talk script teaches the spell (`state.learn`).
2. Practice targets (latched knock switches) and a `trigger` on their signals that sets a flag.
3. A door with `lockedUnless` that flag, leading to the trial level.
4. The trial level: rooms built around the spell, room `trigger`s with hint scripts, checkpoints, and a `star` whose script records `state.lessons` and awards points.
5. The teacher's script hands out a reward once the lesson is in `state.lessons`.
6. Hub content gated with `requires: '<spell>'` appears afterwards.
Progress lives in flags (`practice-done`, `down:<rattlecoat id>`, `trial-hint-*`...), so revisits are consistent.

### Progress & saving
- `GameState` is the single source of progress. Its helpers (`collectCard`, `findSecret`, `award`, `learn`...) emit events, and the HUD, sound and autosave react to those.
- Placed sweets get stable ids from build order (`<level>/<type><index>[.<n>]`) and are remembered in `collected`. **Inserting new sweet specs before existing ones changes their ids**, so append new ones in a level instead.
- Autosave runs on cards, secrets, checkpoints, learning a spell, level loads, and finished dialogue scripts; sweets and points are batched. Sandbox runs never save.
- To change the save shape, bump `VERSION` in `save.ts` and add a migration.

### Shop & upgrades
- Stock lives in `src/data/shop.ts`. Effects come from `UPGRADE_EFFECTS` and are read through `GameState` getters (`chargeTimeScale`, `magnetScale`, `maxStamina`).
- Scripts can `openShop()`; the Tansy and Moss scripts do so once Thwackwort is learned.
- The world halts while the dialogue, shop, album or pause menu is open (`game.isHalted`).

### Menus, options, music
- `main.ts` drives the menus. The title is shown over a drifting hub backdrop (`game.showBackdrop()`, `titleMode`). Losing pointer lock mid-game opens the pause menu.
- Options: sensitivity, invert Y, music and effects volume, graphics (Fancy/Fast) and FPS display. They're stored under `thistlewick.options`, and `game.applyOptions()` applies them.
- Fancy graphics adds bloom and grading, a pixel ratio up to 1.5 and a 4096 shadow map. If frames stay under about 42 fps for 4 s, the game drops to Fast once and shows a toast.
- Music: `engine/music.ts` sequences two original pieces live: the Thistlewick Waltz (hub, title) and the Tumbling Vaults (trial). `LevelDef.music` picks the mood. Moods cross-fade, and the music ducks during dialogue. A file at `public/music/<mood>.mp3` replaces the synthesised version, and should be logged in ASSETS.md.
- A `Song` is a list of `Section`s: bars of melody/bass/chords plus an `Arrangement` (lead instrument and octave shift, harp chords or arpeggio, bass style, counter-melody, chimes, ornaments, dynamics). The same bars come back re-orchestrated, so the loop takes about 1.5 minutes before it repeats. Bars get small random dynamics and grace notes.
- P saves a screenshot (`game.screenshot()`), stamped with level, area, position, facing and mode, for bug reports.

### Atmosphere props (`world/props.ts`)
- `lightShaft(from, dir, length, width)`: window light beams.
- `dustMotes(min, max, count)`: drifting dust.
- `grass(x0, x1, z0, z1, y, density)`: instanced swaying tufts.
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

Spell roster (data comes in M1+):
- Thwackwort (knockback)
- Latchkin (unlock)
- Glimmerwick (light)
- Cindersnap (fire)
- Springwell (bounce)
- Rimewhistle (ice)
- Thistledown (levitation)
