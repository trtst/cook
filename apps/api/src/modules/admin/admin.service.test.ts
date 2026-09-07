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

test("admin user list returns profile fields with masked phone", async () => {
  const userRow = {
    id: 9,
    uid: 10000009,
    nickname: "测试用户",
    avatarUrl: "https://cdn.example.com/avatar.jpg",
    phone: "13800000009",
    status: "ACTIVE",
    cookNo: "cook_10009",
    bio: "家里的掌勺人",
    gender: "FEMALE",
    birthDate: new Date("1990-09-04T00:00:00.000Z"),
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z")
  };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    user: {
      findMany: async () => [userRow],
      count: async () => 1
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
  };
  const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  const result = await service.listUsers(1, 20, undefined, 1);

  assert.equal(result.items[0].phone, "138xxxxx009");
  assert.equal(result.items[0].cookNo, "cook_10009");
  assert.equal(result.items[0].bio, "家里的掌勺人");
  assert.equal(result.items[0].gender, "FEMALE");
  assert.equal(result.items[0].birthDate, "1990-09-04");
});

test("admin user recipe list keeps a missing personal category as null", async () => {
  const recipeRow = {
    id: 254,
    title: "海带排骨汤",
    coverImageUrl: null,
    currentVersionId: 1115,
    version: 1,
    updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    category: null,
    currentVersion: {
      name: "海带排骨汤",
      story: null,
      baseServings: 2,
      difficulty: null,
      duration: null,
      estimatedCalories: null,
      tips: null,
      ingredientsJson: [],
      stepsJson: []
    }
  };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    user: {
      findUnique: async () => ({ id: 1001 })
    },
    recipe: {
      findMany: async () => [recipeRow],
      count: async () => 1
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations)
  };
  const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  const result = await service.listUserRecipes(1001, 1, 1, 20);

  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 254);
  assert.equal(result.items[0].category, null);
});

test("admin user entitlement summary includes profile fields", async () => {
  const userRow = {
    id: 9,
    uid: 10000009,
    nickname: "测试用户",
    avatarUrl: "https://cdn.example.com/avatar.jpg",
    phone: "13800000009",
    status: "ACTIVE",
    cookNo: "cook_10009",
    bio: "家里的掌勺人",
    gender: "FEMALE",
    birthDate: new Date("1990-09-04T00:00:00.000Z")
  };
  const tx = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    user: {
      findUnique: async () => userRow
    },
    storageLedger: {
      findMany: async () => []
    }
  };
  const prisma = {
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const entitlementService = {
    resolveForUser: async () => ({
      tier: "FREE",
      validUntil: null,
      storageLimitBytes: 1024,
      recipeLimit: 20,
      recycleDays: 7,
      variantLimitPerRoot: 2,
      inviteLimit: 3,
      memberLimit: 5,
      imagePolicy: {
        quality: 80,
        maxWidth: 1080,
        maxHeight: 1080,
        maxOutputBytes: 1024,
        maxInputBytes: 2048
      }
    })
  };
  const service = new AdminService(prisma as never, {} as never, entitlementService as never, {} as never, {} as never, {} as never);

  const result = await service.getUserEntitlements(9, 1);

  assert.equal(result.user.avatarUrl, "https://cdn.example.com/avatar.jpg");
  assert.equal(result.user.cookNo, "cook_10009");
  assert.equal(result.user.bio, "家里的掌勺人");
  assert.equal(result.user.gender, "FEMALE");
  assert.equal(result.user.birthDate, "1990-09-04");
});

test("admin phone update records a masked phone change audit event", async () => {
  let auditAction = "";
  let auditPayload: unknown = null;
  const currentUser = {
    id: 9,
    uid: 10000009,
    nickname: "测试用户",
    avatarUrl: null,
    phone: "13800000009",
    status: "ACTIVE",
    cookNo: "cook_10009",
    bio: null,
    gender: null,
    birthDate: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z")
  };
  const tx = {
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    $queryRaw: async () => undefined,
    user: {
      findUnique: async () => currentUser,
      update: async () => ({
        ...currentUser,
        phone: "13900000009",
        updatedAt: new Date("2026-09-03T00:00:00.000Z")
      })
    },
    auditEvent: {
      create: async ({ data }: { data: { action: string; payload: unknown } }) => {
        auditAction = data.action;
        auditPayload = data.payload;
      }
    }
  };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const service = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);

  await service.updateUser(9, { operationId: "202609050001", phone: "13900000009" }, 1);

  assert.equal(auditAction, "USER_PHONE_CHANGED");
  assert.deepEqual(auditPayload, {
    oldPhone: "138xxxxx009",
    newPhone: "139xxxxx009"
  });
  assert.equal(JSON.stringify(auditPayload).includes("13800000009"), false);
  assert.equal(JSON.stringify(auditPayload).includes("13900000009"), false);
});
