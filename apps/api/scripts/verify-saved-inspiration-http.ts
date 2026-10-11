import { randomInt, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/common/security/password";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const prisma = new PrismaClient();
const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const apiHost = new URL(apiBaseUrl).hostname;
const databaseUrl = process.env.DATABASE_URL;
const prefix = `save-http-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const userPassword = process.env.TEST_USER_PASSWORD ?? "change-me";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";

type Envelope<T = any> = { code: number; message: string; data: T };
type HttpResult<T = any> = { status: number; body: Envelope<T> };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertLocalTarget() {
  assert(apiHost === "127.0.0.1" || apiHost === "localhost", "Refusing non-local API_BASE_URL");
  assert(databaseUrl, "DATABASE_URL is required for fixture cleanup");
  const dbHost = new URL(databaseUrl).hostname;
  assert(dbHost === "127.0.0.1" || dbHost === "localhost", "Refusing non-local DATABASE_URL");
}

async function request<T = any>(path: string, options: RequestInit = {}, admin = false): Promise<HttpResult<T>> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(admin
        ? { "x-cook-from": "admin_web", "x-admin-version": "0.1.0", "x-admin-build": "1" }
        : { "x-cook-from": "mini_program", "x-cook-version": "0.1.0" }),
      ...options.headers
    }
  });
  return { status: response.status, body: (await response.json()) as Envelope<T> };
}

function operationKey() {
  return `${Date.now()}${randomInt(100_000_000, 1_000_000_000)}`;
}

function assertOk<T>(result: HttpResult<T>, label: string): T {
  assert(result.status >= 200 && result.status < 300, `${label}: HTTP ${result.status} ${result.body.message}`);
  assert(result.body.code === 0, `${label}: code ${result.body.code} ${result.body.message}`);
  return result.body.data;
}

async function createDisposableUser() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const phone = `139${randomInt(10_000_000, 100_000_000)}`;
    const uid = randomInt(10_000_000, 100_000_000);
    try {
      return await prisma.user.create({ data: { phone, uid, passwordHash: hashPassword(userPassword) } });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
    }
  }
  throw new Error("Unable to allocate a disposable HTTP-test user");
}

async function createDisposableRecipe() {
  const owner = await prisma.recipe.findFirst({
    where: { isInspiration: true, status: "ACTIVE", inspirationCategoryId: { not: null } },
    select: { ownerId: true, inspirationCategoryId: true }
  });
  assert(owner?.inspirationCategoryId, "No active local inspiration recipe is available as an owner/category fixture");

  const title = `HTTP验收灵感菜谱-${prefix}`;
  const content = (name: string) => ({
    createdByUserId: owner.ownerId,
    name,
    story: null,
    baseServings: 2,
    difficulty: "EASY" as const,
    duration: "WITHIN_15" as const,
    estimatedCalories: null,
    tips: null,
    keywordsJson: [],
    toolsJson: [],
    ingredientsJson: [],
    stepsJson: [{ text: "仅用于本地 HTTP 验收。", imageUrl: null }],
    imagesJson: [],
    searchText: name,
    contentSizeBytes: 128
  });

  const oldVersion = await prisma.recipeContentVersion.create({ data: content(`${title}-旧版本`) });
  const currentVersion = await prisma.recipeContentVersion.create({ data: content(`${title}-当前版本`) });
  const recipe = await prisma.recipe.create({
    data: {
      ownerId: owner.ownerId,
      ownerNicknameSnapshot: "本地 HTTP 验收",
      isInspiration: true,
      inspirationCategoryId: owner.inspirationCategoryId,
      inspirationPublishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      currentVersionId: currentVersion.id,
      title,
      searchText: title,
      status: "ACTIVE"
    }
  });

  return { recipe, oldVersion, currentVersion };
}

async function main() {
  assertLocalTarget();
  const operationIds = new Set<string>();
  let user: Awaited<ReturnType<typeof createDisposableUser>> | null = null;
  let fixture: Awaited<ReturnType<typeof createDisposableRecipe>> | null = null;
  let saveId: number | null = null;
  let memberToken: string | null = null;
  let adminToken: string | null = null;
  let isBlocked = false;
  let checks = 0;

  const adminLogin = await request<{ token: string; admin: { id: number; roles: string[] } }>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: adminUsername, password: adminPassword })
  }, true);
  const admin = assertOk(adminLogin, "SUPER_ADMIN login");
  assert(admin.admin.roles.includes("SUPER_ADMIN"), "Admin fixture is not SUPER_ADMIN");
  adminToken = admin.token;

  try {
    user = await createDisposableUser();
    const memberLogin = await request<{ accessToken: string }>("/auth/password/login", {
      method: "POST",
      body: JSON.stringify({ phone: user.phone, password: userPassword, deviceId: prefix })
    });
    memberToken = assertOk(memberLogin, "disposable user login").accessToken;
    fixture = await createDisposableRecipe();

    const saveKey = operationKey();
    operationIds.add(saveKey);
    const save = await request<{ saveId: number; sourceRecipeId: number; sourceVersionId: number; collectCount: number }>(
      "/recipes/saved-inspiration",
      {
        method: "POST",
        headers: { authorization: `Bearer ${memberToken}`, "Idempotency-Key": saveKey },
        body: JSON.stringify({ sourceRecipeId: fixture.recipe.id, sourceVersionId: fixture.currentVersion.id })
      }
    );
    const saved = assertOk(save, "save current inspiration version");
    assert(saved.sourceVersionId === fixture.currentVersion.id && saved.collectCount === 1, "save response did not preserve fixed version/count");
    saveId = saved.saveId;
    checks += 1;

    const staleKey = operationKey();
    operationIds.add(staleKey);
    const stale = await request("/recipes/saved-inspiration", {
      method: "POST",
      headers: { authorization: `Bearer ${memberToken}`, "Idempotency-Key": staleKey },
      body: JSON.stringify({ sourceRecipeId: fixture.recipe.id, sourceVersionId: fixture.oldVersion.id })
    });
    assert(stale.status === 409 || stale.body.code === 409, "stale fixed version did not return conflict");
    checks += 1;

    const savedList = assertOk(await request<{ items: Array<{ saveId: number; sourceRecipeId: number; title: string; owner: { nickname: string | null } }> }>(
      "/recipes/saved-inspiration?page=1&pageSize=20",
      { headers: { authorization: `Bearer ${memberToken}` } }
    ), "saved inspiration list");
    assert(
      savedList.items.some(item =>
        item.sourceRecipeId === fixture?.recipe.id &&
        item.title === `${fixture.recipe.title}-当前版本` &&
        item.owner.nickname === "本地 HTTP 验收"
      ),
      "saved inspiration is missing from private list or lost its source organizer"
    );
    checks += 1;

    const blockKey = operationKey();
    operationIds.add(blockKey);
    assertOk(await request(`/admin/recipes/${fixture.recipe.id}/block`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}`, "Idempotency-Key": blockKey },
      body: JSON.stringify({ reason: `本地验收 ${prefix}` })
    }, true), "block disposable inspiration");
    isBlocked = true;
    checks += 1;

    const detail = assertOk(await request<{ contentVersionId: number; isAvailable: boolean }>(
      `/recipes/saved-inspiration/${saveId}`,
      { headers: { authorization: `Bearer ${memberToken}` } }
    ), "read saved fixed version after block");
    assert(detail.contentVersionId === fixture.currentVersion.id && detail.isAvailable === false, "blocked saved detail lost its fixed version or availability state");
    checks += 1;

    const hidden = await request(`/inspiration-recipes/${fixture.recipe.id}`);
    assert(hidden.body.code !== 0, "blocked source recipe remained publicly readable");
    checks += 1;

    const blockedSaveKey = operationKey();
    operationIds.add(blockedSaveKey);
    const blockedSave = await request("/recipes/saved-inspiration", {
      method: "POST",
      headers: { authorization: `Bearer ${memberToken}`, "Idempotency-Key": blockedSaveKey },
      body: JSON.stringify({ sourceRecipeId: fixture.recipe.id, sourceVersionId: fixture.currentVersion.id })
    });
    assert(blockedSave.body.code !== 0, "new save was accepted after source recipe was blocked");
    checks += 1;

    const removeKey = operationKey();
    operationIds.add(removeKey);
    const removed = assertOk(await request<{ collectCount: number; isSavedToPrivate: boolean }>(
      `/recipes/saved-inspiration/${saveId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${memberToken}`, "Idempotency-Key": removeKey }
      }
    ), "remove saved version after block");
    assert(removed.collectCount === 0 && removed.isSavedToPrivate === false, "remove after block did not restore distinct collector count");
    saveId = null;
    checks += 1;

    const unblockKey = operationKey();
    operationIds.add(unblockKey);
    assertOk(await request(`/admin/recipes/${fixture.recipe.id}/unblock`, {
      method: "POST",
      headers: { authorization: `Bearer ${adminToken}`, "Idempotency-Key": unblockKey },
      body: JSON.stringify({})
    }, true), "restore disposable inspiration");
    isBlocked = false;
    checks += 1;

    const auditCount = await prisma.auditEvent.count({
      where: { objectType: "RECIPE", objectId: fixture.recipe.id, action: { in: ["RECIPE_BLOCKED", "RECIPE_UNBLOCKED"] } }
    });
    assert(auditCount === 2, `expected block/unblock audit pair, received ${auditCount}`);
    checks += 1;
  } finally {
    if (fixture && saveId && memberToken) {
      await request(`/recipes/saved-inspiration/${saveId}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${memberToken}`, "Idempotency-Key": operationKey() }
      }).catch(() => undefined);
    }
    if (fixture && isBlocked && adminToken) {
      const restoreKey = operationKey();
      operationIds.add(restoreKey);
      await request(`/admin/recipes/${fixture.recipe.id}/unblock`, {
        method: "POST",
        headers: { authorization: `Bearer ${adminToken}`, "Idempotency-Key": restoreKey },
        body: JSON.stringify({})
      }, true).catch(() => undefined);
    }

    if (fixture || user) {
      await prisma.$transaction(async tx => {
        if (user) {
          await tx.recipeCollection.deleteMany({ where: { userId: user.id } });
          await tx.storageLedger.deleteMany({ where: { userId: user.id } });
          await tx.idempotencyRecord.deleteMany({ where: { userId: user.id } });
        }
        if (fixture) {
          await tx.recipe.updateMany({ where: { id: fixture.recipe.id }, data: { collectCount: 0, status: "ACTIVE", blockedReason: null, blockedAt: null } });
          await tx.auditEvent.deleteMany({ where: { objectType: "RECIPE", objectId: fixture.recipe.id, action: { in: ["RECIPE_BLOCKED", "RECIPE_UNBLOCKED"] } } });
          await tx.recipe.deleteMany({ where: { id: fixture.recipe.id } });
          await tx.recipeContentVersion.deleteMany({ where: { id: { in: [fixture.oldVersion.id, fixture.currentVersion.id] } } });
        }
        await tx.idempotencyRecord.deleteMany({ where: { operationId: { in: [...operationIds] } } });
        if (user) await tx.user.deleteMany({ where: { id: user.id } });
      });
    }

    const remaining = {
      user: user ? await prisma.user.count({ where: { id: user.id } }) : 0,
      recipe: fixture ? await prisma.recipe.count({ where: { id: fixture.recipe.id } }) : 0,
      versions: fixture ? await prisma.recipeContentVersion.count({ where: { id: { in: [fixture.oldVersion.id, fixture.currentVersion.id] } } }) : 0,
      userSaves: user ? await prisma.recipeCollection.count({ where: { userId: user.id } }) : 0,
      audit: fixture ? await prisma.auditEvent.count({ where: { objectType: "RECIPE", objectId: fixture.recipe.id } }) : 0,
      idempotency: operationIds.size ? await prisma.idempotencyRecord.count({ where: { operationId: { in: [...operationIds] } } }) : 0
    };
    assert(Object.values(remaining).every(count => count === 0), `temporary fixture cleanup incomplete: ${JSON.stringify(remaining)}`);
  }

  console.log(JSON.stringify({ result: "PASS", checks, cleanup: "verified", apiHost, databaseHost: new URL(databaseUrl!).hostname }));
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
