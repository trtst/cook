import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "./theme-vars.test";

const layoutSource = readFileSync(resolve(__dirname, "../components/Layout/Layout.vue"), "utf8");

assert.match(layoutSource, /<view class="layout" :style="themeVars">/);
assert.match(layoutSource, /class="layout__theme"/);
assert.match(layoutSource, /:class="\[themeClasses, \{ 'layout__theme--with-tabbar': showTabbar, 'layout__theme--full-screen': fullScreen \}\]"/);
assert.doesNotMatch(layoutSource, /<view class="layout"[^>]*:class=/);

console.log("useTheme layout contract tests passed");
