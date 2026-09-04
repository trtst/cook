import assert from "node:assert/strict";
import test from "node:test";
import { AdminService } from "./admin.service";

function createService(transaction: () => Promise<unknown>) {
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    $transaction: transaction
  };

  return new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
}

test("admin user creation rejects weak passwords before writing user data", async () => {
  let transactionCount = 0;
  const service = createService(async () => {
    transactionCount += 1;
  });

  await assert.rejects(
    () =>
      service.createUser(
        {
          operationId: "1001",
          phone: "13800000000",
          password: "12345678"
        },
        1
      ),
    { message: "密码需至少包含字母、数字、符号中的两种" }
  );
  assert.equal(transactionCount, 0);
});

test("admin password reset rejects weak passwords before writing user data", async () => {
  let transactionCount = 0;
  const service = createService(async () => {
    transactionCount += 1;
  });

  await assert.rejects(
    () =>
      service.resetUserPassword(
        9,
        {
          operationId: "1002",
          newPassword: "abc12345678901234567!"
        },
        1
      ),
    { message: "密码需要 8-20 位字符" }
  );
  assert.equal(transactionCount, 0);
});
