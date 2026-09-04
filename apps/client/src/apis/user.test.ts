import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const userSource = readFileSync(resolve(__dirname, "./user.ts"), "utf8");

test("account security writes send numeric idempotency keys through the request layer", () => {
	assert.match(userSource, /changeCurrentPassword\(body: ChangeCurrentPasswordRequest\)[\s\S]*idempotencyKey: operationId/);
	assert.match(userSource, /bindCurrentPhone\(body: BindCurrentPhoneRequest\)[\s\S]*idempotencyKey: operationId/);
	assert.match(userSource, /startPhoneChange\(body: StartPhoneChangeRequest\)[\s\S]*idempotencyKey: operationId/);
	assert.match(userSource, /completePhoneChange\(body: CompletePhoneChangeRequest\)[\s\S]*idempotencyKey: operationId/);
});
