# A race a day on the website

Date: 2026-11-23. Branch `main` (Nick: the website deploys from `main`).

## Intent

Nick: one more page, "Play online". It loads one level, which changes daily. The visitor hits Go and races three
other marbles on it, and is shown their time. The level is any from the first world, a new one each day, round and
round. Say that there is a new level every day and that it can be played as many times as wanted. Playing again and
again must ask the server for nothing more than starting the game did.

## Decisions

- The level of the day is by the visitor's own calendar, so it changes at their midnight. All 18 levels of the first
  world in order, then round again (`src/core/daily.ts`).
- The three rivals are Berry, Mango and Plum at Medium. One constant in `src/play.ts` (`SPEED`) changes it.
- Nothing is kept: no save, no stars won, no fruit. The best time of the day lasts as long as the page is open and
  is stored nowhere, so the privacy policy's "nothing collected" stays true. The policy now says so.
- The page is built by Vite from `web/index.html` and `src/play.ts` into `site/play/`, and the build is committed:
  the website is served as it stands and what the deploy builds is not known. `npm run build:play` after changing
  the game.
- The game's pictures and sounds are not copied into `site/`. `server.mjs` serves `/play/assets/` from
  `public/assets/`.
- For the server's sake: one tune only (2.4 MB), fetched when the first race starts and not on arrival; the built
  code is kept by browsers for good (its name changes when it does) and the game's pictures and sounds for a day.
- `createHud` gained two small things: a name for the way out of a run (`quitLabel`) and a foot for the card a race
  with nothing to keep ends on.

## Global Constraints

- No file-path header comments and no docblocks that restate the task.
- New behavioural tests are shown failing before the code and passing after.
- Commits use explicit paths.
- Browser checks run in a browser profile of their own.

## Tests

`tests/daily.test.ts`, 4 new. RED: the file failed to load (`src/core/daily` did not exist). GREEN after: one level
all day, a new one at midnight, all 18 of the first world and only those before coming round, one a day across a
change of the clocks.

`npm test`: 1014 pass. `tsc` clean. `npm run build:play` clean (712 kB of code, 191 kB gzipped; 51 kB of styles).

## Runtime verification

Run 2026-11-23 against `PORT=3999 npm start`, in a browser at 1280 by 800.

- PASS `/play/` shows "Today's race, Cherry Hilltop" with its fruit, the words about a new track every day, and Go.
- PASS Go starts the level with the countdown, three rivals, the place and the clock. No console errors.
- PASS left unsteered the race finished: "Finished! 1:10.9", Mango, Berry, Plum and You in order with times, "Your
  best today!", Race again and Done. The buttons are clear of Pip (they end at 744 across, Pip starts at 804).
- PASS Done returns to the card, which now reads "Your best today: 1:10.9" and "Race again".
- PASS what a second race fetched: three ingredient pictures not seen in the first (dates, milk, oats, about 70 kB
  each). Everything else came from the browser's own copy. Pickups differ from run to run, so a level's pool of
  pictures is fetched once each over the first few races and then nothing is.
- PASS before Go the page had fetched its code, styles, one fruit and the backdrop: no music.
- PASS the server: `/play/` 200; `/play/assets/ui/star.png` 200; `/play/assets/../../package.json` and the same with
  `%2e%2e` 404; `/play/assets/` 404; a missing picture 404. Headers: the page `no-cache`, the built code
  `max-age=31536000, immutable`, the game's pictures `max-age=86400`.
- PASS the home page: "Play today's race now" beside the App Store badge, above the fold at 1280 by 800.

NOT RUN: on a phone or tablet in a browser (touch steering, the turn-sideways card, sound starting on the first
tap). NOT RUN: Safari.

## Review

`/code-review medium` on the whole diff: seven findings, all folded in.

- The built code went into `site/play/build/`, which `.gitignore` drops (`build/`): the page would have gone live
  with no code. It is now built into `site/play/code/`. PASS: `git check-ignore` matches nothing under `site/play`.
- A browser that cannot draw in 3D left an empty page: it now gets a card saying so, with the way back.
- With the drawing surface taken away, Go did nothing: it now asks for the surface back, says "One moment", and
  loads the page afresh once if it has not returned after five seconds. PASS: surface lost mid-race returns to the
  card; the next Go but one starts a race.
- A card left open past midnight kept yesterday's level: Go asks for the level at the press, and the card is drawn
  again when the page is looked at again.
- A tall window on a computer was told to turn its screen: only a touch device is now, and a race waits while a
  phone is held upright. PASS at 700 by 950: the card shows and the race starts.
- The one tune was asked for again each time it ended: it now loops by itself (`src/audio.ts`, a playlist of one).
- On a short screen the top of the card could not be reached: the card centres by its margins and scrolls.

After the fixes: 1014 tests pass, `tsc` and `npm run build:play` clean.

## Live, 2026-11-23

- PASS after the push (`18599a3`): https://smoothiescramble.com/play/ answers 200, shows "Cherry Hilltop", and Go
  starts the race with nothing failing to load.
- PASS the live headers match: code `immutable`, the game's pictures and tune `max-age=86400`. Code and styles
  arrive gzipped.
- NOTE `cf-cache-status: BYPASS` on every file: the network in front of the site is not keeping copies, so each new
  visitor's files come from the server itself. Browsers keep their own copies, so racing again costs nothing.
