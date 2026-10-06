const { loginWithPassword } = require("../../test-utils/auth-fixture");

jest.setTimeout(30000);

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function collectTexts(page) {
  const nodes = await page.$$("text");
  const texts = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) texts.push(value);
  }

  return texts;
}

function createFreshPhone() {
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

async function loginWithCode(phone) {
  return loginWithPassword(phone);
}

async function openRandomPageWithSession(session) {
  const homePage = await program.reLaunch("/pages/home/index");
  await homePage.callMethod("automatorApplySessionOnly", {
    token: session.token,
    uid: session.user.uid,
    expiresAt: session.expiresAt
  });
  return program.reLaunch("/pages_meal/random/index");
}

describe("pages_meal/random/index", () => {
  let page;
  let session;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());

    await clearSession();
    page = await openRandomPageWithSession(session);
    await page.callMethod("automatorPrimeConditions", {
      mealSlot: "DINNER",
      peopleCount: 4,
      fridgePreferred: true
    });
    await page.waitFor(1500);
  });

  it("随机页可以完成真实登录并展示决策台初始主状态", async () => {
    expect(await page.path).toBe("pages_meal/random/index");

    const texts = await collectTexts(page);
    expect(texts).toContain("炊火智厨");
    expect(texts).toContain("根据这顿饭，为你搭配合适的菜品");
    expect(texts).toContain("结合餐次、人数和家里已有食材，为你提供搭配建议；不合适的菜可以单独更换。");
  });

  it("随机页生成结果会在菜位卡片里展示菜名、理由和来源", async () => {
    await page.callMethod("automatorPrimeSlots", [
      {
        slotId: "slot-meat-1",
        slotType: "MEAT",
        slotIndex: 0,
        sourceType: "MY",
        recipeId: 1001,
        recipeVersionId: 2001,
        title: "番茄牛腩",
        coverUrl: null,
        servings: 2,
        duration: "BETWEEN_30_60",
        durationText: "45分钟",
        estimatedCalories: null,
        flavorTags: ["家常"],
        mainProteinType: "BEEF",
        fridgeFit: "HIGH",
        matchedIngredients: ["牛腩"],
        recommendationReason: "家里已有食材可用"
      }
    ]);

    const state = await page.callMethod("automatorReadSlotCards");
    expect(state.hasMenu).toBe(true);
    expect(state.cards).toEqual([
      {
        slotType: "MEAT",
        title: "番茄牛腩",
        recommendationReason: "家里已有食材可用",
        sourceType: "MY",
        fridgeFit: "HIGH",
        durationText: "45分钟",
        servings: 2,
        mainProteinType: "BEEF",
        matchedIngredients: ["牛腩"],
        flavorTags: ["家常"]
      }
    ]);
  });

  it("游客点开始搭配时，会先打开登录弹窗", async () => {
    const guestPage = await openRandomPageWithSession(session);
    await guestPage.callMethod("automatorClearSession");
    await guestPage.waitFor(300);
    await guestPage.callMethod("automatorPrimeConditions", {
      mealSlot: "DINNER",
      peopleCount: 4,
      fridgePreferred: true
    });

    const state = await guestPage.callMethod("automatorTriggerGuestGenerate");
    expect(state.loggedIn).toBe(false);
    expect(state.loginVisible).toBe(true);
  });

  it("游客点家里食材优先选项时，会先打开登录弹窗且不改本地状态", async () => {
    const guestPage = await openRandomPageWithSession(session);
    await guestPage.callMethod("automatorClearSession");
    await guestPage.waitFor(300);
    await guestPage.callMethod("automatorPrimeConditions", {
      mealSlot: "DINNER",
      peopleCount: 4,
      fridgePreferred: false
    });

    const state = await guestPage.callMethod("automatorTriggerGuestToggleFridge");
    expect(state.loggedIn).toBe(false);
    expect(state.loginVisible).toBe(true);
    expect(state.fridgePreferred).toBe(false);
  });

  it("游客直达随机页时会回首页并呼起登录，不停留在随机页", async () => {
    await clearSession();
    const homePage = await program.reLaunch("/pages/home/index");
    await homePage.callMethod("automatorClearSession");

    const blockedPage = await program.reLaunch("/pages_meal/random/index");
    await blockedPage.waitFor(800);

    expect(await blockedPage.path).toBe("pages/home/index");
    expect(await blockedPage.callMethod("automatorReadLoginGateState")).toEqual({
      loggedIn: false,
      loginVisible: true
    });
  });
});
