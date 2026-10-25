import { test } from "node:test";
import assert from "node:assert/strict";
import { closedByUser, describeError } from "./errors.ts";

test("a closed wallet window reads as a choice, not as raw JSON", () => {
  const closed = { code: -1, message: "The user closed the modal." };
  assert.equal(closedByUser(closed), true);
  assert.equal(describeError(closed), "The wallet window was closed before confirming.");
});

test("plain error objects from the wallet show their message", () => {
  assert.equal(closedByUser(new Error("Account not found")), false);
  assert.equal(describeError({ code: 4, message: "Something odd" }), "Something odd");
  assert.match(describeError({ code: -3, message: "User declined access" }), /cancelled in the wallet/);
});
