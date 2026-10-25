import { test } from "node:test";
import assert from "node:assert/strict";
import { pct, pctToBps } from "./format.ts";

test("pctToBps reads percents with up to two decimals and caps at 100%", () => {
  assert.equal(pctToBps("0.1"), 10);
  assert.equal(pctToBps("0,2"), 20);
  assert.equal(pctToBps("2"), 200);
  assert.equal(pctToBps("100"), 10_000);
  for (const bad of ["", "-1", "100.01", "0.123", "abc", "1e2"]) assert.equal(pctToBps(bad), null, bad);
});

test("pct and pctToBps round-trip", () => {
  for (const bps of [0, 10, 20, 200, 8000]) assert.equal(pctToBps(pct(bps).replace("%", "")), bps);
});
