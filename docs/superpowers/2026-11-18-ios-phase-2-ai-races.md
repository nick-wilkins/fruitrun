# iOS phase 2: AI races

Date: 2026-11-18. Status: approved 2026-11-18 and built on branch `ios`; device play waits on Nick. Background: `2026-11-18-ios-app-research.md` section 4.

## Intent

Race any unlocked level against three computer marbles. Everyone starts together, you see the others on your track, nobody can bump anybody, and first across the line wins. A race is a normal run with opponents added: it earns stars and fruit as usual, plus extra fruit for a podium place.

## Decisions carried in

- Up to 3 opponents; a higher podium place earns more fruit.
- Races sit behind the purchase. The purchase itself is phase 3, so in this phase one function answers "are races unlocked?" and says yes. Phase 3 changes only that function.
- Built and tried in a desktop browser on the Mac with `npm run dev`; shipped only in the app. No public web version.
- Branch `ios`. Commit and push when green.

## My choices, for you to overrule

These are the calls the earlier decisions left open. I will build them as written unless you say otherwise.

1. **Always three opponents.** "Up to 3" could mean a picker; a fixed field of four is simpler for a child and makes the podium meaningful.
2. **Getting into a race.** The level card on the map gets a Race button beside Play. Tapping it shows Easy, Medium, Hard; the last choice is remembered.
3. **Podium fruit.** On top of the fruit the stars already give: 1st +3, 2nd +2, 3rd +1, 4th nothing, of the level's own fruit. The same at every difficulty.
4. **Opponents are Pip in other colours**: blue, pink and orange bubbles and bodies, named Berry, Mango and Plum in the race display.
5. **Retry works as now**: it throws the race away, fruit and place included.

## Difficulty

`ace` sets the five star time and would beat nearly every child, so difficulty comes from holding the existing drivers back, not from new AI.

| Level | Line | Held back by |
|---|---|---|
| Easy | careful (`smart`) | slower steering, top speed down about 12%, eases off when well ahead of the player |
| Medium | careful (`smart`) | top speed down about 5%, eases off a little when well ahead |
| Hard | expert (`ace`) | a little steering wobble, nothing else |

The three opponents in one race differ slightly from each other (seeded per level), so they spread out instead of riding in a clump. Easing off only ever slows an opponent; none is sped up to catch the player.

## Global Constraints

- No file-path header comments and no docblocks that restate the task.
- New behavioural tests are shown failing before the implementation and passing after. Any mock declares every call it expects.
- Commits name explicit paths. Never `git add -A`, `git add .` or `git commit -a`.
- Checks: `npm test`, `npm run typecheck`, `npm run build`. Focused tests while working, the full set once at the end.
- Star times must not move: the `smart` and `ace` presets used to calibrate them behave exactly as today. A test pins this.
- All randomness in a race comes from a seeded generator, so a race replays the same way.
- Browser checks run with the game's sound off.

## UI intent

Follow the existing screens; no new art.

- **Level card:** a Race button in the existing button style beside Play, then a small card with three difficulty buttons.
- **During a race:** a place badge ("2nd") by the timer, and a coloured dot for each opponent on the existing progress bar. Opponent marbles are the Pip model in another colour, with the same soft shadow.
- **Results card:** the finishing order (four rows: colour, name, time; yours highlighted) above the usual stars and fruit, with the podium fruit shown as its own line. The same two buttons as now.
- Opponents make no sound and throw no sparks. Their crates, rings and fruit are their own, so nothing the player can see changes when an opponent hits something.

## Tasks

1. **Drivers in the rules engine (`src/game/sim.ts`).** Replace the `autopilot` name with a small driver setting: which line, steering pace, speed scale, wobble, and how much to ease off relative to another marble's progress. `none`, `smart` and `ace` stay as presets.
   - Tests first: star times for a sample of levels are unchanged; each difficulty finishes every level; Easy is slower than Medium is slower than Hard on a sample; the same seed gives the same finish time twice.

