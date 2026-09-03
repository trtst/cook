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

const recentArrangementStatusCopies = {
  EMPTY_MENU: ["菜单还空着呢", "先来定几道菜", "空空如也的菜单", "该加菜了朋友", "菜单一片空白"],
  PENDING_CONFIRM: ["菜单等待确认", "就差你拍板了", "确认一下菜单吧", "菜单等你定夺", "确认菜单再继续"],
  PENDING_SHOPPING: ["食材还差一点", "出发采购食材", "备齐食材再开火", "该去采购了哦", "食材缺口待补"],
  READY_TO_COOK: ["食材齐备可开火", "万事俱备下厨吧", "可以开始做饭啦", "系上围裙开火吧", "一切就绪做饭去"],
  TIME_UP_SHARE: ["饭局结束分享吧", "该记录美好回忆", "回忆时刻到来了", "饭后一起分享吧", "留下今日份快乐"]
};

const recentArrangementHintCopies = {
  EMPTY_MENU: [
    "这顿饭还没有安排菜，先去加点菜吧",
    "菜单还是空的，想好吃什么了吗",
    "没有菜怎么做饭，快来决定一下吧",
    "菜单空荡荡，先填满它再说",
    "还什么都没选呢，加几道拿手菜吧",
    "一顿好饭从点菜开始，去加几道吧",
    "菜单暂空，等你来填"
  ],
  PENDING_CONFIRM_WITH_GAP: [
    "还差 {n} 样食材，确认菜单后就能看到采购清单了",
    "菜单待确认，另有 {n} 样食材需要准备",
    "再差 {n} 样就齐了，确认一下菜单吧",
    "菜单还没敲定，还有 {n} 样缺口待补",
    "确认菜单后，我们会帮你列好这 {n} 样采购项",
    "菜单就差最后一步确认，还缺 {n} 样食材哦",
    "定下菜单，还有 {n} 样等着采购呢"
  ],
  PENDING_CONFIRM_NO_GAP: [
    "菜单已定，就差你点一下确认了",
    "确认菜单，就可以进入下一步了",
    "菜单已经想好了，确认一下吧",
    "就差一个确认，饭局就能推进了",
    "菜单就位，确认后正式开始准备",
    "菜都选好了，点个确认就出发",
    "万事俱备，只欠确认"
  ],
  PENDING_SHOPPING_WITH_GAP: [
    "还差 {n} 样食材，买齐就能开火了",
    "食材缺口 {n} 样，准备采购吧",
    "菜单定了，再补 {n} 样就齐了",
    "还差 {n} 样，买完就可以做饭了",
    "离下厨只差 {n} 样，快去采购",
    "清单已列，还有 {n} 样待购入",
    "补上这 {n} 样，厨房就能开工了"
  ],
  PENDING_SHOPPING_NO_GAP: [
    "菜单已确认，去把食材备齐吧",
    "采购准备就绪，出发买菜吧",
    "可以开始采购了，食材都在等着你",
    "食材备好，才能做好饭哦",
    "备齐食材，离美味更近一步",
    "是时候去一趟菜市场了",
    "采购启动，食材到位就可以下厨了"
  ],
  READY_TO_COOK: [
    "食材齐了，系上围裙开始吧",
    "一切就绪，可以大显身手了",
    "食材已备好，就差你的手艺了",
    "开火吧，美味马上就来",
    "菜已备齐，锅铲就位",
    "做饭时间到，露一手吧",
    "万事俱备，下厨正当时"
  ],
  TIME_UP_SHARE: [
    "饭局结束了，记录一下这顿的美好回忆吧",
    "到点啦，分享一下今天的美食瞬间",
    "饭已吃完，别忘了留下回忆",
    "美食值得被记住，来写点什么吧",
    "这顿饭结束了，但快乐可以留住",
    "饱餐过后，来记录一下今日份满足",
    "饭局已散，回忆永存，分享一下吧"
  ]
};

function recentArrangementHintBranch(arrangement) {
  const gapCount = arrangement.gapCount || 0;
  if (arrangement.status === "EMPTY_MENU") return "EMPTY_MENU";
  if (arrangement.status === "PENDING_CONFIRM") return gapCount > 0 ? "PENDING_CONFIRM_WITH_GAP" : "PENDING_CONFIRM_NO_GAP";
  if (arrangement.status === "PENDING_SHOPPING") return gapCount > 0 ? "PENDING_SHOPPING_WITH_GAP" : "PENDING_SHOPPING_NO_GAP";
  if (arrangement.status === "READY_TO_COOK") return "READY_TO_COOK";
  return "TIME_UP_SHARE";
}

function recentArrangementActionText(status) {
  if (status === "EMPTY_MENU") return "去加菜";
  if (status === "PENDING_CONFIRM") return "确认菜单";
  if (status === "PENDING_SHOPPING") return "去采购";
  if (status === "READY_TO_COOK") return "开始做饭";
  return "分享回忆";
}

