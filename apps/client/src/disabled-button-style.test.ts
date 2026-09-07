import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const membershipCodeSource = readFileSync(resolve(__dirname, "./pages_me/membership-code/index.vue"), "utf8");
const recipeEditSource = readFileSync(resolve(__dirname, "./pages_recipe/edit/index.vue"), "utf8");
const colorsSource = readFileSync(resolve(__dirname, "./styles/colors.scss"), "utf8");

function collectStyleSources(dir: string): Array<{ file: string; source: string }> {
  const entries = readdirSync(dir, { withFileTypes: true });
  const sources: Array<{ file: string; source: string }> = [];

  for (const entry of entries) {
    const file = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      sources.push(...collectStyleSources(file));
      continue;
    }

    if (!entry.isFile() || !/\.(vue|scss|css)$/.test(entry.name)) {
      continue;
    }

    if (statSync(file).size === 0) {
      continue;
    }

    sources.push({ file, source: readFileSync(file, "utf8") });
  }

  return sources;
}

test("disabled button visuals use explicit disabled classes instead of disabled attribute selectors", () => {
  const sources = [membershipCodeSource, recipeEditSource];

  for (const source of sources) {
    assert.doesNotMatch(source, /\.[\w-]+(?:__[\w-]+)?(?:\.[\w-]+(?:__[\w-]+)?)?\[disabled\]/);
  }

  assert.match(membershipCodeSource, /'redeem-button--disabled': !canSubmit \|\| submitting/);
  assert.match(recipeEditSource, /'sheet-confirm--disabled': ingredientConfirmDisabled/);
  assert.match(recipeEditSource, /'sheet-confirm--disabled': ingredientCreateSubmitting/);
  assert.match(recipeEditSource, /'sheet-creator__button--disabled': categorySubmitting \|\| !categoryDraftName\.trim\(\)/);
});

test("global button styles do not depend on native disabled selectors", () => {
  const forbiddenSelector = /(?:wx-button|button|\.[\w-]+(?:__[\w-]+)?(?:--[\w-]+)?)\s*\[disabled\](?:\s*\[type=['"]?default['"]?\])?|\[disabled\]\s*:not\(\[type\]\)/;

  for (const { file, source } of collectStyleSources(__dirname)) {
    assert.doesNotMatch(source, forbiddenSelector, file);
  }

  assert.match(colorsSource, /button\s*\{[^}]*margin:\s*0;[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*color:\s*inherit;[^}]*font:\s*inherit;[^}]*line-height:\s*inherit;[^}]*\}/s);
  assert.match(colorsSource, /button::after\s*\{[^}]*border:\s*0;[^}]*display:\s*none;[^}]*\}/s);
});

test("native button elements do not set disabled attributes", () => {
  const forbiddenButtonDisabled = /<button\b[^>]*(?:\s:disabled=|\sdisabled(?:=|\s|>))/;

  for (const { file, source } of collectStyleSources(__dirname)) {
    assert.doesNotMatch(source, forbiddenButtonDisabled, file);
  }
});
