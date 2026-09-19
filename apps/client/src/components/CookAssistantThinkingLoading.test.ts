import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

test("cook assistant thinking loading is a full-screen themed overlay", () => {
  const source = readFileSync(resolve(currentDir, "CookAssistantThinkingLoading.vue"), "utf8");

  assert.match(source, /<view v-if="visible" class="cook-assistant-thinking-loading"/);
  assert.match(source, /@click="handleCancel"/);
  assert.match(source, /@click\.stop/);
  assert.match(source, /cancel: \[\]/);
  assert.match(source, /function handleCancel\(\)/);
  assert.match(source, /const THINKING_COPY_INTERVAL_MS = 900;/);
  assert.match(source, /watch\(\s*\(\) => props\.visible/);
  assert.match(source, /position: fixed;/);
  assert.match(source, /z-index: 1500;/);
  assert.match(source, /width: 80rpx;/);
  assert.match(source, /height: 100rpx;/);
  assert.match(source, /animation: flyRight 5s ease-in-out infinite;/);
  assert.match(source, /font-size: var\(--font-size-md\);/);
  assert.match(source, /font-weight: var\(--font-weight-semibold\);/);
  assert.match(source, /\{\{ thinkingCopy \}\}\.\.\./);
  assert.match(source, /background: var\(--color-surface-mask-medium\);/);
  assert.match(source, /backdrop-filter: var\(--material-mask-filter\);/);
  assert.match(source, /var\(--button-primary-gradient-start\)/);
  assert.match(source, /var\(--button-primary-gradient-end\)/);

  for (const copy of [
    "先看看",
    "这道菜怎么做",
    "食材准备中",
    "步骤理一理",
    "顺序排好了",
    "火候也照顾到",
    "每一步都接上",
    "让做饭更从容",
    "马上就可以开做啦"
  ]) {
    assert.match(source, new RegExp(copy));
  }

  assert.equal((source.match(/class="pfile"/g) || []).length, 6);
});
