import assert from "node:assert/strict";
import test from "node:test";
import { AdminController } from "./admin.controller";

test("admin phone reveal returns only the requested user's full phone", async () => {
  const controller = new AdminController(
    {
      revealUserPhone: async (userId: number, adminId: number) => {
        assert.equal(userId, 12);
        assert.equal(adminId, 7);
        return { phone: "13800000000" };
      }
    } as never,
    {} as never
  );

  const response = await controller.revealUserPhone({ admin: { adminId: 7 } } as never, 12);

  assert.equal(response.code, 0);
  assert.equal(response.message, "ok");
  assert.deepEqual(response.data, { phone: "13800000000" });
  assert.ok(response.serverTime);
});
