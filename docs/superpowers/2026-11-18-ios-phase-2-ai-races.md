# iOS phase 2: AI races

Date: 2026-11-18. Status: brief awaiting approval. Background: `2026-11-18-ios-app-research.md` section 4.

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

Not started.
