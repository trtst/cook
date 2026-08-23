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

async function collectTexts(nodes) {
  const values = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) values.push(value);
  }

  return values;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolvePlanWindow(minHours, maxHours) {
  const now = new Date();
  const slotCandidates = [
    { mealSlot: "BREAKFAST", hour: 8, minute: 0 },
    { mealSlot: "LUNCH", hour: 12, minute: 0 },
    { mealSlot: "AFTERNOON_TEA", hour: 15, minute: 30 },
    { mealSlot: "DINNER", hour: 18, minute: 30 },
    { mealSlot: "LATE_NIGHT", hour: 22, minute: 0 }
  ];
  let selected = null;

  for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
    for (const candidate of slotCandidates) {
      const scheduledAt = new Date(now);
      scheduledAt.setDate(now.getDate() + dayOffset);
      scheduledAt.setHours(candidate.hour, candidate.minute, 0, 0);
      const diffHours = (scheduledAt.getTime() - now.getTime()) / (60 * 60 * 1000);
      if (diffHours < minHours || diffHours > maxHours) continue;
      if (!selected || diffHours < selected.diffHours) {
        selected = {
          planDate: formatDateOnly(scheduledAt),
          mealSlot: candidate.mealSlot,
          scheduledAt: scheduledAt.toISOString(),
          diffHours
        };
      }
    }
  }

  assert(selected, `failed to resolve meal slot within ${minHours}-${maxHours} hours`);
  return selected;
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

  const created = await requestData("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: `首页最近安排验收分类${nextIdempotencyKey().slice(-6)}`
    })
  });
  return created;
}

async function createRecipeFixture(authHeaders) {
  const ingredients = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  assert(ingredients.items && ingredients.items.length > 0, "missing system ingredient fixture");
  const ingredient = ingredients.items[0];
  const category = await resolveRecipeCategory(authHeaders);
  const suffix = nextIdempotencyKey().slice(-6);

  const draft = await requestData("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `首页最近安排验收菜谱${suffix}`,
        story: "用于验证首页最近安排卡真实登录主状态。",
        categoryId: category.id,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: "先把首页最近安排卡和动作入口展示出来。",
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
            text: "准备食材并观察首页最近安排入口。",
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

async function createMealPlanFixture(authHeaders, recipe, planWindow) {
  return requestData("/meal-plans", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      planDate: planWindow.planDate,
      mealSlot: planWindow.mealSlot,
      title: `首页最近安排验收餐次-${nextIdempotencyKey().slice(-6)}`,
      menuItems: [
        {
          slotType: "MEAT",
          sortOrder: 0,
          recipeId: recipe.id,
          recipeVersionId: recipe.contentVersionId,
          purchaseState: "READY"
        }
      ]
    })
  });
}

async function createDiningEventFixture(authHeaders, plan, scheduledAt) {
  return requestData(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      scheduledAt,
      location: "首页最近安排验收地点"
    })
  });
}

async function waitForRecentArrangement(page, expectedTitle, timeout = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const title = await page.$(".recent-arrangement__title");
    if (title && (await title.text()).trim() === expectedTitle) return;
    await sleep(200);
  }

  throw new Error(`未在 ${timeout}ms 内等到最近安排标题: ${expectedTitle}`);
}

function resolveRecentArrangementStatusText(status) {
  if (status === "EMPTY_MENU") return "还没定菜单";
  if (status === "PENDING_CONFIRM") return "待确认菜单";
  if (status === "PENDING_SHOPPING") return "待采购";
  if (status === "READY_TO_COOK") return "可以开始做饭";
  return "该分享回忆了";
}

function resolveRecentArrangementActionText(status) {
  if (status === "EMPTY_MENU") return "去加菜";
  if (status === "PENDING_CONFIRM") return "确认菜单";
  if (status === "PENDING_SHOPPING") return "去采购";
  if (status === "READY_TO_COOK") return "开始做饭";
  return "分享回忆";
}

function resolveRecentArrangementFocus(status) {
  if (status === "EMPTY_MENU") return "menu";
  if (status === "PENDING_CONFIRM") return "footer";
  if (status === "PENDING_SHOPPING") return "shopping";
  if (status === "READY_TO_COOK") return "assistant";
  return "memory";
}

function resolveHeroPrimaryActionText(nextMealState) {
  if (nextMealState.status === "NO_ARRANGEMENT") return "随机一桌";
  if (nextMealState.status === "NEED_GAP_CHECK") return nextMealState.arrangement?.menuCount ? "看看缺什么" : "去加菜";
  if (nextMealState.status === "NEED_SHOPPING") return "去采购";
  if (nextMealState.status === "READY_TO_COOK") return "开始做饭";
  return "分享回忆";
}

