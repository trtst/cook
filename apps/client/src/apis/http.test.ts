import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const httpSource = readFileSync(resolve(__dirname, "./http.ts"), "utf8");

test("refresh only clears local session when the refresh endpoint confirms 401", () => {
  assert.match(httpSource, /function isRefreshUnauthorized/);
  assert.match(httpSource, /result\.status === 401/);
  assert.match(httpSource, /result\.body\.code === 401/);
  assert.match(httpSource, /throw new HttpError\(result\.status, "请求失败"\)/);
  assert.match(httpSource, /export async function uploadFile/);
  assert.match(httpSource, /useSessionStore\(\)\.accessToken/);
  assert.match(httpSource, /await refreshAccessToken\(\);[\s\S]*continue;/);
  assert.match(httpSource, /await clearUnauthorized\(new UnauthorizedError\(message\)\)/);
  assert.doesNotMatch(httpSource, /catch \(error\) \{\s*await clearUserSessionState\(\);/);
});
