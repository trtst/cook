import assert from "node:assert/strict";
import test from "node:test";
import { AuthSessionService } from "./auth-session.service";

const user = {
  id: 7,
  uid: 10000007,
  nickname: "测试用户",
  avatarUrl: null,
  phone: "13800000007",
  status: "ACTIVE" as const,
  sessionVersion: 0
};

function createFakePrisma() {
  const sessions = new Map<number, Record<string, unknown>>();
  let nextId = 1;

  const prisma = {
    sessions,
    user: {
      findUnique: async () => user
    },
    authSession: {
      create: async ({ data, include }: { data: Record<string, unknown>; include?: unknown }) => {
        const record = { id: nextId++, ...data };
        sessions.set(record.id as number, record);
        return include ? { ...record, user } : record;
      },
      findUnique: async ({ where }: { where: { refreshTokenHash: string } }) => {
        const record = [...sessions.values()].find(item => item.refreshTokenHash === where.refreshTokenHash);
        return record ? { ...record, user } : null;
      },
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const record = sessions.get(where.id);
        if (!record) throw new Error("session not found");
        Object.assign(record, data);
        return record;
      },
      updateMany: async ({ where, data }: { where: { id: number; revokedAt: null }; data: Record<string, unknown> }) => {
        const record = sessions.get(where.id);
        if (!record || record.revokedAt) return { count: 0 };
        Object.assign(record, data);
        return { count: 1 };
      }
    },
    $transaction: async <T>(callback: (transaction: Record<string, unknown>) => Promise<T>) =>
      callback(prisma as unknown as Record<string, unknown>)
  };

  return prisma;
}

test("creates an opaque refresh token while persisting only its hash", async () => {
  const prisma = createFakePrisma();
  const tokenService = {
    createToken: () => ({ token: "access-token", expiresAt: "2026-09-04T01:00:00.000Z" })
  };
  const service = new AuthSessionService(prisma as never, tokenService as never);

  const result = await service.create(user, {
    deviceId: "device-a",
    ip: "127.0.0.1",
    userAgent: "test-agent"
  });

  assert.equal(result.accessToken, "access-token");
  assert.notEqual(result.refreshToken, "");
  assert.equal(prisma.sessions.size, 1);

  const record = [...prisma.sessions.values()][0];
  assert.equal(record.refreshToken, undefined);
  assert.equal(typeof record.refreshTokenHash, "string");
  assert.notEqual(record.refreshTokenHash, result.refreshToken);
  assert.deepEqual(result.user, {
    uid: user.uid,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phone: "138xxxxx007"
  });
});

test("rotates refresh token and rejects the previous token", async () => {
  const prisma = createFakePrisma();
  const tokenService = {
    createToken: () => ({ token: `access-${Date.now()}-${Math.random()}`, expiresAt: "2026-09-04T01:00:00.000Z" })
  };
  const service = new AuthSessionService(prisma as never, tokenService as never);

  const first = await service.create(user, { deviceId: "device-a", ip: "127.0.0.1", userAgent: "test-agent" });
  const second = await service.refresh(first.refreshToken, "device-a", {
    ip: "127.0.0.1",
    userAgent: "test-agent"
  });

  assert.notEqual(second.refreshToken, first.refreshToken);
  await assert.rejects(() => service.refresh(first.refreshToken, "device-a", { ip: "127.0.0.1", userAgent: "test-agent" }), {
    message: "刷新凭证已吊销"
  });
});

test("revokes refresh session on logout", async () => {
  const prisma = createFakePrisma();
  const tokenService = {
    createToken: () => ({ token: "access-token", expiresAt: "2026-09-04T01:00:00.000Z" })
  };
  const service = new AuthSessionService(prisma as never, tokenService as never);
  const session = await service.create(user, { deviceId: "device-a", ip: "127.0.0.1", userAgent: "test-agent" });

  await service.revoke(session.refreshToken, "device-a");

  const record = [...prisma.sessions.values()][0];
  assert.ok(record.revokedAt instanceof Date);
  await assert.rejects(() => service.refresh(session.refreshToken, "device-a", { ip: "127.0.0.1", userAgent: "test-agent" }), {
    message: "刷新凭证已吊销"
  });
});

test("rejects a refresh replay when the atomic session claim is lost", async () => {
  const session = {
    id: 1,
    userId: user.id,
    refreshTokenHash: "unused",
    deviceId: "device-a",
    ip: "127.0.0.1",
    userAgent: "test-agent",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user
  };
  const prisma = {
    authSession: {
      findUnique: async () => session
    },
    $transaction: async <T>(callback: (transaction: never) => Promise<T>) => callback({
      authSession: {
        updateMany: async () => ({ count: 0 }),
        create: async () => {
          throw new Error("refresh replay must not create a session");
        }
      }
    } as never)
  };
  const tokenService = {
    createToken: () => ({ token: "access-token", expiresAt: "2026-09-04T01:00:00.000Z" })
  };
  const service = new AuthSessionService(prisma as never, tokenService as never);

  await assert.rejects(
    () => service.refresh("refresh-token", "device-a", { ip: "127.0.0.1", userAgent: "test-agent" }),
    { message: "刷新凭证已吊销" }
  );
});
