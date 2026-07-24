# 炊火记

炊火记是一个围绕“下一餐”决策闭环构建的家庭餐食小程序工作区。

英文名：`Ember`

Slogan：`炊烟晚，人归缓，烟火暖流年`

它不是菜谱大全，也不是聊天产品。当前产品核心链路是：

`想吃什么 -> 一起决定 -> 确认下一餐 -> 看冰箱 -> 生成购物清单 -> 采购 -> 做饭 -> 留下记忆`

## 当前目标

V1 重点是跑通家庭或长期一起吃饭的人共同管理下一餐的闭环，包含：

- 注册后自动创建单人饭搭子，且每人只有一个活跃长期饭搭子。
- 长期邀请加入、原空间冻结、主动迁入、退出恢复和迁出快照。
- 饭搭子菜谱、固定版本、写时复制、派生做法、存储与删除规则。
- 冰箱、计划、购物清单、点菜、饭局参与和本人口味资料。
- Free / Plus 权益、成员上限、空间限制、到期和只读规则。
- 后台系统菜谱、配置、权益查询和基础审计。

当前明确不做：OCR、AI、小票识别、Pro、多家庭、多饭搭子切换、聊天评论、公开 UGC 运营闭环。

## 仓库结构

```text
apps/
  client/    uni-app 小程序，Vue 3 + TypeScript + Pinia，目标 mp-weixin
  api/       NestJS API，TypeScript + Prisma + PostgreSQL
  admin/     Vue 3 + Element Plus 后台
  worker/    异步任务 Worker，当前保留骨架，V1 不启动

docs/        当前项目规则、契约、计划和执行文档
infra/       本地开发环境与脚本
packages/    现存共享基础代码与构建产物
```

### 三端边界

- `apps/client`、`apps/api`、`apps/admin` 各自维护本端实现。
- API 契约统一写在 `docs/api-contract.md`，并由后端 OpenAPI 输出落地。
- 小程序和后台各自在本端维护 API 请求代码和所需类型，不直接导入对方源码。
- 小程序平台调用统一走 `apps/client/src/platform/uni.ts`，业务代码不直接调用 `wx.*`。

说明：

- 目前仓库里仍有 `packages/` 目录和现存共享代码。
- 新增需求和后续收口以当前项目规则为准，不再把跨应用源码依赖当成默认方案。

## 技术栈

| 端 | 选型 |
| --- | --- |
| Client | uni-app + Vue 3 + TypeScript + Pinia |
| API | NestJS + TypeScript + Prisma |
| DB | PostgreSQL 15+ |
| Cache / Queue | Redis + BullMQ |
| Async | PostgreSQL Outbox，V1 建表但 Worker 不运行 |
| Admin | Vue 3 + Element Plus |
| Contract | OpenAPI 3.0 + `docs/api-contract.md` |

## 文档入口

开始任何开发前，优先看这些文档：

- `docs/AGENT.md`
  当前最短执行规则，AI 和开发协作入口。
- `docs/project.md`
  项目总览、V1 范围、模块状态和工程结构。
- `docs/technical.md`
  技术边界、命名、分层、验证和落地规则。
- `docs/api-contract.md`
  当前共享 API 契约、错误码、鉴权和字段边界。
- `docs/dining-group.md`
  饭搭子、原空间、迁入迁出、饭局和口味规则。
- `docs/configuration.md`
  Free / Plus、空间、图片、派生做法、回收站和到期规则。
- `docs/uniapp.md`
  uni-app 工程规则。
- `docs/uniapp-architecture.md`
  小程序目录、分包、页面边界、登录和状态边界。
- `docs/runbook.md`
  联调、调试、最低验证和交付要求。

`docs/cook/` 下的产品方案、Prisma v0.1 和 SQL 约束是历史来源材料。与顶层文档冲突时，以顶层 `docs/*.md` 为准。

## 常用命令

### 安装依赖

```bash
pnpm install
```

### 启动

```bash
pnpm dev:api
pnpm dev:client
pnpm dev:admin
pnpm dev:worker
```

### 构建

```bash
pnpm build:api
pnpm build:client
pnpm build:admin
pnpm build:worker
```

### 检查

```bash
pnpm type-check
pnpm check
```

补充说明：

- `pnpm type-check` 会按仓库脚本顺序检查 `api`、`worker`、`client`、`admin`。
- `pnpm check` 当前等于根级 `type-check`。
- 改动范围较小时，优先跑最小相关命令，不默认整仓全量构建。

## 当前实现状态

已实现的主干包括：

- 用户登录与用户资料基础链路。
- 当前唯一饭搭子、邀请接受、原空间冻结、退出恢复和迁出快照头。
- 最小 Plus 授权、有效权益解析和成员席位规则。
- 用户级口味资料。
- 后台登录、用户查询、饭搭子查询和权益查询基础链路。

下一批实现重点：

- 原空间迁入和迁出快照清单项。
- 菜谱、空间账本、图片与技术快照。
- 冰箱、计划、购物、饭局和完成事实。
- 最低可用的会员订单、升级和到期处理。

## 开发规则摘要

### 先看契约，再写代码

- API 变更顺序是：更新 `docs/api-contract.md` -> 更新后端 DTO / OpenAPI -> 同步小程序和后台本地请求与类型 -> 运行最小验证。
- 不猜字段、不猜权限、不猜路由、不猜数据库约束。

### 保持扁平

- 路由、接口和目录都保持短路径。
- 不把数据库关系深度编码进 URL 或页面路径。

### 不过度抽象

- 不引入没有真实边界压力的 manager / adapter / center 式抽象。
- 页面编排留在页面，组件只做明确 UI 职责。

### 安全与一致性

- 鉴权接口返回 `401` 时，客户端必须清理 session 和相关缓存。
- 所有可重试写操作使用 `operationId`。
- 共享可变对象使用 `version`。
- 权限不能依赖前端隐藏按钮，服务端必须重新校验。
- 重要跨对象写操作必须事务化。

## 联调与验证

每次改动至少验证：

- 主路径是否可跑通。
- 相关失败路径是否返回合理错误。
- 受影响页面或接口是否没有明显相邻回归。

涉及三端协作时，再额外确认：

- 契约文档与后端 DTO / OpenAPI 一致。
- 小程序和后台各自的本地请求字段已同步。
- mock 没有掩盖真实契约缺口。

## 适合放在 README 之外的内容

以下内容不要继续往顶层 README 堆积，统一放进对应文档：

- 产品规则和范围争议：`docs/project.md`、`docs/decision.md`
- API 字段、错误码、鉴权：`docs/api-contract.md`
- 饭搭子生命周期：`docs/dining-group.md`
- Free / Plus 与空间规则：`docs/configuration.md`
- 小程序工程细节：`docs/uniapp.md`、`docs/uniapp-architecture.md`
- 调试、联调、交付要求：`docs/runbook.md`
