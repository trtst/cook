import assert from "node:assert/strict";
import test from "node:test";
import { AdminService } from "./admin.service";

function createService() {
  const rows = [
    {
      id: 101,
      title: "用户菜谱",
      coverImageUrl: null,
      isInspiration: false,
      status: "ACTIVE",
      currentVersionId: 201,
      updatedAt: new Date("2026-09-21T10:00:00.000Z"),
      owner: { uid: 7001, nickname: "小明" },
      currentVersion: {
        cookAssistant: { status: "NEEDS_REVIEW" },
        recipeWikiRequests: [{ user: { uid: 8001, nickname: "申请人" }, requestedAt: new Date("2026-09-21T11:00:00.000Z") }]
      }
    },
    {
      id: 102,
      title: "已完成菜谱",
      coverImageUrl: null,
      isInspiration: true,
      status: "ACTIVE",
      currentVersionId: 202,
      updatedAt: new Date("2026-09-21T09:00:00.000Z"),
      owner: { uid: 9001, nickname: "公共池用户" },
      currentVersion: {
        cookAssistant: { status: "READY" },
        recipeWikiRequests: []
      }
    }
  ];
  const prisma = {
    adminAccount: { findUnique: async () => ({ status: "ACTIVE", roles: ["SUPER_ADMIN"] }) },
    recipe: {
      findMany: async () => rows.filter(row => row.id === 101),
      count: async () => 1
    },
    recipeCookAssistantRequest: {
      groupBy: async () => [{ recipeVersionId: 201, _count: { _all: 1 } }]
    },
    $transaction: async (input: unknown) => Array.isArray(input) ? Promise.all(input as Promise<unknown>[]) : input
  };
  return new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
}

test("Wiki backfill list only includes active current versions without READY Wiki", async () => {
  const service = createService();
  const result = await service.listRecipeWiki(1, 20, undefined, 1);

  assert.equal(result.total, 1);
  assert.deepEqual(result.items[0], {
    id: 101,
    title: "用户菜谱",
    coverImageUrl: null,
    contentVersionId: 201,
    ownerUid: 7001,
    ownerNickname: "小明",
    sourceType: "USER",
    wikiStatus: "NEEDS_REVIEW",
    hasPendingRequest: true,
    latestRequestAt: "2026-09-21T11:00:00.000Z",
    latestRequestUserUid: 8001,
    latestRequestUserNickname: "申请人",
    updatedAt: "2026-09-21T10:00:00.000Z"
  });
});
