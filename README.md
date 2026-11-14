# Smoothie Adventure (fruitrun)

A kids' marble-run game. Roll Pip down a 3D course, win fruit for a fast time, grab extras on the way, then blend smoothies for points.

Three.js + TypeScript + Vite. Menu, map and blender are DOM/CSS over the supplied art; courses are generated in code.

## Run it

```sh
npm install
npm run dev      # http://localhost:5183 and on your network for an iPad
npm test         # game rules, data and course checks
npm run build    # static site in dist/
```

Landscape only. Steer by holding and sliding a finger or the mouse, or with the arrow keys (A/D also work).

## Where things are

- `src/data/` ingredients (28 fruits, 58 extras); `levels.ts` has the three worlds and their 68 levels: where each sits on its map, its fruit, and which level leads to it
- `src/core/` smoothie scoring and save/progress rules (localStorage key `fruitrun.save.v1`)
- `src/game/sim.ts` the rules of a run, with no rendering: steering, speed, forks, every obstacle
- `src/game/pieces.ts` the library of course pieces; `courses.ts` the recipe for each level and the generator
- `src/game/themes.ts` the look of each level
- `src/game/track.ts`, `course.ts` track maths and the builder; `world.ts`, `run.ts`, `character.ts` what you see
- `src/ui/` menu, map, HUD/results and blender screens
- `tools/music.py` composes and synthesises the extra music tracks (needs macOS `afconvert`)
- `tools/slice.py` cuts `tools/source/*.png` sticker sheets into `public/assets/` (needs Pillow)

## Changing levels

World 1 levels are a list of piece names in `RECIPES` in `src/game/courses.ts`; levels in worlds 2 and 3 get a recipe written for them automatically. Reorder, swap or add pieces and the generator fits them together; `npm test` proves the result does not hit itself and can be finished. Star times set themselves from a hands-free test run. New piece types go in `src/game/pieces.ts`.

If you change layouts, bump `COURSES` in `src/core/progress.ts` so best times set on the old ones stop counting.

In dev, the browser console has `__fr.play(7)` to jump into a level and `__fr.sim('smart', 'level-7')` for a good-line finish time.
