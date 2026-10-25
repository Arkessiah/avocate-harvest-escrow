import {
  circleRing,
  extrude,
  insetPlan,
  knurl,
  onTop,
  pathOf,
  planOutline,
  sideArc,
  sideMatrix,
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
  ARM,
  ARM_Z,
  BASE,
  BASE_H,
  CRATE,
  CRATE_H,
  DISP,
  DISP_R,
  DISP_Z0,
  DISP_Z1,
  DOOR,
  DOOR_Z0,
  DOOR_Z1,
  FOOT_H,
  GATE_Z,
  OUTLET_Z,
  P,
  PLINTH,
  PLINTH_H,
  POST,
  POST_TOP,
  SEAL,
  SLOT,
  STAMP_REST,
  TANK,
  TANK_R,
  TANK_Z1,
  VAULT,
  VAULT_TOP,
  VAULT_Z,
  at,
} from "./view";
import { FACE_Y, WINDOW } from "./counter";
import { CHUTE_FROM, CHUTE_T, CHUTE_TO, FEED_FROM, FEED_T, FEED_TO, GLASS_C, GLASS_FRONT, GLASS_Z0, GLASS_Z1, PIPE_FROM, PIPE_T, PIPE_TO } from "./paths";

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

// A straight bar between two points at any slope: chutes, rails and the pool's feed pipe.
// The kit's prisms only rise vertically, so this builds the six faces itself, keeps the
// ones facing the viewer, and buckets their tones the same way the kit does.
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

// ---- Base -------------------------------------------------------------------------
const FEET = corners4(BASE, 20);
const BASE_SCREWS = corners4(BASE, 8);
const LABEL: Plan = { x: BASE.x + 24, y: BASE.y + BASE.d - 20, w: 58, d: 12, r: 2 };

const RULER: Plan = { x: -86, y: BASE.y + BASE.d - 17, w: 176, d: 9, r: 1.5 };
const RULER_TICKS = topTicks(RULER.x + 4, RULER.x + RULER.w - 4, 4, 5, RULER.y + 0.6, 0.7, [2.6, 5], P);

export const BASE_ART = {
  ruler: slab(RULER, 0, 0.7, 2),
  rulerMinor: RULER_TICKS.minor,
  rulerMajor: RULER_TICKS.major,
  rulerScrews: [at([RULER.x + 2.4, RULER.y + RULER.d - 2.4, 0.7]), at([RULER.x + RULER.w - 2.4, RULER.y + RULER.d - 2.4, 0.7])],
  halo: slab(BASE, -BASE_H - FOOT_H, BASE_H + FOOT_H).fill,
  feet: FEET.map(([x, y]) => [puck(x, y, 8, -BASE_H - FOOT_H, 1.8, 20), puck(x, y, 6, -BASE_H - FOOT_H + 1.8, FOOT_H - 1.8, 20)]),
  slab: slab(BASE, -BASE_H, BASE_H, 8, 1.4),
  groove: planOutline(insetPlan(BASE, 5), 0, P),
  screws: BASE_SCREWS.map(([x, y]) => at([x, y, 0])),
  screwRings: join(BASE_SCREWS.map(([x, y]) => ring(x, y, 2.4, 0, 16))),
  label: slab(LABEL, 0, 0.8, 3),
  labelLine: planOutline(insetPlan(LABEL, 1.6), 0.8, P),
  labelScrews: [at([LABEL.x + 3.5, LABEL.y + LABEL.d / 2, 0.8]), at([LABEL.x + LABEL.w - 3.5, LABEL.y + LABEL.d / 2, 0.8])],
  labelRule: join([0, 1, 2].map((row) => onTop([[LABEL.x + 8, LABEL.y + 3.4 + row * 2.6], [LABEL.x + (row === 1 ? 30 : 46), LABEL.y + 3.4 + row * 2.6]], 0.8, P))),
};

