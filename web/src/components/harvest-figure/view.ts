import { axisVector, boxCorners, fitProjection, iso, type Flat, type Plan, type Point3 } from "./kit/iso-kit";

// World units are roughly screen pixels before scaling. x runs left to right (buyer on the
// left, farmer on the right), y is depth (negative is the back), z is up. The camera looks
// from +x, +y, so the +x and +y faces of every part are the visible ones.
//
// Two rows on one bench, flowing in opposite directions:
//   back row, money:  buyer's dispenser -> escrow vault -> pool tank / farmer's till
//   front row, goods: farmer's orchard -> conveyor -> inspection scale -> buyer's dock
export const WIDTH = 640;
export const HEIGHT = 440;
export const AZIMUTH = 52;

export const BASE: Plan = { x: -206, y: -100, w: 412, d: 152, r: 10 };
export const BASE_H = 9;
export const FOOT_H = 5;

// ---- Money row ---------------------------------------------------------------------
export const DISP = { x: -178, y: -58 };
export const DISP_R = 13;
export const DISP_Z0 = 92;
export const DISP_Z1 = 132;
export const GATE_Z = 84;

export const VAULT: Plan = { x: -146, y: -86, w: 78, d: 58, r: 3 };
export const PLINTH: Plan = { x: -152, y: -92, w: 90, d: 70, r: 4 };
export const PLINTH_H = 6;
export const VAULT_Z = PLINTH_H;
export const VAULT_TOP = 86;
export const SLOT = { x: -122, y: -57 };
export const DOOR: Plan = { x: -138, y: VAULT.y + VAULT.d, w: 56, d: 3, r: 1 };
export const DOOR_Z0 = 16;
export const DOOR_Z1 = 70;
// Two outlets on the vault's right face: a high one to the pool, a low one to the farmer.
export const REPAY_OUT: Point3 = [VAULT.x + VAULT.w, -50, 80];
export const PAY_OUT: Point3 = [VAULT.x + VAULT.w, -80, 58];

export const TANK = { x: 0, y: -50 };
export const TANK_R = 19;
export const TANK_Z1 = 52;
export const HOPPER_R = 11;
export const HOPPER_Z = TANK_Z1 + 4;
export const HOPPER_TOP = HOPPER_Z + 9;
export const LEVEL_FULL = 40;
export const LEVEL_LOW = 22;
// Repayment includes the pool's 2% yield, so the tank ends a little fuller than it began.
export const LEVEL_REPAID = LEVEL_FULL + 2;

export const TILL: Plan = { x: 54, y: -96, w: 36, d: 30, r: 2 };
export const TILL_H = 22;
export const TILL_PAY_SLOT = { x: 62, y: -84 };
export const TILL_ADV_SLOT = { x: 80, y: -76 };

// ---- Goods row ---------------------------------------------------------------------
export const ORCHARD: Plan = { x: 104, y: -96, w: 96, d: 80, r: 3 };
export const BED_H = 7;
export const TREE = { x: 152, y: -56 };

export const BELT_Y = 2;
export const BELT_D = 34;
export const BELT_Z = 16;
// Three sections: the farm belt, the scale platform and the buyer's belt.
export const FARM_BELT = { x0: 44, x1: 192 };
export const SCALE = { x0: -6, x1: 38 };
export const DOCK_BELT = { x0: -176, x1: -12 };

export const CRATE = { w: 30, d: 26, h: 20 };
// Where the crate's centre stops: loading bay under the orchard, scale, buyer's dock.
export const CRATE_X = { farm: 158, scale: 16, dock: -120 };
export const CRATE_Y = BELT_Y + BELT_D / 2;

export const POST = { x: 10, y: -20 };
export const POST_TOP = 132;
export const ARM_Z = 124;
// The stamp comes down over the board across the crate's back end.
export const STAMP = { x: POST.x, y: CRATE_Y - CRATE.d / 2 + 4 };
export const STAMP_REST = 76;
// The seal lands on the board across the crate's back end, just above the crate's rim.
export const BOARD_Z = BELT_Z + CRATE.h + 3;
export const STAMP_DOWN = BOARD_Z + 1.2;

export const DIAL = { x: SCALE.x0 + 22, y: BELT_Y + BELT_D + 7, z: 30 };
export const DIAL_R = 9;

const span: Point3[] = [
  ...boxCorners(BASE, -BASE_H - FOOT_H, 0),
  [DISP.x, DISP.y, DISP_Z1 + 6],
  [POST.x, POST.y, POST_TOP + 4],
  [TREE.x, TREE.y, 92],
];

export const P = fitProjection(span, WIDTH, HEIGHT, { pad: 16, azimuth: AZIMUTH });

export const at = (point: Point3): Flat => iso(point, P);

// Screen offset of a world displacement, for moving pre-built groups.
export const offsetOf = (by: Point3): Flat => axisVector(P, by);
