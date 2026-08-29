import assert from "node:assert/strict";
import { resolveThemeSettingsSnapshot } from "./theme-settings";

assert.deepEqual(resolveThemeSettingsSnapshot(null), {
  themeMode: "system",
  themeSkin: "default",
  themePalette: "default"
});

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "dark",
    themeSkin: "bold-contrast",
    themePalette: "default"
  }),
  {
    themeMode: "dark",
    themeSkin: "bold-contrast",
    themePalette: "default"
  }
);

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "light",
    themeSkin: "minimal-white" as unknown as never,
    themePalette: "default"
  }),
  {
    themeMode: "light",
    themeSkin: "minimal-white",
    themePalette: "default"
  }
);

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "light",
    themeSkin: "default",
    themePalette: "missing" as unknown as never
  }),
  {
    themeMode: "light",
    themeSkin: "default",
    themePalette: "default"
  }
);

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "dark",
    themeSkin: "missing" as unknown as never,
    themePalette: "missing" as unknown as never
  }),
  {
    themeMode: "dark",
    themeSkin: "default",
    themePalette: "default"
  }
);

assert.deepEqual(
  resolveThemeSettingsSnapshot({
    themeMode: "light",
    themeSkin: "minimal-white",
    themePalette: "warm" as unknown as never
  }),
  {
    themeMode: "light",
    themeSkin: "minimal-white",
    themePalette: "default"
  }
);

console.log("theme settings tests passed");
