# 计划：饭搭子命名迁移

> **已被后续计划替代（2026-07-20）**：本文只处理 `Restaurant -> DiningGroup` 命名迁移，不包含已经确认的唯一活跃饭搭子、原空间、迁入迁出、饭局、口味、Free/Plus 和空间规则。后续工作以 `../dining-group.md`、`../configuration.md` 和 `dining-group-lifecycle-plan.md` 为准；本文保留为历史迁移记录。

## 目标

- 将当前不准确的 `Restaurant / 餐厅` 概念迁移为 `DiningGroup / 饭搭子`。
- 先稳定核心命名、接口、数据表和后台文案，再继续做后续业务。
- 迁移后，`DiningGroup` 表示一组长期一起决定吃什么、维护菜谱、冰箱和购物清单的人。

## 命名标准

| 层级 | 标准 |
| --- | --- |
| 中文产品名 | 饭搭子 |
| 英文模型名 | DiningGroup |
| 表名 | `dining_groups` |
| 成员表名 | `dining_group_members` |
| 主键字段 | `diningGroupId` |

替换关系：

| 旧名 | 新名 |
| --- | --- |
| Restaurant | DiningGroup |
| RestaurantMember | DiningGroupMember |
| RestaurantRole | DiningGroupRole |
| RestaurantSummary | DiningGroupSummary |
| restaurantId | diningGroupId |
| restaurants | dining_groups |
| restaurant_members | dining_group_members |
| 餐厅 | 饭搭子 |

## 范围

- 包含：
  - `packages/domain` 类型命名
  - `packages/api-client` 契约命名
  - `apps/api` DTO、Controller、Service、Prisma schema、migration、seed
  - `apps/admin` 菜单、页面标题、列表文案
  - 文档中的第一条后台链路命名
- 排除：
  - 不新增菜谱导入
  - 不新增订单、支付、会员
  - 不扩展小程序 UI 设计
  - 不重构无关主题、样式、组件

## 接口调整

旧接口：

```text
GET /restaurants/mine
POST /restaurants
GET /restaurants/{restaurantId}
GET /restaurant-members?restaurantId=...
POST /restaurant-invites
POST /restaurant-invites/{inviteToken}/accept
GET /admin/restaurants
```

新接口：

```text
GET /dining-groups/mine
POST /dining-groups
GET /dining-groups/{diningGroupId}
GET /dining-group-members?diningGroupId=...
POST /dining-group-invites
POST /dining-group-invites/{inviteToken}/accept
GET /admin/dining-groups
```

兼容策略：

- 第一阶段直接迁移内部开发接口，不保留旧 `restaurant` 路由兼容。
- 如果小程序端还有旧调用，跟随本次迁移同步改名。
- 后续正式发布后再引入兼容策略，当前不增加冗余兼容层。

## 数据迁移

当前数据库仍处于本地开发阶段，可以直接通过 Prisma migration 做表重命名：

```sql
ALTER TABLE restaurants RENAME TO dining_groups;
ALTER TABLE restaurant_members RENAME TO dining_group_members;
```

字段迁移：

```text
owner_id 保持不变
restaurant_id -> dining_group_id
```

枚举迁移：

```text
RestaurantRole -> DiningGroupRole
RestaurantStatus -> DiningGroupStatus
```

默认 seed：

```text
我们家餐厅 -> 我的饭搭子
```

## 任务清单

- [ ] 更新 `packages/domain` 类型：`Restaurant*` -> `DiningGroup*`
- [ ] 更新 `packages/api-client` 契约和请求方法
- [ ] 更新 `apps/api` Prisma schema 和 migration
- [ ] 更新 `apps/api` DTO、Controller、Service、Guard 相关命名
- [ ] 更新 seed 默认数据
- [ ] 更新 `apps/admin` 页面、菜单和接口调用
- [ ] 更新小程序端现有 API 调用命名
- [ ] 更新 `docs/api-contract.md`
- [ ] 运行迁移、seed 和构建检查

## 验收

- API：
  - `POST /admin/auth/login` 登录成功
  - `GET /admin/dining-groups` 返回 seed 的 `我的饭搭子`
  - 未带 admin token 访问返回 `401`
  - 低后台版本访问返回 `426`
- 数据：
  - `dining_groups` 有 1 条 seed 数据
  - `dining_group_members` 有 1 条成员数据
  - 不再依赖 `restaurants` / `restaurant_members` 表
- 后台：
  - 菜单显示 `饭搭子查询`
  - 列表字段不再出现 `餐厅`
- 验证命令：

```bash
pnpm --filter @next-meal/api exec prisma validate
pnpm --filter @next-meal/api type-check
pnpm --filter @next-meal/api build
pnpm --filter @next-meal/admin build
```

## 回滚

- 当前仍是开发库，若迁移失败，可回滚本次代码改动并重建本地数据库。
- 回滚后检查：
  - Prisma migration 状态
  - 后台登录
  - 旧 `restaurants` 表和接口是否恢复
