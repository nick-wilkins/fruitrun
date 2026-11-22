# A free taste of racing, and an unlock screen that shows what it opens

Date: 2026-11-22. Branch `ios`. Follows `2026-11-19-ios-phase-3-purchase.md`.

## Intent

Nick: it is not obvious what the £2.99 unlock gets you, and nothing sells how much fun it is. Let everyone try a race, let anyone join a friend's game, and show short films of a race, a cup and two people racing. It must stay obvious what is locked and how to unlock it.

## What changed

- **One free race.** Level 1 on Easy can be raced by anyone. On level 1 the Race button is live; its picker shows Easy open and the other speeds padlocked, each leading to the unlock screen. Every other level keeps its padlocked Race button.
- **Joining is free, starting is paid.** Together is no longer padlocked on the map. In its first screen, Start a game is padlocked for anyone without the unlock and leads to the unlock screen; Join a game works for everyone. A refund closes a game being hosted but leaves a joined one alone.
- **Cups are unchanged:** behind the unlock.
- **The unlock screen** is headed with what was asked for ("Races are locked", "Cups are locked", "Starting a game is locked"). On the left a film plays: a race, a cup, two friends racing, one after another, starting with the one asked for, with a name to tap for each. On the right: what the unlock opens, the price from the store, "paid once", and what stays free. Reached from a race, it also has "Try a free race".
- The price is now in front of the grown-up sum. Buying and Restore remain behind it. This reverses decision 2 of the purchase phase, at Nick's request.
- The films are `public/assets/video/{race,cup,together}.mp4` with a still each: 480 by 270, H.264, no sound, 1.1 MB in all. They were recorded from the game in the browser, driven by its own hands-free steering; the two-friends one from two tabs.

## Global Constraints

- No file-path header comments and no docblocks that restate the task.
- New behavioural tests are shown failing before the code and passing after.
- Commits use explicit paths.
- Browser checks run with sound off, in a browser profile of their own.

## Tests

`tests/shop.test.ts`, 3 new, shown failing first (`canRace is not a function`), then passing: anyone may race level 1 on Easy and nothing else; every race opens once owned; only an owner may start a game.

## Runtime verification

Run 2026-11-22 in the browser with the dev store.

Not owned, 844 by 390:

- PASS map top bar: Blend, 🔒 Cups, Together, Book.
- PASS level 1: Race is live; the picker says "Try a race for free! The faster ones come with the unlock." with Easy open and Medium, Hard, Legendary padlocked; Medium opens "Races are locked".
- PASS the gate itself: asking for level 2 on Easy, or level 1 on Medium, starts no run and opens the unlock screen.
- PASS Together: Start a game is padlocked and opens "Starting a game is locked" with no game started; the note says joining is free.
- PASS Cups opens "Cups are locked", with the cup film first and no free race button.
- PASS "Try a free race" starts the level 1 race.
- PASS the unlock card fits (147 to 697 across, 59 to 331 down) and the film plays.
- PASS joining: a tab without the unlock found and joined a game hosted by a tab with it, readied, and raced.

Owned: PASS the map, the race picker, Together and the "Races are open!" screen are as before.

At 1100 by 825: PASS the card fits and the film plays.

1001 tests pass; `tsc` and the build are clean.

NOT RUN: any of it on a device. To look at there: the films playing in place without sound on an iPhone and iPad, and a device without the unlock joining one with it.

## Review

`/code-review medium` on the whole diff: six small findings, all folded in.

- The support page said every player needs the unlock to play together: reworded (`docs/store/support.md`; the published copy needs updating by Nick).
- The Book hid the free race's result: it now shows race results whenever there are any.
- "Try a free race" could stall while the rivals were set up: they are set up when the screen opens. The tap took 41 ms.
- A cup race skipped the paid check inside `play`: a cup race now needs the unlock there too. PASS: asked for without it, no run starts.
- Back from "Starting a game is locked" went to the map: it now returns to Together. PASS.
- The films were untracked: committed with the rest.

## Reduce Motion (found from a tester's report the same day)

With Reduce Motion on, everything that bobs was buzzing: the rule cut every animation to 0.01 s but left the repeating ones repeating. Now a repeating animation runs once at its own length and rests, and one-off animations are left alone. PASS with Reduce Motion emulated: Pip on the first screen is `bob 1.3s` once, nothing is running two seconds later, and nothing on the map repeats.

1001 tests pass; `tsc` and the build are clean.
