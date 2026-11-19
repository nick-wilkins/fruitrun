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

## Difficulty tuning (2026-11-19)

Nick raced on Hard, "missed almost every speed up and still just about won". Asked for: Hard genuinely hard, Medium a fair fight, Easy winnable at six to eight, by skill and not speed, still driving like people.

### Diagnosis

Measured with whole contact races run headlessly (three rivals and a stand-in player on one course, `jostle` on), levels 1, 3, 7, 15, 30, 45, 60. Stand-ins: `ace` and `smart` (the hands-free lines), `none` (never steers).

- **The hard rivals did not reach their times.** Guide 3.9 to 4.7 stars; in a race they came home at about 2.5 to 4.2. Level 15: guide 62.5 s, drove 73.8 s on its own and 80.1 s in the race. Level 60: 62.4 against 74.1.
- **So the careful hands-free line beat all three on Hard on 5 levels of 7**, by 3.3 s on average, and the expert line won all 7 by 7.1 s.
- **Why they fell short.** They were following lines written for a marble that turns in an instant (28 across the road a second) with hands limited to 9, by stretching the line's look-ahead. With every mistake and all wandering switched off they still took 1.11 times the best hands-free time, caught 55 to 70 percent of the speed pads and hit 2 to 8 things a race. Reaction time, sharpness and slips made almost no difference: the plan was the limit, not the hands. Two layers also fought each other: the line said "cross now", the danger map still remembered the row of crates just passed and said "stay".
- **The setting-up loop had nothing left to give.** All it could do for a rival behind its time was raise `speed` to 1 and strip its character; most hard rivals were already at 1.
- **Contact** cost a further 2 to 6 s, and the rivals were set on a run alone.
- **Side roads** were taken by fondness alone. Measured per level they are worth anything from 4 s lost (level 45) to 3 s gained (level 7).
- Not confirmed: that a player who truly ignores the pads could win. A stand-in that only dodged came last on Hard by 16 s even then. More likely Nick drove a good line and caught more than it felt like; the rivals were simply at three-star pace.

### Sources

- Game AI Pro ch42 (rubber-banding): change the driver's skill before the car's power, "the drivers are still in the same cars and so no cheating is happening"; none of it near the player. ch38 (architecture): skill is the primary characteristic of a driver persona, a narrow range of it sets the difficulty, and it should vary slowly with short off spells. Game AI Pro 3 ch4: players judge difficulty poorly but notice a stupid-looking mistake at once. Game AI Pro ch40 and Reynolds for steering at a point up the road. https://www.gameaipro.com/
- iRacing AI rosters: lower skill is "slower cornering speeds and a less optimum driving line", with separate dials for aggression and optimism. https://www.iracing.com/airoster/
- Forza: difficulty is named as the skill of the opponents, Tourist to Unbeatable; the newer AI is built to make natural mistakes such as braking late and running wide. https://support.forza.net/hc/en-us/articles/360005363194-Difficulty-Assists-and-Drivatars , https://forza.net/news/forza-motorsport-drivatars-tire-physics (the forum threads on Drivatars cornering beyond the physics are the cautionary tale: https://forums.forza.net/t/ai-drivatar-and-difficulty-balancing-issues/57068 )
- Gran Turismo Sophy coverage, and players' complaint that it is held back on power while ahead: https://aiwire.net/2022/02/11/sonys-sophy-ai-trained-on-thousands-of-races-bests-humans-champs , https://www.gtplanet.net/forum/threads/is-sophy-2-0-no-longer-competitive.423856/
- Mario Kart, as what not to do on Hard (catch-up that players read as rigged): https://www.cheatcc.com/articles/why-mario-kart-s-rubber-band-ai-feels-rigged-not-just-hard/ , https://giantbomb.com/wiki/Concepts/Rubber_Band_AI . Forum and press pieces, not measurements.

What was taken from them: difficulty is one marble driven better or worse, never a quicker marble; the setting-up loop turns a skill dial; the top difficulty is the rivals flat out, with no banding at all.

### Targets

