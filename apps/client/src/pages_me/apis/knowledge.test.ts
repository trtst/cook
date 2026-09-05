/**
 * 厨房知识请求层认证口径测试。
 *
 * 测试文件跟随 `pages_me/apis/knowledge.ts` 放置，确保分包私有请求层
 * 不再通过根 `apis/knowledge` 进入主包。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const knowledgeSource = readFileSync(resolve(__dirname, "./knowledge.ts"), "utf8");
const httpSource = readFileSync(resolve(__dirname, "../../apis/http.ts"), "utf8");

assert.match(
  httpSource,
  /auth\?:\s*boolean\s*\|\s*"optional"/,
  "RequestOptions must support optional auth for public reads with user-specific fields"
);
assert.match(
  httpSource,
  /const shouldClearUnauthorized = auth === true;/,
  "optional auth must not clear local session when the server returns 401"
);
assert.match(
  knowledgeSource,
  /return await get<T>\(url, query, \{ auth: "optional" \}\);/,
  "knowledge public reads should try optional auth without required-auth side effects"
);
assert.match(
  knowledgeSource,
  /return get<T>\(url, query, \{ auth: false \}\);/,
  "knowledge public reads should fall back to anonymous reads after optional auth is rejected"
);
assert.doesNotMatch(
  knowledgeSource,
  /return await get<T>\(url, query\);/,
  "knowledge public reads must not use default required auth"
);

console.log("knowledge api auth tests passed");
