const http = require("http");
const https = require("https");
const { readFileSync } = require("fs");
const { resolve } = require("path");
const { URL } = require("url");
const nodeAssert = require("node:assert/strict");
const nodeTest = require("node:test");
const { loginWithPassword } = require("../../test-utils/auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const hasAutomatorRuntime = typeof globalThis.jest !== "undefined" && typeof globalThis.program !== "undefined";

if (!hasAutomatorRuntime) {
  globalThis.jest = { setTimeout() {} };
  globalThis.describe = () => {};
  globalThis.it = () => {};
  globalThis.beforeAll = () => {};
}

jest.setTimeout(30000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function request(path, options = {}) {
  const target = new URL(`${API_BASE_URL}${path}`);
  const transport = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const requestTask = transport.request(
      target,
      {
        method: options.method || "GET",
        headers: {
          "content-type": "application/json",
          "x-cook-from": "mini_program",
          "x-cook-version": "0.1.0",
          ...(options.headers || {})
        }
      },
      (response) => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          rawBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode || 0,
              body: JSON.parse(rawBody || "null")
            });
          } catch (error) {
            reject(new Error(`invalid json response from ${path}: ${rawBody}`));
          }
        });
      }
    );

    requestTask.on("error", reject);

    if (options.body) {
      requestTask.write(options.body);
    }

    requestTask.end();
  });
}

async function requestData(path, options = {}) {
  const result = await request(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

let idempotencySeed = Date.now();

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function withIdempotencyKey(headers, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

function createFreshPhone() {
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

async function loginWithCode(phone) {
  return loginWithPassword(phone);
}

async function resolveRecipeCategory(authHeaders) {
  const categories = await requestData("/recipe-categories", {
    headers: authHeaders
  });
  if (categories.length) return categories[0];

  return requestData("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: `编辑页验收分类${nextIdempotencyKey().slice(-6)}`
    })
  });
}

async function createDraftFixture(authHeaders) {
  const ingredients = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  assert(ingredients.items && ingredients.items.length > 0, "missing system ingredient fixture");
  const ingredient = ingredients.items[0];
  const category = await resolveRecipeCategory(authHeaders);
  const suffix = nextIdempotencyKey().slice(-6);
  const title = `编辑页验收菜谱${suffix}`;
  const story = "用于验证结构化录入页会真实回填草稿内容。";
  const stepText = "把番茄切块备用，准备进入下一步。";

  const draft = await requestData("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: title,
        story,
        categoryId: category.id,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: "编辑页自动化验收。",
        ingredients: [
          {
            ingredientId: ingredient.id,
            name: ingredient.name,
            quantity: "2",
            unitId: ingredient.defaultUnit.id,
            fuzzyText: null,
            categoryId: ingredient.categoryId,
            defaultUnitId: ingredient.defaultUnit.id,
            source: ingredient.source
          }
        ],
        steps: [
          {
            slotKey: "step-1",
            text: stepText,
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });

  return {
    draftId: draft.id,
    title,
    story,
    categoryName: category.name,
    ingredientName: ingredient.name,
    stepText
  };
}

async function waitForEditState(page, matcher, timeoutMs = 8000) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await page.callMethod("automatorReadState");
    if (matcher(lastState)) {
      return lastState;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`edit state not ready: ${JSON.stringify(lastState)}`);
}

describe("pages_recipe/edit/index", () => {
  let page;
  let session;
  let fixture;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());
    const authHeaders = {
      authorization: `Bearer ${session.token}`
    };
    fixture = await createDraftFixture(authHeaders);

    await clearSession();
    page = await program.reLaunch(`/pages_recipe/edit/index?draftId=${fixture.draftId}`);
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.waitFor(".advanced-row", 8000);
  });

  it("结构化录入页可以展示真实草稿主状态", async () => {
    expect(await page.path).toBe("pages_recipe/edit/index");

    const state = await waitForEditState(page, (value) => value && value.title === fixture.title && value.ingredientCount === 1);

    expect(state.isLoggedIn).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.errorText).toBe("");
    expect(state.title).toBe(fixture.title);
    expect(state.story).toBe(fixture.story);
    expect(state.categoryName).toBe(fixture.categoryName);
    expect(state.ingredientCount).toBe(1);
    expect(state.firstIngredientName).toBe(fixture.ingredientName);
    expect(state.stepCount).toBe(1);
    expect(state.firstStepText).toBe(fixture.stepText);
    expect(state.advancedSummary).toContain(fixture.categoryName);
    expect(state.advancedSummary).toContain("2 人");
    expect(state.advancedSummary).toContain("轻松上手");
    expect(state.advancedSummary).toContain("15分钟内");
  });

  it("已选择食材的名称使用重新选择控件而不是文本输入框", async () => {
    expect(await page.$("input.ingredient-line__field--name")).toBeNull();
    expect(await page.$(".ingredient-line__field--name")).not.toBeNull();
  });
});

if (!hasAutomatorRuntime) {
  const editSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

  nodeTest("ingredient search confirmation reloads the current keyword", () => {
    nodeAssert.match(
      editSource,
      /@confirm="handleIngredientSearchConfirm"/,
      "ingredient search should bind confirmation to an explicit search handler"
    );
    nodeAssert.match(
      editSource,
      /function handleIngredientSearchConfirm\(\)\s*\{[\s\S]*?clearTimeout\(ingredientSearchTimer\)[\s\S]*?void reloadIngredientOptions\(\)/,
      "confirming ingredient search should cancel the pending debounce and reload results"
    );
    nodeAssert.match(
      editSource,
      /keyword:\s*ingredientSearchText\.value \|\| undefined/,
      "ingredient search should send the current keyword to the API"
    );
    nodeAssert.match(
      editSource,
      /const searchedIngredients = computed\(\(\) => \{[\s\S]*?if \(ingredientSearchMode\.value\) \{\s*return ingredientOptions\.value;\s*\}[\s\S]*?return ingredientOptions\.value\.filter\(matchesCurrentIngredientFilter\);/,
      "ingredient search should render the server-filtered result so aliases remain selectable"
    );
  });

  nodeTest("publishing a recipe does not trigger cook assistant generation", () => {
    nodeAssert.match(editSource, /recipeApi\.publishDraft/);
    nodeAssert.match(editSource, /redirectTo\(`\/pages_recipe\/detail\/index\?recipeId=/);
    nodeAssert.doesNotMatch(editSource, /maybeGenerateRecipeAssistantAfterPublish/);
    nodeAssert.doesNotMatch(editSource, /generateMyRecipeAssistant/);
    nodeAssert.doesNotMatch(editSource, /生成做饭建议/);
  });

  nodeTest("recipe edit confirms before invalidating an existing Wiki", () => {
    nodeAssert.match(editSource, /recipeHasReadyWiki/);
    nodeAssert.match(editSource, /Wiki 将失效/);
    nodeAssert.match(editSource, /if \(!confirmed\) return/);
  });

  nodeTest("recipe edit restores Wiki validity when continuing an existing recipe draft", () => {
    nodeAssert.match(editSource, /draft\.recipeId\s*\?\s*await\s+recipeApi\.getMyRecipe\(draft\.recipeId\)/);
    nodeAssert.match(editSource, /recipeHasReadyWiki\.value\s*=\s*recipe\?\.assistantAvailable\s*\?\?\s*false/);
  });

}
