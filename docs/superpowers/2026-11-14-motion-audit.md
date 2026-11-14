# Audit of physics, collisions, camera and track joins

Brief and results (14 Nov 2026). Nick: "do a check of physics, collision, movement etc as seems a little glitchy now and again. And also track joins."

## Global Constraints

- No file-path header comments or task-restating docblocks.
- New behavioural tests demonstrate RED then GREEN; no mocks.
- Commits use explicit paths.
- Tests: `npm test`.

## Method

A headless audit drove every one of the 68 levels five ways (never steering, hard left, hard right, weaving, and the good-line autopilot), stepping the rules at 120 Hz and the camera at 60 Hz, and recorded: any jump in the ball's position in the world, any sideways snap, any jump or sharp swing of the camera, how fork arms meet the main route (position, heading, tilt, width), kinks between track samples, and objects placed inside each other.

## Findings and fixes

1. **Ball jumped about 7 units on taking any fork arm: 205 cases.** The arm and the main road point different ways by the time they part, and the hand-over only corrected for the distance between them. The ball is now placed on the arm by where it actually is in the world. After: 0.
2. **Smaller snaps (up to 1.9 units) when a fork closed behind a ball that was between the two roads, or a road narrowed: 27 cases.** The ball now slides back onto the road instead of snapping. After: 0.
3. **Camera: 516 jumps or sharp swings.** Weaving near a fork flipped the look-ahead between the two roads (swings of up to 66 degrees in one frame); taking an arm cut to the new road's view; a turbo pad made the camera lurch back. The camera now eases its distance and carries on from where it was heading whenever its view would jump. After: 15 small ones, all fast moves inside tight loops and drops rather than cuts.
4. **Uneven frame pacing.** The rules run in fixed steps of 1/120 s, which do not line up with screen frames, so the ball was drawn one step ahead or behind from frame to frame. It is now drawn part-way into the next step. In Chrome on level 2, movement per frame was within about 6% of even over 599 frames.
5. **Distant shimmer where fork roads overlap.** The camera's near plane moved from 0.3 to 0.6, which doubles depth precision in the distance.

Clean:

- Fork arms meet the main route exactly in position, tilt and width; the worst heading difference is 1.45 degrees.
- No kinks over 4.5 degrees between track samples anywhere.
- No solid objects placed inside each other.
- No crate was ever passed through untouched.

## Kept as tests

`tests/motion.test.ts`: every level driven left, right and weaving (204 runs, about 6 s). Each must finish with no ball jump, no crate passed through, and bounded camera movement and swing. `npm test`: 793 passed.

## Not checked

A real iPad. By eye in the browser I only confirmed a level still plays; the smoothness numbers come from the audit and the frame measurement above.

## Regression found by Nick: camera drifting overhead

The camera smoothing added above predicted the next view from how far the camera moved in the previous frame. A frame that took longer than the last looked like a jump; the "correction" was carried forward, the prediction was never refreshed, and the error grew every frame until the camera sat far above the track. The audit missed it because it only used even frames.

- Test first: six levels played with uneven frames (60, 30 and 20 a second, plus hitches). Camera wandered 23 to 62 units from the ball; all six failed.
- Fix: the prediction now comes from the ball's speed and the length of the frame, so nothing goes stale, and a carried difference of more than a road's width is dropped outright.
- After: all six pass (camera within 22 units), with the 204 smoothness runs still passing. In Chrome on level 7 with a forced 70 ms hitch every 25 frames, a pause and resume and a turbo pad, the camera stayed within 12.8 units of the ball.
