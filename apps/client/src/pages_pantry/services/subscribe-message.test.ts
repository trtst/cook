/**
 * 食材分包订阅消息服务测试。
 *
 * 跟随分包服务文件放置，锁定模板 id 与订阅结果映射口径。
 */
import assert from "node:assert/strict";
import {
  buildFridgeExpirySubscribeRequest,
  isSubscribeMessageAccepted,
  resolveFridgeExpirySubscribeOutcome
} from "./subscribe-message";

const request = buildFridgeExpirySubscribeRequest();

assert.equal(request.scene, "fridgeExpiry");
assert.deepEqual(request.templateIds, ["aBwl_-hcLknlqzz22iRMvtFWep9ZvmTEoUy44lgnMHY"]);

assert.equal(isSubscribeMessageAccepted({ [request.templateIds[0]]: "accept" }, request.templateIds[0]), true);
assert.equal(isSubscribeMessageAccepted({ [request.templateIds[0]]: "reject" }, request.templateIds[0]), false);
assert.equal(isSubscribeMessageAccepted({}, request.templateIds[0]), false);

assert.equal(resolveFridgeExpirySubscribeOutcome({ [request.templateIds[0]]: "accept" }), "accepted");
assert.equal(resolveFridgeExpirySubscribeOutcome({ [request.templateIds[0]]: "reject" }), "rejected");
assert.equal(resolveFridgeExpirySubscribeOutcome({ [request.templateIds[0]]: "ban" }), "blocked");
assert.equal(resolveFridgeExpirySubscribeOutcome({}), "unsupported");

console.log("subscribe message client helpers passed");
