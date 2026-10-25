import { towardViewer, type Plane, type Point3 } from "./kit/iso-kit";
import {
  DISP,
  GATE_Z,
  HOPPER_R,
  HOPPER_TOP,
  HOPPER_Z,
  P,
  PAY_OUT,
  REPAY_OUT,
  SLOT,
  TANK,
  TANK_R,
  TILL_ADV_SLOT,
  TILL_H,
  TILL_PAY_SLOT,
  VAULT_TOP,
} from "./view";

// Routes the coins travel along, and the chutes and pipe they ride on. Kept apart from
// geometry.ts so the live component can import them without the static paths.

const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const [tvx, tvy] = towardViewer(P);

// Coins ride on top of a bar of this thickness.
export const onBar = (from: Point3, to: Point3, thick: number): [Point3, Point3] => {
  const lift: Point3 = [0, 0, thick / 2 + 0.9];
  return [add(from, lift), add(to, lift)];
};

// Buyer's feed: from the dispenser's gate down to the vault's slot.
export const FEED_FROM: Point3 = [DISP.x + 19, DISP.y + 1, GATE_Z + 4];
export const FEED_TO: Point3 = [SLOT.x - 9, SLOT.y, VAULT_TOP + 5];
export const FEED_T = 2.4;

// Repayment chute: the vault's high outlet down onto the rim of the pool's hopper.
export const SPOUT_LEN = 8;
export const REPAY_FROM: Point3 = add(REPAY_OUT, [SPOUT_LEN, 0, -1]);
export const REPAY_TO: Point3 = [TANK.x - HOPPER_R + 1.5, TANK.y, HOPPER_TOP + 2.4];
export const REPAY_T = 2.4;

// Pay chute: the vault's low outlet, behind the tank, down to the farmer's till.
export const PAY_FROM: Point3 = add(PAY_OUT, [SPOUT_LEN, 0, -1]);
export const PAY_TO: Point3 = [TILL_PAY_SLOT.x - 3, TILL_PAY_SLOT.y, TILL_H + 6];
export const PAY_T = 2.4;

// Advance pipe: out of the tank's side, sloping down to the till's other slot. It leaves
// sideways so it never points at the viewer, which would foreshorten it into a stub.
export const PIPE_FROM: Point3 = (() => {
  const dx = TILL_ADV_SLOT.x - TANK.x;
  const dy = TILL_ADV_SLOT.y - TANK.y;
  const k = (TANK_R + 6) / Math.hypot(dx, dy);
  return [TANK.x + dx * k, TANK.y + dy * k, 32];
})();
export const PIPE_TO: Point3 = [TILL_ADV_SLOT.x - 2, TILL_ADV_SLOT.y, TILL_H + 7];
export const PIPE_T = 4;

const into = (slot: { x: number; y: number }, z: number): Point3[] => [
  [slot.x, slot.y, z + 1.5],
  [slot.x, slot.y, z - 4],
];

// Each route: out of a mouth, down a bar, then down into a slot or hopper where it is lost
// from view. The live model fades a coin only over those first and last short legs.
export const BUY_ROUTE: Point3[] = [...onBar(FEED_FROM, FEED_TO, FEED_T), ...into(SLOT, VAULT_TOP)];
export const REPAY_ROUTE: Point3[] = [
  add(REPAY_OUT, [1, 0, -1 + REPAY_T / 2 + 0.9]),
  ...onBar(REPAY_FROM, REPAY_TO, REPAY_T),
  [TANK.x - 2, TANK.y, HOPPER_TOP + 1],
  [TANK.x, TANK.y, HOPPER_Z + 2],
];
export const PAY_ROUTE: Point3[] = [add(PAY_OUT, [1, 0, -1 + PAY_T / 2 + 0.9]), ...onBar(PAY_FROM, PAY_TO, PAY_T), ...into(TILL_PAY_SLOT, TILL_H)];
export const ADVANCE_ROUTE: Point3[] = [...onBar(PIPE_FROM, PIPE_TO, PIPE_T), ...into(TILL_ADV_SLOT, TILL_H)];

// Sight glass on the pool tank, on the side that faces the viewer.
export const GLASS_C: Plane = [TANK.x + (TANK_R + 2.4) * tvx, TANK.y + (TANK_R + 2.4) * tvy];
export const GLASS_Z0 = 12;
export const GLASS_Z1 = 48;
export const GLASS_FRONT: [Plane, Plane] = (() => {
  const nx = -tvy * 1.6;
  const ny = tvx * 1.6;
  const fx = GLASS_C[0] + tvx * 2.2;
  const fy = GLASS_C[1] + tvy * 2.2;
  return [
    [fx - nx, fy - ny],
    [fx + nx, fy + ny],
  ];
})();
