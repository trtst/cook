const http = require("http");
const https = require("https");
const { URL } = require("url");
const { existsSync, readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const { loginWithPassword } = require("../../test-utils/auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const hasJestRuntime =
  (typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID)) ||
  (typeof globalThis.describe === "function" && typeof globalThis.it === "function");
const hasAutomatorRuntime = hasJestRuntime && typeof globalThis.program !== "undefined";
const nodeTest = hasJestRuntime ? null : require("node:test");

if (!hasAutomatorRuntime && !hasJestRuntime) {
  globalThis.jest = { setTimeout() {} };
  globalThis.describe = () => {};
  globalThis.it = () => {};
  globalThis.beforeAll = () => {};
}

globalThis.jest?.setTimeout?.(30000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function collectTexts(page) {
  const nodes = await page.$$(`text`);
  const texts = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) texts.push(value);
  }

  return texts;
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

function buildFuturePlanDate(daysFromNow = 7) {
  return formatDateOnly(new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000));
}

function buildFutureIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

async function loginWithCode(phone) {
  return loginWithPassword(phone);
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
      name: `饭局详情验收分类${nextIdempotencyKey().slice(-6)}`
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
        name: `饭局详情验收菜谱${suffix}`,
        story: "用于验证饭局详情页真实正文态。",
        categoryId: category.id,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: "先把菜单和做饭助手展示出来。",
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
            text: "准备食材并开始这顿饭。",
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

async function createMealPlanFixture(authHeaders, recipe, options = {}) {
  return requestData("/meal-plans", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      planDate: options.planDate || buildFuturePlanDate(options.daysFromNow || 7),
      mealSlot: options.mealSlot || "DINNER",
      title: `${options.titlePrefix || "饭局详情验收餐次"}-${nextIdempotencyKey().slice(-6)}`,
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

async function createDiningEventFixture(authHeaders, plan, scheduledAt = buildFutureIso(4)) {
  return requestData(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      scheduledAt,
      location: "饭局详情验收地点"
    })
  });
}

async function waitForTitle(page, expectedTitle, timeout = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const title = await page.$(".summary-card__title");
    if (title && (await title.text()).trim() === expectedTitle) return;
    await sleep(200);
  }

  throw new Error(`未在 ${timeout}ms 内等到饭局详情标题: ${expectedTitle}`);
}

async function waitForFocusedSection(page, expectedSection, timeout = 4000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const state = await page.callMethod("automatorReadFocusState");
    if (state && state.focusAttempt && state.focusAttempt.requested === expectedSection && state.focusAttempt.applied) {
      return state;
    }
    await sleep(100);
  }

  throw new Error(`未在 ${timeout}ms 内等到详情 focus 命中: ${expectedSection}`);
}

