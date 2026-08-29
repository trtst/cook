# 首页改版实施单

## 目标

按已确认方案完成首页改版，首页结构收口为：

1. `Hero` 只承载运营大图与跳转。
2. `左1右2` 区中，左侧为“这周吃饭安排”状态聚合主卡，右侧两张保留运营位。
3. 保留 `4` 个固定动作入口，语义改为动作而非模块目录。
4. `最近安排` 继续按 `24~36h` 规则条件显示。
5. `基于当前库存推荐` 与 `清单和冰箱` 继续保留，但职责与空态重新收口。

## 实施范围

### 前端

- `apps/client/src/pages/home/index.vue`
- `apps/client/src/apis/home.ts`
- `apps/client/src/pages/home/index.test.js`

### 后端

- `apps/api/src/modules/home/home.controller.ts`
- `apps/api/src/modules/home/home.service.ts`
- `apps/api/src/contracts/types.ts`
- `apps/api/src/contracts/openapi.ts`

### 文档

- `docs/api-contract.md`
- `docs/plans/minor_change_log.md`

## 数据设计

新增首页周状态聚合接口，服务左侧主卡：

- `GET /api/home/week-overview`
- 返回：
  - 当前主卡状态
  - 主文案、副文案、主动作文案
  - 主跳转目标
  - 本周已安排天数
  - 最近待处理餐次摘要
  - `7` 天轻量状态条

## 实施说明

1. 复用现有 `MAIN` 首页运营配置位作为 `Hero` 大图来源，不新增新的后台配置入口。
2. 左侧主卡不新建独立落地页，只按状态跳转到真实页面；展示层只保留 `title / subtitle / action`，不再保留重复栏目名与弱价值 meta 行。
3. `4` 个动作入口保留现有坑位，但改为动作文案，并在前端做最小智能分发。
4. 本轮不新增数据库表或 migration。

## 验证

- `pnpm --filter @next-meal/api type-check`
- `pnpm --filter @next-meal/client type-check`
- `node --check apps/client/src/pages/home/index.test.js`
- `git diff --check -- apps/api/src/contracts/openapi.ts apps/api/src/contracts/types.ts apps/api/src/modules/home/home.controller.ts apps/api/src/modules/home/home.service.ts apps/client/src/apis/home.ts apps/client/src/pages/home/index.vue apps/client/src/pages/home/index.test.js docs/api-contract.md docs/plans/minor_change_log.md docs/plans/homepage-refresh-2026-08-27.md`
