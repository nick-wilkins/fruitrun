# Smoothie Adventure (fruitrun)

A kids' marble-run game for iPhone and iPad. Roll Pip down a 3D course, win fruit for a fast time, grab extras on the way, then blend smoothies for points.

Three.js + TypeScript + Vite. Menu, map and blender are DOM/CSS over the supplied art; courses are generated in code.

## Run it

```sh
npm install
npm run dev      # http://localhost:5183, for working on the game in a desktop browser
npm test         # game rules, data and course checks
npm run ios      # build the game and copy it into the iPhone and iPad app
npx cap open ios # open the app in Xcode to run it in a simulator or on a device
```

The game ships as an iPhone and iPad app (Capacitor, in `ios/`). Everything it needs is inside the app, so it plays with no connection. `fastlane ios beta` sends a build to TestFlight; see `fastlane/Fastfile`.

The save lives in the app's own settings store (`src/platform.ts`), not the web view's storage, which a device may clear when it is short of space.

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
- `tools/icons.py` makes the app icon from the smoothie cup (needs Pillow)
- `tools/slice.py` cuts `tools/source/*.png` sticker sheets into `public/assets/` (needs Pillow)

## Changing levels

World 1 levels are a list of piece names in `RECIPES` in `src/game/courses.ts`; levels in worlds 2 and 3 get a recipe written for them automatically. Reorder, swap or add pieces and the generator fits them together; `npm test` proves the result does not hit itself and can be finished. Star times set themselves from a hands-free test run. New piece types go in `src/game/pieces.ts`.

If you change layouts, bump `COURSES` in `src/core/progress.ts` so best times set on the old ones stop counting.

In dev, the browser console has `__fr.play(7)` to jump into a level and `__fr.sim('smart', 'level-7')` for a good-line finish time.