function recentArrangementHintTexts(arrangement) {
  const branch = recentArrangementHintBranch(arrangement);
  return recentArrangementHintCopies[branch].map(text => text.replace("{n}", `${arrangement.gapCount || 0}`));
}

function resolveRecentArrangementFocus(status) {
  if (status === "EMPTY_MENU") return "menu";
  if (status === "PENDING_CONFIRM") return "footer";
  if (status === "PENDING_SHOPPING") return "shopping";
  if (status === "READY_TO_COOK") return "assistant";
  return "memory";
}

describe("pages/home/index", () => {
  it("未登录点击首页随机一桌快捷入口时只呼起登录，不直接跳随机页", async () => {
    await clearSession();
    const page = await program.reLaunch("/pages/home/index");
    await page.callMethod("automatorClearSession");
    await page.waitFor(".dock-action", 8000);

    const actions = await page.$$(".dock-action");
    expect(actions.length).toBeGreaterThanOrEqual(3);
    await actions[2].tap();
    await page.waitFor(300);

    expect(await page.path).toBe("pages/home/index");
    expect(await page.callMethod("automatorReadLoginGateState")).toEqual({
      loggedIn: false,
      loginVisible: true
    });
  });

  it("未登录点击首页换一换时只呼起登录，不直接跳随机页", async () => {
    await clearSession();
    const page = await program.reLaunch("/pages/home/index");
    await page.callMethod("automatorClearSession");
    await page.waitFor(".section-heading__action", 8000);

    const action = await page.$(".section-heading__action");
    expect(await action.text()).toBe("换一换");
    await action.tap();
    await page.waitFor(300);

    expect(await page.path).toBe("pages/home/index");
    expect(await page.callMethod("automatorReadLoginGateState")).toEqual({
      loggedIn: false,
      loginVisible: true
    });
  });

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

    const weekCardTitle = await page.$(".feature-card--status .feature-card__title");
    expect(((await weekCardTitle.text()) || "").trim().length > 0).toBe(true);

    const weekCardSubtitle = await page.$(".feature-card--status .feature-card__subtitle");
    expect(((await weekCardSubtitle.text()) || "").trim().length > 0).toBe(true);

    const weekCardMeta = await page.$(".feature-card--status .feature-card__meta");
    expect(weekCardMeta).toBeNull();

    const weekCardAction = await page.$(".feature-card--status .feature-card__status-action-text");
    expect(((await weekCardAction.text()) || "").trim().length > 0).toBe(true);

    const heroSwiper = await page.$(".hero-swiper");
    expect(heroSwiper).not.toBeNull();

    const heroSlides = await page.$$(".hero-swiper__item");
    expect(heroSlides.length).toBe(2);

    const heroTitle = await page.$(".hero-banner__title");
    expect(((await heroTitle.text()) || "").trim().length > 0).toBe(true);

    const quickTitles = await collectTexts(await page.$$(".dock-action__title"));
    expect(quickTitles).toEqual(["安排下一顿", "看看食材", "随机一桌", "补缺食材"]);
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

    const weekCardSummary = await page.$(".feature-card--status .feature-card__subtitle");
    const weekCardSummaryText = await weekCardSummary.text();
    expect(weekCardSummaryText.length > 0).toBe(true);
    if (typeof arrangement.gapCount === "number" && arrangement.gapCount > 0) {
      expect(weekCardSummaryText.includes(`${arrangement.gapCount}`)).toBe(true);
    }

    const cardTitle = await page.$(".recent-arrangement__title");
    expect(await cardTitle.text()).toBe(arrangement.title);

    const cardMeta = await page.$(".recent-arrangement__meta");
    const cardMetaText = await cardMeta.text();
    expect(cardMetaText.includes(`${arrangement.participantCount}人`)).toBe(true);
    expect(cardMetaText.includes(`${arrangement.menuCount}道菜`)).toBe(true);

    const cardHint = await page.$(".recent-arrangement__hint");
    const cardHintText = await cardHint.text();
    expect(recentArrangementHintTexts(arrangement)).toContain(cardHintText);

    const cardStatus = await page.$(".recent-arrangement__status");
    expect(recentArrangementStatusCopies[arrangement.status]).toContain(await cardStatus.text());

    const actionTexts = await collectTexts(await page.$$(".recent-arrangement__button-text"));
    expect(actionTexts).toContain(recentArrangementActionText(arrangement.status));

    const detailLinks = await page.$$(".recent-arrangement__link-text");
    expect(detailLinks.length).toBe(0);

    const automatorState = await page.callMethod("automatorReadRecentArrangementState");
    expect(automatorState.homeNextStatus).toBe(nextMealState.status);
    expect(automatorState.arrangementStatus).toBe(arrangement.status);
    expect(typeof automatorState.weekOverviewStatus).toBe("string");
    expect(typeof automatorState.weekOverviewTarget).toBe("string");
    expect(automatorState.cardPrimaryTarget).toContain(`focus=${resolveRecentArrangementFocus(arrangement.status)}`);
    expect(automatorState.cardDetailTarget.includes("focus=")).toBe(false);
  });
});
