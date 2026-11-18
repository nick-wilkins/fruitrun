# iOS phase 1: Capacitor shell to TestFlight

Date: 2026-11-18. Status: brief awaiting approval. Background and sources: `2026-11-18-ios-app-research.md`.

## Intent

The game exactly as it plays today, running as an iPhone and iPad app from files bundled in the app, uploaded to TestFlight for internal testing. No races, purchase or multiplayer yet. This is an app-only build: the web-only parts are removed, not hidden.

## Decisions carried in

- Capacitor 8.6.2 with Swift Package Manager. Xcode 27.0 is installed and meets the requirement.
- Minimum iOS 16, iPhone and iPad, landscape only.
- Kids Category rules apply from this build: no third party SDKs, no network calls, no links out.
- Checkout: main (as chosen for this session). Commit and push when green.
- The old iPad check is assumed fine for now and done when the device is to hand.

## Blocked on Nick

1. **Bundle ID.** A placeholder (`app.smoothieadventure.placeholder`) is used until it arrives. Everything up to the simulator runs without it; the TestFlight upload does not.
2. **App record** created by hand in App Store Connect once the bundle ID is chosen.
3. **App Store Connect API key variables** (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`) available in the shell that runs fastlane. They are not set in this one.
4. **The live site.** Removing the service worker and `server.mjs` breaks the Laravel Cloud deployment if main deploys there automatically. Take the site down, or disconnect the deploy, before task 1 is pushed.

## Global Constraints

- No file-path header comments and no docblocks that restate the task; a doc comment only where it says something the code cannot.
- New behavioural tests are shown failing before the implementation and passing after. Any mock declares every call it expects.
- Commits name explicit paths. Never `git add -A`, `git add .` or `git commit -a`.
- Checks: `npm test`, `npm run typecheck`, `npm run build`. Focused tests while working, the full set once at the end.
- No analytics, crash reporting, remote content or live update plugin. Nothing is loaded from the network.
- Sending to TestFlight is run only after Nick says go.

## UI intent

No visual change to the game. Removed from the screens: the Add to Home Screen button, the full screen buttons on the menu and map, and the "turn your screen" card. The app opens full screen in landscape with no status bar, the home indicator dimmed, and a plain launch screen in the menu's sky blue (`#4cc0ff`) so the first frame does not flash white. The icon is the existing smoothie cup art from `tools/icons.py`.

## Tasks

1. **Remove the web-only parts.**
   - Delete `src/sw.ts`, `src/ui/install.ts`, `server.mjs`, the PWA plugin and manifest from `vite.config.ts`, and the `vite-plugin-pwa` and `workbox-*` packages.
   - In `src/ui/screen.ts` keep only `setBackdrop`; remove the calls in `src/ui/menu.ts` and `src/ui/map.ts`.
   - Remove the rotate card from `index.html` and `src/style.css`, the web app meta tags, and the `start` script.
   - Update `README.md` to describe the app build.
   - Acceptance: `npm run build` produces a `dist/` with no service worker or manifest; tests pass; the game still plays in the desktop browser with `npm run dev`.

2. **Add Capacitor and the iOS project.**
   - Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/preferences`.
   - `capacitor.config.ts`: app name "Smoothie Adventure", `webDir: 'dist'`, `ios.scrollEnabled: false`.
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

Not started.
