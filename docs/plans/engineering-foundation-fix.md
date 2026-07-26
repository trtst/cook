# 工程基础修复执行记录

## 状态

- 执行日期：2026-07-24。
- 当前结论：工程基础问题已修复，可以继续业务开发；不代表业务模块已经验收或具备上线条件。
- 数据前提：项目尚未上线，本地开发库允许清空重建，不提供旧数据兼容和回填。

## 本轮范围

1. 修复通用幂等记录的并发竞争窗口。
2. 为管理员写操作增加独立幂等身份和审计身份。
3. 将菜谱下架、恢复和举报处理放入“状态变更、审计、幂等结果”同一事务。
4. 管理端菜谱按钮只展示后端允许的状态转换。
5. 统一模块状态，区分工程基础、开发中、已验收、延期、禁用和保留。
6. 将尚未确认的业务问题登记到 `business-development-todo.md`。

## 本轮不做

1. 不确定饭局参与者最终唯一性规则。
2. 当时未确认菜谱收藏、升级和再次导入原版的最终契约；该产品问题现已转由 `recipe-execution.md` 接管，本文不追溯修改已实施代码。
3. 不确定购物缺口重复生成规则。
4. 不实现空间账本全量重算和最终计量口径。
5. 不实现菜谱图片、背景图上传和资产管理。

## 实际实现

- 通用幂等查询在事务中按操作者、操作类型和 `operationId` 获取 PostgreSQL 事务级 advisory lock。
- 菜谱、冰箱和购物创建的幂等查询移动到业务事务内。
- `IdempotencyRecord` 增加管理员归属，用户和管理员归属互斥。
- `AuditEvent` 增加管理员归属，用户、管理员和系统身份由数据库约束校验。
- 审计操作者外键使用 `RESTRICT`，避免物理删除破坏审计身份。
- 管理端相同请求重放返回第一次结果；参数变化复用同一 `operationId` 返回 `409`。

## 验证记录

1. 清空本地开发库，从第一条 migration 执行到最新 migration，并完成 seed。
2. `pnpm type-check` 通过。
3. `pnpm build:api` 通过。
4. `pnpm build:admin` 通过；保留主包超过 500 kB 的既有警告。
5. `pnpm verify:recipe-flow` 通过，相同 `operationId` 并发创建返回同一菜谱。
6. `pnpm verify:admin-recipe-flow` 通过，并发下架、恢复和举报处理只写一次审计。
7. `pnpm verify:openapi` 通过，共 50 个操作、48 个响应 Schema。
8. `pnpm verify:login-flow`、`verify:dto-flow` 和 `verify:admin-readonly-flow` 通过。
9. `pnpm verify:meal-pantry-flow` 和 `verify:dining-group-flow` 工程流程通过；对应业务规则仍保持开发中，不能据此标记业务已验收。
10. Prisma 共识别 18 个 migration，数据库状态为最新。
11. `git diff --check` 通过。

## 后续入口

业务开发到饭局、菜谱导入、购物缺口、空间计量和图片能力时，先读取 `business-development-todo.md`，再建立对应功能执行单。To-do 只防止遗漏，不作为契约确认。
