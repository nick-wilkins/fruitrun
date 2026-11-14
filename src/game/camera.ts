import { Vector3 } from 'three';
import { CRUISE, type Sim } from './sim';
import { makeFrame } from './track';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The chase camera: it rides the track a little way behind the ball, so it loops, twists and corkscrews with it.
 * No rendering here, so its smoothness can be checked without a browser.
 */
export class Rig {
  readonly pos = new Vector3();
  readonly look = new Vector3();
  readonly up = new Vector3(0, 1, 0);

  private started = false;
  private back = 8.2;
  // Where the camera would be from the track alone, last frame.
  private readonly rawPos = new Vector3();
  private readonly rawLook = new Vector3();
  private readonly rawUp = new Vector3();
  // Left over from the last change of road: fades away so the view glides across instead of cutting.
  private readonly carryPos = new Vector3();
  private readonly carryLook = new Vector3();
  private readonly carryUp = new Vector3();
  private readonly f = makeFrame();
  private readonly behind = makeFrame();
  private readonly ahead = makeFrame();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  private readonly d = new Vector3();

  /** Place the camera for a ball drawn at distance `s`, `x` across and `h` up, `dt` seconds after the last frame. */
  update(sim: Sim, s: number, x: number, h: number, dt: number): void {
    const f = sim.frameAt(s, this.f);
    // Drop back with speed, but ease there: a turbo pad changes the speed in an instant.
    const wanted = 8.2 + clamp((sim.v - CRUISE) * 0.07, 0, 4.2);
    this.back = this.started ? this.back + (wanted - this.back) * Math.min(1, dt * 2.5) : wanted;
    const back = this.back;
    const fc = sim.frameAt(s - back, this.behind);
    const pos = this.a.copy(fc.p).addScaledVector(fc.u, 4 + h * 0.8).addScaledVector(fc.r, x * 0.55);
    const fl = sim.frameAt(s + 7, this.ahead);
    const look = this.b.copy(fl.p).addScaledVector(fl.r, x * 0.75).addScaledVector(fl.u, 1 + h * 0.65);
    const up = this.c.copy(fc.u).add(f.u).normalize();

    if (this.started && dt > 0) {
      // Whenever the view from the track alone jumps (the ball moves onto another road, or the road it is looking
      // down changes at a fork), carry on from where the camera was heading and let the difference fade, rather
      // than cutting to the new view. "Where it was heading" is worked out from the ball's speed and how long this
      // frame took, so a slow or uneven frame is never mistaken for a jump.
      const travel = sim.v * dt;
      const slack = 1.2 + travel * 0.8;
      const posJump = this.d.copy(this.rawPos).addScaledVector(fc.t, travel).sub(pos);
      if (posJump.length() > slack) this.carryPos.add(posJump);
      const lookJump = this.d.copy(this.rawLook).addScaledVector(fl.t, travel).sub(look);
      if (lookJump.length() > slack + 0.6) this.carryLook.add(lookJump);
      if (this.rawUp.dot(up) < 0.985 - Math.min(0.3, dt * 4)) this.carryUp.add(this.rawUp).sub(up);
      // A safety net: the carried difference is only ever a road's width or so. If it is more, let go at once.
      if (this.carryPos.length() > 16) this.carryPos.set(0, 0, 0);
      if (this.carryLook.length() > 20) this.carryLook.set(0, 0, 0);
    }
    this.started = true;
    this.rawPos.copy(pos);
    this.rawLook.copy(look);
    this.rawUp.copy(up);

    const fade = Math.exp(-dt * 4.5);
    this.carryPos.multiplyScalar(fade);
    this.carryLook.multiplyScalar(fade);
    this.carryUp.multiplyScalar(fade);
    this.pos.copy(pos).add(this.carryPos);
    this.look.copy(look).add(this.carryLook);
    this.up.copy(up).add(this.carryUp).normalize();
  }
}
