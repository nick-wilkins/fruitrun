# Players, best times, ghosts and cups

Date: 2026-11-19. Branch: `ios`. Owner: Claude, with Nick's decisions below.

## Why

Give a reason to keep racing over weeks: your own times to beat, a ghost of your best run to chase, cups to win at each difficulty, and a save per child so siblings on one iPad each have their own.

## Nick's decisions

- The leaderboard is the player's own times: each level keeps that player's top five.
- Saves and loads means player profiles: several named players on one device, each with their own stars, fruit, records, ghosts and cups.
- Cups (grand prix): yes. Ghost of your best run: yes.
- No online leaderboard (Kids Category, no accounts, no server).

## Global Constraints

- No file-path header comments or task-restating docblocks; comments are plain-English one-liners saying why.
- New behavioural tests are shown failing before the code and passing after. Mocks declare expected calls.
- Commits use explicit paths, never `git add -A`, `git add .` or `git commit -a`.
- All browser checks run with sound off; the test page is left on `about:blank`.
- Nothing typed by a child leaves the device. A player's name is stored only in the app's own settings store.
- An existing save must survive: the one save on a device today becomes the first player, untouched.
- TestFlight and App Store uploads are Nick's.

## Stage 1: players and top five times

- `src/core/players.ts`: a roster of up to four players, each `{ id, name, save }`, with the one currently playing. Stored as one document under a new key; the old single save is read once and becomes "Player 1" if no roster exists. The old key is left alone.
- Home screen: Carry On goes straight to the map with one player, or asks "Who's playing?" with several. Start New asks for a name and adds a player; it no longer wipes anything. Players can be removed from the picker, after a confirm.
- Each level record keeps the five best times with the day they were set, on the current course layout. The level card gets a Times button listing them; the results card says where a new time ranks.
- Acceptance: a save from before this change loads as Player 1 with everything intact; two players' progress never mixes; removing one leaves the others; a sixth-best time is not kept; a failing store never stops play.

## Stage 2: ghost

- While playing, the marble's place on the road is sampled a few times a second. On a new best time the samples are kept for that player and level, in their own entry in the store (not inside the main save, to keep it small).
- A run on your own (not a race) shows the ghost of your best as a see-through marble, with no contact and no effect on the course. A switch on the level card turns it off.
- Acceptance: the ghost crosses the line at the best time to within a tenth of a second; it never bumps, smashes or collects; a ghost from an older course layout is ignored.

## Stage 3: cups

- A cup is four levels raced back to back at one difficulty. Points per place 10, 7, 5, 3. Standings are shown between races; rivals carry their points through.
- One cup per stretch of each map, open once its levels have been finished. A trophy (gold, silver, bronze by final position) is kept per cup per difficulty.
- A cup in progress can be left and carried on later from the next race.
- Awards: first cup, gold at each difficulty, every cup in a world, a perfect 40.
- Built after the rival difficulty tuning lands, since points only mean something once Hard is hard.
- Acceptance: points and standings add up; a cup left part-way resumes at the right race with the right points; trophies never downgrade.

## Runtime verification

Recorded here per stage with PASS or FAIL: the real screens in desktop Chrome with sound off (add a player, switch, remove, set times, watch a ghost finish, run a cup through), plus `npm test`, `npx tsc --noEmit`, `npm run build`.

## Results

### Stage 1: players and top five times (2026-11-19)

- RED: `tests/players.test.ts` failed (no `players` module). GREEN: 10 tests; one expectation of mine corrected (a 12-letter cut that ends in a space is trimmed to 11). `tests/progress.test.ts` lost its two single-save store tests, now covered by the roster ones.
- `npx vitest run tests/players.test.ts tests/progress.test.ts tests/awards.test.ts`: 42 passed. The full suite was not run for this stage: the rival tuning agent had `tests/race.test.ts` and `src/game/rivals.ts` mid-edit in the same checkout.
- Runtime, desktop Chrome, sound off: PASS. The existing save loaded as "Player 1" with its 2 levels and 74 fruit, and the old key was left in place. Start New asked for a name, "  Sam  " became Sam with a blank map; the store then held Player 1 (2 levels) and Sam (0). Carry On showed "Who's playing?" with both and their stars. Removing Sam asked first, then left Player 1 playing with everything intact. The level card's best time opened the Best times list.
- Not checked: the on-screen keyboard for the name box on a real iPhone or iPad, and the results card's "Your 2nd best" tag (needs a finished run).
- Left for Nick's eye: removing a player is behind a simple confirm, not a grown-up gate.

