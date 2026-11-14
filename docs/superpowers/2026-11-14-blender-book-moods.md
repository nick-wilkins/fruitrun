# Super Blender, Smoothie Book, track variety, level moods, more music

Brief, tasks and results (14 Nov 2026). Follows `2026-11-14-worlds-and-more-pieces.md`.

## Intent

Nick:

1. Bug: the smoothie result card ran off the screen so the buttons could not be reached, and nothing scrolled.
2. Legendary is too easy; five stars on a level should be harder too.
3. Make tracks different in other ways: thinner and thicker road, loop-the-loop splits, choices that last longer, "super super fast" speed-ups.
4. Give some tracks a personality: darker worlds, rainy ones that make the controls slippery.
5. A smoothie tracker showing everything achieved.
6. The blend stop on the first map should be a super blender taking 20 items, with things only it can make.
7. More music options.

Decisions (mine):

- Legendary needs 720 points (was 400); the same good ten-item jug with three recipes is now Delicious. Five stars allows 3% over the test run's good line (was 8%).
- The purple pad on map 1 is the Super Blender. It is powered up by finishing level 14, the level that leads to it. The ordinary blender is the Blend button at the top of every map and the stands on maps 2 and 3.
- Ten recipes need the Super Blender. Its ratings ask 2.3 times the points.
- Weather is a property of a level: night (dark, stars, its own tune), rain and snow (slippery steering). 16 of the 68 levels have weather.
- Extra music is synthesised by `tools/music.py`: four chiptune tracks. Three join the playlist; the slow one plays on night levels.

## Global Constraints

- No file-path header comments or task-restating docblocks.
- New behavioural tests demonstrate RED then GREEN; no mocks.
- Commits use explicit paths.
- Tests: `npm test`. Typecheck: `npm run typecheck`.

## UI intent

Result card: Pip and glass on the left, score on the right, badges below in a box that scrolls if long, buttons always on the card. Smoothie Book: one cream card over the blurred stall, three tabs (Trophies, Recipes, Collection), body scrolls by finger or wheel. Unfound recipes show one ingredient as a clue; uncollected ingredients show as silhouettes. Super Blender: same stall with a rainbow "Super Blender" tag and a 5 by 4 mix grid.

## Tasks and results

1. Result card layout. Done.
2. Rating floors and five-star margin. Done.
3. Super Blender rules (capacity, `big` recipes, `kinds`), `blend(save, ids, capacity)`, `superBlenderOpen`. Done; tests first (7 failed, then passed).
4. Book records in the save (`seen`, `history`, `ratings`) and the Book screen. Done.
5. Track: per-sample road width, `width()` in the builder, clearance by width. Done.
6. Turbo pads (86 against the usual top speed of 56, for 2.2 s). Done.
7. Six pieces: turbo run, turbo jump, tightrope, plaza, twin-loop fork, long fork (about 390 units a side). Done; added to world 1 recipes and the automatic families. `COURSES` bumped to 3.
8. Moods: grip in the rules, repainted themes, rain streaks, snow, stars, HUD warning. Done.
9. Music script and playlist; night tune. Done.
10. Runtime verification: below.

## Runtime verification

`npm test`: 573 passed.

Chrome:

- PASS result card at 1100x560 with a full jug and seven badges: buttons end at y=481 of 560.
- PASS that jug (3 strawberry, 2 banana, 2 peach, yogurt, milk, honey): 645 points, Delicious, not Legendary.
- PASS map 1: Super Blender pad, Blend and Book buttons. Super Blender took 18 items into a 20 grid; blend scored 1,590 with Rainbow Fruit Salad found.
- PASS Book: Trophies page filled in; Recipes 49 listed, 11 found; Collection 86 items, body scrolls (1,870 high in a 512 window).
- PASS level 10 in rain (grey sky, streaks), level 45 in snow, turbo on level 12 reaches 86 with the view stretched.
- PASS levels 9, 11, 18, 50 and 63 auto-played to the finish; no console errors.
- PASS music: four new tracks load (52 to 81 s); a night level switches to its tune on repeat and the playlist resumes afterwards.
- Not checked: how the music and effects sound; slippery steering by hand (only the autopilot has driven it); a real iPad.

## Review

`/code-review medium`, 10 findings, all fixed. `npm test`: 576 passed.

- Snow did not fall: the flakes were drawn from a copy of their positions. Rain and snow now live in the world and wrap round the camera, so they stream past as you move. Measured in Chrome on level 45: a flake fell 3.6 units in half a second.
- The turbo jump's fruit and second ring hung where no ball could reach. They now follow the turbo arc. Test written first (failed, now passes).
- Turbo carried on through an escalator and through sticky patches. Both end it now. Tests written first (failed, now pass).
- A finger held still while the road narrowed kept its old target and scraped the kerb all along the tightrope. The target is now worked out every frame from where the finger is.
- Turbo's flame trail flickered when a ring was collected. Fixed.
- Retrying a night level restarted its tune, and the playlist restarted from the top afterwards. A retry now leaves the tune alone and the playlist resumes where it was.
- Old saves: the Collection tab now also counts the fruit of every level already finished.
- Tidied: one ratings table shared by scoring, the blender and the book; `tools/music.py` only renders when run directly and can render named tracks.
