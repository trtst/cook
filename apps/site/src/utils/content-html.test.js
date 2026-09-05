import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(import.meta.dirname, "content-html.ts"), "utf8");

assert.ok(source.includes("static\\/uploads"), "Expected site sanitizer to allow API static upload paths.");
assert.ok(source.includes("|uploads"), "Expected site sanitizer to allow static-domain upload paths.");
assert.ok(!source.includes("/api/public-assets/site-content-images"), "Expected site sanitizer not to keep the retired public-assets path.");
