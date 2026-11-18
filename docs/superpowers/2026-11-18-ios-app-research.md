# Smoothie Adventure as an iPhone and iPad app: research and recommended approach

Date: 2026-11-18. Status: research only, awaiting approval. No code has been changed.

## Decisions (2026-11-18)

These override anything below that says otherwise.

- **Shell:** Capacitor, as a dedicated app build. No web version is needed, so the service worker, Add to Home Screen button, full screen button and Laravel Cloud hosting are removed instead of kept behind a build mode. Native and Unity rewrites considered and rejected.
- **Paywall:** AI opponents and multiplayer both sit behind the one purchase. £2.99, Family Sharing on.
- **Minimum iOS 16.** Android is "maybe later".
- **Races:** up to 3 AI opponents. A race rewards more fruit the higher the podium place.
- **Listing:** Kids Category. Age band still to pick (Apple offers only 5 and under, 6 to 8, 9 to 11).
- **Privacy policy:** Nick will create a dedicated web page to host it.
- **Release order:** hold 1.0 until multiplayer is done. Phases 5a and 5b therefore come before the store release in section 10.
- **Multiplayer transport:** peer to peer Wi-Fi through Network framework. Each player has their own crates and fruit.
- **Still open:** bundle ID and store name, age band, oldest test devices.

Apple facts below were checked against live pages on 2026-11-18. Anything not confirmed on a live page is marked **unverified**. Sources are numbered at the end.

## 1. Summary

| Area | Recommendation | Main alternative, and why not |
|---|---|---|
| Shell | Capacitor 8.6 (Swift Package Manager), one codebase, a `native` build mode | Native rewrite: months of work, two codebases, and nothing wanted here needs a native renderer |
| AI opponents | Extra `Sim` instances driven by the existing autopilots, detuned per difficulty | Recorded ghost runs: needs 68 levels of recordings redone on every layout change |
| Multiplayer transport | Small local Swift plugin on Network framework with peer to peer Wi-Fi | MultipeerConnectivity: deprecated in iOS 27 and does not use Bluetooth. Core Bluetooth: the only literal "Bluetooth only" option, slower and fiddlier (see 5.1, this needs your call) |
| Multiplayer sync | Each device simulates only its own marble and broadcasts its position on the track; others are drawn as ghosts | Lockstep or host-authoritative physics: unnecessary because marbles never touch each other |
| Purchase | Small local Swift plugin on StoreKit 2, one non-consumable, no server | RevenueCat (what the cocktail app uses): a third party SDK with a recorded Kids Category rejection, for no benefit without a backend |
| Listing | Kids Category, built to its rules from the first build | General Games listing at 4+: reversible, but you may not describe the app as for kids anywhere in the listing |
| Release | Copy the cocktail app's fastlane shape, iOS only, API key plus automatic signing | fastlane match: only pays off with CI or several machines |

Two findings change the brief:

1. **"Bluetooth only" cannot be met with MultipeerConnectivity, and that framework is now deprecated.** Apple's own engineers say it has not used Bluetooth for about ten years [S12]. The realistic choice is peer to peer Wi-Fi (no router, no internet, but Wi-Fi must be switched on) or true Bluetooth LE through Core Bluetooth.
2. **The game is not really a physics simulation, which makes everything easier.** A marble is a point on a rail (distance along, distance across, height). Marbles cannot collide. AI opponents and remote players are therefore cheap to add and sync needs about 20 bytes per update.

## 2. What the codebase looks like (and why it matters)

About 8,000 lines of TypeScript, three.js 0.187, Vite 8, no framework. No backend at all.

**Server dependence: none.** `server.mjs` is a static file server with range requests for audio. There are no `fetch` calls, no API, no accounts. The save is one `localStorage` key, `fruitrun.save.v1` (`src/core/progress.ts:66`). Everything the game needs is in `dist/` (23 MB, of which 15 MB is eight music tracks). Bundling it in an app is a copy.

**Rules engine (`src/game/sim.ts`).** `Sim` holds one marble: `lane`, `s` (distance along), `x` (across), `h` (height), `v`, `xv`. It advances in fixed steps of 1/120 s (`TICK`, line 20) with no rendering or sound, and is already run headless by the tests and by `timeCourse` (line 593). Obstacles are tested by distance on the rail, not by a physics engine. Moving obstacles are pure functions of the sim clock (`swingX`, `spinAngle`). Consequences:

