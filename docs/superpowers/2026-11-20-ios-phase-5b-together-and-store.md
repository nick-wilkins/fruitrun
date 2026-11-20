# iOS phase 5b: finishing playing together, and what the store needs in the app

Date: 2026-11-20. Status: built on branch `ios`, not uploaded. Follows `2026-11-19-ios-phase-5a-nearby-spike.md` and `2026-11-19-ios-phase-3-purchase.md`.

## Intent

Make the play together screens fit for a child, sell playing together on the unlock screen, and give a parent the one place the store expects: what the game collects, restore, and links to the privacy and help pages.

## Decisions from Nick, 2026-11-20

- Every device needs the unlock; Family Sharing covers siblings.
- A joiner may race a level they have not opened.
- A friend race gives what a run on your own gives.
- Retry and Quit go back to the waiting room.
- The app goes in the Kids Category. So: no third party code, no analytics, and every way out of the app sits behind the grown-up gate.

All four game decisions match what build 3 already does. No code changed for them.

## Decisions made while Nick was away

- **The first-time explainer is its own small dialog**, shown once per device before the first Start or Join, because a no to the system's question can only be undone in Settings.
- **"Race three friends" on the unlock screen became "Race three speedy marbles"**, so "friends" means real ones now that they can be played with.
- **The grown-ups section sits on the first screen**, top left, behind the same sum as the purchase. The gate moved to `src/ui/gate.ts` so both use one.
- **Privacy and Help buttons appear only once their addresses are set** in `src/data/links.ts`. They are empty until Nick says where the pages live. The section already says in plain words what the game collects.
- **No StoreKit test file.** The project has no shared Xcode scheme to attach one to, and it could not be tried without running the app from Xcode. The TestFlight purchase Nick is about to make is the real test; the file is worth adding only if that fails and needs debugging.
- **The lock is one helper**, `shut()`, used by `play` and `startCup`; `show` turns the paid screens away by a single list.

## Tasks

1. Unlock screen and purchase dialog mention playing together.
2. Play together: two picture buttons, first-time explainer, waiting rooms that say what the friend should tap.
3. Grown-ups section behind the gate; gate shared.
4. Lock check gathered.
5. Drafts for Nick to host: `docs/store/privacy-policy.md`, `docs/store/support.md`.
6. Runtime verification.

## Global Constraints

- No file-path header comments and no docblocks that restate the task.
- New behavioural tests are shown failing before the code exists; mocks declare expected calls. (This phase is screens and wording over tested logic: no new tests.)
- Commits use explicit paths.
- All browser checks run with sound off; the save is not written.
- No third party code is added.

## Runtime verification

Run 2026-11-20 on `ios`, dev server, sound off, stand-in shop and transport.

- PASS `tsc --noEmit`, `npm run build`, 956 tests.
- PASS locked: Together leads to the unlock screen, which lists playing together; a race and a friend race asked for by hand start no run; a run on your own still starts.
- PASS play together, first time: tapping Start a game shows "One thing first" and hosts nothing; OK starts hosting and is not shown again.
- PASS join through the buttons: the second tab finds "Player 1's game", joins, and reads "Waiting for Player 1 to press Start…".
- PASS four players in four tabs: all four listed everywhere; Start puts each in its own grid slot (-3.3, -1.1, 1.1, 3.3) with three friends on the road.
- PASS one of the four quits mid-race: back in the waiting room still joined; the others show them gone and leave them off the result.
- PASS results agree: host's card "1st Player 1 0:38.6, 2nd You 0:43.9, 3rd Ada 0:46.5"; the winner's card "1st You 0:38.6, 2nd Player 1 0:43.9, 3rd Ada 0:46.5", filled in by itself as the others came home.
- PASS grown-ups: the chip on the first screen opens the sum; the right answer shows what the game collects and Back. With the unlock owned no Restore is offered; with no addresses set no Privacy or Help is offered. Locked: a wrong answer gives a new sum; the right one shows Restore purchase, which with nothing owned answers "No purchase was found for this Apple account."
- NOT RUN, needs devices: unchanged from phase 5a (the real connection, the system's Local Network question, smoothness, backgrounding), and Restore from the grown-ups section against the real store.

## Seen and left

- Two devices whose players are both called "Player 1" read alike in the waiting room; only the colour tells them apart.

## Review (`/code-review medium` on f654b6d) and fixes

Nine findings, all fixed:

- The wording said nothing leaves the room. A game is announced under the player's name to devices close by or on the same Wi-Fi, so the explainer, the grown-ups section and the privacy draft now say that.
- A refund while a game was open left it open with no screen to close it: losing the unlock now closes the game.
- The told-once note was kept where the device can clear it: it is now in the app's settings store.
- Restore in the grown-ups section could be missing for an owner whose answer from the store had not arrived, and was a second copy of the wording: it is always offered and the wording is shared.
- "Waiting for X to press Start" was untrue while X was racing: now "to start a race".
- The Grown-ups chip was too small to tap on a phone: 44 points tall at iPhone width.
- The help draft's way to remove a player did not work with one player.
- Two small tidies in the play together screen.

Re-verified 2026-11-20: `tsc` clean, 956 tests. Browser: the note shows once and is remembered in the settings store; the unlock going while hosting closes the game and shows the unlock screen; the chip measures 118 by 44 at 844 wide.

## For Nick

- A game is announced under the player's typed name. The alternative is a made-up name such as "Blue marble's game" until friends have joined. Kept as is, and disclosed.
