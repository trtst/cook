import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, "session.ts"), "utf8");

test("restored authenticated sessions refresh their auth summary", () => {
	assert.match(source, /async function restoreAuthUserSummary\(\)[\s\S]*if \(!sessionStore\.isLoggedIn\) return;[\s\S]*const authUser = await authApi\.getMe\(\)/);
	assert.match(source, /phone: authUser\.phone,[\s\S]*wechatLinked: authUser\.wechatLinked/);
});
