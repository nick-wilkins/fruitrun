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

## Round two: Nick's notes from two iPads, 2026-11-20

Build 4 connected and raced on two iPads. Nick's notes, and what was done:

- **Starting a game**: until somebody joins, the starter sees only "Waiting for other players…" and Cancel.
- **Colours**: each player has one colour, by seat, the same on every device and on their own marble: the starter green, then blue, orange, pink. The waiting room shows it and the race opens with "You are the blue marble!".
- **After a race nothing is blended or kept.** The card shows the time and the finishing order and one button back to the waiting room. This replaces the earlier decision that a friend race counts like a run of your own.
- **A joiner's game no longer changes**: racing a level with friends opens nothing, and saves no stars, fruit or times, on any device. This is what had opened level 13 on the second iPad.
- **Choosing again**: the starter picks the next race or closes the game; the others see "Waiting for Sam to choose a map…". When the starter closes it they see "Sam closed the game." and Back to map.
- **Cups with friends**: the starter can pick any cup they have open themselves. Four races, 10, 7, 5 and 3 points by finishing order, none for not finishing. The starter's device keeps the count and tells the rest, and a table is shown between races. No trophy is kept.
- Someone still looking at the last finishing order is taken into the next race; before, they sat it out.
- The messages changed, so builds 4 and 5 will not race each other: both devices need the new build.

Tests: 7 new in `tests/nearby.test.ts`. Six were shown failing first (cup table message, cup scoring, host only, single race drops the cup, newcomer sees the cup, whose game closed). The seventh, clearing a finished cup, was written after its code.

Run 2026-11-20, two tabs of the dev server, sound off, saves not written:

- PASS `tsc --noEmit`; 963 tests.
- PASS alone: "Waiting for other players…" and Cancel only.
- PASS colours: the waiting room shows green for the starter and blue for the joiner on both; the hints read "You are the green marble!" and "You are the blue marble!"; on the joiner's card their own row is blue and the starter's green.
- PASS cup: the starter, with the Peach Cup open, starts it; both race level 13, which the joiner has not opened. After everyone is home both show "Peach Cup: race 1 of 4 done" with 10 and 7 points. Next race starts level 14 on both, taking the joiner straight from the finishing order.
- PASS not finishing: the joiner leaves race 2; the table reads 17 and 10.
- PASS Stop the cup returns the starter to the choice of race or cup and the joiner to "Waiting for Sam to choose a map…".
- PASS nothing kept: after a cup race and a single race the joiner's save is identical, byte for byte, to before; the starter's has no new levels.
- PASS closing: the joiner sees "Sam closed the game." and Back to map leads to the map.
- NOT SEEN: the joiner's own marble painted blue on the road (the screenshot was taken after the finish). It uses the same painting as the friends' marbles.
- NOT RUN: any of this on devices.

Left as they are: the finishing card still carries the "Level complete!" banner and a green Pip; an exact dead heat shows each player first on their own card while the cup table goes by the starter's count.

The second iPad's save still has what the earlier builds wrongly gave it (level 13 and anything after). Nothing in the save says which records came from friend races, so it is not undone here.

## Review (`/code-review medium` on eb3b470) and fixes

Ten findings. Fixed:

- A cup race was never counted if the last player out dropped off, and a player who finished then left still took a place from those who stayed.
- A device that could not start the next race while showing the last finishing order was counted as racing, leaving the starter waiting for ever.
- A joiner home first was told the starter was choosing a map while the starter was still racing: now "The others are still racing…", updated as they come home.
- "Sam closed the game" was also shown for a lost connection: now "The game with Sam has ended."
- The progress bar stayed green for every player: it is the player's own colour.
- A friend race on a level in another world moved the joiner's map to that world.
- Tidies: one way back from the finishing card, shared place names, Pip's look marked on the seat instead of matched by colour.

Left: the finishing card for a friend race repeats some of the solo card's markup.

## Round three: splits and a helping hand, 2026-11-20

**Splits.** How it works: a side road starts to peel away, and 18 to 25 units of road later (a third of a second flat out, up to a second at cruising speed) the two roads have separated. At that point the ball is on whichever road it is nearer the middle of. Until then it can roll anywhere across both. Measured on level 2, by the time that choice is made the kerbs have already come apart, so there is no room for a later one.

What was forcing the choice: a swipe could not go past the main road's kerb before the side road began. A finger that swiped for the side road a moment early and then held still asked for nothing more when the road opened, so the ball stayed on the main road. Now a swipe can reach for a side road from about a second before it opens (40 units), is kept, and carries the ball across the moment there is road there. Pushing that way costs no speed, where pushing on a kerb does. A swipe made too late still meets the kerb.

Tried and dropped: letting a ball hop to the other road just after they part. The gap is already wider than the ball within two units, so it either did nothing or jumped a visible gap.

