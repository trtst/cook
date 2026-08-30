import assert from "node:assert/strict";
import { buildFridgeExpiryReminderMessage } from "./subscribe-message";

const reminder = buildFridgeExpiryReminderMessage({
  openid: "openid-test",
  ingredientName: "鸡蛋",
  expireAt: "2026-09-03T00:00:00.000Z",
  daysLeft: 4,
  storedDays: 2,
  tipText: "记得优先安排，减少浪费",
  pagePath: "pages_pantry/index/index"
});

assert.equal(reminder.templateId, "aBwl_-hcLknlqzz22iRMvtFWep9ZvmTEoUy44lgnMHY");
assert.equal(reminder.touser, "openid-test");
assert.equal(reminder.page, "pages_pantry/index/index");
assert.deepEqual(reminder.data, {
  thing1: { value: "鸡蛋" },
  date2: { value: "2026-09-03" },
  number5: { value: "4" },
  number12: { value: "2" },
  thing8: { value: "记得优先安排，减少浪费" }
});

console.log("wechat subscribe message helpers passed");