Stand-ins added, built on the rivals' own driver model with ordinary hands: `steady` (a decent player, goes for most pads), `misser` (same hands, hardly ever goes out of the way for a pad: the run Nick described), `kid` (six to eight: slow hands, short sight, wanders, slips).

- **Hard:** the expert line wins narrowly or loses; the careful line does not beat the leader on average; a decent player is usually fourth; missing the pads is last by a distance.
- **Medium:** a decent player is in a close fight for the podium and wins about half; missing the pads loses it.
- **Easy:** a young child is on the podium nearly every time and wins some; nobody is left more than 10 s behind.
- The brief's "careful line behind two rivals on most levels" was restated. On three of the seven levels the careful line is the best line there is, so it stands in for an expert there. Where it is at least 5 percent slower than the expert line it does finish third or fourth.

### What changed

`src/game/sim.ts`
- **Rivals read the road instead of borrowing the hands-free lines** (`readRoad`). Each look, a rival works out the best way through everything in the next one to three seconds that its own hands can manage: pads, turbos and rings worth having, crates, goo and moving things to miss, the inside of bends, the road narrowing. It no longer sets off for a pad it cannot reach. It knows a ramp carries it over the crates behind it, and that a turning bar lying along the road leaves room.
- **It steers for a point a little way up the road** (`onward`) and carries on with what it has read between looks, so one move flows into the next. The strips of danger are now only for getting round other marbles.
- **New things that separate a sharp driver from a casual one:** `ahead` (seconds of road read), `keen` (how far out of its way it goes for a pad), `foresee` (judging where a swinging thing will be on arrival), `loose` (whether it tightens up with something to aim for), `quick` (top speed of its hands), `wise` (knowing which side roads are short cuts). `line` and `far` are gone. The hands-free lines are untouched; star times are unchanged.

`src/game/rivals.ts`
- **Set in a race, not alone** (`fieldTimes`): the three together with a careful hands-free marble in the player's place, bumping and sharing crates.
- **Set by skill.** `keen` closes in on what brings each rival home on its time. A rival behind its time gives up its favourite side of the road, then concentrates harder, and stops there: it keeps its forks and its character. `speed` stays 1 on Medium and Hard on every level sampled; only an easy rival still too quick while taking next to nothing is slowed, to 0.8 at the least.
- **A sharp scout drives each course once per side road** so rivals can know which are short cuts. Hard rivals nearly always do (0.9), medium sometimes (0.4), easy go by whim.
- Manners: hard reads 2.2 s ahead with hands that cross four units in about a third of a second (a player on keys manages much the same, a swipe is twice as quick); medium 1.6 s and about 0.8 s; easy 1.2 s and over a second.
- Guide form: hard 4.7/4.3/3.9 to 4.9/4.6/4.3, which only an expert's run matches, so in practice they drive flat out. Easy 2.0/1.6/1.2 to 2.0/1.5/0.9: Plum on Easy is now slower than rolling straight, which is what puts a small child on the podium. Medium unchanged.
- Easing off: easy 0.2 to 0.25, medium 0.1, hard 0. Still only ever slower, only when well clear.

### Before and after

Places over the seven levels in level order, and the average seconds ahead of the first rival home (minus is behind).

| Difficulty | Stand-in | Before | After |
|---|---|---|---|
| Hard | expert line | 1111111, +7.1 | 1111111, +1.1 |
| Hard | careful line | 1121211, +3.3 | 1141421, -0.8 |
| Hard | never steers | 4444444, -15.7 | 4444444, -20.4 |
| Hard | decent player | | 4244414, -4.7 |
| Hard | misses the pads | | 4444444, -16.6 |
| Medium | expert line | 1111111, +9.3 | 1111111, +6.8 |
| Medium | careful line | 1121111, +6.4 | 1121111, +3.2 |
| Medium | decent player | | 1111111, +1.5 |
| Medium | misses the pads | | 4143443, -7.4 |
| Easy | never steers | 4123144, -4.2 | 3113232, -2.1 |
| Easy | young child | | 1131331, -0.4 |
| Easy | misses the pads | | 1143131, -0.5 |

