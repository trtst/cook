import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, "index.vue"), "utf8");

assert.match(source, /更换绑定手机号/u);
assert.match(source, /请输入原手机号/u);
assert.match(source, /一个账号30天内只能更换一次手机号/u);
assert.match(source, /确定/u);
assert.match(source, /await refreshSessionUser\(phone\)/u);
assert.match(source, /const authUser = await authApi\.getMe\(\)/u);
assert.match(source, /phone: authUser\.phone/u);
assert.match(source, /function maskPhone\(phone: string\)/u);
assert.match(source, /const changingPhone = isChangingPhone\.value/u);
assert.match(source, /helperText\.value = changingPhone \? "手机号已更换" : "手机号已绑定"/u);
