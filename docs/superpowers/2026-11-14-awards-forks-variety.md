# Awards, perfect runs, fork fixes, midnight, drip-fed features

Brief, tasks and results (14 Nov 2026). Follows `2026-11-14-blender-book-moods.md`.

## Intent

Nick:

1. Show a perfect run (every fruit they could have got).
2. The game should get harder.
3. An even darker midnight run with a darker track.
4. Five stars (and so four, three) harder still.
5. Achievements: perfect run, best times, hitting nothing, night run, rain run, 10 rings, 15 rings, "lots of others".
6. Weather more often: 15 levels in with no ice and rain once.
7. More tunnels. Each level should finish by going through its fruit as a stylised arch.
8. The finish should not be the same on every level.
9. More rings in the air, even single ones over a single jump.
10. Bug: at a split the game makes up its mind before the split and forces a side.
11. Glitch: where a split rejoins, a black triangle shows.
12. Pickups in loops are always in the middle; they should not be.
13. More variety in track width.
14. Drip-feed: first pendulum on level 4 or 5, super-fast on 7 or 8, so later levels reveal more. Level 1 was a good starter.
15. Track colour changes here and there, with character from the fruit.

Decisions (mine):

- A perfect run means every pickup on the route actually taken, so a fork does not make it impossible.
- Five stars now means matching the test run's good line (no margin); the other bands are spread evenly towards never steering, which earns one star.
- At a fork the road is treated as one wide road while the two parts still overlap. The ball takes whichever it is nearer once they have separated (18 to 40 units in, depending on the fork).
- 54 awards, kept in the save and shown in a new Awards tab in the Book. A run shows at most three new ones. Old saves are given, quietly, any awards they had already earned.
- Weather on 42 of the 68 levels: rain first on level 3, night on 5, ice on 6, midnight on 11.
- World 1 recipes rewritten to an introduction schedule (`INTRO` in `game/courses.ts`); the level card says what is new. `COURSES` bumped to 4, so best times reset once.

## Global Constraints

- No file-path header comments or task-restating docblocks.
- New behavioural tests demonstrate RED then GREEN; no mocks.
- Commits use explicit paths.
- Tests: `npm test`. Typecheck: `npm run typecheck`.

## UI intent

Results card: a gold pill for a perfect run and for hitting nothing, otherwise "n of m pickups"; purple pills for new awards. Level card: a purple "New here:" line. Midnight: near-black sky and ground, dark road, glowing kerbs, a lamp on the ball. Finish: a giant cut-out of the level's fruit across the road with an archway through it.

## Tasks and results

1. Fork decision where the roads part; road fill at fork joins. Done. Tests first (1 failed, then passed).
2. Star bands. Done.
3. Awards (`core/awards.ts`), feats counted by the rules engine, perfect and clean runs. Done. Tests first.
4. Results card and Book tab. Done.
5. Midnight mood, lamp, glow per theme; weather table. Done.
6. Pieces: tunnel sweep, tunnel dive, tunnel wiggle, bottleneck, wide sweeper; loop pickups to the side; a ring hung after every ordinary jump. Done.
7. Six finishes; fruit arch. Done.
8. Road colour stretches (the road's colour, then two fruit tints, every 260 units). Done.
9. Generator: 30% of suitable pieces laid on broad road; automatic recipes are 11 to 15 pieces by difficulty and include tunnels. Done.
10. Introduction schedule and its tests. Done.
11. Runtime verification: below.

## Runtime verification

`npm test`: 588 passed.

Chrome:

- PASS level 11 at midnight: black sky with stars, dark road lit round the ball, kerbs glowing.
- PASS level 4 finish: giant orange with an archway, seen from the tunnel that ends that level.
- PASS level 2 fork rejoin: road surface continuous where the two roads meet.
- PASS level 3 and level 4 auto-played: results show "23 of 28 pickups" and new awards; buttons on screen.
- Not checked by hand: steering through a fork (covered by the tests only); the Awards tab by eye; a real iPad.

## Review

`/code-review medium`, 10 findings, all fixed. `npm test`: 589 passed.

- Swiping into a fork arm dragged the ball to the arm's outer kerb, because the swipe remembered a position measured from the main road. Swipes are now built up from finger movement only, and follow the ball when its position is re-measured from the arm. In Chrome on level 2: a held left swipe took the arm and the ball stayed where it was on the road (x 3.8 to 4.0), no scraping.
- The same change means a finger held still no longer moves the ball when the road widens or narrows.
- The road filler at forks ran 64 units and could span the island, climb to a raised arm or cross a gap. It now stops where the roads have parted or one has climbed away, and matches the road's tint.
- The camera's look-ahead at a fork used a different rule from the ball's own choice and could swing the wrong way. Same rule now.
- Awards earned by blending were recorded but never shown. They now appear on the smoothie card.
- Tidied: one pair of full-screen listeners instead of two per screen visit; finishes always built the same way round; a result without feats no longer counts a phantom bump; the award jingle does not play after the card has gone; award goals come from the number of levels.
