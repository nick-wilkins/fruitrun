# Smoothie Adventure: vertical slice

Brief, tasks and results for the first playable slice (14 Nov 2026).

## Intent

Kids' game: each level is a fruit-themed 3D marble run. The ball always rolls forward; hold and slide to steer. Faster finish wins 1 to 5 fruit. Bonus ingredients are picked up on the course. Fruit and extras are blended (max 10 per jug, used up) for points from a hidden scoring algorithm with key combinations. Levels unlock in order on the supplied map. Slice scope: menu (carry on / start new), map, one level, blender. Saves in localStorage.

Decisions from Nick: landscape only; hold steers only; blending uses ingredients up; git on main with origin `nick-wilkins/fruitrun`; mouse and arrow keys on desktop.

## Global Constraints

- No file-path header comments or task-restating docblocks.
- New behavioural tests demonstrate RED then GREEN; no mocks in this slice.
- Commits use explicit paths.
- Tests: `npm test` (Vitest). Typecheck: `npm run typecheck`.
- Art comes from Nick's sheets via `tools/slice.py`; 3D models and textures are generated in code.

## UI intent

Use the supplied art as the look: menu scene with baked Carry On / Start New buttons, the 18-node map (purple pad is the blender), the Smoothies stall for blending, sticker icons for every ingredient. Own UI (cards, pills, chips) follows the same cream/wood/pill-button style. 3D course: bright low-poly orchard, wooden boardwalk, red and white kerbs.

## Tasks and results

1. Asset pipeline: done. 28 fruits, 58 extras, menu, map, stall, banner, stars, lock.
2. Rules (`src/core`): done. Smoothie scoring with 39 combos; progress, stars, unlocks, blend consumption.
3. Track and course: done. Segment builder with turns, slopes, loops, corkscrew, tunnels; Apple Orchard course (1856 units).
4. Run: done. Steering, speed model (pads, rings, slopes, inside line, wall scrape), crates, sliding bumpers, jump, pickups, finish.
5. Screens: done. Menu, map with locks/stars/Pip marker, level card, HUD, pause, results, blender with paging and result card.
6. Runtime verification: below.

Character: Pip, a green sprout who rides inside a striped bubble (3D in `game/character.ts`, flat in `ui/pip.ts`).

## Runtime verification

Chrome at 1280x720 against `npm run dev`, 14 Nov 2026.

- PASS menu: Carry On greyed with no save; Start New creates a save and opens the map.
- PASS map: level 1 open with Pip marker, 2 to 18 locked, blender pad opens the blender; totals shown.
- PASS run: 60 fps, 79 draw calls, about 204k triangles. Loop, corkscrew, tunnels, pads, rings, crates, sliders and pickups all render and behave.
- PASS input: touch pointer events steer right and left to the kerbs, release holds the line, ArrowRight steers, pause freezes the run.
- PASS finish: 43.65 s gave 5 stars, 5 apples plus pickups banked, level 2 unlocked, save written.
- PASS blend: 3 apple, milk, honey, cinnamon, oats, granola scored 370 (Apple Pie +60, Toffee Apple +40), ingredients removed, points banked, recipes found 2/39.
- PASS `npm test` 17/17, `npm run build` clean.
- Timing probe: hands-off 56.8 s, centre line 54.5 s, good line 40.0 s. Star times set to 45 / 49 / 53 / 58 s.
- Not checked: a real iPad (touch path exercised with synthetic touch pointer events only); portrait prompt.
