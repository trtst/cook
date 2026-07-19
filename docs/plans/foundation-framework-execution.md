# 计划：基础框架搭建拆解

## 目标

- 补齐仓库级工程骨架，让三端和预留 Worker 的启动、构建、类型检查入口清晰。
- 只处理基础工程边界，不新增业务接口、业务页面、数据库约束或异步任务行为。

## 范围

- 包含 workspace 包结构、根命令、README、禁用态说明和最小验证链路。
- 排除 Auth、User、DiningGroup、Recipe、Meal、Fridge、Shopping、Share、Admin 业务行为。
- 排除 Redis、BullMQ、Outbox 消费、Prisma 迁移和线上部署配置。

## 影响层级

- UI：无。
- App：新增 `apps/worker` 禁用态工程壳。
- 数据：无。
- 工具：根 `type-check`、`build:worker`、`dev:worker` 命令接入。

## 任务清单

- [x] 新增 `apps/worker` TypeScript 包，默认禁用并直接退出。
- [x] 将 Worker 纳入根 `pnpm type-check` 和独立构建命令。
- [x] 补充 Worker README、根 README 和 agent 命令说明。
- [ ] 后续确认是否需要本地 Redis compose；V1 不运行 Worker 前先不接入。
- [ ] 后续确认是否需要仓库级 lint/format 统一入口；当前不改三端现有规则。
- [ ] 后续确认是否需要 `infra/scripts/` 运维脚本目录；没有真实迁移或导入命令前先不建空抽象。

## 验收

- 可见结果：`apps/worker/README.md` 写明 V1 禁用态和命令。
- 交互结果：`pnpm dev:worker` 输出禁用态并退出，不启动异步任务。
- 数据结果：不读写数据库，不连接 Redis，不消费 Outbox。

## 回滚

- 回退 `apps/worker/`、根 `package.json` worker 脚本、`pnpm-lock.yaml` 中 `apps/worker` importer、README 和文档说明。
- 回退后执行 `pnpm type-check`，确认根检查链路恢复到三端和共享包。
