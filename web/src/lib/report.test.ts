import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { reportHash, toHex } from "./report.ts";

test("reportHash is the SHA-256 of the report, or of trade:verdict when there is none", async () => {
  const expected = (s: string) => createHash("sha256").update(s).digest("hex");
  assert.equal(toHex(await reportHash("Goods arrived intact", "CABC", true)), expected("Goods arrived intact"));
  assert.equal(toHex(await reportHash("", "CABC", false)), expected("CABC:false"));
});