2. **More than one marble in a run (`src/game/run.ts`, `src/game/character.ts`).** A racer is a marble model, a shadow and a source of position. `Run` keeps the player's `Sim` and steps and places a list of racers each frame. Only the player's events drive sound, sparks, camera and the visible obstacles. `buildPip` takes colours.

3. **Race rules (`src/core/`).** Finishing order from each marble's own time; podium fruit added to the result. Opponents still on the course when the player finishes are run on to the line straight away so the results are complete.
   - Tests first: order and podium fruit for each place; a tie goes to the player; a race result banks stars and fruit exactly as a normal run does, plus the podium fruit; a retry banks nothing.

4. **Race display (`src/ui/hud.ts`, `src/style.css`).** Place badge, progress dots, finishing order and the podium line on the results card.

5. **Getting in (`src/ui/map.ts`, `src/main.ts`).** Race button, difficulty card, remembered choice, and the single "are races unlocked?" function.

6. **Independent review**, `/code-review medium`, findings fixed or recorded.

7. **Runtime verification.** Recorded here as PASS or FAIL with evidence.
   - `npm test`, `npm run typecheck`, `npm run build`.
   - In a desktop browser, sound off: start a race from the level card at each difficulty; opponents are visible, coloured and stay on the road through a fork, a loop and a jump; the place badge and dots change as places change; the results show four rows and the right podium fruit; the fruit reaches the basket after blending; retry keeps nothing.
   - Frame time with four marbles against one, on the same level.
   - A normal (non-race) run is unchanged, and star times are unchanged.
   - Simulator build succeeds. Play on a device: Nick.

## Results

Built 2026-11-18 on branch `ios`.

Changes from the brief:
- **Difficulty is set from the star times, not fixed percentages.** Each rival has a form on the stars' scale (easy 2.0, 1.6, 1.2; medium 3.6, 3.2, 2.8; hard 4.7, 4.3, 4.0) and uses just enough of its speed to finish on the matching time. So a place goes hand in hand with the stars for the same run: a two star run ties the best easy rival (a tie goes to the player), and hard needs four or five stars. The speed is found by trial runs when a race is first set up, because going slower also changes jumps and bumpers.
- Two rivals favour a side of the road so the three are not on top of one another; the quickest keeps the ideal line.
- The player starts side by side with the rivals, a bubble's width apart, instead of in the middle of the road.
- The podium fruit is part of the "You won" line ("You won 7 strawberries: 3 for coming 1st!"), and the finishing order is two by two with a smaller time, so the results card still fits a phone.
- The developer shortcut takes a difficulty: `__fr.play(3, 'hard')`.

Runtime verification (desktop Chrome, sound off, 2026-11-18):

| Check | Result | Evidence |
|---|---|---|
| `npm test` | PASS | see the line under this table; `tests/race.test.ts` was written first and failed ("Cannot find module '../src/core/race'") |
| Star times unchanged | PASS | pinned for levels 1, 7 and 30; a rival with nothing held back matches the calibration drivers exactly |
| Every rival finishes every level near its set time | PASS | 68 levels, 3 difficulties, 3 rivals, each within 12% |
| `npm run typecheck`, `npm run build`, simulator build | PASS | see the line under this table |
| Race from the level card | PASS | Play and Race buttons; Race shows Easy, Medium, Hard with the remembered one standing out; card fits 844x390 |
| Rivals visible, coloured, on the road | PASS | screenshot at 8.6 s on level 3: blue and orange ahead, pink alongside, badge "3rd" |
| Place badge and progress dots | PASS | badge changed 1st to 3rd as rivals passed an unsteered player; three dots at 31.0%, 31.4%, 28.8% matched the rivals' progress |
| Results | PASS | order "1st You 0:36.6, 2nd Mango 0:41.6, 3rd Berry 0:42.2, 4th Plum 0:45.1"; 4 stars plus 3 podium = "You won 7 strawberries: 3 for coming 1st!" |
| Retry keeps nothing and stays a race | PASS | fruit 0 and races 0 before and after; three rivals again |
| Blend banks it | PASS | strawberries 9 (7 won plus 2 picked up on the course), races 1, wins 1 |
| Frame time, one marble against four | PASS | median 16.7 ms both; the rules for four marbles cost 0.008 ms per frame |
| A normal run | PASS | no badge, dots or order; "You won 4 strawberries!" |
| Results card on a phone-sized screen | PARTLY | buttons fit at 844x390 (bottom at 383 of 390); on the busiest card (3 awards, two rows of extras) the small print under them is cut off |
| Rivals through a fork, a loop and a jump, watched | NOT WATCHED | covered by the finish-every-level test, not by eye |
| On a device | NOT DONE | Nick |

