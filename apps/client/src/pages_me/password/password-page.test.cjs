const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const source = readFileSync(resolve(__dirname, "./index.vue"), "utf8");

assert.doesNotMatch(source, /class="password-hero"/);
assert.doesNotMatch(source, /pageDescription/);
assert.ok(source.indexOf('class="password-strength__text"') < source.indexOf('class="password-strength__bar"'));
assert.ok(source.indexOf('class="password-strength__bar"') < source.indexOf('class="password-footnote"'));
assert.match(source, /<text class="password-strength__text">\{\{ errorText \|\| " " \}\}<\/text>/);
assert.doesNotMatch(source, /<text v-if="errorText" class="password-error">/);
assert.match(source, /if \(!newPassword\.value\) return "0%"/);
assert.doesNotMatch(source, /Math\.max\(12,/);
assert.match(source, /maxlength="20"[\s\S]*placeholder="请输入新密码"/);
assert.match(source, /maxlength="20"[\s\S]*placeholder="请再次输入新密码"/);
assert.match(source, /密码需要 8-20 位字符，至少包含字母、数字、符号中的两种。/);
assert.match(source, /return "密码需要 8-20 位字符"/);
assert.match(source, /return "密码需至少包含字母、数字、符号中的两种"/);

console.log("password page structure tests passed");
