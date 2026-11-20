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

## Review (`/code-review medium` on 06bec01) and fixes

Ten findings. Fixed:

- A starter who left the race early never brought the others in from the finishing card: now they are brought in when the last one comes home.
- One stalled player locked everyone on the finishing card with no way out: anyone waiting there has a "Waiting room" button, where Leave and Close game are.
- A Ready tapped for one pick could be counted for the next: picks are numbered and a ready is for one pick only.
- The leave question vanished whenever the game changed, and a race could start under it: it is kept up across redraws, and dropped once a race has started.
- A pick told again with the roster reset who was ready for a moment.
- A pick that could not be started left the others waiting: such a pick is refused, and a start that fails calls it off for everyone.
- A friend whose reports stopped went on spinning on the spot for two seconds: now a quarter of a second, as long as it is rolled on for.
- Starting a race by any route clears the pick; the player list is built in one place.

Left: each crate or pin knocked is its own message, so a rack of ten pins is ten small messages. `start`, `startCup` and `nextRace` stay public: the tests drive them.

Re-verified 2026-11-20: `tsc` clean; 988 tests (3 new, shown failing first). Two tabs: the leave question stays up when the starter picks a race underneath it; a starter who leaves the race is in the waiting room, the joiner's card reads "Waiting for Sam…" with a "Waiting room" button, and the joiner is brought into the waiting room by itself on finishing.

## Round five: holding back, and shared fruit, 2026-11-20

**Holding back (new, in every kind of run).** Drawing the steering finger back down the screen slows the ball: nothing for the first 8% of the screen's height, all of it by 22%. The down arrow or S does the same. At its hardest it takes 45 off the speed each second, down to a roll of 14 and no slower: the ball never stops. It ends a turbo. It works in the air, where the ball also falls twice as fast, so a jump can be cut short to land on a speed pad. Letting go, the ball picks up again as usual. The hint at the start of a run mentions it. Nick's intent: go over a jump, then choose to come down early for a speed-up.

**Fruit a friend takes** vanishes on every player's road with a small sparkle and is back half a second later, the same as when a computer rival takes one. Rings stay each player's own.

Tests: 5 new, shown failing first. 993 pass; `tsc` clean.

Run 2026-11-20, dev server, sound off:

- PASS holding back, real touch events on level 1: a finger moved down 5% of the screen does nothing; 15% reads half; 30% reads full and the speed falls from 36 to 14 and holds there, still covering 14 units a second; lifting the finger, the speed is back to 26 in a second and a half.
- PASS fruit, two tabs: the joiner takes 5 fruit; the starter's road loses the same 5.
- NOT RUN: how far down a child's finger wanders while steering. If the ball slows when nobody means it to, the 8% is the number to raise.

## Review (`/code-review medium` on 48255fd) and fixes

Nine findings. Fixed:

- A feather-light pull was quicker than no pull: it switched off the rules that bleed off speed over the limit. Holding back is now only ever speed taken off on top of the usual rules.
- The lightest touch ended a turbo: now only a pull of half or more does.
- A pad landed on while still pulling was wasted, which is the very thing holding back is for: after any pad, holding back does nothing for half a second.
- Holding back across a gap dropped the ball into it to skip along thin air: it does nothing while the ball is flung across a gap.
- The pull was measured from where the finger landed, so a thumb resting low could not pull all the way and a finger drifting down braked for good: it is measured from the highest the finger has been, there is always room below to pull fully, and a slow wander down (under 5% of the screen a second) takes the mark with it.
- Letting go of one of two held keys released the brake.
- Everything a player smashes, knocks over or takes is sent together a few times a second: a row of fruit is one message.

Left: a fruit two friends reach at the same moment can be had by both, and on the taker's own road it does not come back while on the others' it does. Nothing is kept from a friend race, so neither changes a result.

Re-verified 2026-11-20: `tsc` clean; 997 tests (4 new, shown failing first). Real touch events: a finger landing at 85% down the screen reads no pull, and 0.92 at the bottom edge; a finger wandering 18% down over five seconds never reads a pull; a quick pull reads full; lifting reads none.

## Sanity pass: playing together and playing alone, 2026-11-20

