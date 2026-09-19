import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

test("shared cook assistant unlock sheet keeps the compact unlock copy", () => {
  const sheetPath = resolve(currentDir, "CookAssistantUnlockSheet.vue");
  assert.ok(existsSync(sheetPath), "Expected the shared cook assistant unlock sheet to exist");
  const source = readFileSync(sheetPath, "utf8");

  assert.match(source, /title="炊火智厨"/);
  assert.match(source, /当前可用次数/);
  assert.match(source, /remainingCount/);
  assert.match(source, /立即解锁/);
  assert.match(source, /AI 智能分析当前菜谱，拆解烹饪步骤与操作要点，让你边看边做更轻松。/);
  assert.doesNotMatch(source, /loader-con|pfile|thinkingCopy|THINKING_COPY_INTERVAL/);
  assert.doesNotMatch(source, /前期准备|开做步骤|收尾上桌|步骤计时|自动翻页|闹钟提醒/);
});
