# Review Fixes and Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复上一轮上线 review 发现的营养查询、营养快照失效、菜谱 fixture、回归测试和导入脚本安全问题，并重新完成上线验证。

**Architecture:** 营养食物分类筛选在数据库字段上完成，接口按数据库分页；单个食材营养变更只失效引用该食材的正文版本。菜谱正文契约继续保持 `keywords` 始终为数组，fixture 与持久化同步；测试断言跟随现行全局主题入口。

**Tech Stack:** NestJS、Prisma/PostgreSQL、Vue 3、uni-app、TypeScript、Node test。

**Spec:** 上一轮上线 review 报告与本仓库 `docs/AGENT.md`、`docs/api-database-rules.md`。

## Global Constraints

- 保留现有 staged 边界，不提交、不 reset、不重分组已有用户修改。
- 只修复 review 已确认的问题，不扩展菜谱或营养产品范围。
- 先写回归测试并确认失败，再写最小实现。
- 数据库变更必须可迁移、可索引，并保持营养版本隔离。

---

### Task 1: 修复营养查询成本

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260909140000_nutrient_food_category/migration.sql`
- Modify: `apps/api/scripts/import-food-composition-csv.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Test: `apps/api/src/modules/admin/nutrition-admin.test.ts`

- [x] 写测试验证分类筛选使用可查询字段，并只返回请求页数据。
- [x] 运行测试确认当前实现仍会全量扫描/内存分页。
- [x] 增加 `NutrientFood.category`、导入回写、索引和数据库分页查询。
- [x] 运行营养管理测试和 Prisma 校验。

### Task 2: 精准失效营养快照

**Files:**
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Test: `apps/api/src/modules/admin/nutrition-admin.test.ts`

- [x] 写测试验证修改一个食材只删除包含该食材的菜谱版本快照。
- [x] 运行测试确认当前 `deleteMany({ sourceVersion })` 会误删全部快照。
- [x] 使用正文版本 JSON 中的食材 ID 精准查询并删除快照，保留其他版本。
- [x] 运行营养和菜谱营养测试。

### Task 3: 修复菜谱 fixture、导入测试和主题测试

**Files:**
- Modify: `apps/api/scripts/reset-recipe-fixtures.ts`
- Modify: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`
- Modify: `apps/client/src/composables/useTheme.test.ts`
- Modify: `apps/client/src/themes/skin-material.test.ts`

- [x] 先补测试/断言，确认缺少 `keywords`、`category` mock 和过时主题断言会失败。
- [x] 补齐 fixture 正文和 `keywordsJson`，补齐 Prisma mock 的 category 关联。
- [x] 主题测试改为验证 App 全局入口与实际 fallback 源头。
- [x] 运行 API/Admin/Client 定向测试。

### Task 4: 加固营养 CSV 导入

**Files:**
- Modify: `apps/api/scripts/import-food-composition-csv.ts`
- Test: `apps/api/src/modules/admin/nutrition-admin.test.ts`

- [x] 写测试验证缺少表头、空 foodCode、非法数值会被拒绝并给出行号。
- [x] 增加表头/必填字段/数值校验，事务导入并报告异常。
- [x] 保持同一来源版本重复执行幂等，清理或显式处理被移除的来源编码。
- [x] 重新执行脚本级静态验证，不直接操作生产数据库。

### Task 5: 全量验证与报告

- [x] 执行 `git diff --cached --check` 和工作树 diff 检查。
- [x] 执行 API/Admin/Client type-check、API/Admin build、微信小程序 build、OpenAPI、Prisma 校验和定向测试。
- [x] 只读核对本地迁移状态与营养数据计数。
- [x] 更新 `docs/plans/minor_change_log.md`，准确记录实际结果和剩余人工门禁。
