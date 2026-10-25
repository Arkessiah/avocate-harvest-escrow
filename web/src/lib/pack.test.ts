import { test } from "node:test";
import assert from "node:assert/strict";
import { pack, unpack } from "./pack.ts";

test("pack and unpack round-trip arbitrary bytes into a URL-safe string", async () => {
  const bytes = Uint8Array.from({ length: 1380 }, (_, i) => (i * 37) % 256);
  const code = await pack(bytes);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(await unpack(code), bytes);
});

test("unpack rejects damaged or oversized payloads", async () => {
  await assert.rejects(unpack("not base64!"));
  await assert.rejects(unpack("AAAA"));
  const big = await pack(new Uint8Array(20_000));
  await assert.rejects(unpack(big), /too large/);
});
