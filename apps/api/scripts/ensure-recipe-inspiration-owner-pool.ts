import { PrismaClient } from "@prisma/client";
import {
  buildPoolPlan,
  publicContentUserProfiles
} from "../src/modules/recipe/public-content-user-profiles";
import {
  pickPublicContentOwnerId,
  publicContentUserPoolSize
} from "../src/modules/recipe/public-content-user-pool";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(async tx => {
    const profileUids = publicContentUserProfiles.map(item => item.uid);
    const existingUsers = await tx.user.findMany({
      where: {
        OR: [
          { uid: { in: profileUids } },
          { publicContentPoolMember: { isNot: null } }
        ]
      },
      select: {
        id: true,
        uid: true,
        nickname: true,
        phone: true,
        openid: true,
        unionid: true,
        passwordHash: true,
        cookNo: true,
        status: true
      }
    });
    const currentMembers = await tx.publicContentUserPoolMember.findMany({
      select: { userId: true }
    });
    const plan = buildPoolPlan(existingUsers, currentMembers.map(item => item.userId));
    const profileUidSet = new Set(profileUids);
    const existingProfileUsers = existingUsers.filter(item => profileUidSet.has(item.uid));

    for (const user of existingProfileUsers) {
      if (user.status !== "ACTIVE") {
        throw new Error(`固定公共内容用户未启用: ${user.uid}`);
      }
      if (user.phone || user.openid || user.unionid || user.passwordHash || user.cookNo) {
        throw new Error(`固定公共内容 UID 已被登录账号占用: ${user.uid}`);
      }
    }

    if (plan.createProfiles.length > 0) {
      await tx.user.createMany({
        data: plan.createProfiles.map(profile => ({
          uid: profile.uid,
          nickname: profile.nickname,
          phone: null,
          status: "ACTIVE" as const
        }))
      });
    }
    for (const update of plan.nicknameUpdates) {
      await tx.user.update({
        where: { id: update.id },
        data: { nickname: update.nickname }
      });
    }

    const profileUsers = await tx.user.findMany({
      where: { uid: { in: profileUids }, status: "ACTIVE" },
      select: { id: true, uid: true, nickname: true }
    });
    if (profileUsers.length !== publicContentUserPoolSize) {
      throw new Error(`固定公共内容用户必须正好包含 ${publicContentUserPoolSize} 个启用账号`);
    }
    const profileByUid = new Map(publicContentUserProfiles.map(item => [item.uid, item]));
    for (const user of profileUsers) {
      if (user.nickname !== profileByUid.get(user.uid)?.nickname) {
        throw new Error(`固定公共内容用户昵称不符合约束: ${user.uid}`);
      }
    }

    const profileUserIds = profileUsers.map(item => item.id);
    const profileById = new Map(profileUsers.map(item => [item.id, item]));
    const outgoingRecipes = plan.outgoingUserIds.length === 0
      ? []
      : await tx.recipe.findMany({
          where: {
            ownerId: { in: plan.outgoingUserIds },
            isInspiration: true
          },
          select: { id: true, title: true, ownerId: true }
        });
    const reassignedRecipes: Array<{
      id: number;
      title: string;
      previousOwnerId: number;
      ownerUid: number;
      ownerNickname: string;
    }> = [];
    for (const recipe of outgoingRecipes) {
      const ownerId = pickPublicContentOwnerId(profileUserIds);
      const owner = profileById.get(ownerId);
      if (!owner?.nickname) throw new Error(`公共内容用户昵称缺失: ${ownerId}`);
      await tx.recipe.update({
        where: { id: recipe.id },
        data: {
          ownerId,
          ownerNicknameSnapshot: owner.nickname
        }
      });
      reassignedRecipes.push({
        id: recipe.id,
        title: recipe.title,
        previousOwnerId: recipe.ownerId,
        ownerUid: owner.uid,
        ownerNickname: owner.nickname
      });
    }

    await tx.publicContentUserPoolMember.deleteMany({
      where: { user: { status: { not: "ACTIVE" } } }
    });
    if (plan.outgoingUserIds.length > 0) {
      await tx.publicContentUserPoolMember.deleteMany({
        where: { userId: { in: plan.outgoingUserIds } }
      });
    }
    await tx.publicContentUserPoolMember.createMany({
      data: profileUserIds.map(userId => ({ userId })),
      skipDuplicates: true
    });

    const poolUsers = await tx.user.findMany({
      where: { publicContentPoolMember: { isNot: null } },
      select: { id: true, uid: true, nickname: true, status: true }
    });
    if (poolUsers.length !== publicContentUserPoolSize) {
      throw new Error(`公共内容用户池必须正好包含 ${publicContentUserPoolSize} 个用户`);
    }
    for (const user of poolUsers) {
      const profile = profileByUid.get(user.uid);
      if (user.status !== "ACTIVE" || !profile || user.nickname !== profile.nickname) {
        throw new Error(`公共内容用户资料不符合固定名单: ${user.uid}`);
      }
    }

    return {
      count: poolUsers.length,
      createdUsers: plan.createProfiles.length,
      renamedUsers: plan.nicknameUpdates.length,
      retiredMembers: plan.outgoingUserIds.length,
      reassignedRecipes
    };
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
