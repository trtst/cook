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
