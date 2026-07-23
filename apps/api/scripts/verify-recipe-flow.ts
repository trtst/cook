import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import type { DeleteRecipeResponse, ImportRecipeResult, RecipeDetail, RecipeSummary, StorageUsageSummary } from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13700000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-cook-from": "mini_program",
      "x-cook-version": "0.1.0",
      ...options.headers
    }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}) {
  const result = await request<T>(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function login(phone: string) {
  return requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password })
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const owner = await login(ownerPhone);
    const member = await login(memberPhone);
    const ownerAuth = { authorization: `Bearer ${owner.token}` };
    const memberAuth = { authorization: `Bearer ${member.token}` };

    const systemList = await requestData<{ items: RecipeSummary[] }>("/recipes?scope=system&page=1&pageSize=20", {
      headers: ownerAuth
    });
    assert(systemList.items.length >= 2, "system recipes should be seeded");

    const forgedCreate = await request<RecipeDetail>("/recipes", {
      method: "POST",
      headers: ownerAuth,
      body: JSON.stringify({
        operationId: crypto.randomUUID(),
        content: {
          name: "伪造图片菜谱",
          ingredients: [],
          steps: [],
          servings: null,
          durationMinutes: null,
          images: [{ key: "cover", url: "https://example.com/forged.jpg", sizeBytes: 1 }]
        }
      })
    });
    assert(forgedCreate.status === 400, `client-supplied create images should return HTTP 400: ${forgedCreate.status}`);
    assert(forgedCreate.body.code === 400, "client-supplied create images should return code 400");

    const createOperationId = crypto.randomUUID();
    const createBody = JSON.stringify({
      operationId: createOperationId,
      content: {
        name: `并发幂等菜谱-${createOperationId.slice(0, 8)}`,
        ingredients: [{ name: "测试食材", amount: "1份" }],
        steps: [{ content: "验证并发幂等" }],
        servings: "1人份",
        durationMinutes: 1
      }
    });
    const [concurrentCreate1, concurrentCreate2] = await Promise.all([
      requestData<RecipeDetail>("/recipes", { method: "POST", headers: ownerAuth, body: createBody }),
      requestData<RecipeDetail>("/recipes", { method: "POST", headers: ownerAuth, body: createBody })
    ]);
    assert(concurrentCreate1.id === concurrentCreate2.id, "concurrent create replay should return the first recipe");

    const mineBefore = await requestData<{ items: RecipeSummary[] }>("/recipes?scope=mine&page=1&pageSize=50", {
      headers: ownerAuth
    });
    const seededMineCount = mineBefore.items.length;
    const systemRecipe = systemList.items[0];

    const import1 = await requestData<ImportRecipeResult>(`/recipes/${systemRecipe.id}/import`, {
      method: "POST",
      headers: ownerAuth,
      body: JSON.stringify({ operationId: crypto.randomUUID() })
    });
    const import2 = await requestData<ImportRecipeResult>(`/recipes/${systemRecipe.id}/import`, {
      method: "POST",
      headers: ownerAuth,
      body: JSON.stringify({ operationId: crypto.randomUUID() })
    });
    assert(import1.recipe.id === import2.recipe.id, "unmodified re-import should reuse existing entry");
    assert(import2.reusedExisting, "second import should report reusedExisting");

    assert(import1.recipe.content.images.length > 0, "seeded system recipe should contain a readable image");
    const originalImages = import1.recipe.content.images;
    const textUpdatedRecipe = await requestData<RecipeDetail>(`/recipes/${import1.recipe.id}`, {
      method: "PUT",
      headers: ownerAuth,
      body: JSON.stringify({
        operationId: crypto.randomUUID(),
        expectedVersion: import1.recipe.version,
        content: {
          name: `${import1.recipe.content.name} 私房版`,
          ingredients: import1.recipe.content.ingredients,
          steps: import1.recipe.content.steps,
          servings: import1.recipe.content.servings,
          durationMinutes: import1.recipe.content.durationMinutes
        }
      })
    });
    assert(
      JSON.stringify(textUpdatedRecipe.content.images) === JSON.stringify(originalImages),
      "text update should preserve server-owned images"
    );

    const staleUpdate = await request<RecipeDetail>(`/recipes/${import1.recipe.id}`, {
      method: "PUT",
      headers: ownerAuth,
      body: JSON.stringify({
        operationId: crypto.randomUUID(),
        expectedVersion: import1.recipe.version,
        content: {
          name: textUpdatedRecipe.content.name,
          ingredients: textUpdatedRecipe.content.ingredients,
          steps: textUpdatedRecipe.content.steps,
          servings: textUpdatedRecipe.content.servings,
          durationMinutes: textUpdatedRecipe.content.durationMinutes
        }
      })
    });
    assert(staleUpdate.status === 409, `stale recipe version should return HTTP 409: ${staleUpdate.status}`);

    const invalidRecipeId = await request<RecipeDetail>("/recipes/not-a-uuid", { headers: ownerAuth });
    assert(invalidRecipeId.status === 400, `invalid recipe UUID should return HTTP 400: ${invalidRecipeId.status}`);

    const forgedImageWrite = await request<RecipeDetail>(`/recipes/${import1.recipe.id}`, {
      method: "PUT",
      headers: ownerAuth,
      body: JSON.stringify({
        operationId: crypto.randomUUID(),
        expectedVersion: textUpdatedRecipe.version,
        content: {
          name: textUpdatedRecipe.content.name,
          ingredients: textUpdatedRecipe.content.ingredients,
          steps: textUpdatedRecipe.content.steps,
          servings: textUpdatedRecipe.content.servings,
          durationMinutes: textUpdatedRecipe.content.durationMinutes,
          images: [{ key: "mine-cover", url: "https://example.com/recipe/my-cover.jpg", sizeBytes: 102400 }]
        }
      })
    });
    assert(
      forgedImageWrite.status === 400,
      `client-supplied images should return HTTP 400: ${forgedImageWrite.status} ${JSON.stringify(forgedImageWrite.body)}`
    );
    assert(forgedImageWrite.body.code === 400, "client-supplied images should return code 400");

    const storageUsage = await requestData<StorageUsageSummary>("/storage-usage", { headers: ownerAuth });
    assert(storageUsage.usedBytes > 0, "storage ledger should record recipe usage");
    assert(storageUsage.byModule.some(item => item.module === "RECIPE"), "storage usage should include RECIPE module");

    const reportResult = await request(`/recipes/${textUpdatedRecipe.id}/report`, {
      method: "POST",
      headers: memberAuth,
      body: JSON.stringify({ operationId: crypto.randomUUID(), reason: "测试举报" })
    });
    assert(reportResult.status >= 200 && reportResult.status < 300, "member should be able to report visible recipe");

    const deleteResult = await requestData<DeleteRecipeResponse>(`/recipes/${textUpdatedRecipe.id}/delete`, {
      method: "POST",
      headers: ownerAuth,
      body: JSON.stringify({ operationId: crypto.randomUUID(), expectedVersion: textUpdatedRecipe.version })
    });
    assert(deleteResult.status === "RECYCLED", "PRO owner delete should enter recycle bin");

    const systemDetail = await requestData<RecipeDetail>(`/recipes/${systemRecipe.id}`, { headers: ownerAuth });
    assert(systemDetail.id === systemRecipe.id, "source system recipe should remain readable after deleting imported entry");

    const mineAfter = await requestData<{ items: RecipeSummary[] }>("/recipes?scope=mine&page=1&pageSize=50", {
      headers: ownerAuth
    });
    assert(mineAfter.items.length >= seededMineCount, "recycled recipe should still count in my list");

    const recipeRow = await prisma.recipe.findUnique({
      where: { id: import1.recipe.id },
      select: { independentVersionId: true, hiddenBaseImages: true }
    });
    assert(recipeRow?.independentVersionId === null, "text update should not create an independent image version");
    assert((recipeRow?.hiddenBaseImages.length ?? 0) === 0, "text update should not change hiddenBaseImages");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          importedRecipeId: import1.recipe.id,
          concurrentRecipeId: concurrentCreate1.id,
          storageUsedBytes: storageUsage.usedBytes,
          staleUpdateStatus: staleUpdate.status,
          invalidRecipeIdStatus: invalidRecipeId.status
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
