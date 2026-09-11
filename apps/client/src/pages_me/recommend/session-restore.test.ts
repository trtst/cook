import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

assert.ok(source.includes('import { restoreAppSession } from "@/utils/session";'));
assert.ok(source.includes("await restoreAppSession();"));
assert.ok(source.indexOf("await restoreAppSession();") < source.indexOf("if (!sessionStore.isLoggedIn)"));

console.log("recommend session restore test passed");
