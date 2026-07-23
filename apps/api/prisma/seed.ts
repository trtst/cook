import { PrismaClient, type EntitlementTier } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { hashPassword } from "../src/common/security/password";

loadLocalEnv();

const prisma = new PrismaClient();

async function seedOwnedDiningGroup(userId: string, name = "我的饭搭子") {
  const diningGroup = await prisma.diningGroup.upsert({
    where: { ownerId: userId },
    update: {
      name,
      status: "ACTIVE",
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

  await prisma.diningGroupMember.updateMany({
    where: {
      diningGroupId: diningGroup.id,
      userId: { not: userId },
      status: { in: ["ACTIVE", "RESTRICTED"] }
    },
    data: {
      status: "ENDED",
      statusReason: "GROUP_DISSOLVED",
      endedAt: new Date()
    }
  });

  await prisma.diningGroupInvite.deleteMany({
    where: { diningGroupId: diningGroup.id }
  });

  return diningGroup;
}

async function seedEntitlement(userId: string, tier: EntitlementTier | null) {
  if (!tier) {
    await prisma.entitlementGrant.deleteMany({ where: { userId } });
    return;
  }

  await prisma.entitlementGrant.upsert({
    where: { userId },
    update: {
      tier,
      startsAt: new Date(),
      endsAt: null
    },
    create: {
      userId,
      tier,
      startsAt: new Date(),
      endsAt: null
    }
  });
}

async function resetUserRelations(userId: string, keepDiningGroupId: string) {
  await prisma.diningGroupMember.updateMany({
    where: {
      userId,
      diningGroupId: { not: keepDiningGroupId },
      status: { in: ["ACTIVE", "RESTRICTED"] }
    },
    data: {
      status: "ENDED",
      statusReason: "LEFT",
      restrictedAt: null,
      endedAt: new Date()
    }
  });

  await prisma.idempotencyRecord.deleteMany({
    where: {
      OR: [{ userId }, { diningGroupId: keepDiningGroupId }]
    }
  });
}

function recipeSearchText(name: string, ingredients: Array<{ name: string }>) {
  return [name, ...ingredients.map(item => item.name)].join(" ");
}

async function upsertRecipeVersion(
  id: string,
  createdByUserId: string | null,
  content: {
    name: string;
    ingredients: Array<{ name: string; amount: string }>;
    steps: Array<{ content: string }>;
    servings: string | null;
    durationMinutes: number | null;
    images: Array<{ key: string; url: string; sizeBytes: number }>;
  }
) {
  return prisma.recipeContentVersion.upsert({
    where: { id },
    update: {
      createdByUserId,
      name: content.name,
      ingredientsJson: content.ingredients,
      stepsJson: content.steps,
      servings: content.servings,
      durationMinutes: content.durationMinutes,
      imagesJson: content.images,
      searchText: recipeSearchText(content.name, content.ingredients),
      contentSizeBytes: Math.max(
        1024,
        Buffer.byteLength(
          JSON.stringify({
            name: content.name,
            ingredients: content.ingredients,
            steps: content.steps,
            servings: content.servings,
            durationMinutes: content.durationMinutes,
            images: content.images.map(item => ({ key: item.key, url: item.url }))
          }),
          "utf8"
        )
      )
    },
    create: {
      id,
      createdByUserId,
      name: content.name,
      ingredientsJson: content.ingredients,
      stepsJson: content.steps,
      servings: content.servings,
      durationMinutes: content.durationMinutes,
      imagesJson: content.images,
      searchText: recipeSearchText(content.name, content.ingredients),
      contentSizeBytes: Math.max(
        1024,
        Buffer.byteLength(
          JSON.stringify({
            name: content.name,
            ingredients: content.ingredients,
            steps: content.steps,
            servings: content.servings,
            durationMinutes: content.durationMinutes,
            images: content.images.map(item => ({ key: item.key, url: item.url }))
          }),
          "utf8"
        )
      )
    }
  });
}

async function seedRecipes(ownerUserId: string) {
  const tomatoVersion = await upsertRecipeVersion("10000000-0000-4000-8000-000000000001", null, {
    name: "番茄炒蛋",
    ingredients: [
      { name: "番茄", amount: "2 个" },
      { name: "鸡蛋", amount: "3 个" }
    ],
    steps: [{ content: "番茄切块" }, { content: "鸡蛋炒散后和番茄一起翻炒" }],
    servings: "2 人份",
    durationMinutes: 15,
    images: [{ key: "cover", url: "https://example.com/recipe/tomato-egg.jpg", sizeBytes: 128000 }]
  });

  const potatoVersion = await upsertRecipeVersion("10000000-0000-4000-8000-000000000002", null, {
    name: "土豆烧牛肉",
    ingredients: [
      { name: "土豆", amount: "2 个" },
      { name: "牛肉", amount: "400g" }
    ],
    steps: [{ content: "牛肉焯水" }, { content: "土豆与牛肉一起焖煮" }],
    servings: "3 人份",
    durationMinutes: 45,
    images: [{ key: "cover", url: "https://example.com/recipe/beef-potato.jpg", sizeBytes: 156000 }]
  });

  const ownerVersion = await upsertRecipeVersion("10000000-0000-4000-8000-000000000003", ownerUserId, {
    name: "青椒肉丝",
    ingredients: [
      { name: "青椒", amount: "2 个" },
      { name: "里脊肉", amount: "250g" }
    ],
    steps: [{ content: "肉丝上浆" }, { content: "大火快炒" }],
    servings: "2 人份",
    durationMinutes: 20,
    images: [{ key: "cover", url: "https://example.com/recipe/pepper-pork.jpg", sizeBytes: 118000 }]
  });

  await prisma.recipe.upsert({
    where: { id: "20000000-0000-4000-8000-000000000001" },
    update: {
      ownerId: null,
      sourceKind: "SYSTEM",
      sourceRecipeId: null,
      baseVersionId: tomatoVersion.id,
      independentVersionId: null,
      overrideJson: null,
      hiddenBaseImages: [],
      isCustomized: false,
      title: tomatoVersion.name,
      searchText: tomatoVersion.searchText,
      coverImageUrl: "https://example.com/recipe/tomato-egg.jpg",
      status: "ACTIVE",
      blockedReason: null,
      blockedAt: null,
      recycledUntil: null,
      deletedAt: null,
      reportCount: 0
    },
    create: {
      id: "20000000-0000-4000-8000-000000000001",
      ownerId: null,
      sourceKind: "SYSTEM",
      baseVersionId: tomatoVersion.id,
      title: tomatoVersion.name,
      searchText: tomatoVersion.searchText,
      coverImageUrl: "https://example.com/recipe/tomato-egg.jpg"
    }
  });

  await prisma.recipe.upsert({
    where: { id: "20000000-0000-4000-8000-000000000002" },
    update: {
      ownerId: null,
      sourceKind: "SYSTEM",
      sourceRecipeId: null,
      baseVersionId: potatoVersion.id,
      independentVersionId: null,
      overrideJson: null,
      hiddenBaseImages: [],
      isCustomized: false,
      title: potatoVersion.name,
      searchText: potatoVersion.searchText,
      coverImageUrl: "https://example.com/recipe/beef-potato.jpg",
      status: "ACTIVE",
      blockedReason: null,
      blockedAt: null,
      recycledUntil: null,
      deletedAt: null,
      reportCount: 0
    },
    create: {
      id: "20000000-0000-4000-8000-000000000002",
      ownerId: null,
      sourceKind: "SYSTEM",
      baseVersionId: potatoVersion.id,
      title: potatoVersion.name,
      searchText: potatoVersion.searchText,
      coverImageUrl: "https://example.com/recipe/beef-potato.jpg"
    }
  });

  await prisma.recipe.upsert({
    where: { id: "20000000-0000-4000-8000-000000000003" },
    update: {
      ownerId: ownerUserId,
      sourceKind: "USER",
      sourceRecipeId: null,
      baseVersionId: ownerVersion.id,
      independentVersionId: null,
      overrideJson: null,
      hiddenBaseImages: [],
      isCustomized: false,
      title: ownerVersion.name,
      searchText: ownerVersion.searchText,
      coverImageUrl: "https://example.com/recipe/pepper-pork.jpg",
      status: "ACTIVE",
      blockedReason: null,
      blockedAt: null,
      recycledUntil: null,
      deletedAt: null,
      reportCount: 0
    },
    create: {
      id: "20000000-0000-4000-8000-000000000003",
      ownerId: ownerUserId,
      sourceKind: "USER",
      baseVersionId: ownerVersion.id,
      title: ownerVersion.name,
      searchText: ownerVersion.searchText,
      coverImageUrl: "https://example.com/recipe/pepper-pork.jpg"
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

  const ownerUser = await prisma.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {
      uid: 52738164,
      nickname: "下一餐主理人",
      phone: "13800000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      uid: 52738164,
      nickname: "下一餐主理人",
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

  const memberUser = await prisma.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000003" },
    update: {
      uid: 91827364,
      nickname: "下一餐协作成员",
      phone: "13700000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    },
    create: {
      id: "00000000-0000-4000-8000-000000000003",
      uid: 91827364,
      nickname: "下一餐协作成员",
      phone: "13700000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    }
  });

  const ownerGroup = await seedOwnedDiningGroup(ownerUser.id, "主理人的饭搭子");
  const guestGroup = await seedOwnedDiningGroup(guestUser.id, "成员的饭搭子");
  const memberGroup = await seedOwnedDiningGroup(memberUser.id, "协作成员的饭搭子");
  await resetUserRelations(ownerUser.id, ownerGroup.id);
  await resetUserRelations(guestUser.id, guestGroup.id);
  await resetUserRelations(memberUser.id, memberGroup.id);
  await seedEntitlement(ownerUser.id, "PRO");
  await seedEntitlement(guestUser.id, null);
  await seedEntitlement(memberUser.id, "PLUS");
  await seedRecipes(ownerUser.id);

  console.log(`Seeded admin ${admin.username} and users ${ownerUser.phone}, ${guestUser.phone}, ${memberUser.phone}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
