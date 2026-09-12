import assert from "node:assert/strict";
import test from "node:test";
import { toOwnerNicknameSnapshot } from "./recipe-owner-snapshot";

test("freezes a trimmed owner nickname at recipe creation", () => {
  assert.equal(toOwnerNicknameSnapshot("  发布时昵称  "), "发布时昵称");
});

test("stores an unavailable owner nickname as null", () => {
  assert.equal(toOwnerNicknameSnapshot("   "), null);
  assert.equal(toOwnerNicknameSnapshot(null), null);
});
