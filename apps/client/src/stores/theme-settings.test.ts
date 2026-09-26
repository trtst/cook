import assert from "node:assert/strict";
import { resolveThemeSettingsSnapshot } from "./theme-settings";

const defaultSettings = (themeMode: "system" | "light" | "dark") => ({
  themeMode,
  themeSkin: "default",
  themePalette: "default"
});

assert.deepEqual(resolveThemeSettingsSnapshot(null), defaultSettings("system"));

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "dark",
    themeSkin: "default",
    themePalette: "cool" as unknown as never
  }),
  { themeMode: "dark", themeSkin: "default", themePalette: "glacier" }
);

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "light",
    themeSkin: "minimal-white" as unknown as never,
    themePalette: "sprout" as unknown as never
  }),
  { themeMode: "light", themeSkin: "default", themePalette: "default" }
);

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "dark",
    themeSkin: "apple-glass" as unknown as never,
    themePalette: "blue" as unknown as never
  }),
  { themeMode: "dark", themeSkin: "default", themePalette: "default" }
);

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "invalid" as unknown as never,
    themeSkin: "missing" as unknown as never,
    themePalette: "missing" as unknown as never
  }),
  defaultSettings("system")
);

console.log("theme settings tests passed");
