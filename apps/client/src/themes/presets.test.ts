import assert from "node:assert/strict";
import {
  DEFAULT_THEME_PALETTE,
  DEFAULT_THEME_SKIN,
  formatThemeText,
  THEME_MODE_LABELS,
  THEME_PALETTE_LABELS,
  THEME_PALETTE_OPTIONS,
  THEME_PICKER_SKINS,
  THEME_SKIN_LABELS,
  THEME_SKIN_PRESETS
} from "./presets";

assert.deepEqual(THEME_PICKER_SKINS, ["default"]);
assert.deepEqual(THEME_SKIN_PRESETS.map((preset) => preset.value), ["default"]);
assert.deepEqual(THEME_PALETTE_OPTIONS, ["default", "warm", "glacier"]);
assert.equal(THEME_MODE_LABELS.dark, "深色");
assert.deepEqual(THEME_PALETTE_LABELS, { default: "默认", warm: "暖橙", glacier: "冰川蓝" });
assert.deepEqual(THEME_SKIN_LABELS, {
  default: "默认主题"
});
assert.equal(formatThemeText("system", "default", "default", true), "跟随系统 · 默认主题 · 默认");
assert.equal(DEFAULT_THEME_SKIN, "default");
assert.equal(DEFAULT_THEME_PALETTE, "default");

console.log("theme presets tests passed");
