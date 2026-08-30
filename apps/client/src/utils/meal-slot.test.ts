import assert from "node:assert/strict";
import { resolveMealSlotByTime } from "./meal-slot";

assert.equal(resolveMealSlotByTime("05:00"), "BREAKFAST");
assert.equal(resolveMealSlotByTime("10:29"), "BREAKFAST");
assert.equal(resolveMealSlotByTime("10:30"), "LUNCH");
assert.equal(resolveMealSlotByTime("14:29"), "LUNCH");
assert.equal(resolveMealSlotByTime("14:30"), "AFTERNOON_TEA");
assert.equal(resolveMealSlotByTime("17:29"), "AFTERNOON_TEA");
assert.equal(resolveMealSlotByTime("17:30"), "DINNER");
assert.equal(resolveMealSlotByTime("20:59"), "DINNER");
assert.equal(resolveMealSlotByTime("21:00"), "LATE_NIGHT");
assert.equal(resolveMealSlotByTime("04:59"), "LATE_NIGHT");
assert.equal(resolveMealSlotByTime("invalid"), null);
assert.equal(resolveMealSlotByTime("24:00"), null);

console.log("meal slot tests passed");
