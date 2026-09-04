import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "./content.ts"), "utf8");

test("site content API separates business code errors from HTTP transport errors", () => {
  assert.match(source, /export class ApiClientError/);
  assert.match(source, /export class HttpError/);
  assert.match(source, /if \(!body\) throw new HttpError\(response\.status, "响应格式不符合契约"\);/);
  assert.match(source, /if \(!response\.ok\) throw new HttpError\(response\.status, "请求失败"\);\n  if \(body\.code !== 0\) throw new ApiClientError\(body\.code, body\.message\);/);
});
