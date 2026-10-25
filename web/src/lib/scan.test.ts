import { test } from "node:test";
import assert from "node:assert/strict";
import { readScan } from "./scan.ts";

const ORIGINS = ["https://avocate-harvest-escrow.vercel.app", "http://localhost:3030"];
const G = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const C = "CB4HAYW4XQ2RKDJ7ZQ5S4UQ7GQYV4N6VZB4QKXW6Y3H2ZJ7M5LQKD3TA";

test("reads a bare account and a SEP-7 payment URI", () => {
  assert.deepEqual(readScan(G, ORIGINS), { kind: "address", address: G });
  assert.deepEqual(readScan(` ${G}\n`, ORIGINS), { kind: "address", address: G });
  assert.deepEqual(readScan(`web+stellar:pay?destination=${G}&amount=5`, ORIGINS), { kind: "address", address: G });
});

test("follows our own proposal and trade links as paths inside the app", () => {
  assert.deepEqual(readScan(`https://avocate-harvest-escrow.vercel.app/deal#d=abc_-1`, ORIGINS), {
    kind: "link",
    path: "/deal#d=abc_-1",
  });
  assert.deepEqual(readScan(`http://localhost:3030/farmer?trade=${C}`, ORIGINS), {
    kind: "link",
    path: `/farmer?trade=${C}`,
  });
});

test("ignores other sites, other pages and unreadable codes", () => {
  assert.equal(readScan(`https://evil.example/deal#d=abc`, ORIGINS), null);
  assert.equal(readScan(`https://avocate-harvest-escrow.vercel.app.evil.example/deal#d=abc`, ORIGINS), null);
  assert.equal(readScan(`https://avocate-harvest-escrow.vercel.app/admin`, ORIGINS), null);
  assert.equal(readScan(`https://avocate-harvest-escrow.vercel.app/buyer?trade=not-a-trade`, ORIGINS), null);
  assert.equal(readScan(`javascript:alert(1)`, ORIGINS), null);
  assert.equal(readScan(`hello`, ORIGINS), null);
});