### Stage 2: ghost (2026-11-19)

- Built: `src/game/ghost.ts` (recorder, text form, replay), drawn in `src/game/run.ts` as a see-through white marble, kept per player and level by `ghostStore` in `src/platform.ts`, loaded during the countdown of a run on your own, switched on or off from the level card. It is saved when a new best is kept ("Keep and blend"), like the rest of the result. A player's ghosts are cleared when they are removed.
- RED: `tests/ghost.test.ts` failed (no `ghost` module). GREEN: 4 tests. Tolerances I first guessed were tighter than a tenth-of-a-second sampling can give and were set to what it does: within 1 along the road (half a marble) and 0.8 across.
- Size: 3.4 KB for a 42 second run; under 12 KB for the longest tested.
- Runtime, desktop Chrome, sound off, a throwaway player: PASS. First run 41.87 s kept and blended: one ghost entry written. Second run: the ghost loaded with time 41.867 and was on the road from the start to the finish; seen in a screenshot beside the player. Removing the player removed the ghost entry and left Player 1 untouched.
- A race does not show the ghost, but a best time set in a race still becomes the ghost.
- Not checked: on a device; the feel of chasing it is Nick's call.

### Stage 3: cups (2026-11-19)

Built ahead of the difficulty tuning after all: the rules do not depend on it, only how the points feel.

- `src/core/cups.ts`: 19 cups of four levels (5 in Sunny Meadow, 6 in Tropical Falls, 8 in Blossom Village; a world's last cup takes its last four levels, sharing one or two with the cup before). Named after the first level's fruit. Points 10, 7, 5, 3; level on points, the player is ahead. The cup under way and the trophies live in the player's save.
- `src/ui/cups.ts`: a Cups screen (from the map's new Cups button) with every cup, its three trophy slots and a "carry on or give up" strip for a cup under way; a points table after each race; a trophy card at the end.
- In a cup the results card has one button, "Cup points", which keeps the run and scores the race. Leaving a race before the line, or closing the app before pressing it, leaves the cup at that race.
- Awards, new "Racing" group: race wins (1, 10, 50), a win on Hard, sweeps (1, 10, all), cups finished (1, 10), gold trophies (1, 10), gold on Hard, Perfect Forty.
- RED: `tests/cups.test.ts` failed (no `cups` module); the awards test failed with `expected [] to include 'race-wins-1'`. GREEN: 6 tests.
- Runtime, desktop Chrome, sound off, a throwaway player with six levels finished: PASS. Cups screen listed 19 cups, one open. Apple Cup on Easy run through the real game loop: four races in order (Apple Orchard, Banana Bend, Strawberry Fields, Orange Grove), the hint named the cup and race each time, the table after each race added up (10, 20, 30, 40 for four wins; rivals 22, 20, 18), the trophy card showed gold, the save held `cup-0-1: easy 1`, and the awards Cup Runner, Going for Gold and Perfect Forty were earned. The player was then removed, leaving Player 1 untouched.
- Not checked in the browser: carrying a cup on after leaving it (covered by the unit test), losing a cup, a phone-sized screen.

### Review (`/code-review medium`, one round over players, ghost, cups and the rival retune, 2026-11-19)

Fixed:
- A cup race could be restarted from the pause menu until it was won: the restart button is gone in a cup, and the way out reads "Leave the cup for now". Leaving before the line still means that race is run again on carrying on.
- Cup awards were earned silently: they now come back with the cup result and show on the trophy card.
- A finisher whose name matched no rival would have scored for the player: now scores for nobody.
- Five cup names were used twice across worlds: a cup now takes the first fruit among its levels not already used.
- The day a best time was set was kept in UTC and shown as local: now the player's own date.
- Removing the player whose turn it was left the sound as they had it.
- Rivals (from the retune): the "keep to the main road" scouting run could wander down a side road; small sideways moves under one unit undershot; the search for how keen a rival should be kept stale limits after the driver itself was changed.

Left, with reasons:
- A player whose stored save cannot be read is dropped, and an unreadable roster falls back to the single save from before players. Both need the settings store itself to be corrupted; falling back to an old save beats starting with nothing.
- Each world's last cup shares levels with the one before it (the worlds do not divide by four).

After the fixes: `npm test` 922 passed, `npx tsc --noEmit` clean.
