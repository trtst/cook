jest.setTimeout(30000);

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
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
    await clearThemeSettings();
    page = await program.reLaunch("/pages_me/theme/index");
    await page.waitFor(".theme-card__title", 8000);
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
    expect(state.themeOptions).toEqual(["default-theme", "fresh-ingredient", "handdrawn-food", "apple-glass"]);
    expect(state.themeOptionLabels).toEqual(["默认主题", "清新食材", "手绘食物", "磨砂玻璃"]);
    expect(state.showSchemeCard).toBe(true);
    expect(state.showModeCard).toBe(true);
    expect(state.schemeOptionLabels).toEqual(["默认", "暖黄", "橄榄", "冷蓝", "简白", "反差"]);
    expect(state.themeModeOptions).toEqual(["system", "light", "dark"]);
    expect(state.currentThemeText).toBe("默认主题 · 默认 · 跟随系统");
  });

  it("切到默认主题后显示默认主题的色系与模式", async () => {
    const switched = await page.callMethod("automatorSelectThemeFamily", "default-theme");
    expect(switched.effectiveSkin).toBe("default");
    expect(switched.effectivePalette).toBe("default");
    expect(switched.themeOptionLabels).toEqual(["默认主题", "清新食材", "手绘食物", "磨砂玻璃"]);
    expect(switched.showSchemeCard).toBe(true);
    expect(switched.showModeCard).toBe(true);
    expect(switched.schemeOptionLabels).toEqual(["默认", "暖黄", "橄榄", "冷蓝", "简白", "反差"]);
    expect(switched.themeModeOptions).toEqual(["system", "light", "dark"]);
    expect(switched.currentThemeText).toBe("默认主题 · 默认 · 跟随系统");
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

  it("切到手绘食物和磨砂玻璃后都隐藏色系和模式卡片", async () => {
    const handdrawnState = await page.callMethod("automatorSelectThemeFamily", "handdrawn-food");
    expect(handdrawnState.themeMode).toBe("light");
    expect(handdrawnState.effectiveSkin).toBe("handdrawn-food");
    expect(handdrawnState.effectivePalette).toBe("default");
    expect(handdrawnState.showSchemeCard).toBe(false);
    expect(handdrawnState.showModeCard).toBe(false);
    expect(handdrawnState.schemeOptionLabels).toEqual([]);
    expect(handdrawnState.themeModeOptions).toEqual([]);
    expect(handdrawnState.currentThemeText).toBe("手绘食物");

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
