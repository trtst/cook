# Recipe Appropriate Amount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完整支持唯一模糊用量“适量”，并统一 JSON 导入、正式菜谱、营养状态、后台和小程序交互。

**Architecture:** 复用现有 `EXACT | FUZZY` 正文结构，不新增系统单位或数据库迁移。API 统一把模糊值收口为“适量”；JSON 导入用 `quantity/unit/fuzzyText` 互斥字段；前端仅切换当前分支，营养计算把任何 `FUZZY` 正文降为最高 `ESTIMATED`。

**Tech Stack:** NestJS、TypeScript、Prisma JSON 正文、Vue 3、uni-app、Element Plus、Node test。

**Spec:** `docs/superpowers/specs/2026-09-16-recipe-appropriate-amount-design.md`

## Global Constraints

- “适量”不是系统单位，不修改 `Unit`、单位种子或 Prisma schema。
- 模糊用量只允许“适量”，新写入拒绝“少许 / 按需”。
- “适量”只允许当前系统分类代码为 `SEASONING` 的食材；服务端按真实 `ingredientId` 校验。
- 精确与模糊数据互斥；切换到“适量”清空数量和单位，切回不恢复数量。
- 已绑定食材名称只读，更换食材通过选择器完成；更换为非调味料时清除“适量”。
- 只要正文存在模糊用量，营养状态不得为 `COMPLETE`。
- 不重构无关模块，不覆盖工作区现有改动，不提交 Git，除非用户另行要求。

---

### Task 1: 收口 API 用量契约

**Files:** `apps/api/src/contracts/types.ts`、`dtos.ts`、`openapi.ts`、`apps/api/src/modules/auth/admin.controller.ts`、`apps/client/src/apis/recipe.ts`、`apps/admin/src/apis/recipe.ts`。

**Interfaces:** 输出 `RecipeAmountInput = EXACT | { kind: "FUZZY"; text: "适量" }`，草稿和导入输出 `fuzzyText: "适量" | null`。

- [x] 写失败契约测试，断言 DTO/OpenAPI 只暴露“适量”并拒绝“少许 / 按需”。
- [x] 运行定向测试，确认因旧枚举失败。
- [x] 最小化收窄三端类型、DTO、OpenAPI 和控制器映射。
- [x] 运行定向测试与三端类型检查。

### Task 2: 打通 `recipe.import.v1` 模糊用量

**Files:** `apps/api/src/modules/admin/recipe-import-json.ts`、`recipe-import-json.test.ts`、`admin.recipe-import.service.test.ts`、`apps/admin/src/pages/RecipeDetailPage.vue`。

**Interfaces:** 精确行是 `{ quantity: string, unit: string, fuzzyText: null }`；模糊行是 `{ quantity: null, unit: null, fuzzyText: "适量" }`。

- [x] 写失败解析测试，覆盖接受“适量”、拒绝混填、拒绝其他模糊文本及正确导出。
- [x] 运行 `recipe-import-json` 测试确认 RED。
- [x] 修改解析和 `rebuildJsonItemState`，模糊行不要求数量与单位。
- [x] 修改系统菜谱 JSON 导出映射并运行解析、发布测试确认 GREEN。

### Task 3: 保证营养状态降级

**Files:** `apps/api/src/modules/recipe/recipe-nutrition.ts`、`recipe-nutrition.test.ts`。

**Interfaces:** 含 `FUZZY` 时只返回 `ESTIMATED` 或 `INSUFFICIENT`。

- [x] 写回归测试：精确食材可计算但另有“适量”时为 `ESTIMATED`；全部“适量”时为 `INSUFFICIENT`。
- [x] 运行营养测试，确认现有计算逻辑已符合规则。
- [x] 保持现有实现：不估算模糊食材克重，并禁止 `isComplete` 成立。
- [x] 运行营养测试确认 GREEN。

### Task 4: 收口后台交互

**Files:** `apps/admin/src/pages/RecipeCreatePage.vue`、`RecipeDetailPage.vue`、`RecipeImportItemPage.vue`、`recipe-import-json.test.js`。

**Interfaces:** 后台只提供 `EXACT` 和固定 `FUZZY("适量")`；切回精确分支数量为空。

- [x] 写失败页面结构测试，断言只出现“适量”且切换不恢复旧数量。
- [x] 运行 Admin 定向测试确认 RED。
- [x] 删除“少许 / 按需”选项并统一切换函数。
- [x] 运行页面测试和 Admin type-check 确认 GREEN。

### Task 5: 完成小程序用量选择交互

**Files:** `apps/client/src/pages_recipe/edit/index.vue`、`index.test.js`。

**Interfaces:** `selectFuzzyAmount()` 清空 `quantity`、`unitId` 并写入 `fuzzyText = "适量"`；`selectUnitOption(unitId)` 清空 `fuzzyText`，数量保持空。

- [x] 写失败静态交互测试，断言用量面板存在“适量”、模糊状态隐藏数量输入、切换清空字段。
- [x] 运行 Client 定向测试确认 RED。
- [x] 修改模板和方法，在单位 Sheet 顶部展示“模糊用量 / 适量”。
- [x] 运行页面测试与 Client type-check 确认 GREEN。

### Task 6: 同步权威文档并完成验证

**Files:** `docs/plans/recipe-admin-json-conversion.md`、`docs/recipe.md`、`docs/ingredient.md`、`docs/api-contract.md`、`docs/plans/recipe-contract-review.md`、`docs/plans/recipe-data-completion-rules.md`、`docs/plans/recipe-import-review-workbench-rules.md`、`docs/plans/minor_change_log.md`。

- [x] 删除“正式菜谱禁止模糊用量”的冲突表述。
- [x] 补齐 JSON 示例、字段互斥、交互、营养和购物规则。
- [x] 运行聚焦回归、三端 type-check、OpenAPI 校验和目标 `git diff --check`。
- [x] 逐项核对设计验收条件并记录剩余浏览器、微信端门禁。
