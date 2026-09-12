import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(__dirname, "pantry.service.ts"), "utf8");

test("shopping source metadata classifies public recipes by inspiration state, not owner presence", () => {
  assert.match(source, /select:\s*\{\s*id:\s*true,\s*isInspiration:\s*true\s*\}/s);
  assert.match(source, /item\.isInspiration \? "inspiration" as const : "my" as const/);
  assert.doesNotMatch(source, /item\.ownerId \? "my" as const : "inspiration" as const/);
});
