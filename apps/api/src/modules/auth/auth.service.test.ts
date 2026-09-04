import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../../common/security/password";
import { AuthService } from "./auth.service";

const user = {
  id: 9,
  uid: 10000009,
  nickname: "测试用户",
  avatarUrl: null,
  phone: "13800000009",
  passwordHash: hashPassword("secret-pass"),
  status: "ACTIVE" as const,
  sessionVersion: 0
};

test("password login creates the new access and refresh session shape", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    user: {
      findUnique: async () => user
    }
  };
  const session = {
    create: async (currentUser: unknown, context: unknown) => {
      calls.push({ currentUser, context });
      return {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        accessExpiresAt: "2026-09-04T01:00:00.000Z",
        refreshExpiresAt: "2026-10-04T01:00:00.000Z",
        user: { uid: user.uid, nickname: user.nickname, avatarUrl: user.avatarUrl, phone: "138xxxxx009" }
      };
    }
  };
  const risk = {
    assertAllowed: async () => undefined,
    clearPasswordFailures: () => undefined,
    record: async () => undefined,
    recordPasswordFailure: async () => undefined
  };

  const service = new AuthService(prisma as never, session as never, {} as never, {} as never, risk as never);
  const result = await service.loginWithPassword(
    { phone: user.phone, password: "secret-pass", deviceId: "device-a" },
    { ip: "127.0.0.1", userAgent: "test-agent" }
  );

  assert.equal(result.accessToken, "access-token");
  assert.equal(result.refreshToken, "refresh-token");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].context, { deviceId: "device-a", ip: "127.0.0.1", userAgent: "test-agent" });
});

test("password login records a failure before returning an invalid-password error", async () => {
  let failures = 0;
  const prisma = {
    user: {
      findUnique: async () => user
    }
  };
  const risk = {
    assertAllowed: async () => undefined,
    clearPasswordFailures: () => undefined,
    record: async () => undefined,
    recordPasswordFailure: async () => {
      failures += 1;
    }
  };
  const service = new AuthService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    risk as never
  );

  await assert.rejects(
    () =>
      service.loginWithPassword(
        { phone: user.phone, password: "wrong-pass", deviceId: "device-a" },
        { ip: "127.0.0.1", userAgent: "test-agent" }
      ),
    { message: "手机号或密码错误" }
  );
  assert.equal(failures, 1);
});

test("setting a password accepts any two password character categories", async () => {
  let savedHash = "";
  const prisma = {
    user: {
      findUnique: async () => ({ status: "ACTIVE", phone: "13800000009", passwordHash: null }),
      update: async ({ data }: { data: { passwordHash: string } }) => {
        savedHash = data.passwordHash;
        return { updatedAt: new Date("2026-09-04T02:00:00.000Z") };
      }
    }
  };
  const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

  const result = await service.setPassword(9, { password: "12345678!" });

  assert.equal(result.changedAt, "2026-09-04T02:00:00.000Z");
  assert.equal(verifyPassword("12345678!", savedHash), true);
});

test("changing a password requires the current password when one exists", async () => {
  const prisma = {
    user: {
      findUnique: async () => ({ status: "ACTIVE", phone: "13800000009", passwordHash: hashPassword("secret-pass") }),
      update: async () => ({ updatedAt: new Date("2026-09-04T02:00:00.000Z") })
    }
  };
  const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

  await assert.rejects(
    () => service.changePassword(9, { currentPassword: "wrong-pass", newPassword: "new-pass1" }),
    { message: "当前密码错误" }
  );
});

test("password writes reject weak passwords before storing a hash", async () => {
  let updateCount = 0;
  const prisma = {
    user: {
      findUnique: async () => ({ status: "ACTIVE", phone: "13800000009", passwordHash: null }),
      update: async () => {
        updateCount += 1;
        return { updatedAt: new Date("2026-09-04T02:00:00.000Z") };
      }
    }
  };
  const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

  await assert.rejects(() => service.setPassword(9, { password: "abc12!" }), { message: "密码需要 8-20 位字符" });
  await assert.rejects(() => service.setPassword(9, { password: "abc12345678901234567!" }), { message: "密码需要 8-20 位字符" });
  await assert.rejects(() => service.setPassword(9, { password: "12345678" }), { message: "密码需至少包含字母、数字、符号中的两种" });
  assert.equal(updateCount, 0);
});

