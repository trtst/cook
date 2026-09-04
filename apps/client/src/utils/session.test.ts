import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, "session.ts"), "utf8");

test("old restored sessions without phone refresh their auth summary", () => {
	assert.match(source, /await restoreAuthUserSummary\(\)/);
	assert.match(source, /if \(!sessionStore\.isLoggedIn \|\| !sessionStore\.user \|\| "phone" in sessionStore\.user\) return;/);
	assert.match(source, /const authUser = await authApi\.getMe\(\)/);
	assert.match(source, /phone: authUser\.phone/);
});
