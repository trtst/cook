import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { CurrentUserService } from "./current-user.service";

function buildService(now: Date, options: { cookNo?: string | null } = {}) {
  const user = {
    id: 1001,
    uid: 52738164,
    nickname: "旧名字",
    avatarUrl: null,
    cookNo: options.cookNo === undefined ? "52738164" : options.cookNo,
    bio: null,
    gender: null,
    birthDate: null,
    passwordHash: null,
    status: "ACTIVE"
  };
  const tx = {
    user: {
      findUnique: async () => user,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...user, ...data })
    }
  };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx)
  };
  const entitlement = {
    resolveForUser: async () => ({ tier: "FREE", validUntil: null, storageLimitBytes: 0 })
  };
  class TestCurrentUserService extends CurrentUserService {
    protected currentDate() {
      return now;
    }
  }
  return new TestCurrentUserService(prisma as never, entitlement as never);
}

test("current user birthday rejects future dates and ages 14 or younger", async () => {
  const service = buildService(new Date("2026-09-04T12:00:00.000Z"));

  await assert.rejects(
    () => service.updateCurrent(1001, { birthDate: "2026-09-05" }),
    (error) => error instanceof BadRequestException && error.message === "生日不能晚于今天"
  );
  await assert.rejects(
    () => service.updateCurrent(1001, { birthDate: "2012-09-04" }),
    (error) => error instanceof BadRequestException && error.message === "未满14岁需实名认证"
  );
  await assert.rejects(
    () => service.updateCurrent(1001, { birthDate: "2011-09-05" }),
    (error) => error instanceof BadRequestException && error.message === "未满14岁需实名认证"
  );

  const result = await service.updateCurrent(1001, { birthDate: "2011-09-04" });

  assert.equal(result.profile.birthDate, "2011-09-04");
});

test("current user cook number can only change once after the default uid value", async () => {
  const defaultService = buildService(new Date("2026-09-04T12:00:00.000Z"), { cookNo: "52738164" });
  const firstResult = await defaultService.updateCurrent(1001, { cookNo: "cook_520" });

  assert.equal(firstResult.profile.cookNo, "cook_520");

  const customService = buildService(new Date("2026-09-04T12:00:00.000Z"), { cookNo: "cook_520" });

  await assert.rejects(
    () => customService.updateCurrent(1001, { cookNo: "cook_521" }),
    (error) => error instanceof BadRequestException && error.message === "炊火号只能设置一次"
  );

  const sameResult = await customService.updateCurrent(1001, { cookNo: "cook_520" });

  assert.equal(sameResult.profile.cookNo, "cook_520");
});
