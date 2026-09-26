jest.setTimeout(30000);

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
}

describe("pages_meal/random/index theme runtime", () => {
  let page;

  beforeAll(async () => {
    await clearSession();
    await clearThemeSettings();
    page = await program.reLaunch("/pages_meal/random/index");
    await page.waitFor(".random-page", 8000);
    await page.callMethod("automatorClearSession");
    await page.callMethod("automatorResetThemeSettings");
  });

  it("随机页固定使用默认主题和默认色系", async () => {
    const defaultState = await page.callMethod("automatorReadThemeState");
    expect(defaultState.currentThemeText).toBe("跟随系统 · 默认主题");
    expect(defaultState.colorPage).toBe("#fff");
    expect(defaultState.themePageStyle).toContain("background-color: #fff;");

    const legacyState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "fresh-ingredient",
      themePalette: "forest"
    });
    expect(legacyState.currentThemeText).toBe("跟随系统 · 默认主题");
    expect(legacyState.colorPage).toBe("#fff");
    expect(legacyState.themePageStyle).toContain("background-color: #fff;");
  });
});
