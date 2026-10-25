import { pathOf, type Point3 } from "./kit/iso-kit";
import { DIAL, DIAL_R, at } from "./view";

// The scale's dial: a round face standing on the front of the scale, in the x–z plane.
// Shared by the static face (geometry.ts) and the live needle, so the needle always turns
// about the face's own centre.
export const DIAL_FACE_Y = DIAL.y + 2.2;
export const DIAL_C: Point3 = [DIAL.x, DIAL_FACE_Y, DIAL.z];
const SWEEP = 270;
const START = -135;

export const onDial = (fraction: number, radius: number): Point3 => {
  const a = ((START + SWEEP * fraction) * Math.PI) / 180;
  return [DIAL_C[0] + radius * Math.sin(a), DIAL_FACE_Y + 0.3, DIAL_C[2] + radius * Math.cos(a)];
};

// Needle for a reading between 0 (empty) and 1 (full scale): a short tail behind the hub
// and a tip just inside the tick ring.
export function needlePath(fraction: number) {
  const tip = onDial(fraction, DIAL_R * 0.72);
  const tail = onDial(fraction + 0.5, DIAL_R * 0.18);
  return pathOf([at(tail), at(tip)]);
}