test("password writes require a bound phone because password login is phone based", async () => {
  let updateCount = 0;
  const prisma = {
    user: {
      findUnique: async () => ({ status: "ACTIVE", phone: null, passwordHash: null }),
      update: async () => {
        updateCount += 1;
        return { updatedAt: new Date("2026-09-04T02:00:00.000Z") };
      }
    }
  };
  const service = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never);

  await assert.rejects(() => service.setPassword(9, { password: "12345678!" }), { message: "请先绑定手机号" });
  assert.equal(updateCount, 0);
});

test("sms login checks the shared risk gate before consuming a code", async () => {
  let checkedInput: Record<string, unknown> | null = null;
  let consumed = false;
  const prisma = {
    $transaction: async <T>(callback: (transaction: never) => Promise<T>) => callback({} as never)
  };
  const sms = {
    consumeLoginCode: async () => {
      consumed = true;
    }
  };
  const risk = {
    assertAllowed: async (input: Record<string, unknown>) => {
      checkedInput = input;
      throw new Error("risk blocked");
    },
    record: async () => undefined,
    recordFailure: async () => undefined,
    clearPasswordFailures: () => undefined,
    recordPasswordFailure: async () => undefined
  };
  const service = new AuthService(prisma as never, {} as never, {} as never, sms as never, risk as never);

  await assert.rejects(
    () => service.loginWithSms(
      { phone: "13800000009", code: "123456", deviceId: "device-a" },
      { ip: "127.0.0.1", userAgent: "test-agent" }
    ),
    { message: "risk blocked" }
  );
  assert.deepEqual(checkedInput, {
    channel: "SMS",
    operation: "LOGIN",
    phone: "13800000009",
    ip: "127.0.0.1",
    deviceId: "device-a"
  });
  assert.equal(consumed, false);
});

test("current phone change code is blocked within 30 days of the last phone change", async () => {
  let sent = false;
  const prisma = {
    user: {
      findUnique: async () => ({
        id: 9,
        status: "ACTIVE",
        phone: "13800000009",
        phoneChangedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      })
    }
  };
  const sms = {
    sendPhoneChangeCode: async () => {
      sent = true;
    }
  };
  const service = new AuthService(prisma as never, {} as never, {} as never, sms as never, {} as never);

  await assert.rejects(
    () => service.sendCurrentPhoneChangeCode(9, { phone: "13800000009", deviceId: "device-a" }, { ip: "127.0.0.1", userAgent: "test-agent" }),
    { message: "一个账号30天内只能更换一次手机号" }
  );
  assert.equal(sent, false);
});

test("phone change completion consumes the new phone code and records the change time", async () => {
  let consumedPhone = "";
  let updatedPhone = "";
  const prisma = {
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => callback(prisma),
    user: {
      findUnique: async ({ where }: { where: { id?: number; phone?: string } }) => {
        if (where.phone === "13900000009") return null;
        return {
          id: 9,
          uid: 10000009,
          nickname: "测试用户",
          avatarUrl: null,
          phone: "13800000009",
          passwordHash: hashPassword("secret-pass"),
          status: "ACTIVE",
          phoneChangedAt: null
        };
      },
      update: async ({ data }: { data: { phone: string; phoneChangedAt: Date } }) => {
        updatedPhone = data.phone;
        return {
          uid: 10000009,
          nickname: "测试用户",
          avatarUrl: null,
          phone: data.phone,
          status: "ACTIVE",
          passwordHash: hashPassword("secret-pass")
        };
      }
    },
    phoneChangeSession: {
      findUnique: async () => ({
        id: 1,
        userId: 9,
        tokenHash: "token-hash",
        oldPhone: "13800000009",
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000)
      }),
      updateMany: async () => ({ count: 1 })
    },
    idempotencyRecord: {
      findFirst: async () => null,
      create: async () => undefined,
      updateMany: async () => ({ count: 1 })
    },
    $queryRaw: async () => undefined,
    auditEvent: {
      create: async () => undefined
    }
  };
  const sms = {
    consumePhoneChangeCode: async (phone: string, code: string) => {
      if (code !== "654321") throw new Error("wrong code");
      consumedPhone = phone;
    }
  };
  const service = new AuthService(prisma as never, {} as never, {} as never, sms as never, {} as never);

  const result = await service.completePhoneChange(9, "202609041700001", { changeToken: "token", phone: "13900000009", code: "654321" });

  assert.equal(consumedPhone, "13900000009");
  assert.equal(updatedPhone, "13900000009");
  assert.equal(result.phone, "139xxxxx009");
  assert.equal(result.hasPassword, true);
});
