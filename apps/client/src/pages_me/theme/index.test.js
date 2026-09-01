jest.setTimeout(30000);

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
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

describe("pages_me/theme/index", () => {
  let page;

  beforeAll(async () => {
    await clearSession();
    await clearThemeSettings();
    page = await program.reLaunch("/pages_me/theme/index");
    await page.waitFor(".theme-card__title", 8000);
  });

  beforeEach(async () => {
    await page.callMethod("automatorClearSession");
    await page.callMethod("automatorResetThemeSettings");
  });

  it("主题页展示默认模式、可切换皮肤和默认色系", async () => {
    expect(await page.path).toBe("pages_me/theme/index");

    const texts = await collectTexts(await page.$$("text"));
    expect(texts).toContain("主题皮肤");
    expect(texts).toContain("当前主题");
    expect(texts).toContain("个性皮肤");
    expect(texts).toContain("主题");
    expect(texts).toContain("色系");
    expect(texts).toContain("TabBar 预览");

    const sectionTitles = await collectTexts(await page.$$(".theme-card__section-title"));
    expect(sectionTitles).toEqual(["主题", "色系", "模式"]);

    const state = await page.callMethod("automatorReadState");
    expect(state.themeMode).toBe("system");
    expect(state.effectiveSkin).toBe("default");
    expect(state.effectivePalette).toBe("default");
    expect(state.themeOptions).toEqual(["default", "fresh-ingredient", "minimal-white", "apple-glass"]);
    expect(state.themeOptionLabels).toEqual(["默认主题", "清新食材", "简白", "磨砂玻璃"]);
    expect(state.showSchemeCard).toBe(true);
    expect(state.showModeCard).toBe(true);
    expect(state.schemeOptionLabels).toEqual(["默认", "暖黄", "橄榄", "冷蓝"]);
    expect(state.themeModeOptions).toEqual(["system", "light", "dark"]);
    expect(state.currentThemeText).toBe("默认主题 · 默认 · 跟随系统");
  });

  it("未登录切主题只做预览，不立即落缓存", async () => {
    const switched = await page.callMethod("automatorSelectThemeFamily", "default");
    expect(switched.effectiveSkin).toBe("default");

    const previewState = await page.callMethod("automatorSelectThemeFamily", "fresh-ingredient");
    expect(previewState.effectiveSkin).toBe("fresh-ingredient");
    expect(previewState.persistedThemeSkin).toBe("default");
    expect(previewState.loginModalVisible).toBe(false);
  });

  it("未登录点击使用按钮会先呼起登录，再登录成功后才保存主题", async () => {
    await page.callMethod("automatorSelectThemeFamily", "fresh-ingredient");

    const pendingState = await page.callMethod("automatorConfirmThemeSelection");
    expect(pendingState.effectiveSkin).toBe("fresh-ingredient");
    expect(pendingState.persistedThemeSkin).toBe("default");
    expect(pendingState.loginModalVisible).toBe(true);

    const savedState = await page.callMethod("automatorApplyThemeLoginSuccess");
    expect(savedState.effectiveSkin).toBe("fresh-ingredient");
    expect(savedState.persistedThemeSkin).toBe("fresh-ingredient");
    expect(savedState.loginModalVisible).toBe(false);
  });

  it("切到默认主题后显示默认主题的色系与模式", async () => {
    const switched = await page.callMethod("automatorSelectThemeFamily", "default");
    expect(switched.effectiveSkin).toBe("default");
    expect(switched.effectivePalette).toBe("default");
    expect(switched.themeOptionLabels).toEqual(["默认主题", "清新食材", "简白", "磨砂玻璃"]);
    expect(switched.showSchemeCard).toBe(true);
    expect(switched.showModeCard).toBe(true);
    expect(switched.schemeOptionLabels).toEqual(["默认", "暖黄", "橄榄", "冷蓝"]);
    expect(switched.themeModeOptions).toEqual(["system", "light", "dark"]);
    expect(switched.currentThemeText).toBe("默认主题 · 默认 · 跟随系统");
  });

  it("未登录离开主题页时，未确认的预览会回滚到已保存主题", async () => {
    await page.callMethod("automatorSelectThemeFamily", "apple-glass");
    const beforeLeave = await page.callMethod("automatorReadState");
    expect(beforeLeave.effectiveSkin).toBe("apple-glass");
    expect(beforeLeave.persistedThemeSkin).toBe("default");

    const rolledBack = await page.callMethod("automatorSimulateLeave");
    expect(rolledBack.effectiveSkin).toBe("default");
    expect(rolledBack.persistedThemeSkin).toBe("default");
  });

  it("切到简白后隐藏色系卡片，但保留模式切换", async () => {
    const state = await page.callMethod("automatorSelectThemeFamily", "minimal-white");
    expect(state.themeMode).toBe("system");
    expect(state.effectiveSkin).toBe("minimal-white");
    expect(state.effectivePalette).toBe("default");
    expect(state.showSchemeCard).toBe(false);
    expect(state.showModeCard).toBe(true);
    expect(state.schemeOptionLabels).toEqual([]);
    expect(state.themeModeOptions).toEqual(["system", "light", "dark"]);
    expect(state.currentThemeText).toBe("简白 · 跟随系统");
  });

  it("切到清新食材后隐藏色系和模式卡片", async () => {
    const state = await page.callMethod("automatorSelectThemeFamily", "fresh-ingredient");
    expect(state.themeMode).toBe("light");
    expect(state.effectiveSkin).toBe("fresh-ingredient");
    expect(state.effectivePalette).toBe("default");
    expect(state.showSchemeCard).toBe(false);
    expect(state.showModeCard).toBe(false);
    expect(state.schemeOptionLabels).toEqual([]);
    expect(state.themeModeOptions).toEqual([]);
    expect(state.currentThemeText).toBe("清新食材");
  });

  it("切到磨砂玻璃后隐藏色系和模式卡片", async () => {
    const glassState = await page.callMethod("automatorSelectThemeFamily", "apple-glass");
    expect(glassState.themeMode).toBe("light");
    expect(glassState.effectiveSkin).toBe("apple-glass");
    expect(glassState.effectivePalette).toBe("default");
    expect(glassState.showSchemeCard).toBe(false);
    expect(glassState.showModeCard).toBe(false);
    expect(glassState.schemeOptionLabels).toEqual([]);
    expect(glassState.themeModeOptions).toEqual([]);
    expect(glassState.currentThemeText).toBe("磨砂玻璃");
  });
});
