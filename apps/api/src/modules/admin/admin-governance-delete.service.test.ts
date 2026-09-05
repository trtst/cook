import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminSiteContentService } from "./admin-site-content.service";

function idempotencyMock() {
  return {
    findFirst: async () => null,
    create: async () => ({}),
    updateMany: async () => ({ count: 1 })
  };
}

function createAdminService(tx: Record<string, unknown>) {
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  return new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
}

test("admin cannot delete published site content before unpublishing it", async () => {
  const content = {
    id: 18,
    type: "ARTICLE",
    status: "PUBLISHED",
    version: 4,
    title: "官方消息",
    slug: "notice",
    path: "/guides/notice"
  };
  let deleted = false;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    siteContent: {
      findUnique: async () => content,
      delete: async () => {
        deleted = true;
      }
    }
  };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const service = new AdminSiteContentService(prisma as never);

  await assert.rejects(
    () =>
      (service as unknown as {
        deleteContent(contentId: number, operationId: string, expectedVersion: number, adminId: number): Promise<unknown>;
      }).deleteContent(content.id, "202609060101", content.version, 1),
    BadRequestException
  );
  assert.equal(deleted, false);
});

test("admin deletes unlisted site content with version check", async () => {
  const content = {
    id: 19,
    type: "ARTICLE",
    status: "UNLISTED",
    version: 5,
    title: "下架文章",
    slug: "old-guide",
    path: "/guides/old-guide"
  };
  let deletedId: number | null = null;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    siteContent: {
      findUnique: async () => content,
      delete: async ({ where }: { where: { id: number } }) => {
        deletedId = where.id;
        return content;
      }
    },
    auditEvent: {
      create: async () => undefined
    }
  };
  const prisma = {
    adminAccount: {
      findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] })
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx)
  };
  const service = new AdminSiteContentService(prisma as never);

  const result = await (service as unknown as {
    deleteContent(contentId: number, operationId: string, expectedVersion: number, adminId: number): Promise<{ contentId: number; deletedAt: string }>;
  }).deleteContent(content.id, "202609060102", content.version, 1);

  assert.equal(deletedId, content.id);
  assert.equal(result.contentId, content.id);
  assert.match(result.deletedAt, /^20\d{2}-/);
});

test("admin cannot delete a referenced system ingredient", async () => {
  const ingredient = {
    id: 31,
    ownerId: null,
    status: "DISABLED",
    version: 2,
    name: "土豆",
    categoryId: 7,
    defaultUnitId: 3,
    category: { id: 7, name: "蔬果菌菇", code: "VEGETABLES" },
    defaultUnit: { id: 3, name: "克", type: "WEIGHT", ownerId: null }
  };
  let deleted = false;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    ingredient: {
      findFirst: async () => ingredient,
      count: async () => 0,
      delete: async () => {
        deleted = true;
      }
    },
    ingredientRecommendation: { count: async () => 0 },
    ingredientFeedback: { count: async () => 0 },
    fridgeItem: { count: async () => 1 },
    shoppingItem: { count: async () => 0 },
    ingredientNutrientMapping: { count: async () => 0 },
    ingredientUnitNutrientConversion: { count: async () => 0 }
  };
  const service = createAdminService(tx);

  await assert.rejects(
    () =>
      (service as unknown as {
        deleteSystemIngredient(ingredientId: number, operationId: string, expectedVersion: number, adminId: number): Promise<unknown>;
      }).deleteSystemIngredient(ingredient.id, "202609060103", ingredient.version, 1),
    ConflictException
  );
  assert.equal(deleted, false);
});

test("admin deletes a pending unit recommendation", async () => {
  const recommendation = {
    id: 41,
    status: "PENDING",
    version: 3,
    unitName: "撮",
    unitType: "COMMON",
    user: { id: 9, uid: 10000009, nickname: "用户" },
    targetUnit: null
  };
  let deletedId: number | null = null;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    unitRecommendation: {
      findFirst: async () => recommendation,
      delete: async ({ where }: { where: { id: number } }) => {
        deletedId = where.id;
      }
    },
    auditEvent: { create: async () => undefined }
  };
  const service = createAdminService(tx);

  const result = await (service as unknown as {
    deletePendingUnitRecommendation(recommendationId: number, operationId: string, expectedVersion: number, adminId: number): Promise<{ id: number }>;
  }).deletePendingUnitRecommendation(recommendation.id, "202609060104", recommendation.version, 1);

  assert.equal(deletedId, recommendation.id);
  assert.equal(result.id, recommendation.id);
});

test("admin deletes a pending personal ingredient recommendation without deleting the ingredient", async () => {
  const recommendation = {
    id: 52,
    ingredientId: 51,
    status: "PENDING",
    ingredient: {
      id: 51,
      ownerId: 9,
      status: "ACTIVE",
      version: 6,
      name: "青柠",
      defaultUnit: { id: 3, name: "个", type: "COMMON", ownerId: null },
      owner: { id: 9, uid: 10000009, nickname: "用户" }
    }
  };
  let deletedRecommendationId: number | null = null;
  let deletedIngredient = false;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    ingredientRecommendation: {
      findFirst: async () => recommendation,
      delete: async ({ where }: { where: { id: number } }) => {
        deletedRecommendationId = where.id;
      }
    },
    ingredient: {
      delete: async () => {
        deletedIngredient = true;
      }
    },
    auditEvent: { create: async () => undefined }
  };
  const service = createAdminService(tx);

  const result = await (service as unknown as {
    deletePendingIngredient(ingredientId: number, operationId: string, expectedVersion: number, adminId: number): Promise<{ id: number }>;
  }).deletePendingIngredient(recommendation.ingredientId, "202609060105", recommendation.ingredient.version, 1);

  assert.equal(deletedRecommendationId, recommendation.id);
  assert.equal(deletedIngredient, false);
  assert.equal(result.id, recommendation.ingredientId);
});

test("admin deletes a pending ingredient feedback", async () => {
  const feedback = {
    id: 61,
    ingredientId: 31,
    status: "PENDING",
    ingredientVersion: 8,
    ingredient: {
      id: 31,
      ownerId: null,
      status: "ACTIVE",
      version: 8,
      name: "土豆",
      category: { id: 7, name: "蔬果菌菇", code: "VEGETABLES" },
      owner: null
    }
  };
  let deletedId: number | null = null;
  const tx = {
    $queryRaw: async () => [{ ok: "1" }],
    idempotencyRecord: idempotencyMock(),
    ingredientFeedback: {
      findFirst: async () => feedback,
      delete: async ({ where }: { where: { id: number } }) => {
        deletedId = where.id;
      }
    },
    auditEvent: { create: async () => undefined }
  };
  const service = createAdminService(tx);

  const result = await (service as unknown as {
    deleteIngredientFeedback(feedbackId: number, operationId: string, expectedVersion: number, adminId: number): Promise<{ id: number }>;
  }).deleteIngredientFeedback(feedback.id, "202609060106", feedback.ingredient.version, 1);

  assert.equal(deletedId, feedback.id);
  assert.equal(result.id, feedback.id);
});