The people stand-ins need the new driver model, so they have no "before".

Checked again on 23 levels (every third), none of which the numbers were chosen on beyond the seven:
- Hard: expert line wins 19 of 23 by 1.1 s on average and loses 4; careful line averages 0.5 s behind the leader; decent player fourth on 20; missing the pads last on all 23, 19 s back.
- Medium: decent player on the podium 22 of 23, wins 14, average 0.4 s ahead.
- Easy: young child on the podium 20 of 23, wins 6, average 1.7 s behind.

Other numbers:
- Hard leader's time against the best hands-free time: 1.03 (was about 1.12). Second 1.05, third 1.08. Medium 1.17, 1.22, 1.27. Easy 1.34, 1.40, 1.46.
- Things hit per rival per race: hard 0.9 (was about 3), medium 3.6, easy 4.5.
- How it looks, levels 7 and 30: easy rivals peak at 5 to 8 across the road a second and change direction 7 to 25 times a minute; medium 8.5 to 10 and 22 to 39; hard 16 and 32 to 60. The hands-free player line sits at 16 and about 80. Every rival was 3.5 to 9 before: hard is visibly busier now.
- Working out a level's rivals costs 25 to 275 ms in Node (17 to 290 before).

### Evidence

- RED: the six new tests in `tests/race.test.ts` ("how hard the rivals are") run against the previous `sim.ts` and `rivals.ts` all failed, the first two with the diagnosis numbers (7.08 s against a limit of 3; 3.32 against 1). The four that use the people stand-ins fail there partly because the old driver does not understand them.
- GREEN: `npm test` 921 passed in 12 files, 35.5 s (suite was about 30 s). `npx tsc --noEmit` clean.
- Runtime verification: headless whole races only, as above. PASS for the placings. NOT DONE: nothing was watched by eye or on a device, on instruction (no browser, no sound).

### Not achieved, and calls for Nick

- **Not seen on screen.** Hard rivals now move across the road up to 16 a second, where 9 was the limit. They still ease into and out of every move and never snap, but whether that reads as a sharp person or as a machine is a call for the eye. To calm them: `MANNER.hard.quick` and `turn` in `rivals.ts`; quick 14 and turn 10 costs about 2 percent of their pace.
- **The expert line still wins Hard 19 times in 23.** The leader is about 3 percent off it. Closing that needs hands as quick as the player's own, which was not wanted.
- **Hard may now be too hard.** A decent player is last on most levels. The dial is `FORM.hard`: 4.7/4.3/3.9 brings the second and third back by a second or two.
- **Rivals lose 2 to 4 percent in a crowd.** Near other marbles they drop their line and pick a strip. Not improved.
- **Rings over a gap** are not gone for; only rings over a ramp.
- **The stand-in people are models,** built from the same driver the rivals use. Real six year olds were not consulted.
- The seven-level tests pin today's numbers. Retuning will move them; that is their job.

Checked by the session owner after the tuning agent reported (2026-11-19): `npm test` 921 passed, `npx tsc --noEmit` clean, `npm run build` clean. Real game loop in desktop Chrome, sound off: level 7 Hard, careful line 57.4 s came 4th behind 53.6 to 54.3 s; expert line 53.2 s won by 0.1 s. Level 3 Easy, a marble that never steers won by 0.2 s. Level 15 Medium, careful line won by 3 s. Rival setup on starting a race took 15 to 100 ms. No console errors. Not watched by eye.

## Rivals seen finishing (2026-11-19)

Nick asked to see the racers behind him cross the line. Before, everyone still out was brought home out of sight the moment the player finished. Now they race on in view, with no easing off, and the results card waits for any rival who will cross within 7 seconds of the player, plus a moment after. Rivals further back than that are still brought home out of sight, so nobody sits waiting. The player's place is known at the line (rivals already home are ahead); the finishing times in the table come when the card appears.

