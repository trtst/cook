import assert from "node:assert/strict";
import test from "node:test";
import { PantryController } from "./pantry.controller";

test("低维护购物 V1 不再暴露旧个人购物板兼容接口", () => {
  const legacyShoppingMethods = [
    "listShopping",
    "getShoppingBoard",
    "createShoppingItem",
    "createRecipeShoppingItems",
    "updateShoppingStatus",
    "updateShoppingGroupStatus",
    "createEventGap",
    "createGap"
  ];
  for (const method of legacyShoppingMethods) {
    assert.equal(method in PantryController.prototype, false, `${method} should not remain on the V1 controller`);
  }
});

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

test("batch fridge confirmation passes the current user and items to one service operation", async () => {
  const calls: unknown[] = [];
  const controller = new PantryController({
    markFridgeTracesPresent: async (userId: number, operationId: string, items: unknown[]) => {
      calls.push(userId, operationId, items);
      return [];
    }
  } as never);

  const response = await controller.markFridgeTracesPresent(
    { user: { userId: 1001 } } as never,
    "123456",
    { items: [{ name: "鸡蛋", ingredientId: 7, categoryName: "肉禽蛋" }] } as never
  );

  assert.deepEqual(calls, [1001, "123456", [{ name: "鸡蛋", ingredientId: 7, categoryName: "肉禽蛋" }]]);
  assert.equal(response.code, 0);
  assert.deepEqual(response.data, []);
});
