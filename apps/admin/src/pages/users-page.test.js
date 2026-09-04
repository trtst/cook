import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "UsersPage.vue"), "utf8");
const userApiSource = readFileSync(resolve(import.meta.dirname, "../apis/user.ts"), "utf8");

function expectIncludes(snippet, content = source) {
  assert.ok(content.includes(snippet), `Expected source to include: ${snippet}`);
}

expectIncludes("formatDateTime(row.createdAt)");
expectIncludes("formatDateTime(row.updatedAt)");
expectIncludes("formatDateTime(entitlement.membership.validUntil,");
expectIncludes("formatDateTime(entitlement.storage.calculatedAt)");
expectIncludes("查看完整手机号会记录审计日志");
expectIncludes("revealUserPhone");
expectIncludes("revealPhone(userId: UUID)", userApiSource);
expectIncludes("/phone/reveal", userApiSource);
expectIncludes("密码需要 8-20 位字符");
expectIncludes("密码需至少包含字母、数字、符号中的两种");
expectIncludes('maxlength="20" placeholder="8-20 位，至少两类字符"');
