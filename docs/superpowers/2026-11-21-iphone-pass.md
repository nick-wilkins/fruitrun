# iPhone pass: screens that fill a phone

Date: 2026-11-21. Branch `ios`. Follows `2026-11-20-ios-phase-5b-together-and-store.md`.

## Intent

Nick, on an iPhone: the map sits in a narrow window with green round the edges, and buttons need checking. Make every screen work on a phone without breaking the iPad.

## What was wrong

- Screens were 16:9 boxes centred in the device. A phone is wider, so each had a blurred band of its picture at both sides, and every screen faded into it at all four edges. That fade is the green round the edges; on an iPad it showed as a faint rim.
- Text and buttons were sized by the device's width while the box was narrower, so on a phone the map's top row ran into the world's name.
- Nothing allowed for the notch or the home bar.

## What changed

- **Screens with a taller painting fill the device edge to edge**, with no fade. The first screen, book, cups, unlock and waiting rooms put their content in a window as big as fits, in the middle, clear of the notch and the home bar; the painting fills everything behind it.
- **The map fills the phone's full width.** Its painting is then taller than the screen, so the map can be drawn up and down with a finger, and opens on the level the player is at. Its buttons keep clear of the notch and home bar, and on a phone the world's name sits under the home button.
- **The blender stays 16:9 in the middle** on a phone, fading into bands at the sides, because its squares and buttons are painted into the picture. It fills an iPad as before.
- **A race** keeps its pause button, speed gauge and bag clear of the notch and home bar.

## Global Constraints

- No file-path header comments and no docblocks that restate the task.
- Commits use explicit paths.
- All browser checks run with sound off; the save is not written.
- Presentation only: no new tests.

## Runtime verification

Run 2026-11-21 in the browser. A phone's notch and home bar cannot be had in a desktop browser, so they were stood in for by setting the four margins by hand: 47 at each side and 21 at the bottom.

At 844 by 390 with those margins:

- PASS map: the screen is 844 wide where it was 693; the map scrolls through 243 pixels; the home button starts at 59 and the top row ends at 785, inside 47 to 797; top row buttons are 40 high; the world's name is under the home button and nothing overlaps.
- PASS first screen: the painting fills the screen; the window is 694 by 369, ending above the home bar.
- PASS blender: 693 wide in the middle, text sized to it, squares and buttons on their painted places.
- PASS cups: the stall fills the screen; the card is in a 656 by 369 window.
- PASS a race: pause button from 56, speed gauge ending at 360 of 390, bag ending at 788.

At 1100 by 825 (iPad shape) with 20 at the bottom:

- PASS the first screen, blender, map and cups all fill 1100 by 825 with no rim; the map needs no scrolling; the cups card looks as it did.

At 1100 by 620: a tap on a level still opens it.

998 tests pass; `tsc` and the build are clean.

NOT RUN: any of it on a real iPhone. The real notch and home bar margins, and drawing the map with a finger, are the things to look at.
