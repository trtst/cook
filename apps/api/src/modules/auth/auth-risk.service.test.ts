import assert from "node:assert/strict";
import test from "node:test";
import { AuthRiskService } from "./auth-risk.service";

function createFakePrisma() {
  const events: Array<Record<string, unknown>> = [];
  return {
    events,
    authRiskEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return data;
      }
    }
  };
}

test("locks a phone for one minute after three consecutive login failures within ten minutes", async () => {
  const prisma = createFakePrisma();
  const service = new AuthRiskService(prisma as never);
  const input = { phone: "13800000000", ip: "127.0.0.1", deviceId: "device-a" };

  for (let index = 0; index < 3; index += 1) {
    await service.recordPasswordFailure(input);
  }

  await assert.rejects(() => service.assertPasswordAllowed(input), { message: "登录尝试过于频繁，请稍后重试" });
  assert.equal(prisma.events.length, 3);
});

test("does not count failures as consecutive when the previous failure is over ten minutes old", async () => {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const service = new AuthRiskService(createFakePrisma() as never);
    const input = { phone: "13800000000", ip: "127.0.0.1", deviceId: "device-a" };

    await service.recordPasswordFailure(input);
    now += 10 * 60_000 + 1;
    await service.recordPasswordFailure(input);
    await service.recordPasswordFailure(input);

    await service.assertPasswordAllowed(input);
  } finally {
    Date.now = realNow;
  }
});

test("locks a phone for ten minutes after more than ten login failures in one minute", async () => {
  const realNow = Date.now;
  const now = realNow();
  Date.now = () => now;
  try {
    const service = new AuthRiskService(createFakePrisma() as never);
    const input = { phone: "13800000000", ip: "127.0.0.1", deviceId: "device-a" };

    for (let index = 0; index < 11; index += 1) {
      await service.recordPasswordFailure(input);
    }

    await assert.rejects(
      () => service.assertPasswordAllowed(input),
      (error: any) => error?.response?.data?.retryAfterSeconds > 60
    );
  } finally {
    Date.now = realNow;
  }
});

test("allows a different phone while one phone is locked", async () => {
  const service = new AuthRiskService(createFakePrisma() as never);
  const locked = { phone: "13800000000", ip: "127.0.0.1", deviceId: "device-a" };
  for (let index = 0; index < 3; index += 1) await service.recordPasswordFailure(locked);

  await service.assertPasswordAllowed({ phone: "13900000000", ip: "127.0.0.2", deviceId: "device-b" });
});

test("locks the shared security scope across channels after repeated failures", async () => {
  const service = new AuthRiskService(createFakePrisma() as never);
  const base = { ip: "127.0.0.1", deviceId: "device-a" };

  for (let index = 0; index < 3; index += 1) {
    await service.recordFailure({
      channel: index % 2 === 0 ? "PASSWORD" : "SMS",
      phone: `1380000000${index}`,
      ...base
    });
  }

  await assert.rejects(
    () => service.assertAllowed({ channel: "WECHAT_PHONE", phone: "13900000000", ...base }),
    { message: "登录尝试过于频繁，请稍后重试" }
  );
});

test("successful login clears phone ip and device failure buckets", async () => {
  const service = new AuthRiskService(createFakePrisma() as never);
  const input = { phone: "13800000000", ip: "127.0.0.1", deviceId: "device-a" };

  await service.recordPasswordFailure(input);
  await service.recordPasswordFailure(input);
  service.clearLoginFailures(input);
  await service.recordPasswordFailure(input);
  await service.recordPasswordFailure(input);

  await service.assertPasswordAllowed(input);
});
