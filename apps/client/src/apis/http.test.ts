import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const httpSource = readFileSync(resolve(__dirname, "./http.ts"), "utf8");

test("refresh clears local session when refresh returns business code 401", () => {
  assert.match(httpSource, /function isRefreshUnauthorized/);
  assert.match(httpSource, /result\.status === 401/);
  assert.match(httpSource, /result\.body\.code === 401/);
  assert.match(httpSource, /if \(result\.body\.code !== 0\) throw new ApiClientError/);
  assert.match(httpSource, /if \(result\.status < 200 \|\| result\.status >= 300\) throw new HttpError\(result\.status, "请求失败"\);\n\tif \(result\.body\.code === 401\)/);
  assert.match(httpSource, /export type ApiResult<T>/);
  assert.match(httpSource, /async function readResult<T>/);
  assert.match(httpSource, /if \(result\.body\.code !== 0\)[\s\S]*return \{ ok: false, code: result\.body\.code, message: result\.body\.message, data: result\.body\.data \}/);
  assert.match(httpSource, /export function postResult<T>/);
  assert.match(httpSource, /throw new HttpError\(result\.status, "请求失败"\)/);
  assert.match(httpSource, /export async function uploadFile/);
  assert.match(httpSource, /useSessionStore\(\)\.accessToken/);
  assert.match(httpSource, /await refreshAccessToken\(\);[\s\S]*continue;/);
  assert.match(httpSource, /await clearUnauthorized\(new UnauthorizedError\(message\)\)/);
  assert.doesNotMatch(httpSource, /catch \(error\) \{\s*await clearUserSessionState\(\);/);
});