describe("pages_meal/detail/index", () => {
  let page;
  let fixture;
  let planOnlyFixture;

  beforeAll(async () => {
    const phone = createFreshPhone();
    const session = await loginWithCode(phone);
    const authHeaders = { authorization: `Bearer ${session.token}` };
    const recipe = await createRecipeFixture(authHeaders);
    const extraRecipe = await createRecipeFixture(authHeaders);
    const plan = await createMealPlanFixture(authHeaders, recipe, {
      titlePrefix: "饭局详情验收饭局餐次",
      daysFromNow: 7
    });
    const event = await createDiningEventFixture(authHeaders, plan);
    const planOnly = await createMealPlanFixture(authHeaders, recipe, {
      titlePrefix: "饭局详情验收计划餐次",
      daysFromNow: 8
    });

    fixture = {
      session,
      title: event.title,
      recipeTitle: event.menuItems[0].title,
      planDate: plan.planDate,
      planItemId: plan.id,
      eventId: event.id,
      scheduledAt: event.scheduledAt,
      extraRecipeTitle: extraRecipe.title
    };

    planOnlyFixture = {
      session,
      title: planOnly.title,
      planDate: planOnly.planDate,
      planItemId: planOnly.id,
      version: planOnly.version
    };

    await clearSession();
    page = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${fixture.planItemId}&planDate=${fixture.planDate}&eventId=${fixture.eventId}`
    );
    await page.callMethod("automatorApplySession", {
      token: fixture.session.token,
      uid: fixture.session.user.uid,
      expiresAt: fixture.session.expiresAt
    });
    await waitForTitle(page, fixture.title);
  });

  it("主家在菜单未确定时看到亲近的饭局协作文案，且不显示做饭安排", async () => {
    expect(await page.path).toBe("pages_meal/detail/index");

    const title = await page.$(".summary-card__title");
    expect(await title.text()).toBe(fixture.title);

    const texts = await collectTexts(page);
    expect(texts).toContain("参与人");
    expect(texts).toContain("本次菜单");
    expect(texts).toContain("大家想吃的菜");
    expect(texts).toContain("带菜安排");
    expect(texts).toContain("采购准备");
    expect(texts).not.toContain("做饭助手");
    expect(texts).toContain("主家菜单");
    expect(texts).toContain(fixture.recipeTitle);
  });

  it("仅从计划进入时，已到开饭时间的关联饭局仍展示协作模块", async () => {
    await clearSession();
    const linkedPlanPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${fixture.planItemId}&planDate=${fixture.planDate}`
    );
    await linkedPlanPage.callMethod("automatorSetNowMs", new Date(fixture.scheduledAt).getTime() + 60 * 1000);
    await linkedPlanPage.callMethod("automatorApplySession", {
      token: fixture.session.token,
      uid: fixture.session.user.uid,
      expiresAt: fixture.session.expiresAt
    });

    const focusState = await linkedPlanPage.callMethod("automatorReadFocusState");
    expect(focusState.hasEventDetail).toBe(true);

    const texts = await collectTexts(linkedPlanPage);
    expect(texts).toContain("大家想吃的菜");
    expect(texts).toContain("带菜安排");
    expect(texts).toContain("饭局提醒");
  });

  it("添加菜单时显示本次选中状态", async () => {
    await clearSession();
    const menuPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${planOnlyFixture.planItemId}&planDate=${planOnlyFixture.planDate}`
    );
    await menuPage.callMethod("automatorApplySession", {
      token: planOnlyFixture.session.token,
      uid: planOnlyFixture.session.user.uid,
      expiresAt: planOnlyFixture.session.expiresAt
    });
    await waitForTitle(menuPage, planOnlyFixture.title);

    const addAction = await menuPage.$(".meal-menu__add-action");
    expect(addAction).toBeTruthy();
    await addAction.tap();
    await menuPage.waitFor(".recipe-sheet__row", 8000);

    const rows = await menuPage.$$(".recipe-sheet__row");
    const extraRecipeRow = await Promise.all(rows.map(async (row) => ((await row.text()).includes(fixture.extraRecipeTitle) ? row : null)))
      .then(items => items.find(Boolean));
    expect(extraRecipeRow).toBeTruthy();
    await extraRecipeRow.tap();

    const texts = await collectTexts(menuPage);
    expect(texts).toContain("确认添加");
    expect(texts).toContain("已添加");
  });

  it("最近安排 focus=shopping 可以命中详情采购区块", async () => {
    await clearSession();
    const focusPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${fixture.planItemId}&planDate=${fixture.planDate}&eventId=${fixture.eventId}&focus=shopping`
    );
    await focusPage.callMethod("automatorApplySession", {
      token: fixture.session.token,
      uid: fixture.session.user.uid,
      expiresAt: fixture.session.expiresAt
    });
    await waitForTitle(focusPage, fixture.title);

    const focusState = await waitForFocusedSection(focusPage, "shopping");
    expect(focusState.focusAttempt.targetId).toBe("meal-shopping-panel");
    expect(focusState.showShoppingPanel).toBe(true);
    expect(focusState.hasEventDetail).toBe(true);

    const texts = await collectTexts(focusPage);
    expect(texts).toContain("采购准备");
  });

  it("最近安排无效 focus 可以降级到计划详情默认正文", async () => {
    await clearSession();
    const focusPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${planOnlyFixture.planItemId}&planDate=${planOnlyFixture.planDate}&focus=memory`
    );
    await focusPage.callMethod("automatorApplySession", {
      token: planOnlyFixture.session.token,
      uid: planOnlyFixture.session.user.uid,
      expiresAt: planOnlyFixture.session.expiresAt
    });
    await waitForTitle(focusPage, planOnlyFixture.title);

    const focusState = await focusPage.callMethod("automatorReadFocusState");
    expect(focusState.hasEventDetail).toBe(false);
    expect(focusState.hasPlanDetail).toBe(true);
    expect(focusState.focusAttempt.requested).toBe("memory");
    expect(focusState.focusAttempt.targetId).toBe("");
    expect(focusState.focusAttempt.applied).toBe(false);

    const texts = await collectTexts(focusPage);
    expect(texts).toContain("菜单");
    expect(texts).not.toContain("做饭助手");
  });

  it("计划详情 Hero 用餐次提问并提示菜单下一步", async () => {
    await clearSession();
    const planPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${planOnlyFixture.planItemId}&planDate=${planOnlyFixture.planDate}`
    );
    await planPage.callMethod("automatorApplySession", {
      token: planOnlyFixture.session.token,
      uid: planOnlyFixture.session.user.uid,
      expiresAt: planOnlyFixture.session.expiresAt
    });
    await waitForTitle(planPage, planOnlyFixture.title);

    const texts = await collectTexts(planPage);
    expect(texts).toContain("晚餐吃什么？");
    expect(texts).toContain("菜单已添好，继续补齐这顿饭。");
    expect(texts).not.toContain("做饭助手");
  });

  it("菜单确定后才显示固定的一份做饭安排", async () => {
    await requestData(`/meal-plans/${planOnlyFixture.planItemId}/confirm-menu`, {
      method: "POST",
      headers: withIdempotencyKey({ authorization: `Bearer ${planOnlyFixture.session.token}` }),
      body: JSON.stringify({ expectedVersion: planOnlyFixture.version })
    });

    await clearSession();
    const confirmedPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${planOnlyFixture.planItemId}&planDate=${planOnlyFixture.planDate}`
    );
    await confirmedPage.callMethod("automatorApplySession", {
      token: planOnlyFixture.session.token,
      uid: planOnlyFixture.session.user.uid,
      expiresAt: planOnlyFixture.session.expiresAt
    });
    await waitForTitle(confirmedPage, planOnlyFixture.title);

    const texts = await collectTexts(confirmedPage);
    expect(texts).toContain("做饭助手");
    expect(texts).toContain("菜单已经定好，打开后会按你的次数权益生成或解锁。");
    expect(texts).not.toContain("重新生成建议");

    const footerState = await confirmedPage.callMethod("automatorReadFooterState");
    expect(footerState.primaryActionLabel).toBe("结束计划");
  });

  it("饭局到点后 footer 会自动切到分享回忆态", async () => {
    await clearSession();
    const timeUpPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${fixture.planItemId}&planDate=${fixture.planDate}&eventId=${fixture.eventId}`
    );
    await timeUpPage.callMethod("automatorApplySession", {
      token: fixture.session.token,
      uid: fixture.session.user.uid,
      expiresAt: fixture.session.expiresAt
    });
    await waitForTitle(timeUpPage, fixture.title);
    await timeUpPage.callMethod("automatorSetNowMs", new Date(fixture.scheduledAt).getTime() + 60 * 1000);

    const footerState = await timeUpPage.callMethod("automatorReadFooterState");
    expect(footerState.footerStage).toBe("TIME_UP");
    expect(footerState.endedActionLabel).toBe("分享回忆");
    expect(footerState.primaryActionLabel).toBe("");

    const texts = await collectTexts(timeUpPage);
    expect(texts).toContain("分享回忆");
  });
});

