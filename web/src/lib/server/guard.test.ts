import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter, readJson, contractId, describeContractError, HttpError, MAX_BODY_BYTES } from "./guard.ts";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://x/api", { method: "POST", body, headers });

const rejects = async (p: Promise<unknown>, status: number) =>
  assert.rejects(p, (e: unknown) => e instanceof HttpError && e.status === status);

test("rate limiter allows up to the limit, then asks to retry later", () => {
  const rl = new RateLimiter(2, 60_000);
  assert.equal(rl.check("ip", 0), null);
  assert.equal(rl.check("ip", 1_000), null);
  assert.equal(rl.check("ip", 2_000), 58);
  assert.equal(rl.check("other", 2_000), null);
});

test("rate limiter forgets hits outside the window", () => {
  const rl = new RateLimiter(1, 10_000);
  assert.equal(rl.check("ip", 0), null);
  assert.notEqual(rl.check("ip", 5_000), null);
  assert.equal(rl.check("ip", 10_001), null);
});

test("readJson accepts a JSON object", async () => {
  assert.deepEqual(await readJson(post('{"ok":true}')), { ok: true });
});

test("readJson rejects bodies that are too large, by header or by content", async () => {
  await rejects(readJson(post("{}", { "content-length": String(MAX_BODY_BYTES + 1) })), 413);
  await rejects(readJson(post(`{"x":"${"a".repeat(MAX_BODY_BYTES)}"}`)), 413);
});

test("readJson rejects anything that is not a JSON object", async () => {
  await rejects(readJson(post("not json")), 400);
  await rejects(readJson(post("[1,2]")), 400);
  await rejects(readJson(post("null")), 400);
});

test("contractId accepts C... addresses only", () => {
  const c = "CBHU4N74WPLTXFNQ6JERWD7A3CIZCHVG433BCWOYYP3SR677FWPZNXBF";
  assert.equal(contractId(c), c);
  assert.throws(() => contractId("GAKZPSZH6IGTHONT3NSTDLWMV7YO63RINPWIB54RIBXMVGTK7J76YKC7"), HttpError);
  assert.throws(() => contractId("nope"), HttpError);
  assert.throws(() => contractId(42), HttpError);
});

test("contract errors are reported by name", () => {
  const raw = "HostError: Error(Contract, #7)\n\nEvent log (newest first): ...";
  assert.equal(describeContractError(raw), "Contract rejected the call: NotValidated");
  assert.equal(describeContractError("network down"), "network down");
});
