import { pathOf, type Flat, type Point3 } from "./kit/iso-kit";
import { ADVANCE_ROUTE, BUY_ROUTE, GLASS_FRONT, GLASS_Z0, PAY_ROUTE, REPAY_ROUTE } from "./paths";
import { needlePath } from "./dial";
import { CRATE_X, LEVEL_FULL, LEVEL_LOW, LEVEL_REPAID, STAMP_DOWN, STAMP_REST, at, offsetOf } from "./view";

// One trade, start to finish, as a pure function of time. The live component only writes
// what this returns, so the server render and the reduced-motion still use the same numbers.
//
// The numbers are the product's own: the buyer locks the price, the pool advances 80% of
// it, and on settlement the pool is repaid the advance plus its 2% yield before the farmer
// receives the rest.
export const LOOP = 15;
export const PRICE = 1000;
export const ADVANCE = (PRICE * 80) / 100;
export const REPAID = (ADVANCE * 102) / 100;

const BUY_COINS = 4;
const ADVANCE_COINS = 3;
const REPAY_COINS = 3;
const PAY_COINS = 1;
export const COINS = BUY_COINS + ADVANCE_COINS + REPAY_COINS + PAY_COINS;
export const SLOTS = {
  buy: [0, 1, 2, 3],
  advance: [4, 5, 6],
  repay: [7, 8, 9],
  pay: [10],
};

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => {
  const u = clamp(t);
  return u * u * (3 - 2 * u);
};
// Coins speed up as they slide, like something rolling down a slope.
const slide = (t: number) => {
  const u = clamp(t);
  return u * u * (1.6 - 0.6 * u);
};

function lengthsOf(route: Point3[]) {
  return route.slice(1).map((p, i) => Math.hypot(p[0] - route[i]![0], p[1] - route[i]![1], p[2] - route[i]![2]));
}

function along(route: Point3[], t: number): Point3 {
  const lengths = lengthsOf(route);
  const total = lengths.reduce((a, b) => a + b, 0);
  let left = clamp(t) * total;
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (left <= len || i === lengths.length - 1) {
      const k = len ? Math.min(1, left / len) : 1;
      const a = route[i]!;
      const b = route[i + 1]!;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
    left -= len;
  }
  return route[route.length - 1]!;
}

// Share of the route's length taken by its first and last legs: a coin is only faded while
// it comes out of a mouth or drops into a slot, never while it rides in the open.
function endLegs(route: Point3[], first: boolean) {
  const lengths = lengthsOf(route);
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  return (first ? lengths[0]! : lengths[lengths.length - 1]!) / total;
}

export interface Coin {
  shift: Flat;
  opacity: number;
}

export interface Pose {
  coins: Coin[];
  crate: Flat;
  crateOpacity: number;
  seal: number;
  stamp: Flat;
  needle: string;
  level: string;
  surface: string;
  locked: number;
  // Index into the readout lines, which come translated from the page.
  step: number;
}

const HIDDEN: Coin = { shift: [0, 0], opacity: 0 };

function coinOn(route: Point3[], start: number, duration: number, t: number, outOfMouth: boolean): Coin {
  const u = (t - start) / duration;
  if (u <= 0 || u >= 1) return HIDDEN;
  const s = slide(u);
  const inLeg = endLegs(route, true);
  const outLeg = endLegs(route, false);
  const fadeIn = outOfMouth ? clamp(s / inLeg) : clamp(u / 0.06);
  const fadeOut = clamp((1 - s) / outLeg);
  return { shift: offsetOf(along(route, s)), opacity: Math.min(fadeIn, fadeOut) };
}

const BUY = { start: 0.3, every: 0.5, run: 1.6 };
const MOVE_IN = { from: 3.0, to: 6.6 };
const LEND = { start: 3.8, every: 0.55, run: 1.5 };
const WEIGH = { up: 6.6, held: 7.4, down: 9.6, rest: 10.4 };
const PRESS = { down: 7.6, held: 8.2, up: 8.5, back: 9.1 };
const REPAY = { start: 9.0, every: 0.5, run: 1.6 };
const PAY = { start: 10.6, run: 1.7 };
const MOVE_OUT = { from: 9.4, to: 12.0 };
const GONE = { from: 13.2, to: 14.0 };
const BACK = { from: 14.2, to: 15.0 };
// The crate and its avocados weigh this share of the dial's full scale.
const WEIGHT = 0.62;

