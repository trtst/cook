import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { THEME_SKIN_PRESETS } from "./presets";

const themeDir = dirname(fileURLToPath(import.meta.url));
for (const preset of THEME_SKIN_PRESETS) {
  assert.equal(
    existsSync(resolve(themeDir, preset.value, "skins.scss")),
    true,
    `${preset.value} should keep its registered skins.scss file`
  );
}

console.log("theme skin registry tests passed");
