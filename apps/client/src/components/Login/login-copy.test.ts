import assert from "node:assert/strict";
import test from "node:test";
import { loginCopyCandidates, pickLoginCopy } from "./types";

test("login copy candidates are stable two-line pairs", () => {
  assert.ok(loginCopyCandidates.length >= 14);
  for (const candidate of loginCopyCandidates) {
    assert.equal(candidate.length, 2);
    assert.ok(candidate.every(line => line.trim().length > 0));
  }

  assert.deepEqual(pickLoginCopy(0), pickLoginCopy(0));
  assert.notDeepEqual(pickLoginCopy(0), pickLoginCopy(0.99));
});
