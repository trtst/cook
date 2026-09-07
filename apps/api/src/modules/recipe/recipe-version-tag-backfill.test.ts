import assert from "node:assert/strict";
import test from "node:test";
import { isActiveCurrentVersion } from "./recipe-version-tag-backfill";

test("backfill selects active current versions and excludes historical versions", () => {
  assert.equal(isActiveCurrentVersion("ACTIVE", 101, 101), true);
  assert.equal(isActiveCurrentVersion("ACTIVE", 101, 100), false);
  assert.equal(isActiveCurrentVersion("ARCHIVED", 121, 121), false);
});