// ---- Buyer's dispenser ------------------------------------------------------------
const COLUMN: Plan = { x: DISP.x - 5, y: DISP.y - 5, w: 10, d: 10, r: 2 };
const GATE: Plan = { x: DISP.x + 8, y: DISP.y - 6, w: 12, d: 12, r: 1.5 };
const FEED_W = 15;
const [fv0, fv1] = [FEED_FROM, FEED_TO];

export const DISPENSER_ART = {
  foot: puck(DISP.x, DISP.y, 20, 0, 4, 40),
  footRing: ring(DISP.x, DISP.y, 16, 4, 32),
  footScrews: [0, 1, 2, 3].map((k) => at([DISP.x + 16 * Math.cos(k * 1.57 + 0.4), DISP.y + 16 * Math.sin(k * 1.57 + 0.4), 4])),
  column: slab(COLUMN, 4, DISP_Z0 - 4, 3),
  collar: puck(DISP.x, DISP.y, DISP_R + 2, DISP_Z0 - 4, 4, 40),
  tube: puck(DISP.x, DISP.y, DISP_R, DISP_Z0, DISP_Z1 - DISP_Z0, 48),
  bands: join([DISP_Z0 + 10, DISP_Z1 - 10].map((z) => sideArc(DISP.x, DISP.y, DISP_R, z, P))),
  slit: (() => {
    const [vx, vy] = towardViewer(P);
    const fx = DISP.x + DISP_R * vx;
    const fy = DISP.y + DISP_R * vy;
    const tx = -vy * 3;
    const ty = vx * 3;
    const z0 = DISP_Z0 + 14;
    const z1 = DISP_Z1 - 14;
    const frame = pathOf([at([fx - tx, fy - ty, z0]), at([fx + tx, fy + ty, z0]), at([fx + tx, fy + ty, z1]), at([fx - tx, fy - ty, z1])], true);
    const coins: string[] = [];
    for (let z = z0 + 2.5; z < z1 - 1; z += 2.6) coins.push(seg([fx - tx * 0.8, fy - ty * 0.8, z], [fx + tx * 0.8, fy + ty * 0.8, z]));
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
  plate: barOf(fv0, fv1, FEED_W, FEED_T),
  rails: [-1, 1].map((s) => barOf(add(fv0, [0, s * (FEED_W / 2 + 0.8), 2.6]), add(fv1, [0, s * (FEED_W / 2 + 0.8), 2.6]), 1.6, 4.4)),
};

// ---- Vault --------------------------------------------------------------------------
const VAULT_SCREWS = corners4(VAULT, 6);
const SLOT_PLAN: Plan = { x: SLOT.x - 9, y: SLOT.y - 3, w: 18, d: 6, r: 1.5 };
const SPOUT: Plan = { x: VAULT.x + VAULT.w, y: -8, w: 9, d: 16, r: 1 };
const DIAL_C: Point3 = [DOOR.x + 46, DOOR.y + DOOR.d, 40];
const faceY = FACE_Y;

export const VAULT_ART = {
  plinth: slab(PLINTH, 0, PLINTH_H, 4, 1),
  plinthSeam: planOutline(insetPlan(PLINTH, 3), PLINTH_H, P, 4),
  body: slab(VAULT, VAULT_Z, VAULT_TOP - VAULT_Z, 4, 1.2),
  bodySeams: join([VAULT_Z + 8, VAULT_TOP - 8].map((z) => sideSeam(VAULT, z, P, 4))),
  topPanel: planOutline(insetPlan(VAULT, 4), VAULT_TOP, P, 4),
  screws: VAULT_SCREWS.map(([x, y]) => at([x, y, VAULT_TOP])),
  slot: slab(SLOT_PLAN, VAULT_TOP, 0.6, 2),
  slotMouth: planOutline(insetPlan(SLOT_PLAN, 1.4), VAULT_TOP + 0.6, P, 2),
  seat: ring(SEAL.x, SEAL.y, 10.5, VAULT_TOP, 40),
  door: slab(DOOR, DOOR_Z0, DOOR_Z1 - DOOR_Z0, 2),
  doorInset: pathOf(
    [
      at([DOOR.x + 3, faceY, DOOR_Z0 + 3]),
      at([DOOR.x + DOOR.w - 3, faceY, DOOR_Z0 + 3]),
      at([DOOR.x + DOOR.w - 3, faceY, DOOR_Z1 - 3]),
      at([DOOR.x + 3, faceY, DOOR_Z1 - 3]),
    ],
    true,
  ),
  hinges: [DOOR_Z0 + 8, DOOR_Z1 - 14].map((z) => slab({ x: DOOR.x - 3, y: DOOR.y - 1, w: 4, d: 5, r: 1 }, z, 6, 2)),
  dialOuter: sideRing(DIAL_C, 9, "y", P, 36),
  dialInner: sideRing(DIAL_C, 6.2, "y", P, 32),
  dialHub: sideRing(DIAL_C, 1.8, "y", P, 16),
  dialTicks: join(
    Array.from({ length: 12 }, (_, k) => {
      const a = (k / 12) * Math.PI * 2;
      const r0 = k % 3 === 0 ? 6.6 : 7.4;
      return seg([DIAL_C[0] + r0 * Math.cos(a), faceY, DIAL_C[2] + r0 * Math.sin(a)], [DIAL_C[0] + 8.6 * Math.cos(a), faceY, DIAL_C[2] + 8.6 * Math.sin(a)]);
    }),
  ),
  handleStandoffs: [-7, 7].map((dx) => slab({ x: DIAL_C[0] + dx - 1.4, y: faceY, w: 2.8, d: 3.2, r: 0.6 }, DIAL_C[2] - 21, 3, 2)),
  handle: slab({ x: DIAL_C[0] - 10, y: faceY + 3.2, w: 20, d: 2.4, r: 1 }, DIAL_C[2] - 21.4, 3.8, 3, 0.4),
  window: slab({ x: WINDOW.x0, y: faceY - 0.01, w: WINDOW.x1 - WINDOW.x0, d: 1.2, r: 0.6 }, WINDOW.z0, WINDOW.z1 - WINDOW.z0, 2),
  windowGlass: pathOf(
    [at([WINDOW.x0 + 1.4, faceY + 1.2, WINDOW.z0 + 1.4]), at([WINDOW.x1 - 1.4, faceY + 1.2, WINDOW.z0 + 1.4]), at([WINDOW.x1 - 1.4, faceY + 1.2, WINDOW.z1 - 1.4]), at([WINDOW.x0 + 1.4, faceY + 1.2, WINDOW.z1 - 1.4])],
    true,
  ),
  vents: join([22, 27, 32, 37].map((z) => seg([VAULT.x + VAULT.w, -26, z], [VAULT.x + VAULT.w, 26, z]))),
  spout: slab(SPOUT, OUTLET_Z - 5, 9, 2),
  spoutMouth: pathOf([at([SPOUT.x + SPOUT.w, -5, OUTLET_Z - 3]), at([SPOUT.x + SPOUT.w, 5, OUTLET_Z - 3]), at([SPOUT.x + SPOUT.w, 5, OUTLET_Z + 2]), at([SPOUT.x + SPOUT.w, -5, OUTLET_Z + 2])], true),
};


// ---- Validator's press ---------------------------------------------------------------
const HOUSING_C: Plane = [SEAL.x, SEAL.y];
const HOUSING_Z0 = 120;
export const STAMP_HEAD = 6;

export const PRESS_ART = {
  postFoot: slab({ x: POST.x - 4, y: POST.y - 4, w: POST.w + 8, d: POST.d + 8, r: 2 }, 0, 4, 2, 0.6),
  postFootScrews: corners4({ x: POST.x - 4, y: POST.y - 4, w: POST.w + 8, d: POST.d + 8, r: 2 }, 2.4).map(([x, y]) => at([x, y, 4])),
  post: slab(POST, 4, POST_TOP - 4, 3),
  postTicks: join(Array.from({ length: 9 }, (_, k) => seg([POST.x + POST.w, POST.y + 3, 30 + k * 10], [POST.x + POST.w, POST.y + (k % 4 === 0 ? 9 : 6.5), 30 + k * 10]))),
  arm: slab(ARM, ARM_Z, 8, 3, 0.6),
  armLine: sideSeam(ARM, ARM_Z + 4, P, 3),
  armScrews: [at([ARM.x + 5, ARM.y + 6, ARM_Z + 8]), at([ARM.x + 5, ARM.y + ARM.d - 6, ARM_Z + 8])],
  housing: puck(HOUSING_C[0], HOUSING_C[1], 7.5, HOUSING_Z0, ARM_Z - HOUSING_Z0, 32),
  housingBand: sideArc(HOUSING_C[0], HOUSING_C[1], 7.5, HOUSING_Z0 + 6, P),
  gland: puck(HOUSING_C[0], HOUSING_C[1], 4.5, HOUSING_Z0 - 2, 2, 24),
  // The stamp is built at rest and moved down by the live component.
  // Long enough to stay inside the gland at full stroke, short enough to hide under the arm at rest.
  rod: puck(HOUSING_C[0], HOUSING_C[1], 2.2, STAMP_REST + STAMP_HEAD, ARM_Z + 8 - STAMP_REST - STAMP_HEAD, 16),
  head: puck(HOUSING_C[0], HOUSING_C[1], 9, STAMP_REST + 1.5, STAMP_HEAD - 1.5, 36),
  headKnurl: knurl(HOUSING_C[0], HOUSING_C[1], 9, STAMP_REST + 1.5, STAMP_REST + STAMP_HEAD, 36, P),
  pad: puck(HOUSING_C[0], HOUSING_C[1], 8, STAMP_REST, 1.5, 36),
};

export const SEAL_ART = {
  disc: puck(SEAL.x, SEAL.y, 8, VAULT_TOP, 0.9, 40),
  mark: pathOf([at([SEAL.x - 3.4, SEAL.y + 0.6, VAULT_TOP + 0.9]), at([SEAL.x - 0.8, SEAL.y + 3.2, VAULT_TOP + 0.9]), at([SEAL.x + 4, SEAL.y - 2.6, VAULT_TOP + 0.9])]),
  rim: ring(SEAL.x, SEAL.y, 6.4, VAULT_TOP + 0.9, 32),
};

// ---- Pay-out chute to the crate --------------------------------------------------------
const CHUTE_W = 14;

export const CHUTE_ART = {
  plate: barOf(CHUTE_FROM, CHUTE_TO, CHUTE_W, CHUTE_T),
  rails: [-1, 1].map((s) => barOf(add(CHUTE_FROM, [0, s * (CHUTE_W / 2 + 0.8), 2.6]), add(CHUTE_TO, [0, s * (CHUTE_W / 2 + 0.8), 2.6]), 1.6, 4.4)),
  leg: slab({ x: CHUTE_TO[0] - 16, y: -3, w: 6, d: 6, r: 1 }, 0, 40, 2),
  legFoot: slab({ x: CHUTE_TO[0] - 19, y: -6, w: 12, d: 12, r: 1.5 }, 0, 2.5, 2),
};

// ---- Farmer's crate ------------------------------------------------------------------
const AVOCADOS: Plane[] = [
  [CRATE.x + 14, CRATE.y + 12],
  [CRATE.x + 30, CRATE.y + 10],
  [CRATE.x + 47, CRATE.y + 13],
  [CRATE.x + 12, CRATE.y + 29],
  [CRATE.x + 29, CRATE.y + 27],
  [CRATE.x + 47, CRATE.y + 30],
  [CRATE.x + 15, CRATE.y + 45],
  [CRATE.x + 32, CRATE.y + 44],
  [CRATE.x + 49, CRATE.y + 46],
];

export const CRATE_ART = {
  halo: slab(CRATE, 0, CRATE_H).fill,
  box: slab(CRATE, 0, CRATE_H, 2),
  slats: join([CRATE_H / 3, (CRATE_H * 2) / 3].map((z) => sideSeam(CRATE, z, P, 2))),
  posts: corners4(CRATE, 0).map(([x, y]) => slab({ x: x - 2.5, y: y - 2.5, w: 5, d: 5, r: 0.8 }, 0, CRATE_H + 2, 2)),
  rim: planOutline(insetPlan(CRATE, 3), CRATE_H, P, 2),
  avocados: AVOCADOS.map(([x, y]) => {
    const oval = (r: number, cx = x, cy = y) => circleRing(cx, cy, r, 24).map(([px, py]) => [cx + (px - cx) * 1.12, cy + (py - cy) * 0.8] as Plane);
    return {
      body: extrude(oval(6.8), CRATE_H, 3.4, P),
      shoulder: extrude(oval(5, x + 0.8, y - 0.6), CRATE_H + 3.4, 2, P),
      stem: at([x + 1.6, y - 1.2, CRATE_H + 5.4]),
    };
  }),
};

// ---- Financing pool --------------------------------------------------------------------
const [tvx, tvy] = towardViewer(P);
const PIPE_W = 8;
// The spout leaves the tank wall on the line from the tank's axis to the pipe's start.
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
  bands: join([28, 60].map((z) => sideArc(TANK.x, TANK.y, TANK_R, z, P, 36))),
  shoulder: puck(TANK.x, TANK.y, TANK_R - 4, TANK_Z1, 4, 56),
  neck: puck(TANK.x, TANK.y, 8, TANK_Z1 + 4, 5, 32),
  cap: puck(TANK.x, TANK.y, 9.5, TANK_Z1 + 9, 3, 36),
  capKnurl: knurl(TANK.x, TANK.y, 9.5, TANK_Z1 + 9, TANK_Z1 + 12, 36, P),
  glass: puck(GLASS_C[0], GLASS_C[1], 2.4, GLASS_Z0, GLASS_Z1 - GLASS_Z0, 16),
  glassCaps: [GLASS_Z0 - 3, GLASS_Z1].map((z) => puck(GLASS_C[0], GLASS_C[1], 3.4, z, 3, 16)),
  glassTicks: join(
    Array.from({ length: 9 }, (_, k) => {
      const z = GLASS_Z0 + 4 + k * 7;
      const [a, b] = GLASS_FRONT;
      const ex: Plane = [b[0] + (b[0] - a[0]) * 0.6, b[1] + (b[1] - a[1]) * 0.6];
      const len = k % 4 === 0 ? 3 : 1.8;
      return seg([ex[0], ex[1], z], [ex[0] + (b[0] - a[0]) * (len / 4), ex[1] + (b[1] - a[1]) * (len / 4), z]);
    }),
  ),
  spout: barOf(PIPE_SPOUT, PIPE_FROM, 9, 9),
  flange: puck(PIPE_SPOUT[0], PIPE_SPOUT[1], 6.5, PIPE_SPOUT[2] - 7, 14, 28),
  pipe: barOf(PIPE_FROM, PIPE_TO, PIPE_W, PIPE_T),
  pipeLip: barOf(add(PIPE_TO, [0, 0, -1]), add(PIPE_TO, [0, 0, -7]), PIPE_W + 2, PIPE_W + 2),
  valveWheel: puck(PIPE_FROM[0], PIPE_FROM[1], 5.5, PIPE_FROM[2] + PIPE_T / 2, 1.6, 28),
  valveStem: puck(PIPE_FROM[0], PIPE_FROM[1], 1.4, PIPE_FROM[2] + PIPE_T / 2 + 1.6, 2.4, 12),
};

// ---- Coins -------------------------------------------------------------------------------
// Every coin is drawn once at the world origin and moved to its place each frame.
export const COIN_R = 6;
export const COIN_H = 1.8;
export const COIN_ART = {
  body: puck(0, 0, COIN_R, 0, COIN_H, 32),
  ring: ring(0, 0, COIN_R - 1.6, COIN_H, 28),
  mark: topMatrix([0, 1.9], COIN_H, P, "x"),
};