- It is deterministic given the same steering per tick. The only randomness is which fruit a pickup holds, and that generator is injectable (constructor, line 93).
- Each `Sim` owns its own obstacle state (`done[]`, line 64). Two marbles on one course do not share smashed crates or collected fruit.
- **Two autopilots already exist**: `smart` (careful line, line 245) and `ace` (fastest line, line 273). They set the star times today (`src/game/courses.ts:320`). They are the AI.

**Courses (`src/game/courses.ts`, `course.ts`, `track.ts`, `pieces.ts`).** 68 levels generated in code from seeded recipes (`src/game/random.ts`), built once and cached, warmed in the background after launch. Star times are worked out on the device by running the autopilots. Any position on any lane can be turned into a world position with `sim.point(s, x, y, out, lane)` (line 203), which is exactly what drawing a remote marble needs.

**Game loop and rendering (`src/game/run.ts`).** `Run` owns exactly one `Sim`, one Pip model, one shadow, the camera and the input handlers. The frame loop (line 360) accumulates time and steps the sim at 120 Hz, then draws the marble slightly ahead to smooth it (line 513). Sim events (`react`, line 421) drive sound, sparks and the visible state of crates, rings and pickups. This single-marble assumption is the main thing to change for racing.

**Rendering cost (`src/game/world.ts`, `main.ts:21`).** Lambert and basic materials, instanced meshes, fog, one hemisphere and one directional light, **no shadow maps**, no post-processing, textures drawn to canvas at runtime, pixel ratio capped at 2 (`run.ts:320`). This is a light scene. Antialiasing is on.

**Input (`run.ts:280`).** Pointer events on the canvas, first finger steers by swiping, others ignored. CSS already has `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `overscroll-behavior: none`, and `index.html` has `viewport-fit=cover` and no zoom. The usual web view touch problems are already handled.

**Audio (`src/audio.ts`).** Effects are synthesised with Web Audio. Music is one `<audio>` element routed through the Web Audio graph (line 34) because iPads ignore element volume. Sound starts on first tap (`main.ts:115`).

**Web only pieces to switch off in the app.** Service worker (`src/sw.ts`, `vite.config.ts`), Add to Home Screen button (`src/ui/install.ts`), full screen button (`src/ui/screen.ts`), and the "turn your screen" card in `index.html`.

**Your other apps.** `mamc-app` is Capacitor 8 with CocoaPods, deployment target iOS 16, automatic signing, team `R4H9W7HRHW`, RevenueCat, and a Fastfile with `bump`, `beta` and `release` lanes that authenticate with an App Store Connect API key from `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`. That lane shape transfers directly. `korf-app` is NativePHP wrapping a Laravel app, which has nothing to reuse for a static WebGL game.

## 3. App shell

**Recommendation: Capacitor 8.6.x, Swift Package Manager, deployment target iOS 16, iPhone and iPad, landscape only.**

- Current stable is 8.6.2 (published 2026-11-12). It needs Xcode 26 or later and supports iOS 15 and up [S20, S21]. Capacitor 9 is at release candidate and raises the floor to iOS 16, so your chosen minimum makes that upgrade free [S22].
- New Capacitor projects use Swift Package Manager by default [S23]. The cocktail app is still on CocoaPods; the only practical difference is that fastlane builds `App.xcodeproj` instead of a workspace.
- Custom native code is one Swift file per plugin in the app target, registered from a `CAPBridgeViewController` subclass [S24]. No npm package needed. The same subclass hides the home indicator and defers edge swipes during a run.

**One codebase, two builds.** Add a Vite mode (`vite build --mode native`) that leaves out the PWA plugin, and a small `src/platform.ts` that answers "am I in the app?" and exposes purchases and nearby play, with web stubs. The web build is untouched and keeps deploying to Laravel Cloud as now. Races would be app only (web has no way to sell the unlock), which also helps the App Review argument below.

**Offline and assets.** `npx cap sync` copies `dist/` into the app bundle and Capacitor serves it from a local scheme with range requests, so music plays. Nothing is fetched from Laravel Cloud. Service workers do not work under the `capacitor://` scheme, which is another reason to leave the service worker out of the native build [S25].

