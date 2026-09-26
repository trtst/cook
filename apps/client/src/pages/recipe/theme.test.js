jest.setTimeout(30000);

// Keep theme runtime suites in one HBuilderX process so they share one automator port.
require("../home/theme.test.js");
require("../../pages_me/theme/index.test.js");
require("../../pages_me/theme/visual-capture.test.js");
require("../../pages_meal/random/theme.test.js");

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
}

describe("pages/recipe/index theme runtime", () => {
  let page;

  beforeAll(async () => {
    await clearSession();
    await clearThemeSettings();
    page = await program.reLaunch("/pages/recipe/index");
    await page.waitFor(".recipe-page", 8000);
    await page.callMethod("automatorResetThemeSettings");
  });

  it("菜谱页固定使用默认主题和默认色系", async () => {
    const defaultState = await page.callMethod("automatorReadThemeState");
    expect(defaultState.currentThemeText).toBe("跟随系统 · 默认主题");
    expect(defaultState.colorPage).toBe("#fff");
    expect(defaultState.themePageStyle).toContain("background-color: #fff;");

    const legacyState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "minimal-white",
      themePalette: "sage"
    });
    expect(legacyState.currentThemeText).toBe("跟随系统 · 默认主题");
    expect(legacyState.colorPage).toBe("#fff");
    expect(legacyState.themePageStyle).toContain("background-color: #fff;");
  });
});