if (!hasAutomatorRuntime && nodeTest) {
  const detailPageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

  nodeTest("饭局成员可以一次提交最多三道带菜和想吃", () => {
    nodeAssert.match(detailPageSource, /MAX_EVENT_RECIPE_SELECTION\s*=\s*3/);
    nodeAssert.match(detailPageSource, /recipeIds:\s*nextRecipeIds/);
    nodeAssert.match(detailPageSource, /recipeSelectedIds\.value\.length\s*>=\s*MAX_EVENT_RECIPE_SELECTION/);
  });

  nodeTest("饭局成员读取我的口味并通过我的备注 Sheet 快速回填", () => {
    nodeAssert.match(detailPageSource, /userApi\.getTasteProfile\(\)/);
    nodeAssert.match(detailPageSource, /DiningEventParticipantNoteSheet/);
    nodeAssert.match(detailPageSource, /updateDiningEventParticipantNote/);
    nodeAssert.match(detailPageSource, /我的备注/);
  });

  nodeTest("饭局成员不显示采购准备和底部采购动作", () => {
    nodeAssert.match(detailPageSource, /showShoppingPanel[\s\S]*isEventOrganizer/);
    nodeAssert.match(detailPageSource, /footerPrimaryAction[\s\S]*isEventOrganizer/);
    nodeAssert.match(detailPageSource, /v-if="eventDetail && isEventOrganizer && !eventClosed"/);
    nodeAssert.match(detailPageSource, /eventDetail\.value && \(eventClosed\.value \|\| !isEventOrganizer\.value \|\| !currentMenuItems\.value\.length\)/);
  });

  nodeTest("计划详情按食材缺口显示待购数量", () => {
    nodeAssert.match(detailPageSource, /shoppingApi\.previewPlanGap\(planDetail\.value!\.id\)/);
    nodeAssert.match(detailPageSource, /planGapItems\.value\.length/);
    nodeAssert.match(detailPageSource, /这顿饭需要准备 \$\{currentPlanShoppingCount\.value\} 样食材/);
    const targetEventBranchStart = detailPageSource.indexOf("if (!targetEventId) {");
    const targetEventBranchEnd = detailPageSource.indexOf("if (!eventDetail.value || eventDetail.value.id !== targetEventId)", targetEventBranchStart);
    nodeAssert.ok(targetEventBranchStart >= 0 && targetEventBranchEnd > targetEventBranchStart);
    nodeAssert.match(detailPageSource.slice(targetEventBranchStart, targetEventBranchEnd), /await loadGapPreview\(\);/);
  });

  nodeTest("饭局详情只预览当前饭局的采购需求", () => {
    nodeAssert.match(detailPageSource, /shoppingApi\.previewEventGap\(eventDetail\.value\.id\)/);
    nodeAssert.doesNotMatch(detailPageSource, /eventDetail\.value[\s\S]{0,120}shoppingApi\.previewGap\(\)/);
  });

  nodeTest("确认菜单后的饭局 footer 结束饭局并进入回忆", () => {
    const readyStageStart = detailPageSource.indexOf('if (footerStage.value === "READY_TO_START")');
    const readyStageEnd = detailPageSource.indexOf("const footerPrimaryGapText", readyStageStart);
    const readyStageSource = detailPageSource.slice(readyStageStart, readyStageEnd);

    nodeAssert.match(readyStageSource, /key: "complete-event"/);
    nodeAssert.match(readyStageSource, /label: "结束饭局"/);
    nodeAssert.doesNotMatch(readyStageSource, /key: "cook-assistant"/);
    nodeAssert.match(detailPageSource, /title: "结束饭局"/);
    nodeAssert.match(detailPageSource, /mealApi\.completeDiningEvent\(eventDetail\.value\.id, createOperationId\(\)\)/);
    nodeAssert.match(detailPageSource, /navigateTo\(`\/pages_share\/memory\/index\?eventId=/);
  });

  nodeTest("确认菜单后的纯计划 footer 可以结束计划", () => {
    const readyStageStart = detailPageSource.indexOf('if (footerStage.value === "READY_TO_START")');
    const readyStageEnd = detailPageSource.indexOf("const footerPrimaryGapText", readyStageStart);
    const readyStageSource = detailPageSource.slice(readyStageStart, readyStageEnd);

    nodeAssert.match(readyStageSource, /if \(!eventDetail\.value\) return \{ key: "complete-plan", label: "结束计划" \}/);
    nodeAssert.match(detailPageSource, /mealApi\.completePlan\(planDetail\.value\.id, createOperationId\(\)\)/);
    nodeAssert.match(detailPageSource, /title: "结束计划"/);
  });

  nodeTest("饭局有采购缺口优先去采购，无缺口无人接受时显示取消饭局", () => {
    const readyStageStart = detailPageSource.indexOf('if (footerStage.value === "READY_TO_START")');
    const readyStageEnd = detailPageSource.indexOf("const footerPrimaryGapText", readyStageStart);
    const readyStageSource = detailPageSource.slice(readyStageStart, readyStageEnd);

    nodeAssert.match(readyStageSource, /currentEventGapCount\.value > 0[\s\S]*key: "shopping"/);
    nodeAssert.match(readyStageSource, /canCompleteEvent\.value[\s\S]*key: "complete-event"/);
    nodeAssert.match(readyStageSource, /canCancelEvent\.value[\s\S]*key: "cancel-event"/);
    nodeAssert.match(detailPageSource, /mealApi\.cancelDiningEvent\(eventDetail\.value\.id, createOperationId\(\)\)/);
    nodeAssert.match(detailPageSource, /title: "取消饭局"/);
    nodeAssert.match(detailPageSource, /原计划和菜单会保留，之后还可以重新发起饭局/);
  });

  nodeTest("餐次加载不到时使用 Toast，不渲染页面内错误重试块", () => {
    nodeAssert.doesNotMatch(detailPageSource, /class="meal-detail-state meal-detail-state--error"/);
    nodeAssert.doesNotMatch(detailPageSource, /class="meal-panel meal-panel--warning" @click="loadDetail"/);
    nodeAssert.match(detailPageSource, /showLoadErrorToast\("这条餐次暂时找不到了"\)/);
    nodeAssert.match(detailPageSource, /async function showLoadErrorToast[\s\S]*uniPlatform\.feedback\.toast/);
  });

  nodeTest("schedule editor derives the visible meal slot from the edited time", () => {
    nodeAssert.match(detailPageSource, /:meal-slot="scheduledMealSlot"/);
    nodeAssert.match(detailPageSource, /scheduledMealSlot\.value = nextSlot;/);
    nodeAssert.match(detailPageSource, /resolveMealSlotByTime\(nextValue\)/);
  });

  nodeTest("saving an edited dining-event schedule reloads the authoritative plan slot", () => {
    nodeAssert.match(detailPageSource, /planDate\.value = nextDate;/);
    nodeAssert.match(detailPageSource, /if \(updatingSchedule\) \{\s+await loadDetail\(\);\s+\}/);
  });

  nodeTest("declined and removed dining-event participants cannot open the meal assistant", () => {
    nodeAssert.match(
      detailPageSource,
      /isEventOrganizer\.value\s*\|\|\s*\["INVITED", "ACCEPTED"\]\.includes\(currentParticipant\.value\?\.status \?\? ""\)/
    );
  });

  nodeTest("meal detail uses the shared assistant unlock sheet and enters cook mode after unlock", () => {
    const sheetPath = resolve(__dirname, "../../components/CookAssistantUnlockSheet.vue");
    nodeAssert.ok(existsSync(sheetPath), "Expected the shared assistant unlock sheet to exist");
    nodeAssert.match(detailPageSource, /import CookAssistantUnlockSheet from "@\/components\/CookAssistantUnlockSheet\.vue";/);
    nodeAssert.match(detailPageSource, /<CookAssistantUnlockSheet[\s\S]*:visible="cookAssistantSheetVisible"[\s\S]*:remaining-count="cookAssistantRemainingCount"/);
    nodeAssert.match(detailPageSource, /function handleCookAssistantAction\(\)[\s\S]*?cookAssistantSheetVisible\.value = true/);
    nodeAssert.match(detailPageSource, /function unlockCookAssistant\(\)[\s\S]*?mealApi\.unlockCookAssistant[\s\S]*?openCookAssistantMode/);
    nodeAssert.doesNotMatch(detailPageSource, /@click="openCookAssistantPage"/);
    nodeAssert.doesNotMatch(detailPageSource, /openCookAssistantPage/);
    nodeAssert.match(detailPageSource, /if \(action === "cook-assistant"\) \{\s+void handleCookAssistantAction\(\);/);
    nodeAssert.doesNotMatch(detailPageSource, /查看做饭助手/);
    nodeAssert.match(
      detailPageSource,
      /<view class="meal-helper__head">[\s\S]*?class="meal-inline-action meal-inline-action--ghost meal-helper__cook-action"[\s\S]*?@click="openCookMode"[\s\S]*?icon-cook meal-helper__cook-action-icon[\s\S]*?<text>边做边看<\/text>/
    );
    nodeAssert.match(
      detailPageSource,
      /<button class="meal-helper__button meal-helper__button--primary"[\s\S]*?icon-cook-assistant meal-helper__button-icon[\s\S]*?<text>炊火智厨<\/text>/
    );
    nodeAssert.match(detailPageSource, /\.meal-helper__button-icon\s*\{[^}]*color:\s*inherit;/);
    nodeAssert.doesNotMatch(detailPageSource, /meal-helper__text-action|按菜谱做饭/);
    nodeAssert.match(detailPageSource, /\.meal-helper__head\s*\{[\s\S]*?display: flex;[\s\S]*?justify-content: space-between;/);
    nodeAssert.match(detailPageSource, /\.meal-helper__actions\s*\{[\s\S]*?display: flex;[\s\S]*?margin-top: 24rpx;/);
    nodeAssert.doesNotMatch(detailPageSource, /\.meal-helper__button--main\s*\{/);
    nodeAssert.doesNotMatch(detailPageSource, /\/pages_meal\/assistant\/index\?/);
  });

  nodeTest("meal detail restores the assistant unlock sheet after expired login", () => {
    nodeAssert.match(detailPageSource, /import \{ UnauthorizedError, type UUID \} from "@\/apis\/http";/);
    nodeAssert.match(detailPageSource, /restoreCookAssistantAfterLogin/);
    nodeAssert.match(detailPageSource, /restoreCookAssistantAfterLogin\.value = true;[\s\S]*openLogin\(\)/);
    nodeAssert.match(detailPageSource, /if \(!restoreCookAssistantAfterLogin\.value\) return;[\s\S]*cookAssistantSheetVisible\.value = true[\s\S]*loadCookAssistantUsage\(\)/);
    nodeAssert.match(detailPageSource, /cookAssistantSheetVisible\.value = false;[\s\S]*cookAssistantSheetLoading\.value = false;[\s\S]*cookAssistantSheetError\.value = "";[\s\S]*cookAssistantUsage\.value = null;/);
  });

  nodeTest("meal detail keeps the assistant thinking state before entering cook mode", () => {
    nodeAssert.match(detailPageSource, /type CookAssistantUnlockState = "locked" \| "unlocking" \| "unlocked";/);
    nodeAssert.match(detailPageSource, /const cookAssistantUnlockState = ref<CookAssistantUnlockState>\("locked"\);/);
    nodeAssert.match(detailPageSource, /getCookAssistantLoadingDuration/);
    nodeAssert.match(detailPageSource, /waitForCookAssistantLoading/);
    nodeAssert.match(detailPageSource, /import CookAssistantThinkingLoading from "@\/components\/CookAssistantThinkingLoading\.vue";/);
    nodeAssert.match(detailPageSource, /<template #global-loading>\s*<CookAssistantThinkingLoading :visible="cookAssistantSheetSubmitting" @cancel="cancelCookAssistantUnlock" \/>\s*<\/template>/);

    const start = detailPageSource.indexOf("async function unlockCookAssistant()");
    const end = detailPageSource.indexOf("\nasync function submitTitleUpdate", start);
    const functionSource = detailPageSource.slice(start, end);
    const unlockIndex = functionSource.indexOf('cookAssistantUnlockState.value = "unlocking"');
    const waitIndex = functionSource.indexOf("await waitForCookAssistantLoading");
    const unlockedIndex = functionSource.indexOf('cookAssistantUnlockState.value = "unlocked"');
    const navigationIndex = functionSource.indexOf("openCookAssistantMode()");

    nodeAssert.ok(unlockIndex >= 0, "Expected the meal assistant to enter unlocking state");
    nodeAssert.ok(waitIndex > unlockIndex, "Expected the thinking wait after unlocking starts");
    nodeAssert.ok(unlockedIndex > waitIndex, "Expected the unlocked state after the minimum wait");
    nodeAssert.ok(navigationIndex > unlockedIndex, "Expected cook mode navigation after unlock completes");
  });

  nodeTest("meal detail can cancel assistant thinking without navigating", () => {
    nodeAssert.match(detailPageSource, /function cancelCookAssistantUnlock\(\)[\s\S]*?cookAssistantSheetVisible\.value = true/);
    nodeAssert.match(detailPageSource, /cookAssistantUnlockRequestId\s*\+=\s*1/);
    nodeAssert.match(detailPageSource, /cookAssistantUnlockPending\.value/);
    nodeAssert.match(detailPageSource, /cookAssistantUnlockPending\.value = false/);
    nodeAssert.match(detailPageSource, /if \(requestId !== cookAssistantUnlockRequestId\) return;/);
  });
}