function levelAt(t: number) {
  const drain = smooth((t - 3.8) / 2.2);
  const refill = smooth((t - 9.4) / 2.4);
  const settle = smooth((t - 13.4) / 1.4);
  const mid = LEVEL_FULL - (LEVEL_FULL - LEVEL_LOW) * drain + (LEVEL_REPAID - LEVEL_LOW) * refill;
  return mid + (LEVEL_FULL - mid) * settle;
}

function glassPaths(level: number) {
  const [a, b] = GLASS_FRONT;
  const fill = pathOf([at([a[0], a[1], GLASS_Z0 + 1]), at([b[0], b[1], GLASS_Z0 + 1]), at([b[0], b[1], level]), at([a[0], a[1], level])], true);
  const top = pathOf([at([a[0], a[1], level]), at([b[0], b[1], level])]);
  return { fill, top };
}

function crateX(t: number) {
  if (t < MOVE_IN.to) return CRATE_X.farm + (CRATE_X.scale - CRATE_X.farm) * smooth((t - MOVE_IN.from) / (MOVE_IN.to - MOVE_IN.from));
  if (t < BACK.from) return CRATE_X.scale + (CRATE_X.dock - CRATE_X.scale) * smooth((t - MOVE_OUT.from) / (MOVE_OUT.to - MOVE_OUT.from));
  return CRATE_X.farm;
}

function crateOpacity(t: number) {
  if (t < GONE.from) return 1;
  if (t < BACK.from) return 1 - smooth((t - GONE.from) / (GONE.to - GONE.from));
  return smooth((t - BACK.from) / (BACK.to - BACK.from));
}

function stepAt(t: number) {
  if (t < MOVE_IN.from) return 0;
  if (t < LEND.start + 0.6) return 1;
  if (t < WEIGH.up) return 2;
  if (t < PRESS.down) return 3;
  if (t < REPAY.start) return 4;
  if (t < PAY.start + PAY.run) return 5;
  return 6;
}

export function poseAt(time: number): Pose {
  const t = ((time % LOOP) + LOOP) % LOOP;
  const coins: Coin[] = [];
  let locked = 0;
  for (let i = 0; i < BUY_COINS; i++) {
    const start = BUY.start + i * BUY.every;
    coins.push(coinOn(BUY_ROUTE, start, BUY.run, t, false));
    if (t >= start + BUY.run * 0.95) locked += PRICE / BUY_COINS;
  }
  for (let i = 0; i < ADVANCE_COINS; i++) coins.push(coinOn(ADVANCE_ROUTE, LEND.start + i * LEND.every, LEND.run, t, true));
  for (let i = 0; i < REPAY_COINS; i++) {
    const start = REPAY.start + i * REPAY.every;
    coins.push(coinOn(REPAY_ROUTE, start, REPAY.run, t, true));
    if (t >= start) locked -= REPAID / REPAY_COINS;
  }
  coins.push(coinOn(PAY_ROUTE, PAY.start, PAY.run, t, true));
  if (t >= PAY.start) locked = 0;

  const press = t < PRESS.held ? smooth((t - PRESS.down) / (PRESS.held - PRESS.down)) : 1 - smooth((t - PRESS.up) / (PRESS.back - PRESS.up));
  const seal = t >= PRESS.held && t < BACK.from ? 1 : 0;
  const weigh = t < WEIGH.held ? smooth((t - WEIGH.up) / (WEIGH.held - WEIGH.up)) : 1 - smooth((t - WEIGH.down) / (WEIGH.rest - WEIGH.down));
  const glass = glassPaths(levelAt(t));
  return {
    coins,
    crate: offsetOf([crateX(t) - CRATE_X.farm, 0, 0]),
    crateOpacity: crateOpacity(t),
    seal,
    stamp: offsetOf([0, 0, -(STAMP_REST - STAMP_DOWN) * press]),
    needle: needlePath(weigh * WEIGHT),
    level: glass.fill,
    surface: glass.top,
    locked: Math.max(0, Math.round(locked)),
    step: stepAt(t),
  };
}

// The frame shown to anyone who asks for reduced motion: the crate sealed on the scale,
// the advance paid and the price still locked in the vault.
export const STILL_TIME = 8.8;
export const counterText = (locked: number) => locked.toLocaleString("en").padStart(5, " ");
