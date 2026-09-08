import { deflateSync } from "node:zlib";
import {
  PrismaClient,
  RecipeAssistantStatus,
  RecipeNutritionStatus,
  UnitType,
  RecipeVersionTagSource,
  RecipeVersionTagStatus
} from "@prisma/client";
import type { RecipeContentSnapshot, RecipeIngredientSnapshot } from "../src/contracts/types";
import { loadLocalEnv } from "../src/common/load-env";
import { assetKey, AssetStorageService } from "../src/common/asset-storage.service";
import { buildRecipeSearchText, buildRecipeAssistantSnapshot, contentSizeBytes, toJson } from "../src/modules/recipe/recipe-content";

loadLocalEnv();

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const systemUserId = 278;
const personalUserId = 1001;
const personalCategoryId = 1;
const inspirationCategoryId = 6001;
const fixtureSourceVersion = "recipe-fixture-2026-09-08";

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([typeBuffer, data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function solidPng(width: number, height: number, color: [number, number, number, number]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const offset = row * (width * 4 + 1);
    pixels[offset] = 0;
    for (let column = 0; column < width; column += 1) {
      const pixelOffset = offset + 1 + column * 4;
      pixels.set(color, pixelOffset);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

async function writeFixtureImage(assetStorage: AssetStorageService, fileName: string, width: number, height: number, color: [number, number, number, number]) {
  const storageKey = assetKey("uploads", "admin-recipe-images", "fixtures", fileName);
  await assetStorage.writeObject(storageKey, solidPng(width, height, color), "image/png");
  return assetStorage.publicUrl({ protocol: "http", get: () => "127.0.0.1:3000" }, storageKey);
}

function assertLocalDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL 未配置");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || (url.port && url.port !== "5432") || url.pathname !== "/next_meal") {
    throw new Error(`拒绝操作非本地 next_meal 数据库: ${url.hostname}:${url.port || "5432"}${url.pathname}`);
  }
}

function exactIngredient(
  row: { id: number; name: string; categoryId: number; defaultUnitId: number; defaultUnit: { name: string; type: string } },
  quantity: string
): RecipeIngredientSnapshot {
  return {
    ingredientId: row.id,
    ingredientName: row.name,
    source: "SYSTEM",
    categoryId: row.categoryId,
    amount: {
      kind: "EXACT",
      quantity,
      unitId: row.defaultUnitId,
      unitName: row.defaultUnit.name,
      unitType: row.defaultUnit.type as UnitType
    }
  } as RecipeIngredientSnapshot;
}

function fuzzyIngredient(
  row: { id: number; name: string; categoryId: number }
): RecipeIngredientSnapshot {
  return {
    ingredientId: row.id,
    ingredientName: row.name,
    source: "SYSTEM",
    categoryId: row.categoryId,
    amount: { kind: "FUZZY", text: "适量" }
  };
}

async function main() {
  assertLocalDatabase();

  const [recipeCount, draftCount, collectionCount] = await Promise.all([
    prisma.recipe.count(),
    prisma.recipeDraft.count(),
    prisma.recipeCollection.count()
  ]);

  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      database: "127.0.0.1:5432/next_meal",
      current: { recipes: recipeCount, drafts: draftCount, collections: collectionCount },
      next: {
        delete: "recipes, recipe drafts, recipe collections and recipe-topic links",
        preserve: "historical RecipeContentVersion rows referenced by plans/events",
        create: ["完整案例：番茄牛腩焖饭", "不完整案例：家常蛋炒饭"]
      },
      instruction: "确认执行请追加 --apply"
    }, null, 2));
    return;
  }

  const assetStorage = new AssetStorageService();
  const completeCoverImageUrl = await writeFixtureImage(assetStorage, "complete-cover.png", 4, 3, [211, 92, 64, 255]);
  const completeStepImageUrls = await Promise.all(
    Array.from({ length: 5 }, (_, index) => writeFixtureImage(assetStorage, `complete-step-${index + 1}.png`, 4, 4, [64, 124 + index * 12, 96, 255]))
  );

  const result = await prisma.$transaction(async tx => {
    const [systemUser, personalUser, personalCategory, inspirationCategory, nutritionSourceBatch] = await Promise.all([
      tx.user.findUnique({ where: { id: systemUserId }, select: { id: true, uid: true, nickname: true } }),
      tx.user.findUnique({ where: { id: personalUserId }, select: { id: true, uid: true, nickname: true } }),
      tx.recipeCategory.findUnique({ where: { id: personalCategoryId }, select: { id: true, userId: true, name: true } }),
      tx.inspirationCategory.findUnique({ where: { id: inspirationCategoryId }, select: { id: true, name: true } }),
      tx.nutrientSourceBatch.findFirst({ orderBy: [{ importedAt: "desc" }, { id: "desc" }], select: { sourceVersion: true } })
    ]);

    if (!systemUser || systemUser.uid !== 10001) throw new Error("系统用户校验失败");
    if (!personalUser) throw new Error("个人案例用户不存在");
    if (!personalCategory || personalCategory.userId !== personalUserId) throw new Error("个人分类校验失败");
    if (!inspirationCategory) throw new Error("灵感分类校验失败");
    const nutritionSourceVersion = nutritionSourceBatch?.sourceVersion ?? fixtureSourceVersion;

    const ingredientIds = [4001, 4002, 4004, 4007, 4014, 4016, 4049, 4059, 4070];
    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds }, ownerId: null },
      select: {
        id: true,
        name: true,
        categoryId: true,
        defaultUnitId: true,
        defaultUnit: { select: { name: true, type: true } }
      }
    });
    const ingredientMap = new Map(ingredients.map(item => [item.id, item]));
    const getIngredient = (id: number) => {
      const item = ingredientMap.get(id);
      if (!item) throw new Error(`系统食材不存在: ${id}`);
      return item;
    };

    // Remove visible recipe objects and the restrictive links that otherwise block recipe deletion.
    await tx.recipeCollectionScene.deleteMany({});
    await tx.recipeCollection.deleteMany({});
    await tx.homeTopicItem.deleteMany({});
    await tx.recipeDraftScene.deleteMany({});
    await tx.recipeDraft.deleteMany({});
    await tx.storageLedger.deleteMany({ where: { module: "RECIPE" } });
    const recipeShoppingItems = await tx.shoppingItem.findMany({
      where: { OR: [{ sourceRecipeId: { not: null } }, { sourceRecipeVersionId: { not: null } }] },
      select: { id: true }
    });
    const recipeShoppingItemIds = recipeShoppingItems.map(item => item.id);
    if (recipeShoppingItemIds.length > 0) {
      await tx.shoppingItemFridgeReservation.deleteMany({ where: { shoppingItemId: { in: recipeShoppingItemIds } } });
      await tx.shoppingItem.deleteMany({ where: { id: { in: recipeShoppingItemIds } } });
    }
    await tx.recipe.deleteMany({});

    const completeIngredients = [
      exactIngredient(getIngredient(4004), "500"),
      exactIngredient(getIngredient(4001), "300"),
      exactIngredient(getIngredient(4007), "200"),
      exactIngredient(getIngredient(4014), "100"),
      exactIngredient(getIngredient(4016), "20"),
      exactIngredient(getIngredient(4049), "250"),
      exactIngredient(getIngredient(4059), "3"),
      exactIngredient(getIngredient(4070), "20")
    ];
    const completeContent: RecipeContentSnapshot = {
      name: "完整案例：番茄牛腩焖饭",
      story: "用于验证系统菜谱的完整结构化数据、标签、营养和做饭助手快照。",
      baseServings: 4,
      difficulty: "SKILLED",
      duration: "BETWEEN_30_60",
      estimatedCalories: 620,
      tips: "牛腩先煸出香味，再与米饭一起焖煮；出锅后静置 5 分钟再翻拌。",
      ingredients: completeIngredients,
      steps: [
        { text: "牛腩切块，番茄、洋葱切丁，生姜切片。", imageUrl: completeStepImageUrls[0] },
        { text: "牛腩冷水下锅焯水，撇去浮沫后捞出。", imageUrl: completeStepImageUrls[1] },
        { text: "锅中放油，炒香姜片和洋葱，加入番茄炒出汁。", imageUrl: completeStepImageUrls[2] },
        { text: "放入牛腩和大米，加水没过食材，大火煮开后转小火焖 35 分钟。", imageUrl: completeStepImageUrls[3] },
        { text: "加盐调味，关火静置 5 分钟，翻拌均匀后装盘。", imageUrl: completeStepImageUrls[4] }
      ]
    };
    const incompleteIngredients = [
      exactIngredient(getIngredient(4002), "2"),
      fuzzyIngredient(getIngredient(4059))
    ];
    const incompleteContent: RecipeContentSnapshot = {
      name: "不完整案例：家常蛋炒饭",
      story: null,
      baseServings: 2,
      difficulty: null,
      duration: null,
      estimatedCalories: null,
      tips: null,
      ingredients: incompleteIngredients,
      steps: [{ text: "鸡蛋打散后与米饭一起翻炒。", imageUrl: null }]
    };

    const createVersion = (ownerId: number, content: RecipeContentSnapshot, images: unknown) => tx.recipeContentVersion.create({
      data: {
        createdByUserId: ownerId,
        name: content.name,
        story: content.story,
        baseServings: content.baseServings,
        difficulty: content.difficulty,
        duration: content.duration,
        estimatedCalories: content.estimatedCalories,
        tips: content.tips,
        ingredientsJson: toJson(content.ingredients),
        stepsJson: toJson(content.steps),
        imagesJson: toJson(images),
        searchText: buildRecipeSearchText(content),
        contentSizeBytes: Math.max(1024, contentSizeBytes(content))
      }
    });

    const completeVersion = await createVersion(systemUserId, completeContent, {
      coverUploadId: null,
      coverImageUrl: completeCoverImageUrl,
      stepUploads: completeContent.steps.map((_, index) => ({ slotKey: `complete-step-${index + 1}`, uploadId: null }))
    });
    const incompleteVersion = await createVersion(personalUserId, incompleteContent, {
      coverUploadId: null,
      coverImageUrl: null,
      stepUploads: [{ slotKey: "incomplete-step-1", uploadId: null }]
    });

    const completeRecipe = await tx.recipe.create({
      data: {
        ownerId: null,
        isInspiration: true,
        inspirationCategoryId,
        currentVersionId: completeVersion.id,
        title: completeContent.name,
        searchText: buildRecipeSearchText(completeContent),
        coverImageUrl: completeCoverImageUrl,
        curatedByName: "炊火记内容组",
        status: "ACTIVE",
        sortOrder: 1
      }
    });
    const incompleteRecipe = await tx.recipe.create({
      data: {
        ownerId: personalUserId,
        categoryId: personalCategoryId,
        currentVersionId: incompleteVersion.id,
        title: incompleteContent.name,
        searchText: buildRecipeSearchText(incompleteContent),
        status: "ACTIVE",
        sortOrder: 2
      }
    });

    await tx.recipeVersionTag.createMany({
      data: [
        ["MEAL_TYPE", "DINNER"],
        ["DISH_ROLE", "MAIN"],
        ["DISH_ROLE", "STAPLE"],
        ["MAIN_PROTEIN_TYPE", "BEEF"],
        ["PRIMARY_INGREDIENT", "4004"],
        ["PRIMARY_INGREDIENT", "4049"],
        ["FLAVOR_PROFILE", "LIGHT"],
        ["SPICE_LEVEL", "NONE"]
      ].map(([tagCode, tagValue], index) => ({
        recipeVersionId: completeVersion.id,
        tagCode: tagCode as never,
        tagValue,
        source: RecipeVersionTagSource.OPS,
        status: RecipeVersionTagStatus.CONFIRMED,
        confidence: 1,
        sortOrder: index,
        isLocked: true
      }))
    });
    await tx.recipeVersionTag.createMany({
      data: [
        { recipeVersionId: incompleteVersion.id, tagCode: "MEAL_TYPE", tagValue: "BREAKFAST", source: RecipeVersionTagSource.AUTO, status: RecipeVersionTagStatus.CANDIDATE, confidence: 0.78, sortOrder: 0 },
        { recipeVersionId: incompleteVersion.id, tagCode: "DISH_ROLE", tagValue: "STAPLE", source: RecipeVersionTagSource.AUTO, status: RecipeVersionTagStatus.CANDIDATE, confidence: 0.82, sortOrder: 0 }
      ]
    });

    await tx.recipeNutritionSnapshot.create({
      data: {
        recipeVersionId: completeVersion.id,
        status: RecipeNutritionStatus.COMPLETE,
        qualityLabel: "完整结构化估算",
        perServingJson: toJson({ calories: 620, protein: 32, fat: 18, carbohydrate: 70 }),
        perRecipeJson: toJson({ calories: 2480, protein: 128, fat: 72, carbohydrate: 280 }),
        coverageRate: 1,
        sourceVersion: nutritionSourceVersion
      }
    });
    await tx.recipeCookAssistant.create({
      data: {
        recipeVersionId: completeVersion.id,
        status: RecipeAssistantStatus.READY,
        snapshotJson: toJson(buildRecipeAssistantSnapshot(completeContent)),
        generatedAt: new Date(),
        lastAttemptAt: new Date(),
        attemptCount: 1
      }
    });

    return {
      deleted: { recipes: recipeCount, drafts: draftCount, collections: collectionCount, shoppingItems: recipeShoppingItemIds.length },
      created: {
        complete: { recipeId: completeRecipe.id, versionId: completeVersion.id, ownerId: completeRecipe.ownerId, title: completeRecipe.title },
        incomplete: { recipeId: incompleteRecipe.id, versionId: incompleteVersion.id, ownerId: incompleteRecipe.ownerId, title: incompleteRecipe.title }
      }
    };
  });

  const verify = await prisma.recipe.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      ownerId: true,
      categoryId: true,
      inspirationCategoryId: true,
      title: true,
      status: true,
      currentVersion: {
        select: {
          id: true,
          story: true,
          baseServings: true,
          difficulty: true,
          duration: true,
          estimatedCalories: true,
          tips: true,
          ingredientsJson: true,
          stepsJson: true,
          imagesJson: true,
          versionTags: { select: { tagCode: true, tagValue: true, source: true, status: true } },
          nutritionSnapshots: { select: { status: true, coverageRate: true, sourceVersion: true } },
          cookAssistant: { select: { status: true, snapshotJson: true } }
        }
      }
    }
  });
  console.log(JSON.stringify({ ...result, remainingRecipeCount: verify.length, recipes: verify }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
