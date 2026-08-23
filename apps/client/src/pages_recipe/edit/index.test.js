const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const TEST_CODE = "123456";

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
  return requestData("/auth/code-login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      code: TEST_CODE
    })
  });
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
});