Nick asked for a check that a game with friends cannot drift into a weird state, in particular a player ending up alone or against the computer without anyone being told.

Found by reading and fixed:

- **A way onto the map while still counted in.** If the device took the drawing surface away mid-race, the player was put on the map but stayed in the game: free to start a race against the computer while friends waited on them. Now it is the waiting room. And as a rule for every route: showing any screen but the waiting room, or starting any run that is not the friends' race, leaves the game first.
- **Nobody was told when a friend left.** Everyone still in now sees "Ada has left the game."
- **Racing on alone after the game had gone.** If the starter closed the game mid-race the others raced on by themselves with a two second note. Now the race stops and they see "The game with Sam has ended." with Back to map. The same if the last friend leaves mid-race: back to the waiting room.

Walked with real button presses, two tabs, sound off, saves not written:

- PASS join by the buttons; Leave asks, and on yes the joiner is on the map and out; the starter sees "Ada has left the game." and "Waiting for other players…".
- PASS a single race: nothing starts on the starter's pick; the joiner's Ready starts it; afterwards the starter has Race again or Close game, and the joiner waits or leaves.
- PASS surface lost mid-race: the joiner is in the waiting room, still in the game, reading "The others are still racing…".
- PASS forced to the map by code while joined: the joiner is out of the game and the starter is told.
- PASS the starter leaves the race by the pause menu and closes the game (it asks first): the joiner's race stops on "Game over. The game with Sam has ended." and Back to map; from the map a level starts as a run alone with no friends and no rivals.
- PASS alone: a level ends on Retry and Keep and blend, and blending opens the blender; a race has three rivals and the same two buttons; a cup against the computer goes to the points table with Next race.
- NOT RUN in the browser: the last friend leaving mid-race sending the starter to the waiting room (it uses the same step as the case above).

Tests: 1 new, shown failing first. 998 pass.

## Picture pickers and the cup line-up, 2026-11-20

Nick asked for a cup to show its four races as a graphic, Mario Kart style, alone or with friends, and for the starter's choosing to suit a six or seven year old: choose cup or single race, then swipe through cards.

- `src/ui/cards.ts`: a race as a picture card (its fruit, number, name, weather, a sky for its mood), a cup as a card (trophy with its fruit), a cup's four races as a numbered row with arrows, and a row of cards to swipe through, the middle one forward and the others turned away. Arrows either side do the same as a swipe, and tapping a side card brings it to the middle.
- With friends, the starter first chooses "One race" or "A cup" on two big buttons (the cup one is locked until a cup is open), then swipes through races or cups. Under the cups, the chosen cup's four races are shown. Back returns to the first choice.
- "Get ready!" and "Sam picked a cup" show the race as its card, or the cup's four races with this one glowing and those already run ticked. The table between cup races shows the same row.
- Alone, choosing a cup shows its four races above the speeds; carrying on with a cup shows them with the next one glowing.

No new tests: these are screens over tested rules. 998 pass; `tsc` and the build are clean.

Seen in the browser, 2026-11-20: the two big buttons; the race row with Strawberry Fields in the middle and its neighbours turned away, moved on by the arrow; the cup row with the Grapes Cup's four races beneath, changing with the cup; the joiner's "Sam picked a cup" with race 1 glowing; the solo cup dialog with the four races.
NOT RUN: swiping with a finger (the row scrolls natively; only the arrows were pressed).

## The cups screen on painted shelves, 2026-11-20

From Nick's asset pack (`smoothie_scramble_cups_asset_pack.zip`) and mock-up, plus a Blossom Village shelf he sent after.

- Each world's cups stand on that world's painted shelf, under a wooden sign with its name. The cups in a row can be drawn sideways with a finger; the screen still scrolls up and down between worlds.
- A cup that can be entered is gold with its fruit on it; one still shut is grey with its fruit greyed and a padlock. A cup won at every speed is the pack's prize cup.
- Under an open cup: a star for each speed, lit once a trophy is won at it, with the medal won beside it; Legendary's star is padlocked until it opens. Under a shut cup: which levels to finish and how many of the four are done.
- The first cup still shut is flagged "Next up!". The red "Cups" ribbon sits on top of the frame.
- Used from the pack, converted to WebP in `public/assets/cups/`: the two shelves, the three cups, the four stars. The village shelf came with a black background, which was cut away.
- Not used: the pack's plinth (too pale to read on the wood, with a stray orange arc; drawn in the game's own style instead) and its leaf and flower overlays (each has a smear of green behind it). The pack's own notes warn its edges need checking.

