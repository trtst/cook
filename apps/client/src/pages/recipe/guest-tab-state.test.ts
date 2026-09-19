import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.match(
  source,
  /function switchTab\(tab: RecipeTab\) \{[\s\S]*?const previousTab = activeTab\.value;[\s\S]*?activeTab\.value = tab;/,
  "Expected clicking the private tab to change tabs before any login action."
);
assert.doesNotMatch(
  source,
  /function switchTab\(tab: RecipeTab\) \{[\s\S]*?if \(tab === "my" && !sessionStore\.isLoggedIn\) \{[\s\S]*?loginModalStore\.open\(/,
  "Expected the private tab itself not to open login for guests."
);
assert.doesNotMatch(
  source,
  /const currentTab = activeTab\.value;[\s\S]*?if \(!canReadRecipe\(currentTab, sessionStore\.isLoggedIn\)\) \{[\s\S]*?activeTab\.value = "inspiration";/,
  "Expected guest private-tab state not to be redirected to inspiration."
);
assert.match(
  source,
  /if \(currentTab === "my"\) \{[\s\S]*?if \(!sessionStore\.isLoggedIn\) \{[\s\S]*?myRecipes\.value = \[\];[\s\S]*?success = true;/,
  "Expected guest private-tab loading to settle into the default empty state without an API request."
);
assert.match(
  source,
  /function handleEmptyClick\(\) \{[\s\S]*?if \(!sessionStore\.isLoggedIn\) \{[\s\S]*?loginModalStore\.open\(/,
  "Expected clicking the private empty state to open login."
);
assert.ok(source.includes('<template #navbar-center>'), "Expected the recipe home Navbar tabs to remain mounted.");

console.log("recipe guest tab state passed");
