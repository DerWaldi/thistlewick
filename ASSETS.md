# Third-party assets

Everything in the game is built from code unless listed here: primitives, procedural geometry, canvas-painted portraits, synthesised sound effects, and procedurally sequenced music ("The Thistlewick Waltz" and "The Tumbling Vaults" in `src/engine/music.ts`). Only CC0 assets, or assets made for this project, are allowed.

To use a recorded track instead of the synthesised music, place it at `src/assets/music/<mood>.mp3` (`hub`, `dungeon`, `title`, `woods` or `exams`) and add a row below.

| Asset | Used for | Source | Licence |
|---|---|---|---|
| `public/models/*.glb` (Rattlecoat, Snapweed, Ember Crab, Sootling, Hexling, Brass Examiner) | Foe models | Made for Thistlewick with Claude from the project's own concept art (exported from three.js) | Original to this project |
