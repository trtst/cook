# 菜谱 Wiki 数据分层与派生治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 将系统菜谱、用户菜谱、正文版本、派生数据和客观业务事实的边界写成统一的 Wiki 执行规则，为后续 schema、API 和后台治理实现提供唯一基线。

**Architecture:** 用户发布只校验发布必填正文；服务端把当前正文固定为 `RecipeContentVersion`，再按版本持久化标签、营养和分析等派生结果。运营只能补充派生数据，用户编辑时创建新正文版本并让新版本派生数据重新进入 `PENDING`；收藏、计划、分享等客观事实归属于 `Recipe`，同时保存当时引用的版本快照。

**Tech Stack:** Markdown 规则文档、Prisma/PostgreSQL 数据模型说明、NestJS API 契约说明。

**Spec:** 本次用户确认的 Wiki 数据分层规则，落在 `docs/plans/recipe-wiki-execution.md` 与 `docs/plans/recipe-data-completion-rules.md`。

## Global Constraints

- 系统菜谱统一归属保留 UID `10001` 的系统用户；本次只落规则，不执行迁移或回填。
- 菜谱持久化用量只允许精准数量与系统单位；删除 `FUZZY`、`amount.kind`、`amount.text` 和 `fuzzyText` 规则。
- 用户菜谱满足发布必填项即可发布；描述、小贴士、封面和步骤图片不阻塞发布。
- 派生数据写入数据库并绑定固定正文版本；派生结果不得反向覆盖正文事实。
- 用户编辑创建新正文版本；旧版本派生结果和客观业务事实不被改写。
- 收藏、计划、分享、完成等行为是客观业务事实，不进入版本标签或派生质量数据。
- 保留现有未提交工作，不删除或重写无关代码、迁移和测试。

### Task 1: 更新 Wiki 核心数据分层规则

**Files:**

- Modify: `docs/plans/recipe-wiki-execution.md`
- Modify: `docs/plans/recipe-data-completion-rules.md`

- [x] 将系统用户、用户发布门槛、正文版本、版本派生数据和客观行为事实写入同一数据分层模型。
- [x] 明确运营可补充派生数据但不可修改用户正文；用户编辑后新版本派生数据从 `PENDING` 开始。
- [x] 明确完整度按录入、结构化、标签、营养、助理和功能可用性分别计算，不用单一字段替代原始证据。

### Task 2: 收口精准用量与导入规则

**Files:**

- Modify: `docs/recipe.md`
- Modify: `docs/ingredient.md`
- Modify: `docs/plans/recipe-import-review-workbench-rules.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/plans/recipe-contract-review.md`

- [x] 删除当前规则中对模糊用量的支持描述。
- [x] 统一正文食材输入为 `ingredientId + quantity + unitId`，响应补充食材和单位展示信息。
- [x] 明确导入遇到“适量、少许、按需”时只能进入待修正，不得写入正式菜谱模型。
- [x] 将系统菜谱归属从 `ownerId = null` 的旧口径改为系统用户归属规则。

### Task 3: 标记旧待确认项并同步中央日志

**Files:**

- Modify: `docs/plans/recipe-data-open-questions.md`
- Modify: `docs/plans/recipe-wiki-phase-one-execution.md`
- Modify: `docs/plans/minor_change_log.md`

- [x] 将已由用户确认的 `estimatedCalories` 派生层、精准用量、运营补充和版本重算规则标为确认基线。
- [x] 修正阶段一文档中已删除系统菜谱和旧保留菜谱的过时记录，不改变历史代码事实。
- [x] 增加本次文档变更、未执行迁移和未实现代码的说明。

### Task 4: 文档一致性验证

**Files:**

- Validate: all files changed by Tasks 1-3

- [x] 使用 `rg` 逐处复核当前规则文档：模糊用量只出现在“明确删除/待修正”说明，`ownerId = null` 只保留在历史兼容说明或食材旧规则，不再作为系统菜谱现行契约。
- [x] 使用 `git diff --check` 检查文档格式。
- [x] 使用 `git diff --stat` 与 `git status --short` 复核工作区边界；本轮只继续修改文档，工作区已有的阶段一代码、迁移和测试改动不归入本 Wiki 规则计划。
