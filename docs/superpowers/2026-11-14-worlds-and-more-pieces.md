# Branching map, more course features, two more worlds

Brief, tasks and results (14 Nov 2026). Follows `2026-11-14-all-levels.md`.

## Intent

Nick, in order:

1. Map bug: after level 4 the art shows a choice of ways but the game only opened level 5.
2. More fun: route options, jumps, falls, super jumps, windmills, an uphill you ride at a set speed "like an escalator", tighter spirals and tighter loops.
3. Show each level's fruit on the map, greyed while locked.
4. Two more maps to build in after the first.

Decisions (mine):

- Levels open along the paths drawn on each map. After level 4: 5, 6 and 13.
- The two new maps are worlds 2 (Tropical Falls, 21 levels) and 3 (Blossom Village, 29 levels). Tropical Falls opens from level 18; Blossom Village from the last level on Tropical Falls' main path. 68 levels in all.
- The new maps' painted numbers do not follow the route (Tropical Falls has no 4 and two 13s; Blossom Village has two 7s and blank nodes), so every node on those maps is drawn over with its own number. Side paths to the grey stones and blank nodes are extra levels.
- There are only 28 fruits, so the later worlds reuse them. Courses there get an automatic recipe (one piece from each family in a set rhythm) and a look built from a world setting trimmed in the fruit's colour.

## Global Constraints

- No file-path header comments or task-restating docblocks.
- New behavioural tests demonstrate RED then GREEN; no mocks.
- Commits use explicit paths.
- Tests: `npm test`. Typecheck: `npm run typecheck`.

## UI intent

Map nodes carry a fruit badge. Every level waiting to be played pulses, so a junction reads as a choice; Pip stands on the level last played. Worlds 2 and 3 use blue and yellow drawn nodes to match their art. Purple pills in the bottom corners move between worlds; grey when the next world is still shut.

## Tasks and results

1. Branching unlocks (`isUnlocked`, `Level.after`). Done. Tests written first: 4 failed, then passed.
2. Fruit badges on map nodes. Done.
3. Engine: road gaps the ball is flung across, escalator lifts, upright windmills. Done.
4. Nine new pieces: cliff fall, super jump, windmills, escalator hill, tight corkscrew, tight loops, three-way fork, loops-or-cruise fork, escalator-and-jump fork. Done. World 1 recipes rewritten to use them.
5. Worlds: `WORLDS`, 50 new levels, generated themes, automatic recipes, generator retries with a new seed if boxed in, finishing sprint checked for clashes. Done.
6. Map screen per world with world switching. Done.
7. Runtime verification: below.

## Runtime verification

`npm test`: 564 passed. Every one of the 68 levels: no self-clash, forks rejoin, objects on the road, nothing solid where a fork's roads overlap, only airborne things over gaps, finishable hands-free, five stars for a good line and at most two for never steering.

Chrome at 1280x720:

- PASS map 1 after levels 1 to 4: levels 5, 6 and 13 pulse as open; locked nodes show grey fruit.
- PASS level 4: upright windmill on its arch; super jump lip, rings and fruit over the gap; view from mid-air.
- PASS level 2: escalator belt with arches. PASS level 6: three-way fork with two signs and the windmill down the middle.
- PASS levels 8, 13, 17, 18, 25, 33, 50 and 68 auto-played to the finish at 60 fps, no console errors.
- PASS Tropical Falls and Blossom Village maps: all nodes sit on the painted stones; world switch buttons work.
- Not checked: a real iPad; sound by ear; most of the 50 new levels by eye (covered by the tests only).

## Review

`/code-review medium`, 10 findings, all fixed. `npm test`: 565 passed.

- Side-path levels in worlds 2 and 3 were among the hardest in their world although they open early. Difficulty now follows how far along the route a level is.
- World 1 courses changed, so best times set on the old layouts could never be beaten. Records carry a layout version (`COURSES`); the first run on a new layout replaces an old time, and the card hides a time it cannot vouch for. Stars are kept. Test added.
- Saves from before today had no "last played" level, so Pip went back to level 1. It now falls back to the furthest level finished, which also covers a save naming a level that no longer exists (that used to stop the game loading).
- Gap launches threw away boost speed and gave a crawling ball a free lift. Speed is now kept and the arc is a fixed height.
- The ball's shadow floated over gaps. Hidden there now. Checked in Chrome on level 60.
- Course layout could stall the first tap on a level. Courses are laid out in the background after load, reachable levels first, and each attempt has a smaller budget. Opening level 60 cold took 45 ms in Chrome.
- Tidied: one `levelByNumber` lookup, a dead check removed from the automatic recipe, README brought up to date.
