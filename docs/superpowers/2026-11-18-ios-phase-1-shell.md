# iOS phase 1: Capacitor shell to TestFlight

Date: 2026-11-18. Status: approved 2026-11-18 and built on branch `ios`; TestFlight upload waits on the bundle ID. Background and sources: `2026-11-18-ios-app-research.md`.

## Intent

The game exactly as it plays today, running as an iPhone and iPad app from files bundled in the app, uploaded to TestFlight for internal testing. No races, purchase or multiplayer yet. This is an app-only build: the web-only parts are removed, not hidden.

## Decisions carried in

- Capacitor 8.6.2 with Swift Package Manager. Xcode 27.0 is installed and meets the requirement.
- Minimum iOS 16, iPhone and iPad, landscape only.
- Kids Category rules apply from this build: no third party SDKs, no network calls, no links out.
- Checkout: branch `ios` (Laravel Cloud deploys only from main, so the live site is untouched). Commit and push when green.
- The old iPad check is assumed fine for now and done when the device is to hand.

## Blocked on Nick

1. **Bundle ID.** A placeholder (`com.smoothiescramble.app`) is used until it arrives. Everything up to the simulator runs without it; the TestFlight upload does not.
2. **App record** created by hand in App Store Connect once the bundle ID is chosen.
3. **App Store Connect API key variables** (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`) available in the shell that runs fastlane. They are not set in this one.
4. **The live site.** Not an issue while this stays on `ios`. Merging to main will break the Laravel Cloud deployment (no `server.mjs`), so take the site down or disconnect the deploy before merging.

## Global Constraints

- No file-path header comments and no docblocks that restate the task; a doc comment only where it says something the code cannot.
- New behavioural tests are shown failing before the implementation and passing after. Any mock declares every call it expects.
- Commits name explicit paths. Never `git add -A`, `git add .` or `git commit -a`.
- Checks: `npm test`, `npm run typecheck`, `npm run build`. Focused tests while working, the full set once at the end.
- No analytics, crash reporting, remote content or live update plugin. Nothing is loaded from the network.
- Sending to TestFlight is run only after Nick says go.

## UI intent

No visual change to the game. Removed from the screens: the Add to Home Screen button, the full screen buttons on the menu and map, The "turn your screen" card stays: the app is locked to landscape, but a resized window on a newer iPad can still be taller than it is wide. The app opens full screen in landscape with no status bar, the home indicator dimmed, and a plain launch screen in the menu's sky blue (`#4cc0ff`) so the first frame does not flash white. The icon is a stand-in made from the smoothie cup by `tools/icons.py`; Nick is drawing the real one.

## Tasks

1. **Remove the web-only parts.**
   - Delete `src/sw.ts`, `src/ui/install.ts`, `server.mjs`, the PWA plugin and manifest from `vite.config.ts`, and the `vite-plugin-pwa` and `workbox-*` packages.
   - In `src/ui/screen.ts` keep only `setBackdrop`; remove the calls in `src/ui/menu.ts` and `src/ui/map.ts`.
   - Remove the web app meta tags and the `start` script. The rotate card stays.
   - Update `README.md` to describe the app build.
   - Acceptance: `npm run build` produces a `dist/` with no service worker or manifest; tests pass; the game still plays in the desktop browser with `npm run dev`.

2. **Add Capacitor and the iOS project.**
   - Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/preferences`.
   - `capacitor.config.ts`: app name "Smoothie Scramble", `webDir: 'dist'`, `ios.scrollEnabled: false`.
   - `npx cap add ios`, commit the `ios/` project, add an `ios` script (`npm run build && npx cap sync ios`).
   - Acceptance: the app builds and launches in an iPad and an iPhone simulator and shows the menu.

3. **Project settings.**
   - Deployment target 16.0, iPhone and iPad, landscape left and right only, status bar hidden, team `R4H9W7HRHW` with automatic signing, `ITSAppUsesNonExemptEncryption` false.
   - A `CAPBridgeViewController` subclass that hides the home indicator and defers edge swipes, set as the storyboard's controller.
   - Acceptance: no status bar, no rotation to portrait, and a swipe from the bottom edge during a run needs a second swipe to leave the app.

4. **Icon and launch screen.** App icon from the smoothie cup at 1024 px (extend `tools/icons.py`), launch screen in `#4cc0ff`.

5. **Save that survives web data being cleared.**
   - Every save is also written to Preferences; on launch, if `localStorage` has no save, restore from Preferences before the menu is shown.
   - Tests in `tests/progress.test.ts`: restore when local storage is empty, and local storage wins when both exist. Shown failing first.
   - Acceptance: clearing the app's web data and relaunching keeps stars, fruit and points.

6. **Behave like an app when interrupted.**
   - On Capacitor's `resume` event, resume the audio context and the music; confirm a run pauses when the app goes to the background.
   - On `webglcontextlost`, end the run and return to the map; on restore, runs work again.
   - Acceptance: background and return mid-run leaves a paused, playable run with sound; a simulated context loss returns to the map with no white screen.

7. **Privacy manifest.** `PrivacyInfo.xcprivacy` with UserDefaults reason `CA92.1`, no tracking, no collected data. Check Xcode's privacy report for anything Capacitor adds.

8. **fastlane.** `fastlane/Appfile` and `fastlane/Fastfile` modelled on `mamc-app`, iOS only:
   - `bump version:x.y.z` sets the version in `package.json` and the Xcode project and adds one to the build number.
   - `ios beta` builds the web game, syncs, archives `ios/App/App.xcodeproj` with automatic signing, and uploads to TestFlight.
   - Acceptance: `fastlane ios beta` produces a signed archive. The upload step is verified in task 9.

9. **Runtime verification.** Recorded here as PASS or FAIL with evidence.
   - `npm test`, `npm run typecheck`, `npm run build`: all green.
   - iPad and iPhone simulators with the Mac's network off: menu, map, a full run of level 1 with steering, results, blender, book. Music and effects play. Save persists across relaunch.
   - Tasks 3, 5 and 6 acceptance checks.
   - Real device (Nick): one run on a current device; frame rate and sound; later, the old iPad.
   - `fastlane ios beta` uploads and the build appears in TestFlight (after the blocked items are cleared and Nick says go).

## Results

Built 2026-11-18 on branch `ios`. Tasks 1 to 8 done; task 9 partly done, the rest waits on Nick.

Changes from the brief:
- The home indicator is not hidden by an override: Capacitor's view controller owns that setting and does not allow it. Deferring edge swipes dims the indicator and gives the "second swipe to leave" behaviour on its own.
- `fastlane ios archive` was added (build and sign without uploading). It has **not been run**: automatic signing would register the placeholder bundle ID on the Apple developer account.
- `UIRequiresFullScreen` is set so the iPad build may be landscape only.

Runtime verification:

| Check | Result | Evidence |
|---|---|---|
| `npm test` | PASS | 7 files, 806 tests, including 3 new `restoreSave` tests (seen failing first: "restoreSave is not a function") |
| `npm run typecheck`, `npm run build` | PASS | clean; `dist/` holds only `index.html` and `assets/` |
| Debug build, iOS simulator | PASS | `xcodebuild` BUILD SUCCEEDED, Xcode 27.0 |
| Release build for a real device, unsigned | PASS | `xcodebuild -configuration Release CODE_SIGNING_ALLOWED=NO` BUILD SUCCEEDED |
| Launch on iPad mini (A17 Pro) simulator | PASS | menu shown in landscape, no status bar, no install or full screen buttons (screenshot) |
| Launch on iPhone 17 simulator | PASS | same (screenshot) |
| Privacy manifest in the built app | PASS | `PrivacyInfo.xcprivacy` present in `App.app` |
| Full run of level 1, results, blend screen | PASS in desktop Chrome only | autopilot run finished in 42.18 s, 3 stars, Blend opened the blender, no console errors |
| Save copied to the backup on every write | PASS in desktop Chrome | backup value equals the save after the run |
| Save restored when the game's storage is wiped | PASS in desktop Chrome | removed the save, reloaded, level 1 record came back |
| Lost graphics context returns to the map | PASS in desktop Chrome | dispatched `webglcontextlost` mid-run: run ended, map shown |
| Play-through inside the simulator (touch steering, sound, offline) | NOT DONE | no tool here can tap inside the simulator; needs Nick in Xcode or on a device |
| Edge swipe needs a second swipe; no rotation to portrait | NOT DONE | needs a hand on a device |
| Background and return mid-run, sound resumes | NOT DONE | needs a device |
| Save survives clearing web data in the real app | NOT DONE | proven in the browser only; the native store is Capacitor Preferences |
| Real device frame rate; old iPad | NOT DONE | Nick |
| `fastlane ios beta` upload | BLOCKED | bundle ID, app record, API key variables |

Independent review (`/code-review medium`, 2026-11-18), 10 findings:

- Fixed: sound not resuming from the "interrupted" state after a call; a lost graphics context after the finish line discarding the result; a level starting while the surface is still lost; startup waiting for ever on the backup; save written to the backup before the game's own storage; signing flag missing from the export step; app version 1.0 against 1.0.0.
- Left as is: `beta` does not raise the build number itself (same as `mamc-app`: run `bump` first). (Superseded in round three: the newer copy now wins.) The hand-built window alongside the storyboard is Capacitor's own template. The duplicate constant name and settings are style only.
- After the fixes: `npm test` 806 passed, typecheck and build clean, simulator build succeeded. The fixes were not exercised on a device.

Second review round (scoped to the fixes), 9 findings:

- Fixed: the startup timeout could start a returning player on an empty game and then overwrite the backup, so the timeout is removed and the restore is waited for in full. The two save writes are now independent, so a full disk cannot stop the backup. The "surface lost" flag is replaced by asking the renderer directly; a level tap asks for the surface back once and reloads the game on the next try if it is still gone. A rejected sound resume is caught.
- Left as is: `export_method: 'app-store'` matches `mamc-app`, which releases with it today; the signing step stays unproven until the first real archive.

Third review round (scoped to the round two fixes), 10 findings. This round changed the design instead of patching:

- **Save:** every save is stamped with when it was stored. On launch the more recent of the game's own copy and the backup wins, and a copy that is missing or unreadable loses to any readable one. The two writes stay independent. Nothing is copied to the backup until the restore has answered; if it takes over 3 seconds the menu appears anyway, and a save that turns up late reloads the game with it.
- **Lost graphics surface:** no flag. A level tap asks the renderer; if the surface is lost it asks for it back and shows "One moment". Only if it has been gone more than 5 seconds does a tap reload the game.
- Left as is: none of the findings.

Evidence after round three (2026-11-18):

| Check | Result | Evidence |
|---|---|---|
| `npm test` | PASS | 810 tests. 4 new ones seen failing first: backup wins when newer, own save kept when newer, unreadable save replaced, backup still written and stamped when the game's own storage refuses the write |
| `npm run typecheck`, `npm run ios` | PASS | clean, sync finished |
| Real surface loss in desktop Chrome (`WEBGL_lose_context`) | PASS | run ended, next tap refused with the toast, surface came back, level then drew (pixel read back non-blank), no console errors |
| Newer backup wins on launch, desktop Chrome | PASS | own copy set to 1 point and an older stamp, backup to 777 points: game launched with 777 |
| Backup equals the save after a write | PASS | compared 200 ms after `persist()` |
| Any of this inside the app on a device | NOT DONE | Nick |

Fourth review round, 10 findings, most of them in the two-copy save design (timeout path, failed restore write, clock-based stamps, late reload). The design was the problem, so it is replaced:

- **Save: one store.** The save now lives only in the app's settings store (Capacitor Preferences) and is read once before the menu. No second copy, no stamps, no restore step, no timeout. This supersedes task 5 and everything about backups above. Accepted limit: if the native bridge never answers, the app stays on the launch colour; that is a broken install, not a state to design around.
- **Lost graphics surface.** The restore handle is held by the game (three.js drops its own after a restore, which broke a second loss). The 5 second wait runs from the first tap that asked, and a reload happens at most once in a row.

Evidence after round four (2026-11-18):

| Check | Result | Evidence |
|---|---|---|
| `npm test` | PASS | 806 tests. 3 new store tests seen failing first ("keepSavesIn is not a function"); the 7 two-copy tests are removed with the code |
| `npm run typecheck`, `npm run ios`, simulator build | PASS | clean; BUILD SUCCEEDED |
| Save round trip, desktop Chrome | PASS | level 1 finished and blended, reloaded: 4 stars and Carry On present |
| Two surface losses in a row, desktop Chrome | PASS | each: run ended, tap refused with the toast, surface restored, level drew |
| Inside the app on a device | NOT DONE | Nick |

Fifth and last review round, 10 findings, none in the save round trip itself. Reviews stop here.

- Fixed: the surface wait is cleared when the surface comes back, so an old wait cannot trigger an instant reload later; a misleading comment; a stale README line; a test restored for a store that fails (it passed at once, as the behaviour already existed: coverage, not new behaviour).
- Not changed, for Nick to know:
  - No migration from the old web storage key. There are no installed apps and no web version to migrate.
  - A failed write to the settings store is silent: the session plays on and that progress is not kept.
  - If the surface is still lost after the one reload, taps keep showing "One moment" until the app is restarted.
  - A real device loss is restored by the system, not by the game's ask; only the simulated loss is proven.
  - The launch waits on the settings store with no timeout (accepted above).
  - `clearSave` before a fresh save, and the module-level store, could be tidied away.
- After these: `npm test` 807 passed, typecheck clean.

Later on 2026-11-18:

- **Dark patch at fork joins fixed** (`2759bcb`). Cause: the road underside's lip stayed where a kerb was left out, and on a banked stretch stuck up through the other road. Evidence: a scan looking down on the road around every fork found 24 points of underside above the surface in level 3 before the fix and none after, and none across all 148 forks in the game; the spot in Nick's recording is clean in a screenshot from the same view. (A first version of the scan could not see the bug at all and was thrown away.)
- **Renamed to Smoothie Scramble**: home screen name, page title, config, README, fastlane file name. The placeholder bundle ID is now `com.smoothiescramble.app`. The menu artwork still has "Smoothie Adventure" painted in and needs new art from Nick.