Evidence, desktop Chrome, sound off, real game loop: level 7 Hard on the expert line (won by 0.1 s): all three rivals crossed in view and the card came 2.1 s after the player's finish, order and times correct. Level 15 Medium and level 3 Easy (rivals 10 s or more behind): card at 1.8 s as before, rivals out of sight. Level 7 Hard never steering (last): card at 1.8 s, placed 4th. `npm test` 922 passed. How it looks in motion has not been watched.

## Legendary (2026-11-19)

Nick played Hard after the retune and "won every game fairly easily". Decision: Hard stays (hard for a child); a fourth difficulty, Legendary, is for an adult who knows the game.

Targets: the expert hands-free line loses to the best rival on most levels, never wins by more than about a second, and averages mid-pack or worse. The careful line and a decent player are last by a clear distance. No speed boost: same marble, same pads, same top speed.

### What was found

- **Quicker hands alone were worth little.** On its own a legendary rival already matched or beat the expert line (level 1: 37.7 s against 37.9). In a race the same three drove 38.0 to 39.6 and the expert line won.
- **The loss was all in the pack.** The hands-free line gives way to nobody, so it barged through; each rival dropped its line to make room, missed a pad at the start and never got it back. Manner settings (sharper, longer sight, no mistakes at all) moved the result by nothing measurable: 9 or 10 wins for the expert line in 23 every time.
- **Holding the line fixed it.** A rival that keeps its line beside other marbles, and only goes round one it is actually catching, took the expert line's wins from 10 in 23 to 5.

### What changed

- `src/core/race.ts`: `'legendary'` added to `Difficulty` and to `DIFFICULTIES`, last.
- `src/game/sim.ts`: one new `Driver` field, `polish` (0 for easy, medium and hard, 1 for legendary). With it a rival is away the instant the race starts, is not put off its line by marbles beside it or nowhere near where it is going, and lines up for rings hung over a gap in the road.
- `src/game/rivals.ts`: legendary manner: looks every 0.06 to 0.1 s (hard 0.14 to 0.26), hands as quick as a swiping finger (`quick` 28, `turn` 24; hard 16 and 12), reads 2.6 s ahead, knows every short cut (`wise` 1), next to no wandering or slips. Form 5.8/5.7/5.6, which nobody can do, so all three are flat out on every level. No easing off.
- Easy, Medium and Hard go through the same code as before with `polish` 0. Their six pinned tests pass untouched; star times are unchanged.

### Before and after

"Before" is Hard as committed, the hardest there was. Places over levels 1, 3, 7, 15, 30, 45, 60 in order, wins, and average seconds ahead of the first rival home (minus is behind).

| Stand-in | Hard, 7 levels | Legendary, 7 levels | Hard, 23 levels | Legendary, 23 levels |
|---|---|---|---|---|
| Expert line | 1111111, 7 wins, +1.1 | 1244414, 2 wins, -1.4 | 20 wins, place 1.13, +1.7 | 5 wins, place 2.52, -1.6 |
| Careful line | 1243421, 2 wins, -2.1 | 4344443, 0 wins, -3.8 | 10 wins, place 2.13, -0.6 | 4 wins, place 3.43, -3.6 |
| Decent player | 4244414, 1 win, -4.2 | 4444444, 0 wins, -10.0 | 0 wins, place 3.70, -6.7 | 0 wins, place 4.00, -10.4 |

- The expert line's biggest win on Legendary is 0.5 s over the seven levels and 1.1 s over the 23 (6.0 s on Hard).
- The careful line's 4 wins in 23 are on levels where it is the best line there is; its biggest is 0.4 s.
- Legendary leader against the best hands-free time, in a race: 0.97 (Hard 1.02). Things hit per rival per race: 0.3 (Hard 1.2).

### Evidence

- RED: the three new tests ("how hard the legendary rivals are") run against the committed `sim.ts` and `rivals.ts` all failed: there was no legendary to race.
- GREEN: `npm test` 927 passed in 12 files. `npx tsc --noEmit` clean.
- Suite time: `tests/race.test.ts` alone takes 38.9 s with this work and 38.5 s on the committed code, on a busy machine; the legendary tests add about 1.6 s. Legendary is tested on the seven levels only, not all 68, to keep it there.
- Runtime verification: headless whole races only. PASS for the placings. NOT DONE: nothing watched by eye or on a device, on instruction.