After the last change: `npm test` 885 passed, `npm run typecheck` clean, `npm run ios` built and synced, simulator `xcodebuild` BUILD SUCCEEDED.

Known and left: a rival can pass through a crate the player still sees standing, because each marble has its own copy of the course (as designed). Rivals on the same racing line can overlap each other on the inside of a bend. Both replaced on 2026-11-19: see Contact racing below.

## Rivals that drive like people (2026-11-18, later)

Nick's feedback on the first version: the rivals "move perfectly and really quickly into the line". Asked for: not faster, but realistic. Occasional mistakes, not always the perfect line, human things. Set times are a guide for a rival driving exactly to its level; placings matter more.

Sources read (the ICGA journal article was dropped: abstract only):
- Game AI Pro: ch38 racing architecture, ch39 track representation, ch40 PID control, ch41 heat vision track positioning, ch42 rubber-banding; Game AI Pro 2: ch5 reaction time, ch18 context steering, ch19 anticipatory collision avoidance; Game AI Pro 3: ch1 illusion of intelligence, ch2 random walks, ch4 player perception of AI opponents, ch17 Driver San Francisco; Game AI Pro ch3 randomness. https://www.gameaipro.com/
- Reynolds, Steering Behaviors For Autonomous Characters: https://www.red3d.com/cwr/steer/gdc99/
- Majzer and Szajerman, Steering Behaviors for Vehicle Movement in Racing Computer Games, in Computer Game Innovations 2023.
- Wikipedia, Dynamic game difficulty balancing.

What was built from them (`src/game/sim.ts`, `src/game/rivals.ts`):
- **Looks, then steers.** A rival looks at the road every 0.2 to 0.5 s (reaction times from ch5) and holds its decision between looks; it keeps a decision unless the road asks for something clearly different.
- **Smooth steering.** A damped spring with limited force and no overshoot (Reynolds, ch40), in place of snapping to the line. Peak sideways speed fell from 16 to 28 units a second to about 3.5 to 9.
- **Near enough is good enough.** It leaves the marble alone inside a tolerance band (Reynolds path following).
- **Where to be across the road** is chosen from a danger and appeal map of 15 strips (ch18 context steering, ch41): other marbles and things in the road mark danger with a skirt; it takes the most appealing strip reachable without crossing worse danger. Danger lingers from look to look, which gives commitment for free.
- **Wandering and pace** are mean-reverting random walks from bell-shaped steps (GAIP3 ch2, GAIP ch3): it meanders, and has good spells and off spells.
- **Mistakes** (ch38 persona, Majzer, GAIP3 ch4): its mind wanders and it holds its line, or it misjudges and is slow to see what is in the way. Never two within 4 seconds. A knocked rival rocks and throws sparks so the mistake can be seen.
- **Forks:** decides once and early whether to take the side road, leaning away from whatever it did last time.
- **Three characters** at every difficulty (ch38, ch41): Berry steady, Mango bold, Plum a dreamer, differing in reaction, steering sharpness, room left, how far ahead they notice things, wandering, pace swings, slips and fondness for side roads.
- **Easing off** (ch42, GAIP3 ch4, the difficulty article): only when well clear of the player, never in the first 8 seconds, the leaders together so they do not bunch, partly by sloppier driving and only ever downward. Never a staged blunder, never a boost.

