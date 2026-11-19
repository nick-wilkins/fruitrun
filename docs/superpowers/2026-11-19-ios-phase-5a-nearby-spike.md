# iOS phase 5a: playing together nearby, first working slice

Date: 2026-11-19. Status: building on branch `ios`. Background: `2026-11-18-ios-app-research.md` section 5.

## Intent

Two to four players, each on their own iPad or iPhone, race the same level and see each other's marbles. No internet, no accounts, no server. This phase proves the connection between real devices with the plainest screens that will do; the child-friendly host and join screens are phase 5b.

## Decisions carried in

- Transport: Network framework, peer to peer Wi-Fi, Bonjour to find each other. A small Swift plugin in the app target, no third party code.
- Each device runs only its own marble and tells the others where it is about 15 times a second. The others are drawn from those reports. Nobody can bump a friend's marble; each player has their own crates and fruit.
- Finishing order goes by each player's own clock.
- Part of the one purchase (Nick, 2026-11-19).
- Branch `ios`. An upload to TestFlight waits for Nick's go.

## My choices, for you to overrule

1. **Everyone playing needs the unlock.** Family Sharing covers the family's devices; a visiting friend needs their own.
2. **One player starts a game, the others join it.** Whoever started picks the level, from the ones they have open, and presses Start.
3. **A level the joiner has not opened yet can still be raced** when the starter picks it, and counts for them like any run.
4. **Rewards are those of a run on your own**: stars and fruit by your time. No extra fruit for the place and no medal, for now.
5. **Retry and Quit in the pause menu both go back to the waiting room**; a race cannot be restarted by one player.
6. **If a friend drops out their marble disappears and the race goes on.** If the starter drops out, everyone finishes their own run and the game is closed.
7. **Devices with different versions of the game refuse to race**, with a message to update.
8. **In the browser on the Mac** two tabs of the dev server can find each other, so the whole flow can be tried without devices.

## Tasks

1. `src/core/nearby.ts`: the messages, the version check, a friend's marble smoothed between reports, and the party (who is in, who started, relaying). Tests first.
2. `ios/App/App/NearbyPlugin.swift`, registration, and the two Info.plist entries for the Local Network prompt.
3. `src/platform.ts`: the transport, native or the two-tab stand-in.
4. `Run` draws friends' marbles and counts them in the place and the finishing order.
5. A plain screen to start or join a game, a waiting room, and the way in from the map.
6. Runtime verification.

## Global Constraints

- No file-path header comments and no docblocks that restate the task.
- New behavioural tests are shown failing before the code exists; mocks declare expected calls.
- Commits use explicit paths.
- All browser checks run with sound off.
- No third party code is added.

## Runtime verification

Run 2026-11-19 on `ios`.

- PASS tests shown failing first: `npx vitest run tests/nearby.test.ts` could not load before `src/core/nearby.ts` existed; after, 16 of 16 pass. Full suite: 951 passed.
- PASS `tsc --noEmit` clean.
- PASS signed iOS build with the plugin: `fastlane ios archive` exported a build; its Info.plist carries `NSBonjourServices` and `NSLocalNetworkUsageDescription`, and the binary contains `_smoothierace._tcp`. No upload.
- Two tabs of the dev server, sound off, stand-in transport, saves not written:
  - PASS the map shows Together; one tab starts a game and waits; the other finds "Sam's game", joins, and both list Sam and Ada.
  - PASS Start on the host starts level 3 on both, each marble in its own grid slot (-3.3 and -1.1).
  - PASS each sees the other's marble and its dot on the progress bar; the place reads 1st on the one in front, 2nd on the other.
  - PASS the first home sees "Sam, still racing"; when Sam finishes, that card changes to "2nd Sam 0:41.5" by itself. Sam's card reads "1st Ada 0:36.7, 2nd You 0:41.5".
  - PASS Retry goes back to the waiting room, still joined.
  - PASS the host closing the game leaves the other on "The game has ended."
- NOT RUN, needs two devices: everything about the real connection. Finding each other over peer to peer Wi-Fi with no shared network, the Local Network prompt and its refusal, how smooth a friend's marble looks at real latency, a device going to the background mid-race, Wi-Fi switched off, three and four players.
