import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword } from "../../common/security/password";
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
        user: { uid: user.uid, nickname: user.nickname, avatarUrl: user.avatarUrl }
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
