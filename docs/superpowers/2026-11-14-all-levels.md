# All 18 levels, route choices and sound

Brief, tasks and results (14 Nov 2026). Follows `2026-11-14-vertical-slice.md`.

## Intent

Nick: "create the rest of the levels. Use your imagination on adding fun things, choices of routes potentially, take inspiration from marble runs." Then: sound effects for speed pads, pickups, 3-2-1-go and blending, plus a music track (`Untitled.mp3`).

Decisions (mine, Nick away):

- Levels 2 to 18 are assembled from a library of course pieces by a seeded generator, so each is the same every time but none is hand-placed. Level 1 stays hand-built.
- Forks are real: the road splits into a second track that rejoins. One side is quick or risky, the other carries pickups and the level's fruit.
- Star times are not typed in. Building a course plays it twice hands-free (never steering, and a good line) and sets the times from that, so they stay right when a piece changes.
- Game rules moved out of the renderer into `game/sim.ts` so levels can be test-played without a browser.

## Global Constraints

- No file-path header comments or task-restating docblocks.
- New behavioural tests demonstrate RED then GREEN; no mocks.
- Commits use explicit paths.
- Tests: `npm test`. Typecheck: `npm run typecheck`.

## UI intent

Each level has its own palette, road style (planks, tiles, plain) and scenery (orchard, palms, pines, mushrooms, cacti, castle towers), set in `game/themes.ts`. Two levels are dusk or night. HUD and screens unchanged apart from a sound toggle in the pause menu.

## Tasks and results

1. Track: start poses, barrel rolls, bend-to-rejoin for fork arms. Done.
2. Course builder: lanes and forks, mirror building, snapshot and restore, clash detection. Done.
3. New things on the road: skittles, windmill spinners, pendulums on arches, sticky patches, mega jumps with rings in the air, level-fruit pickups. Done.
4. Pieces (`game/pieces.ts`): 23, including wall-ride hairpin, waves, big drop, double loop, corkscrew down, helix up, twist tunnel and three forks (diamond, shortcut, hill or tunnel). Done.
5. Generator (`game/courses.ts`): recipe per level, depth-first with backtracking, links that turn, climb or drop to avoid older track, 90-unit runway check. Done.
6. Rules engine (`game/sim.ts`) and renderer (`game/run.ts`, `game/world.ts`) for lanes and the new objects; kerbs are left out where a fork's two roads overlap. Done.
7. Per-level bonus pools and themes. Done.
8. Sound: looping music, layered effects, pickup streak climbs a scale, music ducks under the blender and fanfare, sound toggle in pause. Done.
9. Runtime verification: below.

## Runtime verification

`npm test`: 123 passed. For every level: frames square, no part of the course within 12 units of an unrelated part, forks rejoin within 2.5 units, objects on the road, finishable hands-free in under 150 s, a good line beats hands-free, star times ordered. One test drives a ball down each side of a fork and checks it takes the arm and comes back.

Chrome at 1280x720 against `npm run dev`:

- PASS level 2 fork: road splits round an island with a sign, kerbs open at the split and close once the roads part.
- PASS level 14: twist tunnel barrel-rolls with the camera; pendulum swings from its arch; mushroom scenery and dusk light render.
- PASS levels 5, 10, 13 and 18 auto-played to the finish: 60 fps, 79 to 197 draw calls, results banked, next level unlocked, no console errors.
- PASS map with everything unlocked: levels 15 to 18 show gold; level cards show generated star times.
- PASS music file requested and streaming after the first tap.
- Not checked: how the sound actually sounds (no ears here); a real iPad; every level by hand. Levels 3, 4, 6 to 9, 11, 12 and 15 to 17 are covered by the headless tests only.

Level lengths run from about 1,850 to 3,300 units; five-star times from about 43 s (level 1) to 71 s (level 18).