### Trades, and calls for Nick

- **They look more like machines.** Hands up to 28 across the road a second and a fresh look a dozen times a second. They still ease in and out of every move. This was allowed for Legendary; it has not been seen on screen.
- **They barge.** Holding the line means 5 to 10 knocks each a race where Hard rivals have 0 to 6, and the player will take more of them, mostly in the scramble for the first pad. This is where the win came from, so it cannot be dialled out cheaply. If it feels rough, the place to look is the alongside rule in `weighUp`.
- **The three are near enough equal.** All flat out, they finish within a second or two of one another, and their characters show less: Mango and Plum give up their favourite side of the road, and nobody wanders much.
- **A bump from behind pushes the front marble on,** for the player as much as for a rival. In a tight pack that makes everyone a little quicker than a clear road: the leader beats the best hands-free time by 3 percent. It is the contact rule as built, not a boost, but it is why a pack is fast.
- **Whether an expert adult can win is not known.** The expert line is steadier than any person and still loses 18 in 23. If Legendary proves unwinnable, bring `MANNER.legendary.quick` and `turn` down towards Hard's, or `FORM.legendary` down so the second and third are set a time.
- **Not done:** legendary rivals on all 68 levels are not individually tested for finishing; the 23 measured all finished.

Checked by the session owner (2026-11-19): `npm test` 927 passed, `npx tsc --noEmit` clean, `npm run build` clean. Real game loop in desktop Chrome, sound off: level 7 Legendary, expert line 54.8 s came 4th behind 51.3 to 53.4 s; level 15 Legendary, expert line 61.5 s came 4th behind 58.8 to 60.1 s; level 7 Legendary, careful line last by 6 s; level 7 Hard unchanged (expert line wins by 0.1 s). The player took 21 to 24 hard knocks in each Legendary race against 4 on Hard. Rival setup on starting a Legendary race took up to 176 ms. Not watched by eye.

Unlocking (owner's side, `src/core/progress.ts`, `src/core/cups.ts`, UI): Legendary opens on a level once it has been won on Hard, and in a cup once that cup has a Hard trophy (Nick: "Legendary only opens up in the cups if you complete hard"). It is not part of a sweep. Awards: Stuff of Legend, Legend of the Cups. Tests in `tests/cups.test.ts` (shown failing first).

## Legendary becomes a duel (2026-11-19)

Nick: "For legendary, let's just have it one other marble and let's restyle it to make him look a bit fast and mean."

- One rival on Legendary: Chilli, red with a dark, red and gold bubble, a scowl, and flames behind it (`LEGEND` and `rivalsFor` in `src/core/race.ts`; `mean` look in `src/game/character.ts` and `src/ui/pip.ts`). It starts beside the player.
- The barging pack is gone with the other two marbles: the player took 6 to 7 hard knocks in a duel against 21 to 24 in the four-marble version.
- A legendary race pays its extra fruit only for winning. A legendary cup is the same duel over four races, 10 and 7 points, and only winning it earns the trophy.
- Measured headless over 12 levels: the expert hands-free line wins 4 (by 0.3 to 1.4 s) and loses 8 (by 0.3 to 4.8 s); the careful line wins 1 of 12; a decent player loses all 12 by 3 to 17 s.
- Tests: the three pinned legendary tests in `tests/race.test.ts` now describe the duel; `tests/cups.test.ts` gained the legendary cup and fruit rules (shown failing first). `npm test` passed, see the commit.
- Real game loop, desktop Chrome, sound off: level 7, expert line 53.0 s lost to Chilli's 51.9 s ("Beat Chilli for more!"); level 1, expert line 37.5 s beat Chilli's 38.3 s. One screenshot from behind shows Chilli's colours; the scowl and the flames have not been looked at properly.
