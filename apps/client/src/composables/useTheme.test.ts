import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(resolve(__dirname, "../components/Layout/Layout.vue"), "utf8");
const useThemeSource = readFileSync(resolve(__dirname, "./useTheme.ts"), "utf8");
const colorsSource = readFileSync(resolve(__dirname, "../styles/colors.scss"), "utf8");
const clientSrc = resolve(__dirname, "..");

assert.doesNotMatch(layoutSource, /:style="themeVars"/);
assert.match(layoutSource, /class="layout__theme"/);
assert.match(layoutSource, /:class="\[themeClasses, \{ 'layout__theme--with-tabbar': showTabbar, 'layout__theme--full-screen': fullScreen \}\]"/);
assert.match(layoutSource, /virtualHost:\s*true/);
assert.match(layoutSource, /<style scoped lang="scss">\s*@use "@\/styles\/colors\.scss";/);
assert.match(layoutSource, /@use "@\/themes\/skins\.scss";/);
assert.doesNotMatch(layoutSource, /<view class="layout"[^>]*:class=/);
assert.doesNotMatch(useThemeSource, /buildThemeVars|getThemeSeed|theme-vars/);
assert.match(useThemeSource, /"--color-page":\s*themePageColor\(/);
assert.match(useThemeSource, /default:\s*"#fff"/);
assert.match(useThemeSource, /warm:\s*"#fbf4e5"/);
assert.match(useThemeSource, /"apple-glass":\s*\{\s*light:\s*\{\s*default:\s*"#eef1f4"/);
assert.match(colorsSource, /@mixin theme-derived-colors\(\s*\$bg,\s*\$surface,\s*\$text,\s*\$primary,\s*\$secondary,/);
assert.match(colorsSource, /--color-primary:\s*var\(--theme-primary\);/);
assert.match(colorsSource, /@include theme-derived-colors\(#f4f7f5, #ffffff, #17231d, #216e4e, #dff1e8, #ffffff, #17231d\);/);
assert.doesNotMatch(colorsSource, /@include theme-derived-colors;/);

function collectVueFiles(dir: string) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const target = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectVueFiles(target));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".vue")) {
      files.push(target);
    }
  }

  return files;
}

const pageVueFiles = collectVueFiles(clientSrc).filter((file) => /\/pages(?:_|\/)/.test(file));
for (const file of pageVueFiles) {
  const source = readFileSync(file, "utf8");
  const layoutTags = source.match(/<Layout\b[\s\S]*?>/g) ?? [];
  for (const layoutTag of layoutTags) {
    assert.match(layoutTag, /:class="themeClasses"/, `${file} Layout host must carry themeClasses for mini-program slot inheritance`);
  }
}

console.log("useTheme layout contract tests passed");
