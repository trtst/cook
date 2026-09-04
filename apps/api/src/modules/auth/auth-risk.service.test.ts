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

test("locks a phone after five consecutive password failures", async () => {
  const prisma = createFakePrisma();
  const service = new AuthRiskService(prisma as never);
  const input = { phone: "13800000000", ip: "127.0.0.1", deviceId: "device-a" };

  for (let index = 0; index < 5; index += 1) {
    await service.recordPasswordFailure(input);
  }

  await assert.rejects(() => service.assertPasswordAllowed(input), { message: "登录尝试过于频繁，请稍后重试" });
  assert.equal(prisma.events.length, 5);
});

test("allows a different phone while one phone is locked", async () => {
  const service = new AuthRiskService(createFakePrisma() as never);
  const locked = { phone: "13800000000", ip: "127.0.0.1", deviceId: "device-a" };
  for (let index = 0; index < 5; index += 1) await service.recordPasswordFailure(locked);

  await service.assertPasswordAllowed({ phone: "13900000000", ip: "127.0.0.2", deviceId: "device-b" });
});

test("locks the shared security scope across channels after repeated failures", async () => {
  const service = new AuthRiskService(createFakePrisma() as never);
  const base = { ip: "127.0.0.1", deviceId: "device-a" };

  for (let index = 0; index < 5; index += 1) {
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
