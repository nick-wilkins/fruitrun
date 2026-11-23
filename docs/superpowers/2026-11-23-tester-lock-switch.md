# Tester switch: play without the unlock

## Intent

A purchase made through TestFlight cannot be cleared, so a tester who has unlocked can never see the locked game
again. Testers get a hidden switch that plays as if the unlock were not owned.

## What it does

- Grown-ups (past the sum) → hold the "For grown-ups" title for 2 seconds. A note says which way it went. Hold again
  to undo; "Restore purchase" or buying again also undoes it.
- Only in builds from Xcode or TestFlight (`StorePlugin.isTester`: a debug build, or a sandbox receipt). In an App
  Store build the plugin refuses and the hold does nothing.
- It can only shut the unlock, never open it: `isOwned()` answers false while the switch is on, otherwise the store's
  own answer.
- The choice is kept in `UserDefaults` (`tester.locked`), so it lasts across launches.
- In the browser on the dev server the stand-in store forgets or remembers its pretend purchase.

## Global Constraints

- No file-path header comments or task-restating docblocks.
- Commits use explicit paths.
- No new automated tests: the rule lives in the Swift plugin, which has no test target; the TypeScript is wiring.

## Runtime verification

- PASS, browser dev server: owned → short press changes nothing → 2s hold: not owned, note "Tester: playing without
  the unlock. Hold the title again to undo." → second hold: owned again.
- PASS: `xcodebuild` simulator build of the app with the changed plugin.
- PASS: `npm test` 1001 tests, after giving the cup tests a 20s limit (one timed out at 5s while the Mac was busy).
- NOT RUN on a device: the switch in a TestFlight build, and that it lasts across launches.

## Review

`/code-review medium`: one finding on this change (a second finger could orphan the hold timer; the switch could run
during a restore or after the dialog closed), fixed. It also raised older matters outside this change, left alone:
a join that sits on "Joining…" when the host has gone, and a failed roster read being overwritten by the next save.

## Note for release

App Review also runs builds with a sandbox receipt, so a reviewer could in principle find the switch. It gives
nothing away (it only locks), and it sits behind the grown-up gate and an unmarked 2 second hold.

## Changed for release, 2026-11-23

Nick chose to keep the switch out of anything Apple sees. From build 10 it exists only in a build run from Xcode
(`#if DEBUG`); TestFlight and App Store builds do not have it. Build 9 on TestFlight still does.