**Performance on older iPads.**
- Web views are capped at 60 fps even on 120 Hz iPads, and Low Power Mode drops them to 30 fps [S26, S27]. The fixed 120 Hz rules step means the game plays identically either way; it only looks less smooth.
- The JavaScript engine in a web view is the same just-in-time compiled engine as Safari.
- iOS 16 brings in iPad 5th generation (2017, A9, 2 GB) and iPhone 8. There are reports that A8 to A10 devices do not reliably get a WebGL 2 context [S28], which three.js needs. **Unverified, and the single most important thing to test on a real device.** If iPad 5, 6 and 7 fail, the honest floor is iOS 17 or a "requires A12" note.
- The web content process can be killed for memory with no warning; there are reports on iPad 9th generation after iOS 18.2 and on iOS 26 [S29]. The scene is light, but the app should handle `webglcontextlost` and resume to the map rather than a white screen.

**Touch.** Already handled in CSS and the viewport tag. Set `ios.scrollEnabled: false` in the Capacitor config as a belt and braces measure.

**Audio.** Web Audio is treated as "ambient", so the silent switch mutes the game [S30]. For a kids game that is the right behaviour and needs no work. After a phone call or backgrounding the audio context can stay suspended [S31]; resume it on the app's `resume` event (one line, the game already resumes on tap).

**Saves.** `localStorage` in a web view normally persists, but iOS may clear web data when storage is short. Mirror the save into `@capacitor/preferences` on every write and restore from it on launch if `localStorage` is empty. This uses UserDefaults, which needs reason `CA92.1` in the privacy manifest [S9].

**Guideline 4.2 (thin wrapper) risk: low to moderate.** The text is "features, content, and UI that elevate it beyond a repackaged website" and "lasting entertainment value" [S1]. In our favour: everything is bundled, it works offline, there is no browser chrome, it is a 68 level game, and by the store release it has StoreKit and nearby play. Rules to keep: no remote code or content in the web view and no live update plugin (2.5.2) [S1]. No guideline explicitly blesses web view games; this is a reading of the wording. Phase 1 on its own is the riskiest thing to submit, so I would not send it to App Review until at least the purchase exists.

**Alternatives rejected.**
- *Plain WKWebView shell in Swift.* You would hand write the file scheme handler with range requests, the message bridge and lifecycle events, which is what Capacitor already is, and lose Android later.
- *Native rewrite.* SceneKit is deprecated as of OS 26 [S32]; RealityKit is Apple only; Unity or Godot is a new engine and toolchain. All mean redoing rendering, rules, 68 levels, audio and UI, then maintaining two games. The only gains are 120 Hz and immunity to web view memory kills.

## 4. AI opponents

**How they are driven.** One extra `Sim` per opponent on the same `Course`, stepped in the same loop as the player, steering itself with the existing autopilot code. A full hands-free run of a course already takes a few milliseconds (three are run per level at warm-up), so three opponents at 120 Hz is negligible.

`ace` sets the five star time and would beat almost every child, so difficulty comes from detuning, not from new AI:

| Level | Driver | Detuning |
|---|---|---|
| Easy | `smart` line | Slower steering response, top speed scaled down about 12%, skips some speed pads, waits for the player if far ahead |
| Medium | `smart` line | Small speed handicap, occasional late dodge |
| Hard | `ace` line | Slight steering noise, no handicap |

Add gentle rubber banding on Easy and Medium (opponents ease off when well ahead, never speed up beyond their cap) so a young child is always near someone. All noise comes from a seeded generator so a race is repeatable and testable.

**What changes in the game loop.**

- `sim.ts`: replace the `autopilot` string with a small driver config (line, steering pace, speed scale, error rate). The two existing autopilots stay as presets so star time calibration is unchanged.
- `run.ts`: introduce a `Racer` (a marble model, a shadow, and a source of position). `Run` keeps its player `Sim` and gains a list of racers that it steps and places each frame. Only the player's sim events drive sound, sparks, camera shake and the visible crates, rings and fruit. Opponents pass through the player's obstacles visually but obey their own copies, which reads fine because marbles never touch.
- `character.ts`: `buildPip()` takes a colour so opponents are told apart.
- `hud.ts`: race position, opponent markers on the progress bar, and a finishing order on the results card.
- `main.ts`, map UI: a way into a race.
- Tests: racers finish every level; Easy is slower than the three star time; a seeded race replays identically.

