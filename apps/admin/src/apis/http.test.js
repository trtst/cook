import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "./http.ts"), "utf8");

test("admin request layer separates transport errors from envelope business errors", () => {
  assert.match(source, /export class ApiClientError/);
  assert.match(source, /export class HttpError/);
  assert.match(source, /if \(!response\.ok\) throw new HttpError\(response\.status, "请求失败"\);\n\n  if \(body\.code === 401\)/);
  assert.match(source, /if \(body\.code === 401\)[\s\S]*throw error;/);
  assert.match(source, /if \(body\.code !== 0\)[\s\S]*throw new ApiClientError\(body\.code, body\.message, body\.data\);/);
});
