import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { hashPassword } from "../src/common/security/password";

loadLocalEnv();

const prisma = new PrismaClient();

async function seedUserSpace(userId: string, name = "我的饭搭子") {
  const diningGroup = await prisma.diningGroup.upsert({
    where: { ownerId: userId },
    update: {
      name,
      status: "ACTIVE",
      frozenAt: null,
      archivedAt: null
    },
    create: {
      name,
      ownerId: userId,
      status: "ACTIVE"
    }
  });

  await prisma.diningGroupMember.upsert({
    where: {
      diningGroupId_userId: {
        diningGroupId: diningGroup.id,
        userId
      }
    },
    update: {
      role: "OWNER",
      status: "ACTIVE",
      statusReason: null,
      restrictedAt: null,
      endedAt: null
    },
    create: {
      diningGroupId: diningGroup.id,
      userId,
      role: "OWNER",
      status: "ACTIVE"
    }
  });

  await prisma.userSpace.upsert({
    where: { userId },
    update: {
      originalDiningGroupId: diningGroup.id,
      currentDiningGroupId: diningGroup.id
    },
    create: {
      userId,
      originalDiningGroupId: diningGroup.id,
      currentDiningGroupId: diningGroup.id
    }
  });

  return diningGroup;
}

async function resetUserLifecycle(userId: string, originalDiningGroupId: string) {
  const now = new Date();

  await prisma.diningGroupMember.updateMany({
    where: {
      userId,
      diningGroupId: { not: originalDiningGroupId },
      status: { in: ["ACTIVE", "RESTRICTED"] }
    },
    data: {
      status: "ENDED",
      statusReason: "LEFT",
      restrictedAt: null,
      endedAt: now
    }
  });

  await prisma.userSpace.update({
    where: { userId },
    data: {
      currentDiningGroupId: originalDiningGroupId,
      originalDiningGroupId,
      version: { increment: 1 }
    }
  });

  await prisma.carryBackSnapshot.deleteMany({
    where: {
      OR: [
        { userId },
        { sourceDiningGroupId: originalDiningGroupId },
        { targetDiningGroupId: originalDiningGroupId }
      ]
    }
  });

  await prisma.diningGroupInvite.deleteMany({
    where: {
      OR: [
        { diningGroupId: originalDiningGroupId },
        { createdByUserId: userId },
        { acceptedByUserId: userId }
      ]
    }
  });

  await prisma.idempotencyRecord.deleteMany({
    where: {
      OR: [{ userId }, { diningGroupId: originalDiningGroupId }]
    }
  });
}

async function main() {
  const username = process.env.ADMIN_SEED_USERNAME ?? "admin";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
  const displayName = process.env.ADMIN_SEED_DISPLAY_NAME ?? "系统管理员";

  const admin = await prisma.adminAccount.upsert({
    where: { username },
    update: {
      displayName,
      passwordHash: hashPassword(password),
      roles: ["SUPER_ADMIN"],
      status: "ACTIVE"
    },
    create: {
      username,
      displayName,
      passwordHash: hashPassword(password),
      roles: ["SUPER_ADMIN"],
      status: "ACTIVE"
    }
  });

  const user = await prisma.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {
      uid: 52738164,
      nickname: "下一餐用户",
      phone: "13800000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      uid: 52738164,
      nickname: "下一餐用户",
      phone: "13800000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    }
  });

  const guestUser = await prisma.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {
      uid: 83947215,
      nickname: "下一餐成员",
      phone: "13900000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    },
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      uid: 83947215,
      nickname: "下一餐成员",
      phone: "13900000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    }
  });

  const userDiningGroup = await seedUserSpace(user.id);
  const guestDiningGroup = await seedUserSpace(guestUser.id);
  await resetUserLifecycle(user.id, userDiningGroup.id);
  await resetUserLifecycle(guestUser.id, guestDiningGroup.id);

  console.log(`Seeded admin ${admin.username} and users ${user.phone}, ${guestUser.phone}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