A `Racer` takes its position from one of three places: local input, an autopilot `Sim`, or network updates. That is the same abstraction multiplayer needs, so this phase does most of the multiplayer groundwork.

**Design questions this raises** are in section 10 (what a race rewards, how many opponents).

**Alternative rejected: recorded ghosts.** Replaying stored runs needs recordings for 68 levels that go stale whenever `COURSES` is bumped. The autopilots regenerate themselves.

## 5. Multiplayer

### 5.1 Transport: this needs your decision

What is true today:

- **MultipeerConnectivity is deprecated.** "Multipeer Connectivity is deprecated. Migrate any code using this framework to the Network framework" [S10]; "Xcode 27 deprecates the entire Multipeer Connectivity framework" [S11].
- **It does not use Bluetooth.** Apple DTS: "Multipeer Connectivity hasn't worked over Bluetooth for 10-ish years. On modern systems its peer-to-peer support is based entirely on peer-to-peer Wi-Fi" [S12]. The framework page still mentions Bluetooth; DTS says that text is out of date. There is no way to restrict it to Bluetooth.
- **Apple's recommended replacement** is Network framework with peer to peer Wi-Fi switched on (`includePeerToPeer`) and Bonjour for discovery [S13].
- **Wi-Fi Aware** (iOS 26 and later, iPhone 12 and later, needs an entitlement and a system pairing step) [S14] is too new and too heavy a pairing flow for young children.
- **No usable Capacitor plugin exists** for nearby play. The one MultipeerConnectivity plugin targets Capacitor 7 and has been silent since July 2025; the community Bluetooth LE plugin is central only and cannot host; the one plugin with peripheral mode is young and little used [S33, S34, S35].

| | Network framework, peer to peer Wi-Fi (recommended) | Core Bluetooth (literal Bluetooth only) |
|---|---|---|
| Needs internet or a router | No | No |
| Needs Wi-Fi switched on | Yes (joined to a network or not) | No, needs Bluetooth on |
| Permission prompt | Local Network, once | Bluetooth, once |
| Speed | Fast, a few ms | Tens of ms per hop, low bandwidth (**unverified figures**) |
| Players | Comfortably 4 | Host plus about 3, each relayed through the host |
| Effort | About 250 lines of Swift | Roughly double, with more edge cases (roles, reconnects, packet sizes) |
| Works with Android later | No | Yes, it is the only option that does |
| Apple's direction | Recommended | Supported, not aimed at games |

**My recommendation is Network framework peer to peer Wi-Fi**, on the reading that your requirement is really "nearby, no accounts, no servers, works in the car". The one place it falls short is a device with Wi-Fi fully off in Settings. If you mean Bluetooth literally, or cross-play with Android matters, choose Core Bluetooth; the sync design below is small enough to fit it.

Either way the JavaScript side talks to a transport-neutral interface (`host`, `browse`, `join`, `send`, `leave`, plus peer and message events), so the transport can be swapped or a second one added without touching the game.

### 5.2 Reaching it from the web layer

A local Swift Capacitor plugin (`NearbyPlugin.swift` in the app target). Messages cross the bridge as short strings about 15 times a second, which is well within what the bridge handles. No third party dependency.

### 5.3 Keeping marbles in sync

Is the physics deterministic? Yes for a given device and input, but **the design should not depend on it**, and does not need to:

- Each device runs the full `Sim` only for its own marble, exactly as today. Steering stays instant; there is no input lag from the network.
- About 15 times a second it broadcasts `{lane, s, x, h, v, xv, finished, time}`, roughly 20 bytes.
- Other players are drawn as racers placed with `sim.point(...)`, moved forward between updates using their last speed, and eased onto each new update. A late packet shows as a small glide, never a stall of your own marble.
- The host sends the level, the fruit seed and "go in 3 seconds"; each device runs its own countdown from receipt. A few tens of milliseconds of offset between devices is invisible because finishing order is decided by each player's own run time, which is measured locally and reported at the line.
- Each player has their own obstacles and fruit. A crate you smash is still there for your friend. This is the simplest model and avoids any shared state to fight over.
- On joining, devices compare app version and the `COURSES` number and refuse to race if they differ, so nobody races on different layouts.

