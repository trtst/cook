import assert from "node:assert/strict";
import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  formatThemeText,
  THEME_MODE_LABELS,
  THEME_PALETTE_LABELS,
  THEME_PICKER_SKINS,
  THEME_SKIN_LABELS,
  THEME_SKIN_PRESETS,
  THEME_SOURCE_MODE_LABELS
} from "./presets";

assert.deepEqual(THEME_PICKER_SKINS, ["default", "fresh-ingredient", "minimal-white", "apple-glass", "handdrawn-food", "bold-contrast"]);
assert.equal(THEME_SKIN_LABELS["minimal-white"], "简白");
assert.equal(THEME_SKIN_LABELS["apple-glass"], "磨砂玻璃");
assert.equal(THEME_MODE_LABELS.dark, "深色");
assert.equal(THEME_PALETTE_LABELS.cool, "冷蓝");
assert.equal(THEME_SOURCE_MODE_LABELS.mono, "单主题色");
assert.equal(THEME_SOURCE_MODE_LABELS.duo, "双色主题");
assert.equal(formatThemeText("light", "minimal-white", "default", false), "浅色 · 简白");
assert.equal(DEFAULT_THEME_SKIN, "default");
assert.equal(DEFAULT_THEME_PALETTE, "default");
assert.equal(THEME_SKIN_LABELS[DEFAULT_THEME_SKIN], "默认主题");
assert.equal(formatThemeText("system", "default", "warm", true), "跟随系统 · 默认主题 · 暖黄");
assert.equal(THEME_SKIN_PRESETS.find((preset) => preset.value === "minimal-white")?.sourceMode, "mono");
assert.equal(THEME_SKIN_PRESETS.find((preset) => preset.value === "default")?.sourceMode, "duo");

const defaultPreset = THEME_SKIN_PRESETS.find((preset) => preset.value === DEFAULT_THEME_SKIN);
const freshPreset = THEME_SKIN_PRESETS.find((preset) => preset.value === "fresh-ingredient");
const minimalPreset = THEME_SKIN_PRESETS.find((preset) => preset.value === "minimal-white");

assert.ok(defaultPreset, "default theme preset must exist");
assert.ok(freshPreset, "fresh-ingredient preset must exist");
assert.ok(minimalPreset, "minimal-white preset must exist");
assert.equal(defaultPreset.sourceMode, "duo");
assert.equal(defaultPreset.supportsPalette, true);
assert.equal(defaultPreset.supportsDark, true);
assert.deepEqual(defaultPreset.seeds.default?.light, {
  bg: "#f4f7f5",
  surface: "#ffffff",
  text: "#17231d",
  primary: "#216e4e",
  secondary: "#dff1e8"
});
assert.equal(freshPreset.sourceMode, "duo");
assert.equal(freshPreset.supportsPalette, false);
assert.equal(freshPreset.supportsDark, false);
assert.deepEqual(freshPreset.seeds.default?.light, {
  bg: "#f4f7f5",
  surface: "#ffffff",
  text: "#17231d",
  primary: "#216e4e",
  secondary: "#dff1e8"
});
assert.equal(minimalPreset.supportsDark, true);
assert.deepEqual(minimalPreset.seeds.default?.dark, {
  bg: "#101211",
  surface: "#171a18",
  text: "#f5f7f6",
  primary: "#9db488"
});

for (const preset of THEME_SKIN_PRESETS) {
  assert.equal(preset.supportsPalette, preset.palettes.length > 0, `${preset.value} palette capability should match palette declarations`);
  assert.deepEqual(
    Object.keys(preset.seeds).sort(),
    (preset.supportsPalette ? preset.palettes : [DEFAULT_THEME_PALETTE]).slice().sort(),
    `${preset.value} should only define seeds for declared palettes`
  );
  assert.equal(Boolean(preset.seeds[DEFAULT_THEME_PALETTE]), true, `${preset.value} should define the fallback palette seed`);
  const fallbackSeedSet = preset.seeds[DEFAULT_THEME_PALETTE];
  const fallbackDarkSeed = fallbackSeedSet && "dark" in fallbackSeedSet ? fallbackSeedSet.dark : undefined;

  assert.equal(Boolean(fallbackDarkSeed), preset.supportsDark, `${preset.value} dark capability should match fallback seed`);

  for (const seedSet of Object.values(preset.seeds)) {
    if (!seedSet) continue;

    if (!preset.supportsDark) {
      const darkSeed = "dark" in seedSet ? seedSet.dark : undefined;

      assert.equal(darkSeed, undefined, `${preset.value} should not define dark seeds when dark mode is disabled`);
    }

    for (const seed of [seedSet.light, seedSet.dark].filter(Boolean)) {
      assert.equal(
        preset.sourceMode,
        seed.secondary ? "duo" : "mono",
        `${preset.value} source mode should match every seed source count`
      );
      assert.deepEqual(
        Object.keys(seed).sort(),
        (seed.secondary ? ["bg", "primary", "secondary", "surface", "text"] : ["bg", "primary", "surface", "text"]).sort(),
        `${preset.value} should only expose 1-color or 2-color theme sources`
      );
      assert.equal("accent" in seed, false, `${preset.value} should not expose legacy accent source`);
    }
  }
}

console.log("theme presets tests passed");
