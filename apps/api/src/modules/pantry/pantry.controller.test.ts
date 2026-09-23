import assert from "node:assert/strict";
import test from "node:test";
import { PantryController } from "./pantry.controller";

test("meal plan shopping gap preview delegates with the current user and plan", async () => {
  const calls: number[] = [];
  const controller = new PantryController({
    previewPlanGap: async (userId: number, planItemId: number) => {
      calls.push(userId, planItemId);
      return [];
    }
  } as never);

  const response = await controller.previewPlanGap({ user: { userId: 1001 } } as never, 2001);

  assert.deepEqual(calls, [1001, 2001]);
  assert.equal(response.code, 0);
  assert.deepEqual(response.data, []);
});

test("dining event shopping gap preview delegates with the current user and event", async () => {
  const calls: number[] = [];
  const controller = new PantryController({
    previewEventGap: async (userId: number, eventId: number) => {
      calls.push(userId, eventId);
      return [];
    }
  } as never);

  const response = await controller.previewEventGap({ user: { userId: 1001 } } as never, 3001);

  assert.deepEqual(calls, [1001, 3001]);
  assert.equal(response.code, 0);
  assert.deepEqual(response.data, []);
});
