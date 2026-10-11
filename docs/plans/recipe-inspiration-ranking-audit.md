# 灵感私房收藏与推荐排序：旧数据只读审计

## 本次审计

- 日期：2026-10-10
- 目标：`apps/api/.env` 当前配置的本地 PostgreSQL 数据库。
- 方法：`apps/api/scripts/audit-inspiration-private-save.ts`；只读事务，连接目标限定为 localhost/127.0.0.1/::1。
- 执行命令：`pnpm --filter @next-meal/api exec tsx scripts/audit-inspiration-private-save.ts`
- 数据修改：无。

## 结果

| 项目 | 数量 |
| --- | ---: |
| 旧“从灵感创建”个人副本 | 0 |
| 有唯一当前来源候选的旧副本 | 0 |
| 当前来源候选歧义的旧副本 | 0 |
| 找不到当前来源候选的旧副本 | 0 |
| 内容和封面均未改的旧副本 | 0 |
| 存在计划、饭局或采购固定引用的旧副本 | 0 |
| 旧副本关联的固定引用合计 | 0 |
| 现存 RecipeCollection 收藏关系 | 0 |
| 灵感菜谱 `collectCount` 与收藏关系不一致的菜谱 | 0 |

本地库没有可用于历史副本转换、收藏计数重算或引用兼容性抽样的记录。这只能说明当前本地数据库为空或未加载这些历史数据，不能推断其他环境或生产数据库也为零。

## 代码路径盘点

- Client API：`apps/client/src/apis/recipe.ts` 仍提供 `/recipes/from-inspiration`、`/collections`、`/collections/recipes` 相关方法。
- Client 保存流程：`apps/client/src/components/Recipe/AddToPrivateSheet.vue` 仍调用 `createMyRecipeFromInspiration`；Recipe detail 相关测试仍覆盖该旧路径。
- Client 固定版本读取：`apps/client/src/pages_meal/cook-mode/index.vue` 有 `collection` 类型读取分支。固定计划菜谱必须保留可读取的固定版本引用。
- Recipe API：`apps/api/src/modules/recipe/recipe.controller.ts` 仍暴露 `/recipes/from-inspiration` 和合集读取/写入路由；业务逻辑在 `recipe.service.ts`。
- Admin 用户菜谱管理：`apps/admin/src/pages/UserRecipeDomainPage.vue`、`apps/admin/src/apis/user-recipe.ts` 和 Admin Controller/Service 仍展示或读取用户合集。
- 现有底层关系：`RecipeCollection` 唯一键为 `(userId, sourceRecipeId, sourceVersionId)`，可关联多个场景；它引用来源 Recipe 和固定正文版本。旧副本则通过个人 Recipe 的 `originVersionId` 记录派生版本，没有保存直接 `sourceRecipeId`。
- 额外引用路径：`MealPlanDish`、饭局的 bring/wish/menu 固定版本关系、`ShoppingItem` 可继续引用 Recipe 和固定版本；审计脚本逐条统计这些引用。

## 映射边界与处理规则

当前候选来源按灵感菜谱的 `currentVersionId = legacy.originVersionId` 查找。此方式只能证明“当前来源候选”，无法重建来源菜谱已经发布新版本后的完整历史映射；代码模型没有 RecipeContentVersion 到来源 Recipe 的权威历史映射。

可自动转换的最低条件仍为：唯一来源候选、旧个人 Recipe 当前正文版本仍等于 `originVersionId`、封面仍等于 `originCoverImageUrl`，且计划/饭局/采购固定引用行为已核对。未满足任一条件的记录保留为个人菜谱，不自动转换、不删除、不改写引用。收藏计数以有效收藏关系中的 `(userId, sourceRecipeId)` 去重后重算。

## 后续执行状态（2026-10-10）

本节记录的是本地库在收藏关系为空时的只读审计结果，不证明任何其他环境或生产历史为空。后续实现已完成：新 migration `20261010100000_recipe_inspiration_private_saves_ranking` 已应用到本地库，`prisma migrate status` 显示 schema up to date；新库状态不能反向验证历史数据映射。任何有历史数据的数据库在迁移/部署前，仍须对该目标库重跑只读审计并审阅逐条报告。生产数据库连接、生产迁移和部署不在当前授权范围内。
