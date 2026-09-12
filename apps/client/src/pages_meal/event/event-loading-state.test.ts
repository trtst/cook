import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

test("initial dining event loading uses card-shaped skeletons instead of a text notice", () => {
  assert.match(source, /import Skeleton from "@\/components\/Skeleton\/Skeleton\.vue"/);
  assert.match(source, /v-if="loading && !eventCards\.length" class="event-list event-list--skeleton"/);
  assert.match(source, /v-for="index in 2" :key="index" class="event-card event-card--skeleton"/);
  assert.match(source, /<Skeleton width="100%" height="100%" radius="0" \/>/);
  assert.doesNotMatch(source, /正在同步饭局/);
});
