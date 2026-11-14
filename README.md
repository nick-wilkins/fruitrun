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

- `src/data/` ingredients (28 fruits, 58 extras) and the 18 map levels
- `src/core/` smoothie scoring and save/progress rules (localStorage key `fruitrun.save.v1`)
- `src/game/` track maths, course layout (`course.ts`), scenery, Pip, and the run loop
- `src/ui/` menu, map, HUD/results and blender screens
- `tools/slice.py` cuts `tools/source/*.png` sticker sheets into `public/assets/` (needs Pillow)

## Adding a level

Write a `buildXxx()` in `src/game/course.ts` with `CourseBuilder`, register it in `COURSES` in `src/main.ts`, and set `built` plus `starTimes` and `bonusPool` on the level in `src/data/levels.ts`. In dev, `__fr.sim('smart')` and `__fr.sim('none')` in the browser console return a good-line and a hands-off time to set star times from.