Rejected: lockstep (every device simulates every marble from shared inputs) needs bit-identical maths across iOS versions and stalls everyone when one packet is late. It would only be needed if marbles could collide.

**Latency.** With this design latency affects only how accurately you see others, not how your marble handles. Anything under about 150 ms looks fine.

**Player limit.** Recommend 2 to 4. Four marbles is plenty on a track this wide and keeps a Bluetooth fallback possible.

**Dropouts.** If a peer vanishes, their marble fades out and the race continues. If the host vanishes, everyone finishes their own run and sees their own result.

### 5.4 Permission prompts

- Peer to peer Wi-Fi: `NSLocalNetworkUsageDescription` and `NSBonjourServices` in Info.plist; one Local Network alert [S15]. No Bluetooth prompt.
- Core Bluetooth: `NSBluetoothAlwaysUsageDescription`; the app crashes without it [S16].
- Trigger the prompt when the player opens multiplayer, not at launch, with a friendly screen first explaining why. A parent will usually need to tap Allow; if it is denied, show how to turn it on in Settings.

## 6. In-app purchase

**Recommendation: a local Swift plugin on StoreKit 2. One non-consumable, for example `races_unlock`, unlocking AI races and multiplayer.**

- StoreKit 2 verifies transactions on the device and `Transaction.currentEntitlements` returns each owned non-consumable, with refunds removed. Apple describes server verification as optional [S17]. No backend, no account, no SDK.
- Surface to JavaScript: `getProduct()` (localised price), `purchase()`, `isUnlocked()`, `restore()`, and an event when entitlements change. Roughly 100 lines of Swift.
- Restore: purchases reappear automatically on reinstall, but 3.1.1 still expects a restore mechanism [S1]. A Restore Purchases button calls `AppStore.sync()`, only on a tap because it asks for the Apple Account password [S18].
- Ask to Buy: a child's purchase can sit pending for up to 24 hours [S19]. The app must show "waiting for a grown-up" and unlock when the transaction arrives through `Transaction.updates`, not hang.
- Family Sharing for the unlock is optional and **cannot be turned off once enabled** [S36]. For a kids game shared across family iPads I would turn it on.
- Testing: a StoreKit configuration file in Xcode works offline with no App Store Connect setup; then sandbox through TestFlight [S37].
- The product itself must be created by hand in App Store Connect (fastlane cannot) and the first purchase is reviewed together with an app version [S38].

**Alternatives rejected.**
- *RevenueCat*, as in the cocktail app. It sends purchase history to a third party, which must be declared, and there is a recorded Kids Category rejection under 1.3 where it was the only SDK [S39]. Its value is server-side receipts and analytics, neither of which this app has a use for.
- *`@capgo/native-purchases`* (8.9.16, StoreKit 2, no server) is the fallback if you would rather not own any Swift. It is subscription-centred and one more dependency for 100 lines of code.

## 7. Kids rules

**What the Kids Category requires** [S1, S2, S3]:

- Purchases and links out of the app only "behind a parental gate", defined as an adult-level task. This covers the buy button, Restore, the privacy policy link and any support link. No Apple text says the system purchase sheet counts, so plan on your own gate.
- No third party analytics or advertising (narrow exceptions exist). No personal or device information to third parties.
- A privacy policy, and compliance with children's privacy law (COPPA, GDPR).
- Pick one age band: 5 and under, 6 to 8, or 9 to 11.
- **It is a one-way door.** App Store Connect: "You can't change this selection once your app is approved by App Review" [S3]. The guideline itself says the app must keep following the rules "even if you decide to deselect the category" [S1].
- Only available when the calculated age rating is 4+ or 9+ [S3]. Ratings are now 4+, 9+, 13+, 16+, 18+ [S4].

**What still applies outside the Kids Category** to an app aimed at children: "Apps intended primarily for kids should not include third-party analytics or third-party advertising" (5.1.4), and you may not use "For Kids" style terms, or anything in the name, subtitle, icon, screenshots or description that implies children are the main audience (2.3.8, 5.1.4) [S1].

