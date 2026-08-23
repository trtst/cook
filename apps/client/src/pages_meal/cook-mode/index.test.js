const { createMealAssistantFixture } = require("../../test-utils/meal-assistant-fixture.js");

jest.setTimeout(30000);

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function waitForCookMode(page, expectedSourceTag, timeout = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const state = await page.callMethod("automatorReadState");
    if (state && state.currentSourceTag === expectedSourceTag) return state;
    await page.waitFor(100);
  }

  throw new Error(`未在 ${timeout}ms 内等到做饭模式来源标签: ${expectedSourceTag}`);
}

describe("pages_meal/cook-mode/index", () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createMealAssistantFixture();
  });

  it("会员菜谱进入做饭模式时默认优先读建议流程，并可切回原始步骤", async () => {
    await clearSession();
    const page = await program.reLaunch(
      `/pages_meal/cook-mode/index?source=recipe&recipeId=${fixture.paidGeneratedRecipe.id}&kind=my`
    );
    await page.callMethod("automatorApplySession", {
      token: fixture.paidSession.token,
      uid: fixture.paidSession.user.uid,
      expiresAt: fixture.paidSession.expiresAt
    });

    const initial = await waitForCookMode(page, "建议流程");
    expect(initial.flowMode).toBe("assistant");
    expect(initial.canSwitchFlowMode).toBe(true);
    expect(initial.assistantStepCount).toBeGreaterThan(0);
    expect(initial.originalStepCount).toBeGreaterThan(0);

    const switched = await page.callMethod("automatorSetFlowMode", "original");
    expect(switched.flowMode).toBe("original");
    expect(switched.currentSourceTag).toBe("菜谱步骤");
  });

  it("免费菜谱未生成建议时仍可按原始步骤进入做饭模式", async () => {
    await clearSession();
    const page = await program.reLaunch(
      `/pages_meal/cook-mode/index?source=recipe&recipeId=${fixture.freeRecipe.id}&kind=my`
    );
    await page.callMethod("automatorApplySession", {
      token: fixture.freeSession.token,
      uid: fixture.freeSession.user.uid,
      expiresAt: fixture.freeSession.expiresAt
    });

    const state = await waitForCookMode(page, "菜谱步骤");
    expect(state.flowMode).toBe("original");
    expect(state.canSwitchFlowMode).toBe(false);
    expect(state.assistantStepCount).toBe(0);
    expect(state.originalStepCount).toBeGreaterThan(0);
  });
});
