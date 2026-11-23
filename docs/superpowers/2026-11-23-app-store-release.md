# App Store release, 1.0.0

## Intent

Get Smoothie Scramble 1.0.0 onto the App Store: Kids Category (ages 6 to 8), free, one non-consumable unlock
(`races_unlock`).

## State of App Store Connect when this began (read with the API key, 2026-11-23)

- App record exists: name, subtitle "Roll, race and blend smoothies", primary category Games, age rating 4+, Kids
  age band 6 to 8, primary language en-GB.
- Version "1.0" in Prepare for Submission with nothing filled in: no description, keywords, screenshots, support
  or privacy address, copyright, review details or build. Builds are 1.0.0, so the version is renamed on upload.
- `races_unlock`: Missing Metadata. It has a name, description and a price (base GBR); it has no review screenshot.
- Builds 1 to 9 are valid on TestFlight. Encryption is declared as none.

## Decisions from Nick, 2026-11-23

- Privacy and support pages go on his own website. Addresses to come.
- The music is from a licensed library: the listing declares third-party content with rights held.
- The tester's switch is for Xcode builds only.
- Fix both older bugs before release (see below).

## Done

1. **Progress never saved over what could not be read.** `loadRoster` (`src/core/players.ts`) asks the store up to
   five times. If it never answers, or holds players that cannot be read and cannot be copied aside, nothing is
   saved that session, ghosts included. A roster read in part is copied to `fruitrun.players.v1.lost.<time>` first.
2. **A join that never connects gives up.** Ten seconds for each step of joining, then "The game has ended."
3. **Tester's switch** compiled into Debug builds only.
4. **Listing words** in `fastlane/metadata`: description, keywords, promotional text, copyright, review notes.
5. **Screenshots** in `fastlane/screenshots/en-GB`: five at 2868 by 1320 (iPhone 6.9") and five at 2752 by 2064
   (iPad 13"), taken from the game in a browser at those sizes. The purchase's review screenshot is
   `fastlane/iap/races_unlock-review.png`.
6. **Lanes:** `fastlane ios listing` sends words and screenshots; `fastlane ios release` builds, uploads and submits
   (`submit:false` to upload only). An approved build waits to be released by hand.
7. The privacy draft now says joining is free.

## Global Constraints

- No file-path header comments or task-restating docblocks.
- New behavioural tests shown failing first. Commits use explicit paths.
- Nothing is sent to App Store Connect until Nick has approved the words and pictures.

## Tests and review

- 9 new tests, each seen failing first: 7 for reading players at launch, 2 for giving up on a join. 1010 pass.
- `/code-review medium`, three rounds on the fixes. Round one found the first design could stop saving altogether
  and could still overwrite; it was replaced. Round two found a second loss could go uncopied and ghosts were still
  written; fixed. Round three: clean.

## Runtime verification

- PASS, browser: the game starts with its players after the change, a save is written and read back, no copy is
  kept aside when nothing is wrong.
- NOT RUN: the failing-store paths outside tests (they need a store that fails), and anything on a device.
- Store steps: recorded below as they are done.

## Still to do

For Nick:
- Host the privacy and support pages; give the two addresses (they also go into `src/data/links.ts`).
- App Privacy in App Store Connect: "Data Not Collected" (the key cannot set it).
- Confirm the Paid Apps agreement, tax and banking are active (needed for the purchase).
- Review contact: name, phone, email.
- Add the purchase's review screenshot, and attach the purchase to the version before submitting (a first purchase
  must go in with a version).
- Approve the words and screenshots.

Then: `fastlane ios listing`, build 10, `fastlane ios release`.

## The website, 2026-11-23

Nick's decisions: `ios` is merged into `main`, which is the branch from now on. smoothiescramble.com (Laravel Cloud,
deploys on a push to `main`) stops serving the game and becomes a page about it, with a privacy policy, terms and
help. The game stays playable in a browser on this machine with `npm run dev`. Contact address:
hello@smoothiescramble.com. The listing words and screenshots are approved.

- `site/`: plain pages, no build. `/`, `/privacy/`, `/terms/`, `/support/`. The privacy and help words are the old
  `docs/store` drafts (removed; `site/` is now the only copy). The terms are new and have not been read by a lawyer.
- `server.mjs` (from the old `main`) serves `site/` only, with `npm start`. `dist` is never served, so the game is
  not on the web whatever the deploy builds.
- `site/sw.js` and `site/registerSW.js` remove the service worker the old playable version left in visitors'
  browsers, which would otherwise keep showing them the cached game.
- The App Store badge is Apple's own artwork. It is not a link until the game is on sale: a note in
  `site/index.html` says what to swap in (`https://apps.apple.com/app/id6836531016`).
- The game's Grown-ups screen now links to `/privacy/` and `/support/`, and the listing has the three addresses.

Checked in a browser against `PORT=3999 npm start`: every page answers 200, an unknown path and a path out of
`site/` answer 404, no sideways scroll at 1280 or 390 wide, every picture loads.
