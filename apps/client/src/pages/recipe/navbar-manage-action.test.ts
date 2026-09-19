import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./index.vue"), "utf8");
const fontSource = readFileSync(resolve(__dirname, "../../assets/fonts/font.scss"), "utf8");
const navbarCenter = source.match(/<template #navbar-center>([\s\S]*?)<\/template>/)?.[1] ?? "";
const manageStyle = source.match(/\.manage-fab \{([\s\S]*?)\n\}/)?.[1] ?? "";
const manageIconStyle = source.match(/\.manage-fab__icon \{([\s\S]*?)\n\}/)?.[1] ?? "";
const recipeNavbarStyle = source.match(/\.recipe-navbar \{([\s\S]*?)\n\}/)?.[1] ?? "";

assert.match(source, /<Layout[^>]*:navbar-capsule-guard="true"/);
assert.match(navbarCenter, /class="recipe-navbar"/);
assert.match(navbarCenter, /v-if="sessionStore\.isLoggedIn && activeTab !== 'inspiration'"/);
assert.match(navbarCenter, /class="manage-fab"/);
assert.match(navbarCenter, /icon-manage-add manage-fab__icon/);
assert.match(navbarCenter, /@click="handleFab"/);
assert.ok(!source.includes("manage-fab__text"), "Expected the manage action to be icon-only");
assert.ok(!source.includes("fabText"), "Expected the manage action copy state to be removed");
assert.match(fontSource, /\.icon-manage-add::before \{[\s\S]*?content: "\\e6db";/);
assert.ok(!source.includes("<template #navbar-right>"), "Expected the manage action not to render inside the capsule-reserved slot");
assert.ok(!source.includes("manage-fab--hidden"), "Expected the Navbar action not to hide with list scrolling");
assert.ok(!source.includes("const fabHidden"), "Expected the old floating-button visibility state to be removed");
assert.ok(!source.includes("let scrollTimer"), "Expected the old floating-button scroll timer to be removed");
assert.ok(!source.includes('@scroll="handleListScroll"'), "Expected list scrolling not to control the Navbar action");

for (const snippet of ["display: flex;", "align-items: center;", "justify-content: center;"]) {
  assert.ok(manageStyle.includes(snippet), `Expected Navbar action style: ${snippet}`);
}

assert.ok(manageIconStyle.includes("color: var(--color-text);"), "Expected the manage icon to use the default text color");
for (const snippet of ["padding:", "background:", "box-shadow:"]) {
  assert.ok(!manageStyle.includes(snippet), `Expected icon-only Navbar action style to exclude: ${snippet}`);
}

assert.ok(recipeNavbarStyle.includes("justify-content: space-between;"), "Expected the tabs and manage action to align across the Navbar center");

for (const snippet of ["position: fixed;", "bottom:", "transform:", "transition:"]) {
  assert.ok(!manageStyle.includes(snippet), `Expected Navbar action style to exclude: ${snippet}`);
}

console.log("recipe Navbar manage action tests passed");
