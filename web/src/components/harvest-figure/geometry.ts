import {
  circleRing,
  extrude,
  insetPlan,
  knurl,
  onTop,
  pathOf,
  planOutline,
  sideArc,
  sideRing,
  sideSeam,
  slabOf,
  topMatrix,
  topTicks,
  towardViewer,
  type Flat,
  type Plan,
  type Plane,
  type Point3,
  type SolidPaths,
} from "./kit/iso-kit";
import {
  BASE,
  BASE_H,
  BED_H,
  BELT_D,
  BELT_Y,
  BELT_Z,
  BOARD_Z,
  CRATE,
  CRATE_X,
  CRATE_Y,
  DIAL,
  DIAL_R,
  DISP,
  DISP_R,
  DISP_Z0,
  DISP_Z1,
  DOCK_BELT,
  DOOR,
  DOOR_Z0,
  DOOR_Z1,
  FARM_BELT,
  FOOT_H,
  GATE_Z,
  HOPPER_R,
  HOPPER_TOP,
  HOPPER_Z,
  ORCHARD,
  P,
  PAY_OUT,
  PLINTH,
  PLINTH_H,
  POST,
  POST_TOP,
  ARM_Z,
  REPAY_OUT,
  SCALE,
  SLOT,
  STAMP,
  STAMP_REST,
  TANK,
  TANK_R,
  TANK_Z1,
  TILL,
  TILL_ADV_SLOT,
  TILL_H,
  TILL_PAY_SLOT,
  TREE,
  VAULT,
  VAULT_TOP,
  VAULT_Z,
  at,
} from "./view";
import { FACE_Y, WINDOW } from "./counter";
import { DIAL_C, DIAL_FACE_Y, onDial } from "./dial";
import {
  FEED_FROM,
  FEED_T,
  FEED_TO,
  GLASS_C,
  GLASS_FRONT,
  GLASS_Z0,
  GLASS_Z1,
  PAY_FROM,
  PAY_T,
  PAY_TO,
  PIPE_FROM,
  PIPE_T,
  PIPE_TO,
  REPAY_FROM,
  REPAY_T,
  REPAY_TO,
  SPOUT_LEN,
} from "./paths";

const slab = (plan: Plan, z: number, h: number, steps = 4, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
const puck = (cx: number, cy: number, r: number, z: number, h: number, steps = 32) => extrude(circleRing(cx, cy, r, steps), z, h, P);
const ring = (cx: number, cy: number, r: number, z: number, steps = 32) => onTop(circleRing(cx, cy, r, steps), z, P, true);
const seg = (a: Point3, b: Point3) => pathOf([at(a), at(b)]);
const join = (parts: string[]) => parts.join("");
const corners4 = ({ x, y, w, d }: Plan, inset: number): Plane[] => [
  [x + inset, y + inset],
  [x + w - inset, y + inset],
  [x + inset, y + d - inset],
  [x + w - inset, y + d - inset],
];

const VIEW: Point3 = (() => {
  const [vx, vy] = towardViewer(P);
  const e = ((P.elevation ?? 30) * Math.PI) / 180;
  return [vx * Math.cos(e), vy * Math.cos(e), Math.sin(e)];
})();
const [tvx, tvy] = towardViewer(P);

const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Point3, k: number): Point3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Point3): Point3 => scale(a, 1 / (Math.hypot(...a) || 1));

