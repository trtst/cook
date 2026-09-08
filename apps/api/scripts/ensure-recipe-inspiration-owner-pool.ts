import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { recipeInspirationOwnerCount } from "../src/modules/recipe/recipe-inspiration-owner";

const prisma = new PrismaClient();

function randomUid(used: Set<number>) {
  let uid = 0;
  while (!uid || used.has(uid)) uid = randomInt(10_000_000, 100_000_000);
  used.add(uid);
  return uid;
}

function randomNickname(used: Set<string>) {
  let nickname = "";
  while (!nickname || used.has(nickname)) nickname = `用户${randomInt(1_000_000_000, 10_000_000_000)}`;
  used.add(nickname);
  return nickname;
}

async function main() {
  const result = await prisma.$transaction(async tx => {
    const systemUser = await tx.user.findUnique({ where: { uid: 10001 }, select: { id: true, nickname: true, phone: true } });
    if (!systemUser) throw new Error("UID 10001 系统用户不存在");
    if ((systemUser.nickname ?? "").includes("炊火") || (systemUser.nickname ?? "").includes("炊火记")) {
      throw new Error("UID 10001 系统用户昵称包含禁用关键词");
    }

    const existing = await tx.recipeInspirationOwner.findMany({ select: { userId: true } });
    if (existing.length > recipeInspirationOwnerCount) throw new Error("灵感菜谱归属用户池超过 100 个用户");
    const members = new Set(existing.map(item => item.userId));
    if (!members.has(systemUser.id)) {
      await tx.recipeInspirationOwner.create({ data: { userId: systemUser.id } });
      members.add(systemUser.id);
    }
    const users = await tx.user.findMany({ select: { uid: true, nickname: true } });
    const usedUids = new Set(users.map(item => item.uid));
    const usedNicknames = new Set(users.map(item => item.nickname).filter((item): item is string => Boolean(item)));
    while (members.size < recipeInspirationOwnerCount) {
      const user = await tx.user.create({
        data: {
          uid: randomUid(usedUids),
          nickname: randomNickname(usedNicknames),
          phone: null,
          status: "ACTIVE"
        },
        select: { id: true }
      });
      await tx.recipeInspirationOwner.create({ data: { userId: user.id } });
      members.add(user.id);
    }
    const poolUsers = await tx.user.findMany({
      where: { inspirationOwnerPool: { isNot: null }, status: "ACTIVE" },
      select: { id: true, uid: true, nickname: true, phone: true, status: true }
    });
    if (poolUsers.length !== recipeInspirationOwnerCount) {
      throw new Error(`灵感菜谱归属用户池必须正好包含 ${recipeInspirationOwnerCount} 个用户`);
    }
    for (const user of poolUsers) {
      if (user.status !== "ACTIVE") throw new Error(`灵感用户状态不符合约束: ${user.uid}`);
      if ((user.nickname ?? "").includes("炊火")) throw new Error(`灵感用户昵称包含禁用关键词: ${user.uid}`);
      if (user.id !== systemUser.id && (user.uid < 10_000_000 || user.uid >= 100_000_000 || user.phone !== null || !/^用户\d{10}$/.test(user.nickname ?? ""))) {
        throw new Error(`灵感用户资料不符合约束: ${user.uid}`);
      }
    }
    return { count: poolUsers.length };
  });
  console.log(JSON.stringify(result));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
