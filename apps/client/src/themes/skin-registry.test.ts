import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { THEME_SKIN_PRESETS } from "./presets";

const themeDir = dirname(fileURLToPath(import.meta.url));
const svgAssetNames = ["home", "home-active", "recipe", "recipe-active", "me", "me-active"] as const;

assert.equal(
  existsSync(resolve(themeDir, "handdrawn-food", "skins.scss")),
  false,
  "handdrawn-food should be removed from the theme system"
);
assert.deepEqual(
  svgAssetNames.filter(assetName => existsSync(resolve(themeDir, "handdrawn-food", `${assetName}.svg`))),
  [],
  "handdrawn-food should not leave registered svg assets behind"
);

for (const preset of THEME_SKIN_PRESETS) {
  assert.equal(
    existsSync(resolve(themeDir, preset.value, "skins.scss")),
    true,
    `${preset.value} should keep its registered skins.scss file`
  );

  if (preset.assetType !== "svg") continue;

  for (const assetName of svgAssetNames) {
    assert.equal(
      existsSync(resolve(themeDir, preset.value, `${assetName}.svg`)),
      true,
      `${preset.value} should keep svg asset ${assetName}.svg`
    );
  }
}

console.log("theme skin registry tests passed");
