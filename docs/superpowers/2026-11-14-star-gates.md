# Stars needed to move on, Retry or Blend, fork kerbs

Brief and results (14 Nov 2026).

## Intent

Nick: a small black triangle remains after a split rejoins; a certain number of stars should be needed to move on, explained to the player ("2-3 stars early on, sometimes 4, and now and again (near the end of worlds) 5, its not linear"); after a course offer only Retry or Blend, with the map reachable from pause; retrying loses what the run earned; words in pills vertically centred, always.

Decisions (mine):

- Each level has a `need`. Sunny Meadow: 2 2 3 2 3 3 2 3 4 3 3 4 3 4 3 4 5 4. Tropical Falls and Blossom Village start at 3, with five asked once and four times respectively, near their ends.
- A level already played stays open, so existing saves lose nothing.
- A finished run is worked out on a copy of the save and only kept when the player chooses "Keep and blend". Retry discards it: fruit, pickups, stars, awards and best time.
- Centring uses `text-box: trim-both cap alphabetic` where the browser supports it (Chrome and Safari do), with flex centring as the fallback.

## Global Constraints

- No file-path header comments or task-restating docblocks.
- New behavioural tests demonstrate RED then GREEN; no mocks.
- Commits use explicit paths.
- Tests: `npm test`.

## Results

- Star gates: tests first (4 failed, then passed). Shown on the level card, in the HUD ("Keep 2 to move on", with that star ringed), on the results card, as a red "needs 2★" tag on the map node, and in the message when a locked level is tapped.
- Fork kerbs: arm kerbs now hand over to the main road's with no gap. Checked from above in Chrome at the rejoin on level 33, the level in Nick's screenshot.

## Runtime verification

`npm test`: 802 passed. Chrome, fresh save:

- PASS a one-star run on level 1 shows "You need 2 stars here to open the next level. You got 1." with only Retry and Keep and blend; nothing is saved while the card is up.
- PASS Keep and blend saves the run and opens the blender; the map then shows "needs 2★" under level 1 and tapping level 2 says how many stars are needed.
- PASS a quick run shows "Next level open!"; Retry from there leaves the save exactly as it was and restarts the level.
- Not checked: a real iPad.
