import { test } from "node:test";
import assert from "node:assert/strict";
import { bps, formatUsdc, toUnits } from "./usdc.ts";

test("toUnits parses whole and decimal amounts into 7-decimal base units", () => {
  assert.equal(toUnits("1000"), 10_000_000_000n);
  assert.equal(toUnits("12.5"), 125_000_000n);
  assert.equal(toUnits("0,0000001"), 1n);
  assert.equal(toUnits(" 3. "), 30_000_000n);
});

test("toUnits rejects anything that is not a plain positive amount", () => {
  for (const bad of ["", "-1", "1e3", "abc", "1.00000001", "1.2.3"]) assert.equal(toUnits(bad), null, bad);
});

test("formatUsdc shows two decimals, rounding half up for display only", () => {
  assert.equal(formatUsdc(10_000_000_000n), "1,000.00 USDC");
  assert.equal(formatUsdc(1n), "0.00 USDC");
  assert.equal(formatUsdc(50_000n), "0.01 USDC");
  assert.equal(formatUsdc(49_999n), "0.00 USDC");
  assert.equal(formatUsdc(-10_000_000n), "−1.00 USDC");
});

test("bps rounds down like the contract", () => {
  assert.equal(bps(10_000_000_000n, 10), 10_000_000n);
  assert.equal(bps(999n, 10), 0n);
});
