import { towardViewer, type Plane, type Point3 } from "./kit/iso-kit";
import { CRATE, CRATE_H, DISP, GATE_Z, OUTLET_Z, P, SLOT, TANK, TANK_R, VAULT, VAULT_TOP } from "./view";

// Routes the coins travel along. Kept apart from geometry.ts so the live component can
// import them without pulling every static path into the client bundle.

const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const [tvx, tvy] = towardViewer(P);

// Coins ride on top of a bar of this thickness (the chutes and the feed pipe).
export const onBar = (from: Point3, to: Point3, thick: number): [Point3, Point3] => {
  const lift: Point3 = [0, 0, thick / 2 + 0.9];
  return [add(from, lift), add(to, lift)];
};

export const FEED_FROM: Point3 = [DISP.x + 20, DISP.y + 1, GATE_Z + 4];
export const FEED_TO: Point3 = [SLOT.x - 8, SLOT.y - 1, VAULT_TOP + 5];
export const FEED_T = 2.4;

export const CHUTE_FROM: Point3 = [VAULT.x + VAULT.w + 9, 0, OUTLET_Z - 4];
export const CHUTE_TO: Point3 = [CRATE.x - 4, 2, CRATE_H + 8];
export const CHUTE_T = 2.4;

// The feed leaves the tank sideways so it never points at the viewer, which would
// foreshorten it into a stub.
export const PIPE_FROM: Point3 = [TANK.x - (TANK_R + 4) * 0.8, TANK.y + (TANK_R + 4) * 0.6, 60];
export const PIPE_TO: Point3 = [CRATE.x + 14, CRATE.y + 14, CRATE_H + 10];
export const PIPE_T = 4;

const crateTop = (x: number, y: number): Point3 => [CRATE.x + x, CRATE.y + y, CRATE_H + 5.5];

// Each route: slide down a bar, then drop to where the coin disappears.
export const BUY_ROUTE: Point3[] = [...onBar(FEED_FROM, FEED_TO, FEED_T), [SLOT.x, SLOT.y, VAULT_TOP + 1.5], [SLOT.x, SLOT.y, VAULT_TOP - 3]];
export const PAY_ROUTE: Point3[] = [...onBar(CHUTE_FROM, CHUTE_TO, CHUTE_T), crateTop(14, 30), crateTop(18, 30)];
export const ADVANCE_ROUTE: Point3[] = [...onBar(PIPE_FROM, PIPE_TO, PIPE_T), crateTop(16, 20), crateTop(16, 22)];

// Sight glass on the pool tank, on the side that faces the viewer.
export const GLASS_C: Plane = [TANK.x + (TANK_R + 2.4) * tvx, TANK.y + (TANK_R + 2.4) * tvy];
export const GLASS_Z0 = 20;
export const GLASS_Z1 = 84;
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