**A helping hand in friend races.** Research (Gran Turismo's Boost setting, Mario Kart 8's item bands by distance, Black Rock's write-up of Pure, a 2024 CHI study of balancing in a two-player racer) agrees on: help the one behind and never slow the leader; go by distance, not place; nothing when close; keep it small and capped; fade it out before the finish; say nothing about it. No source gave a figure for speed help between human players; the numbers here are a starting point to tune by play.

As built: nothing within 35 units of the leader, growing evenly to 6% more road covered for the same speed at 150 units behind. None in the first 4 seconds. It fades to nothing as the leader covers the last fifth of the course. It eases in and out over about a second. In the air and on escalators it does nothing. It applies only in races with friends.

Tests: 9 new (3 for splits, 4 for the helping hand, 2 for the review), each shown failing first. 972 pass.

Run 2026-11-20, dev server, sound off:

- PASS split, real touch events: on level 2, one swipe towards the side road made 20 units before it opens and then held still. The steering target reads -14.4 against a kerb at -4, no speed is lost, and the ball takes the side road.
- PASS helping hand, two tabs: the joiner, 5% of the course behind, reads a help of 0.026 and rising; the leader reads 0.
- PASS the joiner's progress bar is blue; their map stays on their own world; home first they read "The others are still racing…"; when the starter closes the game, "The game with Sam has ended." and Back to map.
- NOT RUN on a device: how the split feels under a finger, and whether 6% is felt at all.

## Review (`/code-review medium` on d428e5d) and fixes

Nine findings. Fixed:

- A full early swipe for a side road still scraped the kerb and lost speed (43.4 at the fork against 49.45): reaching for a road about to open now never scrapes, however hard the swipe.
- The swipe could run 10 units past the kerb, leaving a swipe back dead for a whole road's width: it now reaches 60% of the way to the side road, enough to take it.
- A player joining between races made the others read "still racing".
- The helping hand was eased by a timer's count: it now goes by the race's own clock, and stands still while paused.
- A friend whose reports had stopped still counted as the leader: one not heard from for two seconds is left out.
- The reach is only worked out when a ball is against a kerb.

Left: pushing on the outer kerb while a side road is opening, or on the main kerb just before one with keys or a mouse, costs no speed. `reach()` and `bounds()` share a shape. The cup table is sent twice when a leaver ends a race.

Re-verified 2026-11-20: `tsc` clean; 974 tests (3 new, shown failing first). Real touch events on level 2: a full swipe 38 units early gives a target of -10.7, arrives at the fork at 49.45 with no scrape, and takes the side road.

## Clearing what was left, 2026-11-20

Nick asked for everything left over to be fixed first.

- **Kerbs beside a split**: only a swipe may reach for a road about to open without losing speed. Keys and a mouse scrape as on any kerb. With the reach now 60% of the way over, the outer kerb of an opening side road scrapes again once the road is that wide.
- **Dead heats**: a tie goes to whoever sits nearer the starter, on every finishing card and in the cup count alike.
- **The friend-race finishing card** reads "🏁 Finished!" with no "Level complete!" banner, and its Pip is the player's colour. It shares its shell with the solo card.
- **Tidies**: the road's edges are worked out in one place for both `bounds()` and `reach()`; the cup table is sent once when a leaver ends a race.
- Two players with the same name are told apart by their colours, which are now the same on every device.

Not fixable here: the second iPad's save keeps the levels the earlier build opened. Still not done: a StoreKit test file.

Tests: 2 new, shown failing first; 975 pass. `tsc` and the build are clean. Browser: the solo results card is unchanged after sharing its shell; in an exact dead heat between two tabs both cards put the starter first; the joiner's card shows a blue Pip.

## Round four: from build 5 on two iPads, 2026-11-20

Nick's notes and what was done:

- **A friend's marble did not roll.** It now rolls at the speed their device last reported, and its leaves lean with it.
- **A friend went through crates and they stayed.** What any player smashes or knocks over (crates, pins) is now gone from every player's road, flying off as it did on theirs. Fruit and rings stay each player's own.
- **Nobody starts racing unready.** The starter picks a race, a cup or the cup's next race; nothing starts. Everyone else sees what was picked and one button, "I'm ready!". The race starts when all have tapped it. The starter sees a tick by each ready player and can pick again. A player who leaves instead is gone without.
- **The starter moves the screens on.** After a race only the starter's finishing card has a button, and only once everyone is home; the others read "Waiting for Sam…". The starter's tap takes everyone to the waiting room together. If the game has gone, every card gets its own Done.
- **Leaving is asked about.** Leave and Close game ask "Leave the game with your friends?" or "Close the game for everyone?" with Stay as the big button.
- The messages changed again: every device needs this build.

Tests: 10 new, each shown failing first (smash told to all, the smash message, a marble's speed, and seven for getting ready). 985 pass; `tsc` and the build are clean.

Run 2026-11-20, two tabs, sound off, saves not written:

- PASS the starter picks the Apple Cup: no race starts; the starter reads "Get ready!" with a tick for themselves and an hourglass for the joiner; the joiner reads "Sam picked a race, Apple Cup: Apple Orchard" with "I'm ready!". The tap starts level 1 on both.
- PASS smashes: the joiner drives through crates and pins 9, 10, 13, 16, 22, 58 and 70; the same seven are gone on the starter's road.
- PASS finishing: the joiner, home first, has no button and reads "Waiting for everyone to finish…", then "Waiting for Sam…". The starter, once all are home, has "Cup points ▶".
- PASS the starter's tap puts both in the waiting room with the table; "Next race" offers Banana Bend; the joiner's Ready starts level 2 on both.
- PASS leaving a race by the pause menu puts the joiner in the waiting room reading "The others are still racing…"; Leave asks first and Stay keeps them in.
- PASS Stop the cup, then a single race: offered and readied the same way.
- PASS rolling: given a report at speed 30, the friend's bubble turns over half a second of frames and its leaves lean.
- NOT RUN on devices.
