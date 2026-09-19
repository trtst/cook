import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const homeSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const planSource = readFileSync(resolve(__dirname, "../../pages_meal/plan/index.vue"), "utf8");

assert.match(
  homeSource,
  /function openWeekOverview\(\) \{\s+navigateTo\(weekOverviewState\.value\?\.targetValue \|\| "\/pages_meal\/plan\/index"\);\s+\}/,
  "Expected the home week overview card to open the plan landing page for guests."
);
assert.doesNotMatch(
  homeSource,
  /function openWeekOverview\(\) \{\s+if \(!sessionStore\.isLoggedIn\)/,
  "Expected the home week overview card not to gate navigation behind login."
);
assert.match(
  planSource,
  /<Empty\s+v-if="!sessionStore\.isLoggedIn"[\s\S]*title="登录后查看这一天的安排"/,
  "Expected the plan landing page to keep its guest empty state."
);

console.log("home week overview entry tests passed");
