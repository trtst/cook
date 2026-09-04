import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

test("prisma exposes the auth persistence models", () => {
  const prisma = new PrismaClient() as PrismaClient & Record<string, unknown>;

  assert.equal(typeof prisma.userWechatIdentity, "object");
  assert.equal(typeof prisma.authSession, "object");
  assert.equal(typeof prisma.wechatLoginSession, "object");
  assert.equal(typeof prisma.smsCode, "object");
  assert.equal(typeof prisma.authRiskEvent, "object");

  void prisma.$disconnect();
});
