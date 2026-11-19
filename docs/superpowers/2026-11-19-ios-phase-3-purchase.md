# iOS phase 3: the unlock purchase

Date: 2026-11-19. Status: building on branch `ios`. Background: `2026-11-18-ios-app-research.md` sections 6 and 7.

## Intent

The whole solo game is free, ghost included. One purchase opens everything with other marbles in it: single races, cups, and (when it is built) playing together on two devices.

## Decisions carried in

- Free: every level on your own, the ghost of your best run, the blender, the book. Paid: races, cups, multiplayer. (Nick, 2026-11-19.)
- One non-consumable at £2.99, Family Sharing on. Nick creates it in App Store Connect; the code expects the product ID `races_unlock` unless he says otherwise.
- StoreKit 2 in a small Swift plugin in the app target. No server, no third party SDK.
- Kids Category rules: Buy and Restore are reachable only through a grown-up gate.
- Branch `ios`. Commit and push when green. An upload to TestFlight waits for Nick's go.

## My choices, for you to overrule

1. **A locked player still sees Race and Cups**, with a padlock. Tapping either opens the unlock screen. Hiding them would hide the thing for sale.
2. **The unlock screen talks to the child, the buying is for the grown-up.** The child sees what they would get and one button, "Ask a grown-up". Behind the gate are the price, Unlock and Restore.
3. **The gate is a sum**: a two digit number times a one digit number, typed on a number pad. A wrong answer gives a new sum.
4. **Ask to Buy**: the screen says "Waiting for a grown-up to say yes" and the game carries on. Races open by themselves when the approval arrives, even days later.
5. **A refund locks races and cups again.** Trophies, medals and a cup under way are kept in the save and come back with a new purchase.
6. **Multiplayer is not mentioned on the unlock screen yet**; it is added when it exists.
7. **In the browser on the Mac** a stand-in shop is used so the flow can be tried: it remembers "bought" in the page's own storage. It exists only in the dev server.

## Tasks

1. `src/core/shop.ts`: what a purchase attempt does to the shop's state, and the grown-up sum. Tests first.
2. `racesUnlocked()` answers from the shop instead of always yes.
3. `ios/App/App/StorePlugin.swift` and its registration: product, owned, purchase, restore, a change event.
4. `src/platform.ts`: the shop, native or stand-in.
5. Unlock screen with gate, buying, waiting and restore; padlocks on Race and Cups; a race or cup cannot start while locked.
6. Runtime verification.

## Global Constraints

- No file-path header comments and no docblocks that restate the task.
- New behavioural tests are shown failing before the code exists; mocks declare expected calls.
- Commits use explicit paths.
- All browser checks run with sound off.
- No third party code is added.

## Runtime verification

Run 2026-11-19 on `ios`.

- PASS tests shown failing first: `npx vitest run tests/shop.test.ts` failed to load before `src/core/shop.ts` existed; after, 6 of 6 pass. Full suite: 935 passed.
- PASS `tsc --noEmit` clean.
- PASS signed iOS build with the plugin: `fastlane ios archive` exported `build/SmoothieScramble-1.0.0.ipa`; the binary contains `races_unlock`. No upload.
- Browser, dev server, sound off, stand-in shop, save not written:
  - PASS locked: map shows "🔒 Cups"; tapping it opens the unlock screen; asking for a race by hand opens the unlock screen and starts no run.
  - PASS gate: a wrong answer gives a new sum and shows no Unlock button; the right answer shows Back, Restore purchase, Unlock for £2.99.
  - PASS waiting (Ask to Buy): shop is pending and not owned, the screen says a grown-up is being waited for, a race still cannot start.
  - PASS cancelled: nothing changes, the dialog stays. Failed: "That did not go through. Please try again."
  - PASS restore with nothing owned: "No purchase was found for this Apple account."
  - PASS bought: "Races are open!", map shows "Cups", the cups screen opens, a race starts with three rivals.
- NOT RUN, needs a device: the real StoreKit sheet, price from the store, a sandbox purchase, restore after reinstall, Ask to Buy approval arriving later, a refund locking races again. These need a TestFlight build and a sandbox Apple account.
- NOT DONE: a StoreKit configuration file for offline testing in Xcode. The sandbox through TestFlight is the test instead.

## Review (`/code-review medium` on 56c8dca) and fixes

Ten findings. Fixed:

- The dialog could be closed by a tap outside it while the store was answering, losing the answer: it now stays until the answer is shown.
- The game waited on the store before showing its first screen: it no longer waits. Ownership is asked at launch and again each time the app comes back.
- An ownership change rebuilt whatever screen was up, emptying a half-filled jug: now only the map, cups and unlock screens are rebuilt.
- A change arriving before the page was listening was lost: the plugin keeps it until it is heard.
- The wait for a grown-up was forgotten on restart and never ended after a no: it is remembered for a day, then dropped.
- A late price lookup could overwrite "One moment…" during a purchase.
- A cup could be entered in the save before the lock turned it away.
- The locked Cups button now greys like the locked Race button.

Left: the lock is checked in `show`, `play` and `startCup` rather than one place (to be gathered when multiplayer adds its own way in). A production web build has no store, so races there are locked with no way to buy: this matters only if `ios` is ever merged for the web.

Re-verified after the fixes, 2026-11-19:

- PASS `tsc --noEmit`; `fastlane ios archive` exported a signed build; no upload.
- Tests: 935 passed on three runs. One earlier run, straight after the Xcode build, showed 1 failure that did not repeat and was not identified.
- PASS browser: owned is picked up after a reload; a pending approval is still shown after a reload; an ownership change while in the blender leaves the blender alone; locked Cups carries the `locked` style.
