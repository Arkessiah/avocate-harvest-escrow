import { axisVector, boxCorners, fitProjection, iso, type Flat, type Plan, type Point3 } from "./kit/iso-kit";

// World units are roughly screen pixels before scaling: x runs along the flow of money
// (buyer on the left, farmer on the right), y is depth (negative is the back), z is up.
export const WIDTH = 640;
export const HEIGHT = 420;
export const AZIMUTH = 55;

export const BASE: Plan = { x: -178, y: -84, w: 360, d: 150, r: 10 };
export const BASE_H = 9;
export const FOOT_H = 5;

// Buyer's coin dispenser.
export const DISP = { x: -138, y: -6 };
export const DISP_R = 14;
export const DISP_Z0 = 92;
export const DISP_Z1 = 136;
export const GATE_Z = 84;

// The escrow vault.
export const VAULT: Plan = { x: -62, y: -40, w: 96, d: 80, r: 3 };
export const PLINTH: Plan = { x: -68, y: -46, w: 108, d: 92, r: 4 };
export const PLINTH_H = 7;
export const VAULT_Z = PLINTH_H;
export const VAULT_TOP = 78;
export const SLOT = { x: -36, y: 0 };
export const SEAL = { x: 6, y: 10 };
export const DOOR: Plan = { x: -52, y: 40, w: 66, d: 3, r: 1 };
export const DOOR_Z0 = 16;
export const DOOR_Z1 = 68;
export const OUTLET_Z = 50;

// Validator's press, standing behind the vault.
export const POST: Plan = { x: 0, y: -74, w: 12, d: 12, r: 2 };
export const POST_TOP = 150;
export const ARM: Plan = { x: 1, y: -76, w: 10, d: 86, r: 2 };
export const ARM_Z = 142;
export const STAMP_REST = 110;
export const STAMP_DOWN = VAULT_TOP;

// Farmer's crate and the financing pool behind it.
export const CRATE: Plan = { x: 104, y: -26, w: 64, d: 58, r: 2 };
export const CRATE_H = 36;
export const TANK = { x: 154, y: -60 };
export const TANK_R = 22;
export const TANK_Z1 = 92;
export const LEVEL_FULL = 70;
export const LEVEL_LOW = 50;

const span: Point3[] = [
  ...boxCorners(BASE, -BASE_H - FOOT_H, 0),
  [DISP.x, DISP.y, DISP_Z1 + 6],
  [POST.x, POST.y, POST_TOP + 4],
  [TANK.x + TANK_R, TANK.y, TANK_Z1 + 8],
];

export const P = fitProjection(span, WIDTH, HEIGHT, { pad: 18, azimuth: AZIMUTH });

export const at = (point: Point3): Flat => iso(point, P);

// Screen offset of a world displacement, for moving pre-built groups.
export const offsetOf = (by: Point3): Flat => axisVector(P, by);