function hull(points: Flat[]): Flat[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Flat[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && turn(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Flat[] = [];
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// A straight bar between two points at any slope: chutes, rails and the pool's pipe. The
// kit's prisms only rise vertically, so this builds the six faces itself, keeps the ones
// facing the viewer, and buckets their tones the way the kit does.
export function barOf(from: Point3, to: Point3, width: number, thick: number): SolidPaths {
  const along = unit(sub(to, from));
  const side = unit(cross([0, 0, 1], along));
  const up = unit(cross(along, side));
  const w = scale(side, width / 2);
  const h = scale(up, thick / 2);
  const box = (end: Point3) => [add(add(end, w), h), add(sub(end, w), h), sub(sub(end, w), h), sub(add(end, w), h)];
  const [a0, a1, a2, a3] = box(from);
  const [b0, b1, b2, b3] = box(to);
  const faces: { quad: Point3[]; normal: Point3 }[] = [
    { quad: [a0!, a1!, b1!, b0!], normal: up },
    { quad: [a3!, a2!, b2!, b3!], normal: scale(up, -1) },
    { quad: [a0!, a3!, b3!, b0!], normal: side },
    { quad: [a1!, a2!, b2!, b1!], normal: scale(side, -1) },
    { quad: [a0!, a1!, a2!, a3!], normal: scale(along, -1) },
    { quad: [b0!, b1!, b2!, b3!], normal: along },
  ];
  const visible = faces.filter((f) => dot(f.normal, VIEW) > 1e-6);
  const light: Point3 = [-Math.sin(((P.azimuth ?? 45) * Math.PI) / 180), Math.cos(((P.azimuth ?? 45) * Math.PI) / 180), 0];
  const shades = ["", "", "", ""];
  let top = "";
  for (const face of visible) {
    const d = pathOf(face.quad.map(at), true);
    if (face.normal[2] > 0.7) top += d;
    else {
      const bucket = Math.min(3, Math.max(0, Math.floor(((dot(face.normal, light) + 1) / 2) * 4)));
      shades[bucket] += d;
    }
  }
  const all = [a0!, a1!, a2!, a3!, b0!, b1!, b2!, b3!].map(at);
  const outline = pathOf(hull(all), true);
  return { fill: outline, outline, crease: "", top, shades };
}

// A chute: a sloping plate between two low side rails.
const chuteOf = (from: Point3, to: Point3, width: number, thick: number) => ({
  plate: barOf(from, to, width, thick),
  rails: [-1, 1].map((s) => {
    const along = unit(sub(to, from));
    const side = unit(cross([0, 0, 1], along));
    const off = scale(side, s * (width / 2 + 0.8));
    return barOf(add(add(from, off), [0, 0, 2.6]), add(add(to, off), [0, 0, 2.6]), 1.6, 4.4);
  }),
});

// A rectangular mouth on a vertical face that faces +x, centred on `c`.
const mouthX = (c: Point3, half: number, z0: number, z1: number) =>
  pathOf([at([c[0], c[1] - half, c[2] + z0]), at([c[0], c[1] + half, c[2] + z0]), at([c[0], c[1] + half, c[2] + z1]), at([c[0], c[1] - half, c[2] + z1])], true);

// ---- Bench -------------------------------------------------------------------------
const FEET = corners4(BASE, 20);
const BASE_SCREWS = corners4(BASE, 8);
const LABEL: Plan = { x: BASE.x + 22, y: BASE.y + BASE.d - 13, w: 52, d: 9, r: 2 };

export const BASE_ART = {
  halo: slab(BASE, -BASE_H - FOOT_H, BASE_H + FOOT_H).fill,
  feet: FEET.map(([x, y]) => [puck(x, y, 8, -BASE_H - FOOT_H, 1.8, 20), puck(x, y, 6, -BASE_H - FOOT_H + 1.8, FOOT_H - 1.8, 20)]),
  slab: slab(BASE, -BASE_H, BASE_H, 8, 1.4),
  groove: planOutline(insetPlan(BASE, 5), 0, P),
  screws: BASE_SCREWS.map(([x, y]) => at([x, y, 0])),
  screwRings: join(BASE_SCREWS.map(([x, y]) => ring(x, y, 2.4, 0, 16))),
  label: slab(LABEL, 0, 0.8, 3),
  labelLine: planOutline(insetPlan(LABEL, 1.6), 0.8, P),
  labelScrews: [at([LABEL.x + 3.5, LABEL.y + LABEL.d / 2, 0.8]), at([LABEL.x + LABEL.w - 3.5, LABEL.y + LABEL.d / 2, 0.8])],
  labelRule: join([0, 1].map((row) => onTop([[LABEL.x + 8, LABEL.y + 3 + row * 3], [LABEL.x + (row ? 28 : 42), LABEL.y + 3 + row * 3]], 0.8, P))),
};

// ---- Buyer's dispenser ------------------------------------------------------------
const COLUMN: Plan = { x: DISP.x - 5, y: DISP.y - 5, w: 10, d: 10, r: 2 };
const GATE: Plan = { x: DISP.x + 7, y: DISP.y - 6, w: 12, d: 12, r: 1.5 };

export const DISPENSER_ART = {
  foot: puck(DISP.x, DISP.y, 19, 0, 4, 40),
  footRing: ring(DISP.x, DISP.y, 15, 4, 32),
  footScrews: [0, 1, 2, 3].map((k) => at([DISP.x + 15 * Math.cos(k * 1.57 + 0.4), DISP.y + 15 * Math.sin(k * 1.57 + 0.4), 4])),
  column: slab(COLUMN, 4, DISP_Z0 - 4, 3),
  collar: puck(DISP.x, DISP.y, DISP_R + 2, DISP_Z0 - 4, 4, 40),
  tube: puck(DISP.x, DISP.y, DISP_R, DISP_Z0, DISP_Z1 - DISP_Z0, 48),
  bands: join([DISP_Z0 + 9, DISP_Z1 - 9].map((z) => sideArc(DISP.x, DISP.y, DISP_R, z, P))),
  slit: (() => {
    const fx = DISP.x + DISP_R * tvx;
    const fy = DISP.y + DISP_R * tvy;
    const tx = -tvy * 3;
    const ty = tvx * 3;
    const z0 = DISP_Z0 + 13;
    const z1 = DISP_Z1 - 13;
    const frame = pathOf([at([fx - tx, fy - ty, z0]), at([fx + tx, fy + ty, z0]), at([fx + tx, fy + ty, z1]), at([fx - tx, fy - ty, z1])], true);
    const coins: string[] = [];
    for (let z = z0 + 2.5; z < z1 - 1; z += 2.6) coins.push(seg([fx - tx, fy - ty, z], [fx + tx, fy + ty, z]));
    return { frame, coins: join(coins) };
  })(),
  cap: puck(DISP.x, DISP.y, DISP_R + 1.5, DISP_Z1, 4, 48),
  capKnurl: knurl(DISP.x, DISP.y, DISP_R + 1.5, DISP_Z1, DISP_Z1 + 4, 40, P),
  knob: puck(DISP.x, DISP.y, 5, DISP_Z1 + 4, 3, 24),
  gate: slab(GATE, GATE_Z, 10, 2),
  gateLine: sideSeam(GATE, GATE_Z + 5, P, 2),
};

// The feed chute's lower end rests on a bracket standing on the vault top.
const FEED_BRACKET: Plan = { x: FEED_TO[0] - 2, y: FEED_TO[1] - 6, w: 4, d: 12, r: 0.8 };
export const FEED_ART = {
  bracket: slab(FEED_BRACKET, VAULT_TOP, FEED_TO[2] - FEED_T / 2 - VAULT_TOP, 2),
  ...chuteOf(FEED_FROM, FEED_TO, 14, FEED_T),
};

// ---- Escrow vault --------------------------------------------------------------------
const VAULT_SCREWS = corners4(VAULT, 6);
const SLOT_PLAN: Plan = { x: SLOT.x - 9, y: SLOT.y - 3, w: 18, d: 6, r: 1.5 };
const DOOR_DIAL: Point3 = [DOOR.x + 44, DOOR.y + DOOR.d, 40];
const spoutOf = (out: Point3): Plan => ({ x: out[0], y: out[1] - 7, w: SPOUT_LEN, d: 14, r: 1 });
const RIGHT = VAULT.x + VAULT.w;

export const VAULT_ART = {
  plinth: slab(PLINTH, 0, PLINTH_H, 4, 1),
  plinthSeam: planOutline(insetPlan(PLINTH, 3), PLINTH_H, P, 4),
  body: slab(VAULT, VAULT_Z, VAULT_TOP - VAULT_Z, 4, 1.2),
  bodySeams: join([VAULT_Z + 8, VAULT_TOP - 8].map((z) => sideSeam(VAULT, z, P, 4))),
  topPanel: planOutline(insetPlan(VAULT, 4), VAULT_TOP, P, 4),
  screws: VAULT_SCREWS.map(([x, y]) => at([x, y, VAULT_TOP])),
  slot: slab(SLOT_PLAN, VAULT_TOP, 0.6, 2),
  slotMouth: planOutline(insetPlan(SLOT_PLAN, 1.4), VAULT_TOP + 0.6, P, 2),
  door: slab(DOOR, DOOR_Z0, DOOR_Z1 - DOOR_Z0, 2),
  doorInset: pathOf(
    [
      at([DOOR.x + 3, FACE_Y, DOOR_Z0 + 3]),
      at([DOOR.x + DOOR.w - 3, FACE_Y, DOOR_Z0 + 3]),
      at([DOOR.x + DOOR.w - 3, FACE_Y, DOOR_Z1 - 3]),
      at([DOOR.x + 3, FACE_Y, DOOR_Z1 - 3]),
    ],
    true,
  ),
  hinges: [DOOR_Z0 + 8, DOOR_Z1 - 14].map((z) => slab({ x: DOOR.x - 3, y: DOOR.y - 1, w: 4, d: 5, r: 1 }, z, 6, 2)),
  dialOuter: sideRing(DOOR_DIAL, 8.5, "y", P, 36),
  dialInner: sideRing(DOOR_DIAL, 6, "y", P, 32),
  dialHub: sideRing(DOOR_DIAL, 1.8, "y", P, 16),
  dialTicks: join(
    Array.from({ length: 12 }, (_, k) => {
      const a = (k / 12) * Math.PI * 2;
      const r0 = k % 3 === 0 ? 6 : 6.9;
      return seg([DOOR_DIAL[0] + r0 * Math.cos(a), FACE_Y, DOOR_DIAL[2] + r0 * Math.sin(a)], [DOOR_DIAL[0] + 8.5 * Math.cos(a), FACE_Y, DOOR_DIAL[2] + 8.5 * Math.sin(a)]);
    }),
  ),
  handleStandoffs: [-7, 7].map((dx) => slab({ x: DOOR_DIAL[0] + dx - 1.4, y: FACE_Y, w: 2.8, d: 3.2, r: 0.6 }, DOOR_DIAL[2] - 20, 3, 2)),
  handle: slab({ x: DOOR_DIAL[0] - 10, y: FACE_Y + 3.2, w: 20, d: 2.4, r: 1 }, DOOR_DIAL[2] - 20.4, 3.8, 3, 0.4),
  window: slab({ x: WINDOW.x0, y: FACE_Y - 0.01, w: WINDOW.x1 - WINDOW.x0, d: 1.2, r: 0.6 }, WINDOW.z0, WINDOW.z1 - WINDOW.z0, 2),
  windowGlass: pathOf(
    [at([WINDOW.x0 + 1.4, FACE_Y + 1.2, WINDOW.z0 + 1.4]), at([WINDOW.x1 - 1.4, FACE_Y + 1.2, WINDOW.z0 + 1.4]), at([WINDOW.x1 - 1.4, FACE_Y + 1.2, WINDOW.z1 - 1.4]), at([WINDOW.x0 + 1.4, FACE_Y + 1.2, WINDOW.z1 - 1.4])],
    true,
  ),
  // Vents are closed slots on the right face, never lines that stop mid-face.
  vents: join([22, 27, 32, 37].map((z) => mouthX([RIGHT, VAULT.y + VAULT.d / 2 + 1, z], VAULT.d / 2 - 13, 0, 1.4))),
  // Two outlets on the right face: high to the pool's hopper, low to the farmer's till.
  spouts: [REPAY_OUT, PAY_OUT].map((out) => slab(spoutOf(out), out[2] - 5, 9, 2)),
  spoutMouths: join([REPAY_OUT, PAY_OUT].map((out) => mouthX([out[0] + SPOUT_LEN, out[1], out[2]], 5, -3, 2))),
};

// ---- Pool tank and the chutes into and out of it ------------------------------------
const PIPE_SPOUT: Point3 = (() => {
  const dx = PIPE_FROM[0] - TANK.x;
  const dy = PIPE_FROM[1] - TANK.y;
  const k = (TANK_R - 1) / Math.hypot(dx, dy);
  return [TANK.x + dx * k, TANK.y + dy * k, PIPE_FROM[2]];
})();

export const POOL_ART = {
  plinth: puck(TANK.x, TANK.y, TANK_R + 4, 0, 5, 56),
  plinthBolts: Array.from({ length: 10 }, (_, k) => [TANK.x + (TANK_R + 2) * Math.cos(k * 0.628), TANK.y + (TANK_R + 2) * Math.sin(k * 0.628)] as Plane)
    .filter(([x, y]) => (x - TANK.x) * tvx + (y - TANK.y) * tvy > 2)
    .map(([x, y]) => at([x, y, 5])),
  body: puck(TANK.x, TANK.y, TANK_R, 5, TANK_Z1 - 5, 64),
  bands: join([20, 44].map((z) => sideArc(TANK.x, TANK.y, TANK_R, z, P, 36))),
  shoulder: puck(TANK.x, TANK.y, TANK_R - 3, TANK_Z1, 2, 56),
  neck: puck(TANK.x, TANK.y, 6, TANK_Z1 + 2, HOPPER_Z - TANK_Z1 - 2, 32),
  hopper: puck(TANK.x, TANK.y, HOPPER_R, HOPPER_Z, HOPPER_TOP - HOPPER_Z, 48),
  hopperMouth: ring(TANK.x, TANK.y, HOPPER_R - 1.6, HOPPER_TOP, 40),
  glass: puck(GLASS_C[0], GLASS_C[1], 2.4, GLASS_Z0, GLASS_Z1 - GLASS_Z0, 16),
  glassCaps: [GLASS_Z0 - 3, GLASS_Z1].map((z) => puck(GLASS_C[0], GLASS_C[1], 3.4, z, 3, 16)),
  glassTicks: join(
    Array.from({ length: 8 }, (_, k) => {
      const z = GLASS_Z0 + 3 + k * 4.5;
      const [a, b] = GLASS_FRONT;
      const ex: Plane = [b[0] + (b[0] - a[0]) * 0.6, b[1] + (b[1] - a[1]) * 0.6];
      const len = k % 4 === 0 ? 3 : 1.8;
      return seg([ex[0], ex[1], z], [ex[0] + (b[0] - a[0]) * (len / 4), ex[1] + (b[1] - a[1]) * (len / 4), z]);
    }),
  ),
  pipeSpout: barOf(PIPE_SPOUT, PIPE_FROM, 9, 9),
  pipeFlange: puck(PIPE_SPOUT[0], PIPE_SPOUT[1], 6, PIPE_SPOUT[2] - 6.5, 13, 28),
  pipe: barOf(PIPE_FROM, PIPE_TO, 8, PIPE_T),
  pipeLip: barOf(add(PIPE_TO, [0, 0, -1]), add(PIPE_TO, [0, 0, -6]), 10, 10),
  valveWheel: puck(PIPE_FROM[0], PIPE_FROM[1], 5, PIPE_FROM[2] + PIPE_T / 2, 1.6, 28),
  valveStem: puck(PIPE_FROM[0], PIPE_FROM[1], 1.4, PIPE_FROM[2] + PIPE_T / 2 + 1.6, 2.2, 12),
};

export const REPAY_ART = chuteOf(REPAY_FROM, REPAY_TO, 13, REPAY_T);

// The pay chute is long: a leg holds its middle, and its lower end rests on a bracket on
// the till.
const PAY_MID: Point3 = add(PAY_FROM, scale(sub(PAY_TO, PAY_FROM), 0.62));
export const PAY_ART = {
  ...chuteOf(PAY_FROM, PAY_TO, 13, PAY_T),
  leg: slab({ x: PAY_MID[0] - 2.5, y: PAY_MID[1] - 2.5, w: 5, d: 5, r: 1 }, 0, PAY_MID[2] - PAY_T / 2, 2),
  legFoot: slab({ x: PAY_MID[0] - 5, y: PAY_MID[1] - 5, w: 10, d: 10, r: 1.5 }, 0, 2, 2),
  bracket: slab({ x: PAY_TO[0] - 2, y: PAY_TO[1] - 5, w: 4, d: 10, r: 0.8 }, TILL_H, PAY_TO[2] - PAY_T / 2 - TILL_H, 2),
};

// ---- Farmer's till ---------------------------------------------------------------------
const slotPlan = (c: { x: number; y: number }): Plan => ({ x: c.x - 3, y: c.y - 7, w: 6, d: 14, r: 1.5 });
export const TILL_ART = {
  halo: slab(TILL, 0, TILL_H).fill,
  feet: corners4(TILL, 3).map(([x, y]) => slab({ x: x - 2, y: y - 2, w: 4, d: 4, r: 1 }, 0, 2, 2)),
  body: slab(TILL, 2, TILL_H - 2, 3, 0.8),
  seam: sideSeam(TILL, TILL_H - 5, P, 3),
  slots: [TILL_PAY_SLOT, TILL_ADV_SLOT].map((c) => slab(slotPlan(c), TILL_H, 0.6, 2)),
  slotMouths: join([TILL_PAY_SLOT, TILL_ADV_SLOT].map((c) => planOutline(insetPlan(slotPlan(c), 1.2), TILL_H + 0.6, P, 2))),
  screws: corners4(TILL, 3.5).map(([x, y]) => at([x, y, TILL_H])),
  // A small leaf badge on the front: this box is the farmer's.
  badge: slab({ x: TILL.x + TILL.w - 14, y: TILL.y + TILL.d, w: 9, d: 0.8, r: 0.6 }, 7, 7, 2),
};

// ---- Orchard -----------------------------------------------------------------------------
const EDGE = 3.5;
const BED_SOIL = insetPlan(ORCHARD, EDGE);
const edgeBoards: Plan[] = [
  { x: ORCHARD.x, y: ORCHARD.y, w: ORCHARD.w, d: EDGE, r: 0.6 },
  { x: ORCHARD.x, y: ORCHARD.y + ORCHARD.d - EDGE, w: ORCHARD.w, d: EDGE, r: 0.6 },
  { x: ORCHARD.x, y: ORCHARD.y + EDGE, w: EDGE, d: ORCHARD.d - EDGE * 2, r: 0.6 },
  { x: ORCHARD.x + ORCHARD.w - EDGE, y: ORCHARD.y + EDGE, w: EDGE, d: ORCHARD.d - EDGE * 2, r: 0.6 },
];
// Furrows run across the bed, from the left board to the right one.
const FURROWS = [ORCHARD.y + 14, ORCHARD.y + 26, ORCHARD.y + 54, ORCHARD.y + 66];
// The crown is a squashed sphere cut into bands, bottom up, each band as wide as the sphere
// at its middle: a clipped, terraced tree, the way orchard avocados are pruned.
const CROWN = { z0: 38, z1: 86, r: 27 };
const CANOPY: [number, number, number][] = (() => {
  const bands = 8;
  const h = (CROWN.z1 - CROWN.z0) / bands;
  const mid = (CROWN.z0 + CROWN.z1) / 2;
  const half = (CROWN.z1 - CROWN.z0) / 2;
  return Array.from({ length: bands }, (_, i) => {
    const zc = CROWN.z0 + h * (i + 0.5);
    const r = CROWN.r * Math.sqrt(Math.max(0.12, 1 - ((zc - mid) / half) ** 2));
    return [r, CROWN.z0 + h * i, h] as [number, number, number];
  });
})();
// Fruit hangs on the side of the tree that faces the viewer.
const HANGING = [-0.6, 0.05, 0.7].map((a, i) => {
  const base = Math.atan2(tvy, tvx);
  const ang = base + a;
  const r = 15 + (i % 2) * 3;
  return { x: TREE.x + r * Math.cos(ang), y: TREE.y + r * Math.sin(ang), z: 33 - (i % 2) * 2 };
});
const ovalRing = (cx: number, cy: number, rx: number, ry: number): Plane[] => circleRing(cx, cy, 1, 24).map(([px, py]) => [cx + (px - cx) * rx, cy + (py - cy) * ry]);

export const ORCHARD_ART = {
  halo: slab(ORCHARD, 0, BED_H).fill,
  soil: slab(BED_SOIL, 0, BED_H - 1.5, 2),
  furrows: join(FURROWS.map((y) => onTop([[BED_SOIL.x, y], [BED_SOIL.x + BED_SOIL.w, y]], BED_H - 1.5, P))),
  boards: edgeBoards.map((b) => slab(b, 0, BED_H, 2)),
  stakes: corners4(ORCHARD, 1.75).map(([x, y]) => at([x, y, BED_H])),
  trunkFlare: puck(TREE.x, TREE.y, 6.5, BED_H - 1.5, 3, 24),
  trunk: puck(TREE.x, TREE.y, 3.6, BED_H + 1.5, CROWN.z0 + 2 - BED_H - 1.5, 20),
  canopy: CANOPY.map(([r, z, h]) => puck(TREE.x, TREE.y, r, z, h, 48)),
  fruit: HANGING.map((f) => ({
    // A pear shape: a fuller body below a narrower neck.
    body: extrude(ovalRing(f.x, f.y, 2.6, 2.2), f.z - 4.5, 3.4, P),
    top: extrude(ovalRing(f.x + 0.2, f.y - 0.2, 1.7, 1.4), f.z - 1.1, 2.7, P),
    // The stalk rises to the rim of the crown's lowest band.
    stalk: (() => {
      const k = CANOPY[0]![0] / Math.hypot(f.x - TREE.x, f.y - TREE.y);
      return seg([f.x, f.y, f.z + 1.6], [TREE.x + (f.x - TREE.x) * k, TREE.y + (f.y - TREE.y) * k, CROWN.z0]);
    })(),
  })),
  // Two young seedlings in the front furrow.
  seedlings: [ORCHARD.x + 22, ORCHARD.x + 74].map((x) => ({
    stem: puck(x, FURROWS[3]!, 0.8, BED_H - 1.5, 5, 10),
    leaves: puck(x, FURROWS[3]!, 3, BED_H + 3, 1.6, 16),
  })),
};

// ---- Conveyor ---------------------------------------------------------------------------
const RAIL = 2.4;
const beltPlan = (x0: number, x1: number): Plan => ({ x: x0, y: BELT_Y, w: x1 - x0, d: BELT_D, r: 1 });
const railPlan = (x0: number, x1: number, front: boolean): Plan => ({
  x: x0,
  y: front ? BELT_Y + BELT_D : BELT_Y - RAIL,
  w: x1 - x0,
  d: RAIL,
  r: 0.6,
});
const legsOf = (x0: number, x1: number) =>
  [x0 + 4, x1 - 8].flatMap((x) => [BELT_Y + 1, BELT_Y + BELT_D - 5].map((y) => slab({ x, y, w: 4, d: 4, r: 0.8 }, 0, BELT_Z - 4, 2)));
const ribsOf = (x0: number, x1: number) => {
  const out: string[] = [];
  for (let x = x0 + 5; x < x1 - 3; x += 7) out.push(onTop([[x, BELT_Y], [x, BELT_Y + BELT_D]], BELT_Z, P));
  return join(out);
};
// Roller ends seen on the front rail: a ring with a hub dot at each end of a section.
const rollersOf = (x0: number, x1: number) => [x0 + 4, x1 - 4].map((x): [Point3, Flat] => [[x, BELT_Y + BELT_D + RAIL, BELT_Z - 3.5], at([x, BELT_Y + BELT_D + RAIL, BELT_Z - 3.5])]);

function section(x0: number, x1: number) {
  return {
    legs: legsOf(x0, x1),
    back: slab(railPlan(x0, x1, false), BELT_Z - 7, 10, 2),
    belt: slab(beltPlan(x0 + 1, x1 - 1), BELT_Z - 3, 3, 2),
    ribs: ribsOf(x0 + 1, x1 - 1),
    front: slab(railPlan(x0, x1, true), BELT_Z - 7, 10, 2),
    rollers: rollersOf(x0, x1).map(([c]) => sideRing(c, 2.6, "y", P, 20)),
    hubs: rollersOf(x0, x1).map(([, f]) => f),
  };
}

export const FARM_BELT_ART = section(FARM_BELT.x0, FARM_BELT.x1);
export const DOCK_BELT_ART = section(DOCK_BELT.x0, DOCK_BELT.x1);

// The buyer's end: a stop plate where delivered crates come to rest.
const STOP: Plan = { x: DOCK_BELT.x0 - 4, y: BELT_Y - RAIL, w: 4, d: BELT_D + RAIL * 2, r: 0.8 };
export const STOP_ART = {
  plate: slab(STOP, 0, BELT_Z + 9, 2),
  screws: [BELT_Y + 6, BELT_Y + BELT_D - 6].map((y) => at([STOP.x + 2, y, BELT_Z + 9])),
};

// ---- Inspection scale ---------------------------------------------------------------------
const SCALE_BASE: Plan = { x: SCALE.x0, y: BELT_Y - 3, w: SCALE.x1 - SCALE.x0, d: BELT_D + 6, r: 2 };
const SCALE_PAN: Plan = { x: SCALE.x0 + 1, y: BELT_Y, w: SCALE.x1 - SCALE.x0 - 2, d: BELT_D, r: 1.5 };
const DIAL_BOX: Plan = { x: DIAL.x - 11, y: DIAL.y - 4, w: 22, d: DIAL_FACE_Y - DIAL.y + 4, r: 2 };

export const SCALE_ART = {
  halo: slab(SCALE_BASE, 0, 10).fill,
  base: slab(SCALE_BASE, 0, 10, 3, 0.8),
  baseSeam: sideSeam(SCALE_BASE, 5, P, 3),
  pan: slab(SCALE_PAN, 10, BELT_Z - 10, 3, 0.6),
  panGroove: planOutline(insetPlan(SCALE_PAN, 3), BELT_Z, P, 3),
  // The dial stands on a short neck from the front of the scale.
  neck: slab({ x: DIAL.x - 2.5, y: SCALE_BASE.y + SCALE_BASE.d, w: 5, d: DIAL.y - 4 - (SCALE_BASE.y + SCALE_BASE.d), r: 0.8 }, 3, DIAL.z - 10, 2),
  box: slab(DIAL_BOX, DIAL.z - 11, 22, 3, 0.8),
  face: sideRing(DIAL_C, DIAL_R, "y", P, 40),
  faceInner: sideRing(DIAL_C, DIAL_R - 1.6, "y", P, 36),
  ticks: join(
    Array.from({ length: 11 }, (_, k) => {
      const f = k / 10;
      return pathOf([at(onDial(f, k % 5 === 0 ? DIAL_R - 3.4 : DIAL_R - 2.6)), at(onDial(f, DIAL_R - 1.6))]);
    }),
  ),
  hub: at(DIAL_C),
};

// ---- Crate (built at the loading bay, moved along the belt) --------------------------------
const CRATE_PLAN: Plan = { x: CRATE_X.farm - CRATE.w / 2, y: CRATE_Y - CRATE.d / 2, w: CRATE.w, d: CRATE.d, r: 1.5 };
const CRATE_TOP = BELT_Z + CRATE.h;
const BOARD: Plan = { x: CRATE_PLAN.x, y: CRATE_PLAN.y, w: CRATE.w, d: 7, r: 0.8 };
// The seal lands where the stamp is, in the crate's own frame while it sits on the scale.
export const SEAL_AT: Plane = [CRATE_X.farm + (STAMP.x - CRATE_X.scale), STAMP.y];
const FRUIT: Plane[] = [-9, 0, 9].flatMap((dx) => [3.5, 10.5].map((dy): Plane => [CRATE_X.farm + dx, CRATE_PLAN.y + BOARD.d + dy]));

export const CRATE_ART = {
  halo: slab(CRATE_PLAN, BELT_Z, CRATE.h).fill,
  box: slab(CRATE_PLAN, BELT_Z, CRATE.h, 2),
  slats: join([BELT_Z + CRATE.h / 3, BELT_Z + (CRATE.h * 2) / 3].map((z) => sideSeam(CRATE_PLAN, z, P, 2))),
  posts: corners4(CRATE_PLAN, 0).map(([x, y]) => slab({ x: x - 2, y: y - 2, w: 4, d: 4, r: 0.8 }, BELT_Z, CRATE.h + 1.5, 2)),
  rim: planOutline(insetPlan(CRATE_PLAN, 2.5), CRATE_TOP, P, 2),
  fruit: FRUIT.map(([x, y]) => ({
    body: extrude(ovalRing(x, y, 3.6, 2.7), CRATE_TOP - 2, 2.6, P),
    top: extrude(ovalRing(x + 0.4, y - 0.3, 2.4, 1.8), CRATE_TOP + 0.6, 1.3, P),
    stem: at([x + 1.2, y - 0.8, CRATE_TOP + 1.9]),
  })),
  board: slab(BOARD, CRATE_TOP, BOARD_Z - CRATE_TOP, 2),
  boardScrews: [BOARD.x + 3, BOARD.x + BOARD.w - 3].map((x) => at([x, BOARD.y + BOARD.d / 2, BOARD_Z])),
};

export const SEAL_ART = {
  disc: puck(SEAL_AT[0], SEAL_AT[1], 3.8, BOARD_Z, 0.7, 32),
  mark: pathOf([at([SEAL_AT[0] - 1.6, SEAL_AT[1] + 0.3, BOARD_Z + 0.7]), at([SEAL_AT[0] - 0.4, SEAL_AT[1] + 1.5, BOARD_Z + 0.7]), at([SEAL_AT[0] + 1.9, SEAL_AT[1] - 1.2, BOARD_Z + 0.7])]),
};

// ---- Validator's press ----------------------------------------------------------------------
const POST_PLAN: Plan = { x: POST.x - 6, y: POST.y - 6, w: 12, d: 12, r: 2 };
const ARM_PLAN: Plan = { x: POST.x - 5, y: POST.y - 6, w: 10, d: STAMP.y - POST.y + 15, r: 2 };
const HOUSING_Z0 = 96;
export const STAMP_HEAD = 6;

export const PRESS_ART = {
  foot: slab({ x: POST_PLAN.x - 4, y: POST_PLAN.y - 4, w: POST_PLAN.w + 8, d: POST_PLAN.d + 8, r: 2 }, 0, 4, 2, 0.6),
  footScrews: corners4({ x: POST_PLAN.x - 4, y: POST_PLAN.y - 4, w: POST_PLAN.w + 8, d: POST_PLAN.d + 8, r: 2 }, 2.4).map(([x, y]) => at([x, y, 4])),
  post: slab(POST_PLAN, 4, POST_TOP - 4, 3),
  postTicks: join(Array.from({ length: 9 }, (_, k) => seg([POST_PLAN.x + POST_PLAN.w, POST_PLAN.y + 2, 30 + k * 10], [POST_PLAN.x + POST_PLAN.w, POST_PLAN.y + (k % 4 === 0 ? 8 : 5.5), 30 + k * 10]))),
  postCap: slab({ x: POST_PLAN.x - 1, y: POST_PLAN.y - 1, w: POST_PLAN.w + 2, d: POST_PLAN.d + 2, r: 2 }, POST_TOP, 3, 3, 0.4),
  arm: slab(ARM_PLAN, ARM_Z, 8, 3, 0.6),
  armLine: sideSeam(ARM_PLAN, ARM_Z + 4, P, 3),
  armScrews: [at([ARM_PLAN.x + 5, ARM_PLAN.y + ARM_PLAN.d - 6, ARM_Z + 8])],
  housing: puck(STAMP.x, STAMP.y, 6.5, HOUSING_Z0, ARM_Z - HOUSING_Z0, 32),
  housingBand: sideArc(STAMP.x, STAMP.y, 6.5, HOUSING_Z0 + 8, P),
  gland: puck(STAMP.x, STAMP.y, 4, HOUSING_Z0 - 2, 2, 24),
  // Built at rest and moved down by the live component. The rod's top stays inside the
  // gland at full stroke and hides inside the arm at rest.
  rod: puck(STAMP.x, STAMP.y, 1.8, STAMP_REST + STAMP_HEAD, ARM_Z + 6 - STAMP_REST - STAMP_HEAD, 16),
  head: puck(STAMP.x, STAMP.y, 5.5, STAMP_REST + 1.2, STAMP_HEAD - 1.2, 32),
  headKnurl: knurl(STAMP.x, STAMP.y, 5.5, STAMP_REST + 1.2, STAMP_REST + STAMP_HEAD, 28, P),
  pad: puck(STAMP.x, STAMP.y, 4.6, STAMP_REST, 1.2, 32),
};

// ---- Coins ---------------------------------------------------------------------------------
// Every coin is drawn once at the world origin and moved to its place each frame.
export const COIN_R = 5.5;
export const COIN_H = 1.7;
export const COIN_ART = {
  body: puck(0, 0, COIN_R, 0, COIN_H, 32),
  ring: ring(0, 0, COIN_R - 1.5, COIN_H, 28),
  mark: topMatrix([0, 1.7], COIN_H, P, "x"),
};
