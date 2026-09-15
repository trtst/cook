import assert from "node:assert/strict";
import { mealInvitePath } from "./routing";

assert.equal(
  mealInvitePath(42, 17, "2026-09-21"),
  "/pages_meal/detail/index?planItemId=17&planDate=2026-09-21&eventId=42",
  "linked dining-event preview must keep the server-provided planItemId so the meal assistant target stays the MealPlanItem"
);

assert.equal(
  mealInvitePath(42, null, "2026-09-21"),
  "/pages_meal/detail/index?eventId=42",
  "detached historical dining-event preview must not invent a planItemId or expose a fake assistant target"
);

assert.equal(
  mealInvitePath("", 17, "2026-09-21"),
  "/pages_meal/event/index",
  "missing event id falls back to the dining-event list instead of constructing a broken detail route"
);

console.log("share preview cook-assistant routing tests passed");
