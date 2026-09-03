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

assert.deepEqual(THEME_PICKER_SKINS, ["default", "fresh-ingredient", "minimal-white", "apple-glass"]);
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
const presetValues = THEME_SKIN_PRESETS.map((preset) => String(preset.value));

assert.equal(presetValues.includes("bold-contrast"), false);
assert.equal(presetValues.includes("handdrawn-food"), false);

const defaultPreset = THEME_SKIN_PRESETS.find((preset) => preset.value === DEFAULT_THEME_SKIN);
const freshPreset = THEME_SKIN_PRESETS.find((preset) => preset.value === "fresh-ingredient");
const minimalPreset = THEME_SKIN_PRESETS.find((preset) => preset.value === "minimal-white");
const presetsSourceKeys = THEME_SKIN_PRESETS.flatMap((preset) => Object.keys(preset));

assert.ok(defaultPreset, "default theme preset must exist");
assert.ok(freshPreset, "fresh-ingredient preset must exist");
assert.ok(minimalPreset, "minimal-white preset must exist");
assert.equal(defaultPreset.sourceMode, "duo");
assert.equal(defaultPreset.supportsPalette, true);
assert.equal(defaultPreset.supportsDark, true);
assert.deepEqual(defaultPreset.palettes, ["default", "warm", "olive", "cool"]);
assert.equal(freshPreset.sourceMode, "duo");
assert.equal(freshPreset.supportsPalette, false);
assert.equal(freshPreset.supportsDark, false);
assert.equal(minimalPreset.supportsDark, true);
assert.equal(presetsSourceKeys.includes("seeds"), false, "theme colors belong to skin scss, not preset metadata");

for (const preset of THEME_SKIN_PRESETS) {
  assert.equal(preset.supportsPalette, preset.palettes.length > 0, `${preset.value} palette capability should match palette declarations`);
  assert.deepEqual(
    Object.keys(preset).sort(),
    ["access", "assetType", "label", "palettes", "sourceMode", "supportsDark", "supportsPalette", "value"].sort(),
    `${preset.value} should only expose theme metadata`
  );
}

console.log("theme presets tests passed");
