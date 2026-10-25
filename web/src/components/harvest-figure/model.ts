import { pathOf, type Flat, type Point3 } from "./kit/iso-kit";
import { ADVANCE_ROUTE, BUY_ROUTE, GLASS_FRONT, GLASS_Z0, PAY_ROUTE } from "./paths";
import { LEVEL_FULL, LEVEL_LOW, STAMP_DOWN, STAMP_REST, at, offsetOf } from "./view";

// One trade, start to finish, as a pure function of time. The live component only writes
// what this returns, so the server render and a still frame use the same numbers.

export const LOOP = 13;
export const PRICE = 1000;
export const ADVANCE = 800;
const BUY_COINS = 4;
const PAY_COINS = 4;
const ADVANCE_COINS = 2;
export const COINS = BUY_COINS + PAY_COINS + ADVANCE_COINS;

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

function along(route: Point3[], t: number): Point3 {
  const lengths = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i]![0], p[1] - route[i]![1], p[2] - route[i]![2]));
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

export interface Coin {
  shift: Flat;
  opacity: number;
}

export interface Pose {
  coins: Coin[];
  stamp: Flat;
  seal: number;
  level: string;
  surface: string;
  locked: number;
  step: string;
}

const HIDDEN: Coin = { shift: [0, 0], opacity: 0 };

function coinOn(route: Point3[], start: number, duration: number, t: number): Coin {
  const u = (t - start) / duration;
  if (u <= 0 || u >= 1) return HIDDEN;
  const fadeIn = clamp(u / 0.08);
  const fadeOut = clamp((1 - u) / 0.1);
  return { shift: offsetOf(along(route, slide(u))), opacity: Math.min(fadeIn, fadeOut) };
}

const BUY = { start: 0.4, every: 0.55, run: 1.7 };
const LEND = { start: 4.1, every: 0.6, run: 1.6 };
const PRESS = { down: 6.7, held: 7.25, up: 7.6, back: 8.3 };
const PAY = { start: 8.7, every: 0.5, run: 1.5 };

function levelAt(t: number) {
  const drain = smooth((t - 4.0) / 1.8);
  const refill = smooth((t - 9.4) / 2.2);
  return LEVEL_FULL - (LEVEL_FULL - LEVEL_LOW) * drain + (LEVEL_FULL - LEVEL_LOW) * refill;
}

function glassPaths(level: number) {
  const [a, b] = GLASS_FRONT;
  const fill = pathOf([at([a[0], a[1], GLASS_Z0 + 1]), at([b[0], b[1], GLASS_Z0 + 1]), at([b[0], b[1], level]), at([a[0], a[1], level])], true);
  const top = pathOf([at([a[0], a[1], level]), at([b[0], b[1], level])]);
  return { fill, top };
}

function stepAt(t: number) {
  if (t < 3.9) return `Buyer locks ${PRICE.toLocaleString("en")} USDC`;
  if (t < 6.5) return `Pool advances ${ADVANCE.toLocaleString("en")} USDC to the farmer`;
  if (t < 8.6) return "Validator: delivery conforms";
  if (t < 12.2) return "Farmer paid, pool repaid";
  return "Ready for the next trade";
}

export function poseAt(time: number): Pose {
  const t = ((time % LOOP) + LOOP) % LOOP;
  const coins: Coin[] = [];
  let locked = 0;
  for (let i = 0; i < BUY_COINS; i++) {
    const start = BUY.start + i * BUY.every;
    coins.push(coinOn(BUY_ROUTE, start, BUY.run, t));
    if (t >= start + BUY.run * 0.92) locked += PRICE / BUY_COINS;
  }
  for (let i = 0; i < ADVANCE_COINS; i++) coins.push(coinOn(ADVANCE_ROUTE, LEND.start + i * LEND.every, LEND.run, t));
  for (let i = 0; i < PAY_COINS; i++) {
    const start = PAY.start + i * PAY.every;
    coins.push(coinOn(PAY_ROUTE, start, PAY.run, t));
    if (t >= start) locked -= PRICE / PAY_COINS;
  }
  const press = t < PRESS.held ? smooth((t - PRESS.down) / (PRESS.held - PRESS.down)) : 1 - smooth((t - PRESS.up) / (PRESS.back - PRESS.up));
  const seal = t < PRESS.held ? 0 : t < 12 ? 1 : 1 - smooth((t - 12) / 0.7);
  const level = levelAt(t);
  const glass = glassPaths(level);
  return {
    coins,
    stamp: offsetOf([0, 0, -(STAMP_REST - STAMP_DOWN) * press]),
    seal,
    level: glass.fill,
    surface: glass.top,
    locked: Math.max(0, locked),
    step: stepAt(t),
  };
}

// The frame shown to anyone who asks for reduced motion: verdict in, money still locked.
export const STILL_TIME = 8.45;
export const counterText = (locked: number) => locked.toLocaleString("en").padStart(5, " ");
