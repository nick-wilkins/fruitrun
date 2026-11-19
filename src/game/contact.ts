import { BALL_RADIUS, type Sim } from './sim';

/** How much of the speed two marbles meet at they come apart with: a soft bump, not a pinball. */
const BOUNCE = 0.5;
/** Meeting faster than this is a knock that is felt; slower is only rubbing along together. */
const HARD = 3;

/**
 * Marbles on the same road cannot be in the same place. Where two overlap they are eased apart across the road and
 * trade speed along the line between them: one run into from behind is pushed on and the one behind is checked,
 * and one steered into is knocked aside. Call it once all of them have moved.
 */
export function jostle(sims: readonly Sim[]): void {
  for (let i = 0; i < sims.length; i++) {
    for (let j = i + 1; j < sims.length; j++) {
      const a = sims[i];
      const b = sims[j];
      if (a.lane !== b.lane || a.countdown > 0 || b.countdown > 0) continue;
      // One sailing over the other does not touch it, and an escalator carries everyone up the middle.
      if (Math.abs(a.h - b.h) > BALL_RADIUS || a.onLift() || b.onLift()) continue;
      const ds = a.s - b.s;
      const dx = a.x - b.x;
      const gap = Math.hypot(ds, dx);
      if (gap >= BALL_RADIUS * 2) continue;
      // The line from one to the other; two in exactly the same place part sideways.
      const along = gap > 1e-6 ? ds / gap : 0;
      const across = gap > 1e-6 ? dx / gap : 1;
      const closing = -((a.pace - b.pace) * along + (a.xv - b.xv) * across);
      const push = closing > 0 ? ((1 + BOUNCE) / 2) * closing : 0;
      // Only ever moved across the road: along it, the change of speed is what parts them.
      const aside = (Math.sign(dx) || 1) * (Math.sqrt(Math.max(0, 4 * BALL_RADIUS * BALL_RADIUS - ds * ds)) - Math.abs(dx)) * 0.5 * Math.abs(across);
      // A marble on turbo is not to be stopped: it keeps its speed, and what it hits is only nudged on.
      const eased = a.turboT > 0 || b.turboT > 0 ? 0.3 : 1;
      a.shove(push * along * eased, push * across, aside, closing > HARD);
      b.shove(-push * along * eased, -push * across, -aside, closing > HARD);
    }
  }
}