No new tests: a screen over tested rules. Seen in the browser: three shelves with 19 cups; a row scrolls sideways; an open cup opens its line-up; a shut one says what to finish.

## The cups screen, second pass with Nick's two new sheets, 2026-11-20

Nick sent two sprite sheets (shelves, cups, plinth, stars; vines and flowers) painted on a blurred background, and asked for a critical pass.

Cutting them out: the Mac's subject detection found almost nothing on a sheet. What worked was following the sprites' firm outlines: the soft background has no edges, so it floods away from the picture's border and stops at each outline. The results were checked on a bright background before use. Grey rocks on the grey part of the background were lost, and the prize cup kept specks of its glow, so the pack's prize cup is kept.

What was wrong with the first pass, and what changed:

- The plinths were drawn in code because the pack's was unusable. The sheet's wooden plinth is now used, with the cup's name on its label.
- The stars' words made the panels wider than their cups, so they ran into each other and the first was cut off at the shelf's end. Panels are now the width of their cup.
- The medal won was a speck on the corner of each star. Now the star itself is gold, silver or bronze, and one not yet won is a ghost.
- What hung under one shelf ran into the next shelf's sign. There is room for it now.
- At phone size the words under the stars were 6 pixels high. Below 760 wide the words go and the stars are bigger; names and the levels to finish are larger.
- Added from the sheets: flowering vines over the frame's top corners (taps pass through them; the close button stays on top), and each world's flower on its sign.
- The shelves themselves were re-cut from the new sheet, without the hazy fringe the first ones had.

Seen in the browser at 1100 by 620, 1100 by 825 and 844 by 390: three shelves, a prize cup, a cup with silver, bronze and gold stars, an open cup with none, shut cups with their bar, and "Next up!" on the first shut one. An open cup opens its line-up; the close button is what a tap in its middle reaches. 998 tests pass; `tsc` and the build are clean.

Still true: on an iPad the whole screen sits in a 16:9 window with bands above and below, until the backgrounds are redone at 4:3.

## The first 4:3 background

Nick's new first-screen picture (2732 by 2048, full colour) was checked: sharp at full size, the same scene as the old one extended up and down, and the middle band an iPhone would show holds the cottage, lake, mountain and waterfall. Good to use. Not wired in yet: the screens still fit inside the device rather than filling it.

## Cups screen: softening the ends of each row, 2026-11-20

Nick's screenshots showed cups and their panels cut off at a straight vertical line at each end of a row. Now the row fades out over its last 4 units at each end, and each world's plants stand in front of both ends (daisies for the meadow, hibiscus and a monstera leaf for the falls, pink hibiscus and daisies for the village), so cups slide out from behind leaves. The plants sit inside the frame so they are not cut themselves, and taps pass through them. Seen in the browser with both rows scrolled: no straight cut at either end.

## The first taller map: Tropical Falls, 2026-11-20

Nick sent Tropical Falls extended to 4:3. Measured against the old picture: the old one sits across the full width of the new, from 11.05% to 86.0% of its height (a mean difference of 11 in 255 at the best fit, and the level spots line up by eye).

How it is wired: a world may now carry a taller painting and where the 16:9 picture sits in it. With one, the map screen is as tall as the device allows, from 16:9 up to 4:3. The painting is always 4:3 and rides up behind the screen so that on a 16:9 screen exactly the old picture shows, and on a 4:3 screen all of it does. Level spots and the blender stand are placed on the painting, so they stay on their painted places at every shape. The top bar and the corner buttons stay at the screen's edges.

Seen in the browser: at 1100 by 620 the map looks as before with every spot on its stone; at 1100 by 825 it fills the screen with more sky and river and the spots are still on their stones.

To do: the file pasted was 1448 by 1086, smaller than the old map (1672 wide). The full-size original is wanted. The meadow and village maps, and every other screen, still sit in a 16:9 window. A phone wider than 16:9 still has bands at the sides.
