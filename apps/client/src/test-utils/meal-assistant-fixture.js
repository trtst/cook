const http = require("http");
const https = require("https");
const { URL } = require("url");
const { loginWithPassword } = require("./auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "change-me";

let idempotencySeed = Date.now();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
  const suffix = `${Date.now()}${nextIdempotencyKey()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPlanDate(daysFromNow) {
  const extraDays = Number(nextIdempotencyKey().slice(-2)) % 10;
  return formatDateOnly(new Date(Date.now() + (daysFromNow + extraDays) * 24 * 60 * 60 * 1000));
}

function buildFutureIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function buildHeaders(options = {}, admin = false) {
  return {
    "content-type": "application/json",
    ...(admin
      ? {
          "x-cook-from": "admin_web",
          "x-admin-version": "0.1.0",
          "x-admin-build": "1"
        }
      : {
          "x-cook-from": "mini_program",
          "x-cook-version": "0.1.0"
        }),
    ...(options.headers || {})
  };
}

async function request(path, options = {}, admin = false) {
  const target = new URL(`${API_BASE_URL}${path}`);
  const transport = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const requestTask = transport.request(
      target,
      {
        method: options.method || "GET",
        headers: buildHeaders(options, admin)
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

async function requestData(path, options = {}, admin = false) {
  const result = await request(path, options, admin);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

function adminHeaders(token, operationId) {
  return {
    authorization: `Bearer ${token}`,
    ...(operationId ? { "Idempotency-Key": operationId } : {})
  };
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
      name: `做饭助手页面分类${nextIdempotencyKey().slice(-6)}`
    })
  });
}

async function loginAdmin() {
  return requestData(
    "/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD
      })
    },
    true
  );
}

async function resolveAdminInspirationCategory(adminAuth) {
  const categories = await requestData("/admin/inspiration-categories", { headers: adminAuth }, true);
  if (categories.length) return categories[0];

  return requestData(
    "/admin/inspiration-categories",
    {
      method: "POST",
      headers: withIdempotencyKey(adminAuth),
      body: JSON.stringify({
        name: `做饭助手系统分类${nextIdempotencyKey().slice(-6)}`
      })
    },
    true
  );
}

async function loadSystemIngredient(authHeaders) {
  const result = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  const ingredient = result.items[0];
  assert(ingredient, "missing system ingredient fixture");
  return ingredient;
}

async function createPublishedRecipe(authHeaders, titlePrefix) {
  const ingredient = await loadSystemIngredient(authHeaders);
  const category = await resolveRecipeCategory(authHeaders);
  const suffix = nextIdempotencyKey().slice(-6);
  const draft = await requestData("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `${titlePrefix}${suffix}`,
        story: "用于做饭助手页面自动化。",
        categoryId: category.id,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: "先看做饭建议，再决定是否切回原步骤。",
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
            text: "先把食材准备好。",
            uploadId: null,
            imageUrl: null
          },
          {
            slotKey: "step-2",
            text: "开火翻炒后装盘。",
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });
  const draftDetail = await requestData(`/recipe-drafts/${draft.id}`, {
    headers: authHeaders
  });
  const published = await requestData(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      expectedVersion: draftDetail.version
    })
  });
  return published.recipe;
}

function buildReadyImportDocument(categoryId, ingredient) {
  return {
    schemaVersion: "recipe.import.v1",
    recipe: {
      inspirationCategoryId: categoryId,
      coverImageUrl: null,
      content: {
        name: `做饭助手系统菜谱${nextIdempotencyKey().slice(-6)}`,
        story: "用于做饭助手页面自动化。",
        baseServings: 2,
        difficulty: "EASY",
        duration: "BETWEEN_15_30",
        tips: "按做饭助手步骤完成即可。",
        keywords: [],
        ingredients: [{
          name: ingredient.name,
          quantity: "100",
          unit: "克",
          fuzzyText: null,
          categoryCode: "PRODUCE"
        }],
        tools: [{ name: "炒锅" }],
        steps: [
          {
            text: "准备食材并检查调味料。",
            imageUrl: null,
            imagePrompt: "案板上检查食材并完成备菜，真实中式家常场景，不出现文字"
          },
          {
            text: "下锅翻炒 6 分钟后装盘。",
            imageUrl: null,
            imagePrompt: "锅中翻炒食材并准备装盘，真实中式家常场景，不出现文字"
          }
        ]
      }
    },
    wiki: {
      tags: [
        { tagCode: "CUISINE", tagValue: "OTHER" },
        { tagCode: "DISH_STYLE", tagValue: "STIR_FRY" },
        { tagCode: "MEAL_TYPE", tagValue: "DINNER" },
        { tagCode: "DISH_ROLE", tagValue: "MAIN" },
        { tagCode: "MAIN_PROTEIN_TYPE", tagValue: "NONE" },
        { tagCode: "FLAVOR_PROFILE", tagValue: "LIGHT" },
        { tagCode: "SPICE_LEVEL", tagValue: "NONE" }
      ],
      assistant: {
        steps: [
          {
            order: 1,
            phase: "PREP",
            action: "OTHER",
            title: "备菜",
            detail: "准备食材并检查调味料。",
            imageUrl: null,
            imagePrompt: "做饭助理视角检查食材并完成备菜，真实中式家常场景，不出现文字",
            durationMinutes: 5,
            durationText: "约 5 分钟"
          },
          {
            order: 2,
            phase: "COOK",
            action: "STIR_FRY",
            title: "翻炒",
            detail: "下锅翻炒 6 分钟。",
            imageUrl: null,
            imagePrompt: "锅中翻炒食材并控制火候，真实中式家常场景，不出现文字",
            durationMinutes: 6,
            durationText: "约 6 分钟"
          },
          {
            order: 3,
            phase: "SERVE",
            action: "PLATE",
            title: "装盘",
            detail: "关火装盘上桌。",
            imageUrl: null,
            imagePrompt: "将炒好的菜肴盛入盘中准备上桌，真实中式家常场景，不出现文字",
            durationMinutes: 2,
            durationText: "约 2 分钟"
          }
        ]
      }
    }
  };
}

function multipartJson(filename, document) {
  const boundary = `----cook-assistant-${nextIdempotencyKey()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: application/json\r\n\r\n`
  );
  const body = Buffer.from(JSON.stringify(document));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, body, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

async function uploadJson(adminAuth, filename, document) {
  const multipart = multipartJson(filename, document);
  return requestData(
    "/admin/recipe-import-jobs/json",
    {
      method: "POST",
      headers: {
        ...withIdempotencyKey(adminAuth),
        "content-type": multipart.contentType
      },
      body: multipart.body
    },
    true
  );
}

async function loadImportItem(adminAuth, jobId) {
  const job = await requestData(`/admin/recipe-import-jobs/${jobId}?page=1&pageSize=20`, { headers: adminAuth }, true);
  const item = job.items.items[0];
  assert(item, `导入任务 ${jobId} 没有条目`);
  return requestData(`/admin/recipe-import-items/${item.id}`, { headers: adminAuth }, true);
}

async function createReadySystemRecipe(adminAuth, categoryId, ingredient) {
  const document = buildReadyImportDocument(categoryId, ingredient);
  const job = await uploadJson(adminAuth, `meal-assistant-${nextIdempotencyKey()}.json`, document);
  const item = await loadImportItem(adminAuth, job.id);
  assert(item.status === "READY", `导入系统菜谱未进入 READY: ${item.status}`);
  const published = await requestData(
    `/admin/recipe-import-items/${item.id}/publish`,
    {
      method: "POST",
      headers: withIdempotencyKey(adminAuth),
      body: JSON.stringify({ expectedVersion: item.version })
    },
    true
  );
  assert(published.status === "PUBLISHED" && published.recipeId, "导入系统菜谱发布失败");
  return requestData(`/inspiration-recipes/${published.recipeId}`);
}

async function createMealPlan(authHeaders, recipes, titlePrefix, daysFromNow) {
  const titleSuffix = nextIdempotencyKey().slice(-6);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await request("/meal-plans", {
      method: "POST",
      headers: withIdempotencyKey(authHeaders),
      body: JSON.stringify({
        planDate: buildPlanDate(daysFromNow + attempt),
        mealSlot: "DINNER",
        title: `${titlePrefix}-${titleSuffix}-${attempt}`,
        menuItems: recipes.map((recipe, index) => ({
          slotType: index % 2 === 0 ? "MEAT" : "VEGETABLE",
          sortOrder: index,
          recipeId: recipe.id,
          recipeVersionId: recipe.contentVersionId,
          purchaseState: "READY"
        }))
      })
    });
    if (result.status >= 200 && result.status < 300 && result.body.code === 0) {
      return result.body.data;
    }
    if (result.body.code !== 409) {
      throw new Error(`/meal-plans HTTP ${result.status}: ${result.body.message}`);
    }
  }

  throw new Error("failed to create meal assistant fixture plan after retries");
}

async function createDiningEvent(authHeaders, plan, hoursFromNow) {
  return requestData(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      scheduledAt: buildFutureIso(hoursFromNow),
      location: "做饭助手页面验收饭局"
    })
  });
}

async function createMealAssistantFixture() {
  const paidSession = await loginWithPassword(createFreshPhone());
  const freeSession = await loginWithPassword(createFreshPhone());
  const adminSession = await loginAdmin();
  const paidAuth = { authorization: `Bearer ${paidSession.token}` };
  const freeAuth = { authorization: `Bearer ${freeSession.token}` };
  const adminAuth = adminHeaders(adminSession.token);

  const paidProfile = await requestData("/users/me", {
    headers: paidAuth
  });
  assert(paidProfile.profile && paidProfile.membership, "owner fixture user profile should be readable");

  const freeProfile = await requestData("/users/me", {
    headers: freeAuth
  });
  assert(freeProfile.profile && freeProfile.membership, "participant fixture user profile should be readable");

  const systemIngredient = await loadSystemIngredient(paidAuth);
  const adminCategory = await resolveAdminInspirationCategory(adminAuth);
  const paidGeneratedRecipe = await createReadySystemRecipe(adminAuth, adminCategory.id, systemIngredient);
  const paidMissingRecipe = await createPublishedRecipe(paidAuth, "做饭助手待补洞菜谱");
  const freeRecipe = await createPublishedRecipe(freeAuth, "做饭助手免费菜谱");

  const plan = await createMealPlan(
    paidAuth,
    [paidGeneratedRecipe, paidMissingRecipe],
    "做饭助手页面本餐",
    14
  );
  const event = await createDiningEvent(paidAuth, plan, 6);

  return {
    paidSession,
    paidProfile,
    freeSession,
    freeProfile,
    paidGeneratedRecipe,
    paidMissingRecipe,
    freeRecipe,
    plan,
    event
  };
}

module.exports = {
  createMealAssistantFixture
};
