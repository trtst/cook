jest.setTimeout(30000);

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

describe("pages_meal/plan/index", () => {
  it("游客直达时，不展示计划管理浮层", async () => {
    await clearSession();
    const page = await program.reLaunch("/pages_meal/plan/index");
    await page.callMethod("automatorClearSession");
    await page.waitFor(300);

    const state = await page.callMethod("automatorReadGuestState");
    expect(state.loggedIn).toBe(false);
    expect(state.showPlanDock).toBe(false);
  });
});