describe("pages/home/index", () => {
  it("首页可以完成真实登录并展示未安排状态下的主状态", async () => {
    const session = await loginWithCode(createFreshPhone());

    await clearSession();
    const page = await program.reLaunch("/pages/home/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.waitFor(".dock-action__title", 8000);

    expect(await page.path).toBe("pages/home/index");

    const restaurantName = await page.$(".restaurant-bar__name");
    expect(await restaurantName.text()).toBe("饭局、计划、清单");

    const heroEyebrow = await page.$(".hero-copy__eyebrow");
    expect(await heroEyebrow.text()).toBe("还没有安排");

    const heroTitle = await page.$(".hero-copy__title");
    expect(await heroTitle.text()).toBe("今晚吃什么？");

    const heroDescription = await page.$(".hero-copy__description");
    expect(await heroDescription.text()).toBe("还没有安排，试试随机一桌，或者先看看冰箱里现在能做什么。");

    const quickTitles = await collectTexts(await page.$$(".dock-action__title"));
    expect(quickTitles).toEqual(["翻菜谱", "看食材", "随机", "缺什么"]);
  });

  it("首页可以展示真实最近安排卡并更新主动作", async () => {
    const session = await loginWithCode(createFreshPhone());
    const authHeaders = {
      authorization: `Bearer ${session.token}`
    };
    const recipe = await createRecipeFixture(authHeaders);
    const planWindow = resolvePlanWindow(1, 24);
    const plan = await createMealPlanFixture(authHeaders, recipe, planWindow);
    const event = await createDiningEventFixture(authHeaders, plan, planWindow.scheduledAt);
    const arrangement = await requestData("/home/recent-arrangement", {
      headers: authHeaders
    });
    const nextMealState = await requestData("/home/next-meal", {
      headers: authHeaders
    });

    assert(arrangement, "recent arrangement should exist after creating dining event");
    assert(arrangement.eventId === event.id, "recent arrangement should point to the created dining event");
    assert(nextMealState.arrangement && nextMealState.arrangement.eventId === event.id, "next-meal should reuse the created dining event");

    await clearSession();
    const page = await program.reLaunch("/pages/home/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await waitForRecentArrangement(page, arrangement.title);

    expect(await page.path).toBe("pages/home/index");

    const heroEyebrow = await page.$(".hero-copy__eyebrow");
    expect((await heroEyebrow.text()).includes(`${arrangement.participantCount}人`)).toBe(true);

    const heroDescription = await page.$(".hero-copy__description");
    const heroDescriptionText = await heroDescription.text();
    expect(heroDescriptionText.includes(`${arrangement.participantCount}人`)).toBe(true);
    expect(heroDescriptionText.includes(`${arrangement.menuCount}道菜`)).toBe(true);
    if (typeof arrangement.gapCount === "number" && arrangement.gapCount > 0) {
      expect(heroDescriptionText.includes(`还差${arrangement.gapCount}样食材`)).toBe(true);
    }

    const heroPrimaryAction = await page.$(".hero-copy__button--primary .hero-copy__button-text");
    expect(await heroPrimaryAction.text()).toBe(resolveHeroPrimaryActionText(nextMealState));

    const cardTitle = await page.$(".recent-arrangement__title");
    expect(await cardTitle.text()).toBe(arrangement.title);

    const cardBadge = await page.$(".recent-arrangement__badge");
    expect(await cardBadge.text()).toBe("饭局");

    const cardMeta = await page.$(".recent-arrangement__meta");
    const cardMetaText = await cardMeta.text();
    expect(cardMetaText.includes(`${arrangement.participantCount}人`)).toBe(true);
    expect(cardMetaText.includes(`${arrangement.menuCount}道菜`)).toBe(true);
    if (typeof arrangement.gapCount === "number" && arrangement.gapCount > 0) {
      expect(cardMetaText.includes(`还差${arrangement.gapCount}样食材`)).toBe(true);
    }

    const cardStatus = await page.$(".recent-arrangement__status");
    expect(await cardStatus.text()).toBe(resolveRecentArrangementStatusText(arrangement.status));

    const actionTexts = await collectTexts(await page.$$(".recent-arrangement__button-text"));
    expect(actionTexts).toContain(resolveRecentArrangementActionText(arrangement.status));
    expect(actionTexts).toContain("查看详情");

    const automatorState = await page.callMethod("automatorReadRecentArrangementState");
    expect(automatorState.homeNextStatus).toBe(nextMealState.status);
    expect(automatorState.arrangementStatus).toBe(arrangement.status);
    expect(automatorState.cardPrimaryTarget).toContain(`focus=${resolveRecentArrangementFocus(arrangement.status)}`);
    expect(automatorState.cardDetailTarget.includes("focus=")).toBe(false);

    if (nextMealState.status === "NEED_GAP_CHECK") {
      expect(automatorState.heroPrimaryTarget).toContain(`focus=${arrangement.menuCount > 0 ? "shopping" : "menu"}`);
    } else if (nextMealState.status === "NEED_SHOPPING") {
      expect(automatorState.heroPrimaryTarget).toContain("focus=shopping");
    } else if (nextMealState.status === "READY_TO_COOK") {
      expect(automatorState.heroPrimaryTarget).toContain("focus=assistant");
    } else if (nextMealState.status === "COMPLETED") {
      expect(automatorState.heroPrimaryTarget).toContain("focus=memory");
    }
  });
});
