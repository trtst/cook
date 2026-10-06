import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./date.ts", import.meta.url), "utf8")
  .replaceAll("export function", "function")
  .replace(/value: string/g, "value")
  .replace(/value\?: string \| null/g, "value")
  .replace(/emptyText = "-"/g, "emptyText = \"-\"");
const context = {};
vm.createContext(context);
vm.runInContext(
  `${source}
result = {
  valid: formatDateTime("2026-09-03T18:01:58.249Z"),
  empty: formatDateTime(null),
  invalid: formatDateTime("bad-date")
};`,
  context
);

assert.match(context.result.valid, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
assert.equal(context.result.empty, "-");
assert.equal(context.result.invalid, "bad-date");
