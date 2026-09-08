import { PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const prisma = new PrismaClient();
const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
let operationSeed = Date.now();

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface ImportJob {
  id: number;
  status: string;
}

interface ImportItem {
  id: number;
  status: string;
  recipeId: number | null;
  version: number;
}

interface ImportJobDetail extends ImportJob {
  items: {
    items: ImportItem[];
  };
}

interface ImportItemDetail extends ImportItem {
  recipeBody: {
    ingredients: Array<{ ingredientId: number | null; unitId: number | null }>;
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextOperationId() {
  operationSeed += 1;
  return String(operationSeed);
}

function adminHeaders(token: string, operationId?: string) {
  return {
    authorization: `Bearer ${token}`,
    "x-cook-from": "admin_web",
    "x-admin-version": "0.1.0",
    "x-admin-build": "1",
    ...(operationId ? { "Idempotency-Key": operationId } : {})
  };
}

async function request<T>(path: string, options: RequestInit = {}, headers: Record<string, string> = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "x-cook-from": "admin_web",
      "x-admin-version": "0.1.0",
      "x-admin-build": "1",
      ...headers,
      ...(options.headers ?? {})
    }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}, headers: Record<string, string> = {}) {
  const result = await request<T>(path, options, headers);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

function buildDocument(categoryId: number, ingredients: Array<{ name: string }>) {
  return {
    schemaVersion: "recipe.import.v1",
    recipe: {
      inspirationCategoryId: categoryId,
      coverImageUrl: null,
      content: {
        name: `导入链路验证菜谱-${operationSeed}`,
        story: "用于验证 JSON 导入、待审核和发布链路。",
        baseServings: 2,
        difficulty: "EASY",
        duration: "BETWEEN_15_30",
        tips: "按步骤完成即可。",
        ingredients: ingredients.map(item => ({ name: item.name, quantity: "100", unit: "克" })),
        tools: [{ name: "炒锅" }],
        steps: [{ text: "准备食材并完成烹饪。", imageUrl: null }]
      }
    },
    wiki: {
      tags: [
        { tagCode: "MEAL_TYPE", tagValue: "DINNER" },
        { tagCode: "DISH_ROLE", tagValue: "MAIN" },
        { tagCode: "MAIN_PROTEIN_TYPE", tagValue: "NONE" },
        { tagCode: "FLAVOR_PROFILE", tagValue: "LIGHT" },
        { tagCode: "SPICE_LEVEL", tagValue: "NONE" }
      ],
      assistant: {
        steps: [{
          order: 1,
          phase: "PREP",
          action: "OTHER",
          title: "准备食材",
          detail: "准备并检查食材。",
          imageUrl: null,
          durationMinutes: 5,
          durationText: "约 5 分钟"
        }]
      }
    }
  };
}

async function uploadJson(token: string, name: string, document: unknown) {
  const form = new FormData();
  form.append("file", new Blob([JSON.stringify(document)], { type: "application/json" }), name);
  return requestData<ImportJob>(
    "/admin/recipe-import-jobs/json",
    { method: "POST", body: form },
    adminHeaders(token, nextOperationId())
  );
}

async function getItem(token: string, jobId: number) {
  const job = await requestData<ImportJobDetail>(
    `/admin/recipe-import-jobs/${jobId}?page=1&pageSize=20`,
    {},
    adminHeaders(token)
  );
  const item = job.items.items[0];
  assert(item, `导入任务 ${jobId} 没有条目`);
  return requestData<ImportItemDetail>(`/admin/recipe-import-items/${item.id}`, {}, adminHeaders(token));
}

async function main() {
  const jobIds: number[] = [];
  let recipeId: number | null = null;
  let versionId: number | null = null;
  try {
    const category = await prisma.inspirationCategory.findFirst({ select: { id: true } });
    const ingredients = await prisma.ingredient.findMany({
      where: {
        ownerId: null,
        status: "ACTIVE",
        category: { is: { isSelectable: true } }
      },
      select: { name: true },
      take: 2,
      orderBy: { id: "asc" }
    });
    assert(category, "没有可用灵感分类");
    assert(ingredients.length === 2, "没有两条可匹配的系统食材");

    const login = await requestData<{ token: string }>(
      "/admin/auth/login",
      { method: "POST", body: JSON.stringify({ username: adminUsername, password: adminPassword }) },
      { "content-type": "application/json" }
    );
    const validJob = await uploadJson(login.token, "import-flow-valid.json", buildDocument(category.id, ingredients));
    jobIds.push(validJob.id);
    const validItem = await getItem(login.token, validJob.id);
    assert(validItem.status === "READY", `合法 JSON 未进入 READY: ${validItem.status}`);
    assert(validItem.recipeId === null, "发布前不应创建正式菜谱");
    assert(validItem.recipeBody.ingredients.every(item => item.ingredientId !== null && item.unitId !== null), "合法 JSON 未完成严格匹配");

    const invalidDocument = buildDocument(category.id, ingredients);
    invalidDocument.recipe.content.ingredients[0] = { name: `不存在的导入食材-${operationSeed}`, quantity: "100", unit: "克" };
    const invalidJob = await uploadJson(login.token, "import-flow-invalid.json", invalidDocument);
    jobIds.push(invalidJob.id);
    const invalidItem = await getItem(login.token, invalidJob.id);
    assert(invalidItem.status === "NEEDS_FIX", `未匹配食材未进入 NEEDS_FIX: ${invalidItem.status}`);
    assert(invalidItem.recipeId === null, "未匹配 JSON 不应创建正式菜谱");

    const published = await requestData<ImportItemDetail>(
      `/admin/recipe-import-items/${validItem.id}/publish`,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion: validItem.version })
      },
      {
        ...adminHeaders(login.token, nextOperationId()),
        "content-type": "application/json"
      }
    );
    assert(published.status === "PUBLISHED" && published.recipeId !== null, "合法 JSON 发布失败");
    recipeId = published.recipeId;

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { ownerId: true, isInspiration: true, inspirationCategoryId: true, status: true, currentVersionId: true }
    });
    assert(recipe, "发布后正式菜谱不存在");
    versionId = recipe.currentVersionId;
    assert(recipe.isInspiration && recipe.inspirationCategoryId !== null && recipe.status === "ACTIVE", "发布后的菜谱不是公开灵感菜谱");
    assert(recipe.ownerId !== null && await prisma.recipeInspirationOwner.findUnique({ where: { userId: recipe.ownerId } }), "发布后未从 100 人用户池分配归属");

    const version = await prisma.recipeContentVersion.findUnique({ where: { id: versionId }, select: { estimatedCalories: true, toolsJson: true } });
    assert(version?.estimatedCalories === null, "营养结果不应从 JSON 写入正文版本");
    assert(Array.isArray(version?.toolsJson) && version.toolsJson.length > 0, "工具未写入正文版本");
    const tags = await prisma.recipeVersionTag.findMany({ where: { recipeVersionId: versionId, source: "OPS", status: "CONFIRMED" } });
    assert(tags.length === 5, `导入 OPS 标签数量错误: ${tags.length}`);
    const assistant = await prisma.recipeCookAssistant.findUnique({ where: { recipeVersionId: versionId } });
    assert(assistant?.status === "READY", "助理快照未写入");

    console.log(JSON.stringify({ validJobId: validJob.id, invalidJobId: invalidJob.id, recipeId, versionId }));
  } finally {
    await prisma.$transaction(async tx => {
      if (jobIds.length) {
        await tx.recipeImportJob.deleteMany({ where: { id: { in: jobIds } } });
      }
      if (recipeId !== null) {
        await tx.recipe.delete({ where: { id: recipeId } });
      }
      if (versionId !== null) {
        await tx.recipeContentVersion.delete({ where: { id: versionId } });
      }
    });
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