**Recommendation: list in the Kids Category.** The usual cost of the category is giving up analytics, ads and SDKs, and this app has none: no accounts, no network calls, no third party code at all once RevenueCat is avoided. The only extra work is a parental gate, which a kids game selling an unlock should have anyway. In return you can say plainly that it is for children, and parents browsing the Kids section can find it. A general listing is slightly simpler on day one but forces you to market a children's game without saying so.

The trade is permanence: no analytics or ad SDKs in this app, ever. If you might want those later, choose the general listing. Either way I would build to Kids rules from the first build, and the choice is only made at the first App Store submission, not for TestFlight.

**Privacy.**
- A privacy policy URL is required for every app, plus a link inside the app (behind the gate) [S5].
- App Privacy answers: "No, we do not collect data from this app". Data processed only on the device is not "collected" [S6, S7].
- Privacy manifest: declare UserDefaults reason `CA92.1` [S9]. Check Xcode's privacy report on the built app to confirm what Capacitor itself declares (**unverified**).

**Age assurance laws.** Texas, Utah and Louisiana app store laws are in force in 2026. Apple says developers are responsible for their own obligations but that App Review has not changed, and Apple handles parental consent for downloads and purchases itself [S8]. Whether a game with no accounts and no data has to do anything is a legal question, not a review gate. Flagged, not solved.

## 8. Build and release

Reusing the cocktail app's approach:

- **Bundle ID.** Needs your choice; something like `com.<yourdomain>.smoothieadventure` under team `R4H9W7HRHW`. It cannot be changed after the first upload.
- **Signing.** Automatic signing with `-allowProvisioningUpdates`, as in the cocktail app. No match.
- **Fastfile.** Copy `mamc-app/fastlane/Fastfile` and keep the iOS half: `bump`, `ios beta` (TestFlight) and `ios release`. Changes: build `ios/App/App.xcodeproj` (no workspace under Swift Package Manager), run `npm run build -- --mode native && npx cap sync ios` first, device family iPhone and iPad. Same `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH` variables. fastlane is at 2.242.0.
- **Toolchain.** Uploads must be built with Xcode 26 or later now, and with the iOS 27 SDK from April 2027 [S40]. Xcode 27.2 is current.
- **TestFlight.** Internal testers get builds without review. External testers need a short beta review.
- **Landscape on iPad.** The game is landscape only. iPadOS 26 and later let apps be resized in windows; the stage already letterboxes to a fixed ratio so this should be fine, but it needs a look on a real iPad (**unverified**).

**Needed from you.**
1. App name confirmed ("Smoothie Adventure") and checked for availability, and the bundle ID.
2. Create the app record in App Store Connect by hand (fastlane cannot with an API key [S38]).
3. Create the in-app purchase product, choose a price, decide on Family Sharing.
4. A privacy policy page at a public URL, and a support URL.
5. Age rating questionnaire, Kids Category decision and age band.
6. The oldest iPad and iPhone you can lay hands on, and two devices for multiplayer testing.
7. Screenshots and listing copy (I can draft; design taste and submission are yours).
8. Review notes explaining that multiplayer needs two devices.

## 9. Risks and unknowns

**Could get the app rejected.**
1. Kids Category: any purchase, restore or outbound link reachable without the parental gate (1.3).
2. Thin wrapper (4.2), mostly if a build with no native features is submitted. Mitigation: do not submit before the purchase exists; keep everything bundled.
3. Any third party SDK that touches data in a kids app. Mitigation: none are planned; keep it that way.
4. Missing privacy manifest reasons or usage strings. These are refused at upload or crash on first use.
5. Purchase flow that hangs on Ask to Buy, or no restore path.
6. Reviewer unable to exercise multiplayer. Mitigation: review notes, and AI races demonstrate the paid feature on one device.
7. Kid-directed wording in the listing if you choose the general category.

