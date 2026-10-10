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
- `?test`: the simulation only advances through `__tw.advance(seconds)`, which makes tests deterministic. The click-to-play overlay is hidden.

`window.__tw` (src/main.ts) provides:
- `state()`: mode, feet, vel, camera, `cameraInsideSolid`, stamina, sweets, current target, charging, checkpoint
- `input({x, y, jump})`: camera-relative virtual stick; pass `null` to release
- `pressJump()`, `teleport(x, y, z, facing?)`, `setCamera(yaw, pitch?)`, `advance(s)`
- `aimAt(x, y, z)`: point the crosshair at a world position; `cast(holdSeconds)`: click or hold-and-release
- `learn(spell)`, `signal(id)`
- `game`: the Game instance, for poking around

## Architecture

```
src/main.ts            boot: Rapier init, Game, pointer lock, tuning panel, test API
src/game.ts            wires systems together; fixedUpdate / frameUpdate order lives here
src/engine/            loop (fixed 60 Hz + interpolated render), input, physics (Rapier wrapper +
                       ColliderInfo metadata), render (renderer, sky, sun), events (typed bus), sfx, debug
src/player/            controller (kinematic character), camera (orbit + spring arm + shoulder offset), model
                       (procedural student), animator (procedural animation incl. cast pose), effects (blob
                       shadow, puffs), health (stamina, damage, faint → checkpoint)
src/spells/            caster (soft-lock targeting, tap/charge, bolts), targets (SpellTarget interface +
                       registry), runes (procedural rune glyphs + floating markers)
src/entities/          level objects: pushBlock, mechanisms (knockSwitch, plate, gate, checkpoint), gnarling,
                       teasers (targets for spells not yet learned), sweets (instanced SweetField);
                       types.ts holds the EntitySpec union and WorldContext
src/world/             builder (level DSL: geometry + entity specs), world (spawns specs via a factory map,
                       steps entities), signals (named on/off wires), materials, merge (draw-call merging)
src/state/             GameState: stamina, sweets, known spells, checkpoint (persisted from M2)
src/data/              all content and tuning: spells.ts, sweets.ts, tuning.ts, levels/*.ts
src/ui/                hud.ts (stamina, sweets, target hint, charge ring, toasts) + style.css
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
- **Draw calls:** props built from primitives should call `mergeChildren(group, animatedParts)`.
- **Events:** communicate through the typed `EventBus`. Add new events to `GameEvents` in `src/engine/events.ts`. SFX, particles and animation subscribe to events and never poll.
- **Tuning:** all game-feel numbers live in `src/data/tuning.ts`. Edit them live in the panel (`` ` `` key); edits persist in localStorage (`thistlewick.tuning`). Use "Copy tuning JSON" to promote values to defaults.
- **Data-driven content:** levels are TS modules in `src/data/levels/` that call the `LevelBuilder` DSL (`box`, `ramp`, `stairs`, `cylinder`, `pool`, `mover`, `bouncePad`, `lantern`, `label`, `prop`) and finish with `b.finish()`, which merges static geometry into one draw call.
- **Visual style:** flat-shaded vertex colours with a warm palette (`COLORS` in `world/materials.ts`). Build from primitives. External assets must be CC0 and recorded in `ASSETS.md`.
- **Comments:** explain *why*, not what.

## Milestones

| Milestone | Status | Contents |
|---|---|---|
| M0 Feel gym | done | Controller, camera, procedural student, gym, tuning panel, e2e harness |
| M1 Casting core | done | Spell targeting/aim assist/charge, Thwackwort, push blocks, switches, doors, health, checkpoints, sweets, HUD, Gnarling, SFX |
| M2 Hub | next | Level pipeline, Lantern Hall / Crooked Corridor / Hollyhock Court / Cupboard, secrets, cards & album, save, house sorting & points |
| M3 Lesson | | Gorse's lesson, the Thwackwort Trial dungeon (~5 min), Thistle Star, a post-lesson hub secret |
| M4 Slice complete | | Shop and upgrades, all 10 cards, 3 secrets, title/pause screens, CC0 music, polish, perf |

Spell roster (data comes in M1+):
- Thwackwort (knockback)
- Latchkin (unlock)
- Glimmerwick (light)
- Cindersnap (fire)
- Springwell (bounce)
- Rimewhistle (ice)
- Thistledown (levitation)