Evidence (desktop Chrome, sound off, five whole races stepped as the frame loop steps them, player on the careful hands-free line):
- Level 3 easy: rivals 48.8 to 52.4 s (1 to 2 stars) against the player's 36.7 s. Hard: 38.8 to 41.8 s (3 to 4 stars).
- Level 30 hard: Mango 64.6 s and Plum 67.6 s beat the player's 72.4 s; each took one side road.
- Direction changes 16 to 40 a minute; marbles overlapped another for 0 to 3 s of a race; hits 0 to 6 each.
- `tests/race.test.ts`: every rival finishes every level at every difficulty within a quarter of its guide time; star times unchanged.
- Not yet watched by eye on a device.

## Contact racing (2026-11-19)

Nick's decisions: marbles bump each other; a crate hit by anyone is gone for everyone; fruit a rival takes is simply not there for you, and is back within 0.5 seconds for whoever comes next (as in Mario Kart). This replaces the earlier "each marble has its own crates and fruit".

Global constraints: no file-path header comments or task-restating docblocks; new behavioural tests shown failing first; commits use explicit paths; all browser checks with sound off.

What was built:
- `src/game/sim.ts`: `shareWith(other)` puts marbles on one course. Crates and pins share one smashed list. Fruit has a shared "back at" time, `FRUIT_BACK = 0.5` seconds after anyone takes it; on your own it never comes back. Rings and "which fruit I collected" stay per marble (`had(index)`), so the fruit count and awards are the player's own. `shove(...)` applies a knock; a hard one takes the steering away for 0.15 s and raises a `knock` event.
- `src/game/contact.ts`: `jostle(sims)` runs after every step. Two overlapping marbles on the same road trade speed along the line between them with a soft bounce (0.5): run into from behind, the front one is pushed on and the one behind is checked; steered into, it is knocked aside. They are only ever moved apart across the road. No contact in the air over one another, on escalators, or during the countdown. Being bumped does not count as a hit for the clean-run awards.
- `src/game/run.ts`, `src/audio.ts`: crates and pins a rival smashes fly for everyone; fruit hides while taken and reappears; a knock gives a small shake, sparks and a new soft sound. Rivals brought home out of sight after the player finishes are taken out of contact.
- Rivals already steer round other marbles and skip smashed crates, so their driving needed no change.

Evidence:
- RED: `tests/contact.test.ts` failed before the code existed (missing `contact` module), and one expectation of mine was wrong and corrected (equal marbles do not bounce back, the striker keeps a quarter of its speed). GREEN: 10 tests. `tests/sim.test.ts` now asks `had(i)` for rings and fruit.
- `npm test`: 894 passed. `npx tsc --noEmit` clean. `npm run build` clean.
- Runtime, desktop Chrome, sound off, whole races run through the real frame loop with the player on the careful hands-free line: PASS.
  - Level 7 medium: 4 marbles share one course; 12 of 16 crates smashed, 5 by the player; fruit hidden then back 50 times, about half a second each; 16 hard knocks, 4 to the player; rivals took 8, 2 and 13 fruit, the player 28.
  - Level 7 easy and level 30 hard: finished; most any two marbles overlapped was 0.05 of a 2 wide marble; biggest sideways correction in one step 0.015; no console errors.
- Not yet watched by eye or on a device: how the bumps feel is Nick's call.

For multiplayer later: smashed crates, fruit times and knocks will have to be sent between devices.

Review (`/code-review medium`, one round, 2026-11-19). Fixed: a knock can no longer push a marble off the road or past the normal top speed; a marble on turbo keeps its speed and only nudges what it hits; speed in the air is read correctly; held-back rivals respond in proportion; rivals brought home out of sight after the player finishes each run on their own copy of the course, with nothing shown and no fruit left hidden; no knock sound or shake once past the line; tests added for different roads, the countdown, the kerb and turbo. Left: rival pace is still tuned on a solo run (times are a guide, placings matter); `shareWith` assumes everyone shares with the same marble, which is how it is used.
After the fixes: `npm test` 895 passed, `tsc` clean; level 7 medium and level 30 easy raced through the real loop to the results: most overlap 0.12, no fruit left hidden at the finish.