**Needs a prototype or a real device to prove.**
1. WebGL 2 and frame rate on A9 and A10 devices (iPad 5, 6, 7, iPhone 8). Decides whether iOS 16 is a true floor.
2. Web view memory kills on 3 GB iPads over a long session, and recovery from a lost graphics context.
3. Peer to peer Wi-Fi between two devices with no shared network, and what happens with Wi-Fi off in Settings. Also the latency of messages through the Capacitor bridge.
4. Audio after an interruption (phone call, Control Centre, backgrounding).
5. One unconfirmed report that iOS 27 disables just-in-time compilation for pages outside a secure context [plugin research, single source]. Check the game's frame time on an iOS 27 device in the first TestFlight build.
6. Save survival: confirm the Preferences mirror restores after web data is cleared.

**Product unknowns.** How a race fits the existing star, fruit and smoothie loop; whether a seven year old can get two devices connected without help. Both want a child in front of the prototype.

## 10. Phased build order

Effort is rough working days for the two of us, excluding your device testing and Apple's review time.

| Phase | What | Ships | Effort |
|---|---|---|---|
| 1 | **Shell to TestFlight.** Capacitor project, `native` build mode (no service worker, install and full screen buttons hidden), landscape lock, home indicator, icons and launch screen, save mirror, privacy manifest, fastlane `beta` lane. The game exactly as it is on the web. | TestFlight, internal | 1.5 to 2 |
| 1b | **Old device check** on the first build: WebGL 2, frame rate, memory, audio, iOS 27 JIT. Confirms or moves the iOS floor. | Decision | 0.5 plus your testing |
| 2 | **AI races** in the web layer: driver config, racers in `Run`, coloured marbles, race HUD and results, three difficulties, tests. Developed and tested in the browser, unlocked there in dev only. | TestFlight | 4 to 5 |
| 3 | **Purchase.** StoreKit 2 plugin, parental gate, unlock screen, restore, Ask to Buy pending state, StoreKit test file. | TestFlight (sandbox) | 2 to 3 |
| 4 | **Store release 1.0**: listing, screenshots, privacy policy, age rating, review notes, submit. AI races are the paid feature; multiplayer follows as an update to the same unlock. | App Store | 1.5 plus review |
| 5a | **Multiplayer spike.** Nearby plugin, two devices exchanging positions, one ghost marble on screen. Proves the transport before any UI is built. | Internal | 2 to 3 |
| 5b | **Multiplayer proper.** Host and join screens a child can use, permission explainer, start sync, results, dropouts, version check, 2 to 4 players. | TestFlight, then App Store update | 5 to 7 |

Releasing 1.0 after phase 3 gets App Review's verdict on the wrapper, the Kids Category and the purchase before the largest piece of work is built on top. If you would rather launch with multiplayer included, phases 5a and 5b move ahead of 4 and the first review carries more risk.

Each phase gets its own short brief in `docs/superpowers/` with acceptance and runtime verification when you approve it.

## 11. Open questions for you

1. **Transport.** Is peer to peer Wi-Fi (no internet, no router, Wi-Fi switched on) acceptable as "nearby only", or must it be literally Bluetooth? This decides Network framework versus Core Bluetooth.
2. **Kids Category or general listing?** I recommend Kids, knowing it is permanent. If Kids, which age band (I would pick 6 to 8)?
3. **What is a race?** Does racing a level earn stars and fruit like a normal run, or is it a separate mode with its own reward (trophies, wins)? Can you race any unlocked level?
4. **How many opponents** in an AI race: one, or up to three?
5. **Does the web version get AI races** for free, stay solo as now, or show races as "in the app"? I have assumed web stays solo.
6. **Release order.** 1.0 with AI races then multiplayer as an update (my recommendation), or hold 1.0 until multiplayer is done?
7. **Price** for the unlock, and Family Sharing on or off (on cannot be undone).
8. **Bundle ID and name**, and where the privacy policy page will live.
9. **Devices.** What is the oldest iPad and iPhone you can test on?
10. **Shared obstacles in multiplayer.** I have assumed each player has their own crates and fruit. Say if you want a smashed crate to vanish for everyone; it is more work and more to go wrong.

## Sources

Apple, checked 2026-11-18:

