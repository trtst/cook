import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import type {
  CollectionListResponse,
  DeleteRecipeResponse,
  IngredientSummary,
  InspirationRecipeDetail,
  InspirationRecipeSummary,
  MyRecipeDetail,
  MyRecipeSummary,
  PageResult,
  RecipeCategorySummary,
  RecipeDraftDetail,
  RecipeReportSummary,
  RecipeSceneSummary,
  SaveCollectionRecipeResponse,
  SaveRecipeDraftResponse,
  StorageUsageSummary
} from "../src/contracts/types";

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

let idempotencySeed = Date.now();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
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

    const inspirationList = await requestData<PageResult<InspirationRecipeSummary>>("/inspiration-recipes?page=1&pageSize=20");
    assert(inspirationList.items.length >= 2, "inspiration recipes should be seeded");
    const inspirationRecipe = inspirationList.items[0];
    assert(typeof inspirationRecipe.id === "number", "inspiration recipe id should be numeric");

    const inspirationDetail = await requestData<InspirationRecipeDetail>(`/inspiration-recipes/${inspirationRecipe.id}`);
    assert(inspirationDetail.contentVersionId > 0, "inspiration detail should expose numeric contentVersionId");

    const systemIngredients = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
      headers: ownerAuth
    });
    assert(systemIngredients.items.length > 0, "system ingredients should be readable");
    const ingredient = systemIngredients.items[0];

    const suffix = nextIdempotencyKey();
    const category = await requestData<RecipeCategorySummary>("/recipe-categories", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({ name: `验收分类${suffix.slice(-6)}` })
    });
    const scene = await requestData<RecipeSceneSummary>("/recipe-scenes", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({ name: `验收合集${suffix.slice(-6)}` })
    });
    assert(typeof category.id === "number" && typeof scene.id === "number", "category and scene ids should be numeric");

    const forgedDraft = await request<SaveRecipeDraftResponse>("/recipe-drafts", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({
        recipeId: null,
        content: {
          name: "伪造图片草稿",
          story: null,
          categoryId: category.id,
          sceneIds: [scene.id],
          baseServings: 2,
          difficulty: "EASY",
          duration: "WITHIN_15",
          tips: null,
          ingredients: [
            {
              ingredientId: ingredient.id,
              amount: {
                kind: "FUZZY",
                text: "适量"
              }
            }
          ],
          steps: [{ text: "验证草稿禁止客户端图片字段" }],
          images: [{ key: "cover", url: "https://example.com/forged.jpg", sizeBytes: 1 }]
        }
      })
    });
    assert(forgedDraft.status === 400, `client-supplied draft images should return HTTP 400: ${forgedDraft.status}`);

    const rawDraftBody = JSON.stringify({
      recipeId: null,
      content: {
        name: `验收菜谱${suffix.slice(-6)}`,
        story: "用于数字 ID 与草稿发布验收",
        categoryId: 99999991,
        sceneIds: [99999992],
        baseServings: null,
        difficulty: null,
        duration: null,
        tips: null,
        ingredients: [
          {
            ingredientId: 99999993,
            name: ingredient.name,
            quantity: "",
            unitId: 99999994,
            fuzzyText: null,
            categoryId: ingredient.categoryId,
            defaultUnitId: ingredient.defaultUnit.id,
            source: ingredient.source
          }
        ],
        steps: [{ text: "热锅下油，完成验收步骤" }]
      }
    });
    const createOperationId = nextIdempotencyKey();
    const [draft1, draft2] = await Promise.all([
      requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
        method: "POST",
        headers: withIdempotencyKey(ownerAuth, createOperationId),
        body: rawDraftBody
      }),
      requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
        method: "POST",
        headers: withIdempotencyKey(ownerAuth, createOperationId),
        body: rawDraftBody
      })
    ]);
    assert(draft1.id === draft2.id, "concurrent draft save replay should return the first draft");
    assert(typeof draft1.id === "number", "draft id should be numeric");
    assert(draft1.recipeId === null, "new draft should not have recipeId before publish");

    const draftDetail = await requestData<RecipeDraftDetail>(`/recipe-drafts/${draft1.id}`, {
      headers: ownerAuth
    });
    assert(draftDetail.id === draft1.id, "draft detail should match saved draft");
    assert(draftDetail.content.categoryId === 99999991, "draft content should preserve raw category id");
    assert(draftDetail.content.sceneIds[0] === 99999992, "draft content should preserve raw scene ids");
    assert(draftDetail.content.ingredients[0]?.ingredientId === 99999993, "draft content should preserve raw ingredient id");
    assert(draftDetail.content.ingredients[0]?.unitId === 99999994, "draft content should preserve raw unit id");
    assert(draftDetail.category === null, "unowned category should not be linked into draft relation");
    assert(draftDetail.scenes.length === 0, "unowned scenes should not be linked into draft relation");
    assert(draftDetail.ingredientRefs.length === 0, "invalid ingredient refs should not block draft save");
    assert(draftDetail.unitRefs.length === 0, "invalid unit refs should not block draft save");

    const blankDraft = await request<SaveRecipeDraftResponse>("/recipe-drafts", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({
        recipeId: null,
        content: {
          ...draftDetail.content,
          name: "   "
        }
      })
    });
    assert(blankDraft.status === 400, `blank draft title should return HTTP 400: ${blankDraft.status}`);

    const updatedDraft = await requestData<SaveRecipeDraftResponse>(`/recipe-drafts/${draft1.id}`, {
      method: "PUT",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({
        expectedVersion: draft1.version,
        content: {
          ...draftDetail.content,
          name: `${draftDetail.content.name} 更新版`,
          categoryId: category.id,
          sceneIds: [scene.id],
          baseServings: 2,
          difficulty: "EASY",
          duration: "WITHIN_15",
          tips: "更新后的提示",
          ingredients: [
            {
              ingredientId: ingredient.id,
              name: ingredient.name,
              quantity: "",
              unitId: null,
              fuzzyText: "适量",
              categoryId: ingredient.categoryId,
              defaultUnitId: ingredient.defaultUnit.id,
              source: ingredient.source
            }
          ]
        }
      })
    });
    assert(updatedDraft.version === draft1.version + 1, "draft update should increment version");

    const staleDraftUpdate = await request<SaveRecipeDraftResponse>(`/recipe-drafts/${draft1.id}`, {
      method: "PUT",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({
        expectedVersion: draft1.version,
        content: {
          ...draftDetail.content,
          name: `${draftDetail.content.name} 旧版本提交`
        }
      })
    });
    assert(staleDraftUpdate.status === 409, `stale draft version should return HTTP 409: ${staleDraftUpdate.status}`);

    const invalidRecipeId = await request<MyRecipeDetail>("/recipes/not-a-number", { headers: ownerAuth });
    assert(invalidRecipeId.status === 400, `invalid recipe id should return HTTP 400: ${invalidRecipeId.status}`);

    const publishOperationId = nextIdempotencyKey();
    const publishBody = JSON.stringify({ expectedVersion: updatedDraft.version });
    const [publish1, publish2] = await Promise.all([
      requestData<{ recipe: MyRecipeDetail }>(`/recipe-drafts/${draft1.id}/publish`, {
        method: "POST",
        headers: withIdempotencyKey(ownerAuth, publishOperationId),
        body: publishBody
      }),
      requestData<{ recipe: MyRecipeDetail }>(`/recipe-drafts/${draft1.id}/publish`, {
        method: "POST",
        headers: withIdempotencyKey(ownerAuth, publishOperationId),
        body: publishBody
      })
    ]);
    assert(publish1.recipe.id === publish2.recipe.id, "concurrent publish replay should return the first recipe");
    assert(typeof publish1.recipe.id === "number", "published recipe id should be numeric");
    assert(publish1.recipe.category.id === category.id, "published recipe should keep chosen category");

    const publishedRecipe = publish1.recipe;
    const draftAfterPublish = await request<RecipeDraftDetail>(`/recipe-drafts/${draft1.id}`, {
      headers: ownerAuth
    });
    assert(draftAfterPublish.status === 404, "published draft should be removed");

    const mineBeforeDelete = await requestData<PageResult<MyRecipeSummary>>("/recipes?page=1&pageSize=50", {
      headers: ownerAuth
    });
    assert(mineBeforeDelete.items.some(item => item.id === publishedRecipe.id), "published recipe should appear in my recipe list");

    const storageUsage = await requestData<StorageUsageSummary>("/storage-usage", { headers: ownerAuth });
    assert(storageUsage.usedBytes > 0, "storage ledger should record recipe usage");
    assert(storageUsage.byModule.some(item => item.module === "RECIPE"), "storage usage should include RECIPE module");

    const collectOperationId = nextIdempotencyKey();
    const collectBody = JSON.stringify({
      sourceRecipeId: inspirationDetail.id,
      sourceVersionId: inspirationDetail.contentVersionId,
      sceneIds: [scene.id]
    });
    const [collect1, collect2] = await Promise.all([
      requestData<SaveCollectionRecipeResponse>("/collections/recipes", {
        method: "POST",
        headers: withIdempotencyKey(ownerAuth, collectOperationId),
        body: collectBody
      }),
      requestData<SaveCollectionRecipeResponse>("/collections/recipes", {
        method: "POST",
        headers: withIdempotencyKey(ownerAuth, collectOperationId),
        body: collectBody
      })
    ]);
    assert(collect1.recipe.id === collect2.recipe.id, "concurrent collect replay should return the first collection recipe");
    assert(typeof collect1.recipe.id === "number", "collection recipe id should be numeric");

    const collections = await requestData<CollectionListResponse>("/collections", {
      headers: ownerAuth
    });
    const collectionScene = collections.items.find(item => item.id === scene.id);
    assert(collectionScene?.recipeCount, "collection scene should contain the collected recipe");

    const collectionList = await requestData<PageResult<{ id: number; sourceRecipeId: number }>>(
      `/collections/recipes?page=1&pageSize=20&sceneId=${scene.id}`,
      {
        headers: ownerAuth
      }
    );
    assert(collectionList.items.some(item => item.id === collect1.recipe.id), "collection recipe should appear in filtered list");

    const collectionDetail = await requestData<{ id: number; sourceRecipeId: number; contentVersionId: number }>(
      `/collections/recipes/${collect1.recipe.id}`,
      {
        headers: ownerAuth
      }
    );
    assert(collectionDetail.sourceRecipeId === inspirationDetail.id, "collection detail should point to the inspiration recipe");

    const reportResult = await requestData<RecipeReportSummary>(`/recipes/${inspirationDetail.id}/report`, {
      method: "POST",
      headers: withIdempotencyKey(memberAuth),
      body: JSON.stringify({ reason: "菜谱流验收举报" })
    });
    assert(reportResult.recipeId === inspirationDetail.id, "report should target the inspiration recipe");

    const deleteResult = await requestData<DeleteRecipeResponse>(`/recipes/${publishedRecipe.id}/delete`, {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({ expectedVersion: publishedRecipe.version })
    });
    assert(deleteResult.status === "RECYCLED", "PRO owner delete should enter recycle bin");

    const mineAfterDelete = await requestData<PageResult<MyRecipeSummary>>("/recipes?page=1&pageSize=50", {
      headers: ownerAuth
    });
    assert(!mineAfterDelete.items.some(item => item.id === publishedRecipe.id), "recycled recipe should leave active my list");

    const recipeRow = await prisma.recipe.findUnique({
      where: { id: publishedRecipe.id },
      select: { status: true, ownerId: true }
    });
    assert(recipeRow?.status === "RECYCLED", "database recipe status should be RECYCLED");
    assert(typeof recipeRow?.ownerId === "number", "database owner id should be numeric");

    console.log(
      JSON.stringify(
        {
          apiBaseUrl,
          inspirationRecipeId: inspirationDetail.id,
          draftId: draft1.id,
          publishedRecipeId: publishedRecipe.id,
          collectionRecipeId: collect1.recipe.id,
          reportedRecipeId: reportResult.recipeId,
          storageUsedBytes: storageUsage.usedBytes,
          staleDraftUpdateStatus: staleDraftUpdate.status,
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