- [S1] App Review Guidelines (last updated 2026-10-16), sections 1.3, 2.3.8, 2.5.2, 3.1.1, 4.2, 4.7, 5.1.1, 5.1.4: https://developer.apple.com/app-store/review/guidelines/
- [S2] Building apps for kids, including parental gates and age bands: https://developer.apple.com/kids/
- [S3] Set an app age rating, including Made for Kids: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
- [S4] Age ratings values and definitions: https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions/
- [S5] Manage app privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- [S6] App privacy details: https://developer.apple.com/app-store/app-privacy-details/
- [S7] Describing use of required reason API: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
- [S8] Age assurance: https://developer.apple.com/support/age-assurance/ and https://developer.apple.com/news/?id=f5zj08ey
- [S9] Required reason API types (UserDefaults CA92.1): https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype
- [S10] Multipeer Connectivity (deprecation banner, 8 peer limit): https://developer.apple.com/documentation/multipeerconnectivity
- [S11] TN3213, Moving from Multipeer Connectivity to Network framework: https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework
- [S12] Apple DTS forum replies on Multipeer and Bluetooth: https://developer.apple.com/forums/thread/809565 and https://developer.apple.com/forums/thread/769043 (read through a fetch tool, not directly)
- [S13] TN3151, Choosing the right networking API: https://developer.apple.com/documentation/technotes/tn3151-choosing-the-right-networking-api
- [S14] Wi-Fi Aware: https://developer.apple.com/documentation/wifiaware
- [S15] TN3179, Understanding local network privacy: https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy
- [S16] Core Bluetooth: https://developer.apple.com/documentation/corebluetooth
- [S17] StoreKit current entitlements and verification: https://developer.apple.com/documentation/storekit/transaction/currententitlements and https://developer.apple.com/documentation/storekit/verificationresult
- [S18] AppStore.sync(): https://developer.apple.com/documentation/storekit/appstore/sync()
- [S19] Ask to Buy: https://support.apple.com/en-us/105055
- [S36] Supporting Family Sharing: https://developer.apple.com/documentation/storekit/supporting-family-sharing-in-your-app
- [S37] StoreKit testing in Xcode: https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode
- [S40] Upcoming requirements: https://developer.apple.com/news/upcoming-requirements/
- [S32] SceneKit (deprecated at 26.0): https://developer.apple.com/documentation/scenekit

Tooling, checked 2026-11-18:

- [S20] Capacitor 8.6.2 on npm: https://registry.npmjs.org/@capacitor/core
- [S21] Capacitor 8 requirements: https://capacitorjs.com/docs/updating/8-0
- [S22] Capacitor 9 release candidate: https://github.com/ionic-team/capacitor/releases
- [S23] Capacitor and Swift Package Manager: https://capacitorjs.com/docs/ios/spm
- [S24] Capacitor custom native iOS code: https://capacitorjs.com/docs/ios/custom-code
- [S25] Service workers and custom schemes: https://bugs.webkit.org/show_bug.cgi?id=206741
- [S26] 120 Hz in web views: https://bugs.webkit.org/show_bug.cgi?id=294338
- [S27] Low Power Mode frame throttling: https://bugs.webkit.org/show_bug.cgi?id=215745
- [S28] WebGL 2 on older chips: https://bugs.webkit.org/show_bug.cgi?id=226975
- [S29] Web view memory reports: https://developer.apple.com/forums/thread/778735 and https://discourse.threejs.org/t/memory-limit-crash-on-ios-26/86978
- [S30] Web Audio and the silent switch: https://bugs.webkit.org/show_bug.cgi?id=237878
- [S31] Audio context after interruption: https://bugs.webkit.org/show_bug.cgi?id=243727
- [S33] capacitor-nearby-multipeer: https://github.com/squareetlabs/capacitor-nearby-multipeer
- [S34] @capacitor-community/bluetooth-le 8.4.0 (central only): https://github.com/capacitor-community/bluetooth-le
- [S35] @capgo/capacitor-bluetooth-low-energy 8.2.9: https://github.com/Cap-go/capacitor-bluetooth-low-energy
- [S38] fastlane and the App Store Connect API: https://docs.fastlane.tools/app-store-connect-api/
- [S39] RevenueCat community, Kids Category rejection: https://community.revenuecat.com/sdks-51/how-should-i-answer-app-review-questions-about-the-kids-category-3041
- `@capgo/native-purchases` 8.9.16: https://github.com/Cap-go/capacitor-native-purchases
