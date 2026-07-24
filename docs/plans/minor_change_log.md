# 项目变更记录

## 记录规则

1. 每次完成代码、接口、数据库、配置或规则改动，都必须在本文件留下中央时间线记录。
2. 小型低风险改动直接记录实际改动、影响文件和验证结果。
3. 范围较大的工作使用独立计划或执行文档，并在本文件增加摘要、提交或工作区状态、验证结果和文档链接。
4. 计划不等于完成记录；交付时必须回填实际实现、实际验证和遗留项。
5. 没有执行验证时必须写“未执行”，历史证据缺失时必须写“原验证记录缺失”，不得推测通过。
6. 提交或交付前必须检查本次改动已有对应记录；没有记录不得标记完成。

## 记录项

| 日期 | 改动 | 影响文件 | 验证 |
| --- | --- | --- | --- |
| 2026-07-24 | 拆分客户端会话恢复与会话清理事件，恢复 `utils/session-events.ts` 轻量模块，消除请求层到恢复链的静态循环依赖 | `apps/client/src/utils/session.ts`、`apps/client/src/utils/session-events.ts`、`apps/client/src/apis/http.ts`、`apps/client/src/stores/dining-group.ts` | `pnpm --filter @next-meal/client check`、`git diff --check` |
| 2026-07-24 | 将客户端 `utils` 目录现有文件的英文注释统一改为中文注释 | `apps/client/src/utils/session.ts`、`apps/client/src/utils/utils.ts`、`apps/client/src/utils/operation-id.ts` | `git diff --check -- apps/client/src/utils docs/plans/minor_change_log.md` |
| 2026-07-24 | 收口客户端 `utils` 目录：合并登录前后会话辅助为 `utils/session.ts`，将 `helpers.ts` 改为 `utils.ts`，删除未使用的 `validators.ts` | `apps/client/src/utils/session.ts`、`apps/client/src/utils/utils.ts`、`apps/client/src/App.vue`、`apps/client/src/pages/me/index.vue`、`apps/client/src/apis/http.ts`、`apps/client/src/stores/dining-group.ts`、`apps/client/src/stores/user.ts`、`apps/client/src/composables/useSystemInfo.ts` | `pnpm --filter @next-meal/client type-check`、`git diff --check` |
| 2026-07-24 | 为客户端 `stores` 与 `utils` 目录补充详细职责注释，明确每个 store 的状态边界、恢复/持久化责任，以及每个小工具文件的用途 | `apps/client/src/stores/*.ts`、`apps/client/src/utils/*.ts` | `pnpm --filter @next-meal/client type-check`、`git diff --check` |
| 2026-07-24 | 扫描并清理客户端禁用命名残留，同时将重复的 `isRecord` / `isNullableString` 收口到共享小工具，避免在 store 和 composable 内重复定义 | `apps/client/src/utils/helpers.ts`、`apps/client/src/stores/session.ts`、`apps/client/src/stores/user.ts`、`apps/client/src/composables/useSystemInfo.ts` | `pnpm --filter @next-meal/client type-check`、`git diff --check` |
| 2026-07-24 | 清理客户端残留的 `normalize*` 命名，按现行规则改为 `resolveUid` 和 `readSnapshot` | `apps/client/src/stores/session.ts`、`apps/client/src/composables/useSystemInfo.ts` | `pnpm --filter @next-meal/client type-check` |
| 2026-07-24 | 补充客户端平台适配层注释，明确 `platform/uni.ts` 的职责边界、与 `utils` 的区别，以及 storage/navigation/system 等能力分区 | `apps/client/src/platform/uni.ts` | `git diff --check -- apps/client/src/platform/uni.ts docs/plans/minor_change_log.md` |
| 2026-07-24 | 将客户端 `APP_STORAGE_KEYS` 从 `config/app.ts` 收回到 `platform/uni.ts`，让 Storage key 与实际存储封装同处维护 | `apps/client/src/platform/uni.ts`、`apps/client/src/config/app.ts`、`apps/client/src/stores/session.ts`、`apps/client/src/stores/settings.ts`、`apps/client/src/stores/user.ts`、`apps/client/src/composables/useSystemInfo.ts` | `pnpm --filter @next-meal/client type-check` |
| 2026-07-19 | 新增 Worker 禁用态工程壳，补齐根命令和基础框架拆解执行单，V1 不启动异步任务 | `apps/worker/`、`package.json`、`pnpm-lock.yaml`、`README.md`、`AGENTS.md`、`docs/index.md`、`docs/plans/foundation-framework-execution.md` | `pnpm --filter @next-meal/worker type-check`、`pnpm build:worker`、`pnpm type-check`、`pnpm --filter @next-meal/worker dev`、`git diff --check` |
| 2026-07-19 | 收口登录后的请求和响应，启动恢复不再自动补 `/users/me`，登录和当前用户响应改用 `UserBasic` | `apps/client/src/App.vue`、`apps/client/src/components/Login/Login.vue`、`apps/client/src/pages_restaurant/create/index.vue`、`apps/client/src/stores/user.ts`、`apps/api/src/modules/auth/auth.service.ts`、`packages/api-client/src/contracts.ts`、`packages/api-client/src/types.ts`、`docs/api-contract.md`、`docs/client-api.md`、`docs/plans/client-login-execution.md` | `pnpm --filter @next-meal/api-client type-check`、`pnpm --filter @next-meal/api type-check`、`pnpm --filter @next-meal/client type-check`、`pnpm --filter @next-meal/client build:mp-weixin`、`git diff --check` |
| 2026-07-19 | 参考 mini_teach 收口小程序配置目录，请求常量拆到全局 `src/config/`，`uni` adapter 补充上传下载封装，业务侧通过 `http.ts` 自动带 token | `apps/client/src/config/app.ts`、`apps/client/src/config/env.ts`、`apps/client/src/config/index.ts`、`apps/client/src/apis/adapters/uni.ts`、`apps/client/src/apis/http.ts`、`apps/client/README.md`、`docs/client-api.md`、`docs/plans/client-login-execution.md` | `pnpm --filter @next-meal/client type-check`、`pnpm --filter @next-meal/client build:mp-weixin`、`git diff --check` |
| 2026-07-19 | 小程序请求层移除 mock adapter，统一走真实 `uni.request`，无数据时通过后端 seed 或真实创建接口解决 | `apps/client/src/apis/http.ts`、`apps/client/src/apis/adapters/uni.ts`、`apps/client/src/apis/adapters/mock.ts`、`apps/client/.env.example`、`apps/client/README.md`、`docs/api-contract.md`、`docs/client-api.md` | `pnpm --filter @next-meal/client type-check`、`pnpm --filter @next-meal/client build:mp-weixin` |
| 2026-07-19 | `X-Cook-From` 改为环境变量优先、userAgent 实时判断，并补充鸿蒙 `harmony` 来源 | `apps/client/src/apis/adapters/uni.ts`、`apps/client/src/env.d.ts`、`apps/api/src/common/auth-context.ts`、`apps/api/src/common/request-context.middleware.ts`、`docs/api-contract.md`、`docs/client-api.md` | `pnpm --filter @next-meal/api type-check`、`pnpm --filter @next-meal/client type-check` |
| 2026-07-19 | 降低登录恢复请求频率，增加用户资料 10 分钟本地缓存和 refresh 10 分钟检查节流 | `apps/client/src/stores/user.ts`、`apps/client/src/stores/session.ts`、`apps/client/src/apis/http.ts`、`apps/client/src/App.vue`、`docs/api-contract.md`、`docs/client-api.md` | `pnpm --filter @next-meal/client type-check` |
| 2026-07-19 | 小程序请求默认增加 `X-Cook-From` / `X-Cook-Version`，并新增登录态刷新接口和前台自动续期 | `apps/api/src/modules/auth/auth.controller.ts`、`apps/api/src/modules/auth/auth.service.ts`、`apps/api/src/common/security/user-token.service.ts`、`apps/api/src/common/request-context.middleware.ts`、`apps/client/src/apis/http.ts`、`apps/client/src/apis/adapters/uni.ts`、`apps/client/src/App.vue`、`packages/api-client/src/client.ts`、`packages/api-client/src/contracts.ts`、`docs/api-contract.md`、`docs/client-api.md`、`docs/api-index.md` | `pnpm --filter @next-meal/api-client type-check`、`pnpm --filter @next-meal/api type-check`、`pnpm --filter @next-meal/client type-check` |
| 2026-07-19 | 新增客户端接口手册，按示例文档结构记录变更日志、路由分组、接口状态、请求响应和调用说明 | `docs/client-api.md`、`docs/api-index.md`、`docs/index.md` | `git diff --check -- docs/client-api.md docs/api-index.md docs/index.md docs/plans/minor_change_log.md` |
| 2026-07-19 | 新增 API 接口索引，看板式展示已创建、待创建、暂不创建接口和详情位置 | `docs/api-index.md`、`docs/index.md` | `git diff --check -- docs/api-index.md docs/index.md` |
| 2026-07-19 | 关闭微信开发者工具本地联调 URL 合法域名校验，避免拦截 `127.0.0.1:3100` 请求 | `apps/client/src/manifest.json` | `pnpm build:client` 并确认产物 `project.config.json` 的 `urlCheck=false` |
| 2026-07-19 | 小程序默认切到真实 API 联调模式，对齐本地 API 地址，并透出 request fail 诊断 | `apps/client/src/apis/http.ts`、`apps/client/src/apis/adapters/uni.ts`、`apps/client/src/config/index.ts`、`apps/client/.env.example`、`apps/client/README.md` | `curl /api/auth/login`、`uniRequestAdapter` 模拟请求、`git diff --check`、`pnpm --filter @next-meal/client type-check`、`pnpm build:client` |
| 2026-07-19 | 收口小程序手机号密码登录子纵切，去除默认凭据并修正 401/429、session 和用户摘要链路 | `apps/client/src/components/Login/Login.vue`、`apps/client/src/pages/me/index.vue`、`apps/client/src/stores/session.ts`、`packages/api-client/src/client.ts`、`apps/api/src/common/security/user-token.service.ts`、`docs/plans/client-login-execution.md` | `git diff --check`、`pnpm check` |
| 2026-07-19 | 补充三端联合开发机制、接口契约流程和功能执行单模板 | `docs/project.md`、`docs/api-contract.md`、`docs/runbook.md`、`docs/index.md`、`docs/templates/feature_execution_template.md` | `git diff --check -- docs/templates/feature_execution_template.md docs/project.md docs/api-contract.md docs/runbook.md docs/index.md` |
| 2026-07-20 | 历史补录 `eca0f63`：入档饭搭子生命周期、会员空间、迁入迁出、饭局与口味边界 | `docs/dining-group.md`、`docs/configuration.md`、`docs/plans/dining-group-lifecycle-plan.md` 及相关主文档 | 原验证记录未写入提交；本次仅按 Git 文件事实补录 |
| 2026-07-20 | 历史补录 `5eaa511`：调整菜谱派生做法、图片独立化与技术快照规则 | `docs/configuration.md`、`docs/dining-group.md`、`docs/api-contract.md` 等 | 原验证记录未写入提交；本次仅按 Git 文件事实补录 |
| 2026-07-21 | 历史补录 `d5c9ff5`：重构当前饭搭子空间底座，增加 migration、策略、接口、客户端状态和真实流程脚本 | `apps/api/prisma/`、`apps/api/src/modules/dining-group/`、`apps/client/`、`docs/plans/prisma-schema-plan.md` | 原验证记录未写入提交；关联 `current-implementation-gap.md`、`dining-group-lifecycle-plan.md` |
| 2026-07-21 | 历史补录 `045fd8c`：增加最小 Plus 授权、权益解析、迁出快照和后台权益查询 | `apps/api/prisma/`、`apps/api/src/modules/entitlement/`、DiningGroup/Admin 契约及文档 | 原验证记录未写入提交；关联 `dining-group-lifecycle-plan.md`、`prisma-schema-plan.md` |
| 2026-07-21 | 历史补录 `f6eec2d`：后台用户列表增加有效权益入口和抽屉状态 | `apps/admin/src/pages/UsersPage.vue` | 原验证记录未写入提交 |
| 2026-07-21 | 历史补录 `361d52c`：重构“我的”页面服务入口、登录失败重试和主题展示 | `apps/client/src/pages/me/index.vue`、主题样式 | 原验证记录未写入提交 |
| 2026-07-21 | 历史补录 `1917bfd`：冻结成就勋章和会员支付边界，并保留客户端入口表达 | `apps/client/src/pages/me/index.vue`、`docs/configuration.md`、`docs/decision.md` 等 | 原验证记录未写入提交；产品规则以关联文档为准 |
| 2026-07-22 | 历史补录 `a3698f2`：新增本人口味档案表、GET/PUT 接口、DTO 和验证脚本 | `apps/api/prisma/`、`apps/api/src/modules/user/`、`verify-taste-profile-flow.ts` | 原验证结果未写入提交 |
| 2026-07-22 | 历史补录 `39175cb`：小程序接入口味档案页面和“我的”页入口 | `apps/client/src/pages_me/taste/index.vue`、`pages.json`、`pages/me/index.vue` | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `4516bad`：按应用拆分接口类型和工程依赖，移除跨应用共享源码包 | `apps/admin/`、`apps/api/`、`apps/client/`、`apps/worker/`、删除 `packages/*` | 原验证记录未写入提交；关联 `full-refactor-execution.md` |
| 2026-07-22 | 历史补录 `2852e51`：补充前后端边界和数据建模硬规则 | `docs/api-contract.md`、`docs/architecture.md`、`docs/technical.md` | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `c5b3c02`：收口 API 一级模块入口，AppModule 只负责装配 | `apps/api/src/common/core.module.ts`、各模块 `*.module.ts`、`full-refactor-execution.md` | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `e28a63c`：收敛用户和饭搭子契约，增加修改密码、空间用量、约束与索引 | API migration、Auth/User/DiningGroup/Entitlement 服务、三端契约文档 | 原验证结果未写入提交；提交包含登录、口味和饭搭子验证脚本修改 |
| 2026-07-22 | 历史补录 `6efabf7`：后台移除工作台，收口用户和饭搭子只读查询入口 | `apps/admin/`、`apps/api/scripts/verify-admin-readonly-flow.ts`、AdminService | 原验证结果未写入提交 |
| 2026-07-22 | 历史补录 `9ffc542`：小程序同步会话和用户契约，平台层收口导航、Toast、剪贴板 | `apps/client/src/apis/`、stores、platform、页面及 `utils/app-session.ts` | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `d96c44a`：区分用户和管理员 token，加固管理员实时鉴权与幂等状态写入 | API Guard、token service、DTO、DiningGroupService、异常层 | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `d85b545`：后台列表忽略过期响应，权益入口限制为 SUPER_ADMIN | Admin 请求层、用户页、饭搭子页 | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `bd179e9`：小程序收口平台能力，首页和菜谱页移除示例数据并改为空态 | Client 请求层、系统信息、主题、首页、菜谱页、平台层 | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `407ed9a`：收口口味档案写入归一化 | `apps/api/src/modules/user/taste-profile.service.ts` | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `6dee94f`：完善“我的”页面真实状态展示 | `apps/client/src/pages/me/index.vue` | 原验证记录未写入提交 |
| 2026-07-22 | 历史补录 `11b7eb2`：恢复“我的”页面勋章模块 | `apps/client/src/pages/me/index.vue` | 原验证记录未写入提交 |
| 2026-07-23 | 历史补录 `5031473`：完善饭搭子概览、小程序导航和系统信息适配 | DiningGroup API/Service、Client Layout/NavBar/首页/我的/成员页、契约文档 | 原验证结果未写入提交；提交包含饭搭子流程脚本修改 |
| 2026-07-23 | 历史补录 `a452e07`：入档个人数据、多饭搭子关系、菜谱和协作规则 | `AGENTS.md`、`docs/recipe.md`、DiningGroup/Configuration/API/架构等主文档 | 原验证记录未写入提交 |
| 2026-07-24 | 审计并整改 API 与数据库边界：拆分本人资料、权益、空间和饭搭子响应，删除旧聚合接口及旧字段，补 DTO/OpenAPI/约束规则 | API、Client、Admin 契约与实现，`api-database-boundary-audit.md`、`api-database-rules.md` | `pnpm type-check`、API/Client/Admin/Worker 构建、DTO 流程、OpenAPI 校验、`git diff --check` |
| 2026-07-24 | 实施个人数据与饭搭子关系候选工程改造，增加四档个人权益、菜谱、周计划、饭局、冰箱、购物和后台治理基础 | Prisma Schema/migration、Recipe/Meal/Pantry/User/Admin 模块、三端页面与 API、`personal-data-refactor-plan.md` | Prisma 校验；Recipe 和 Admin Recipe 真实流程；全仓类型检查与构建；DiningGroup、Meal/Pantry 保持开发中待业务验收 |
| 2026-07-24 | 修复工程基础问题：并发幂等、管理员独立幂等和审计身份、治理事务、状态按钮及模块状态文档 | `idempotency.ts`、Admin/Recipe/Meal/Pantry、Prisma migration、Admin 菜谱页、`engineering-foundation-fix.md` | 全新数据库执行 18 个 migration 和 seed；Login/DTO/DiningGroup/Recipe/Meal-Pantry/Admin 真实流程；OpenAPI 50/48；全仓类型、四端构建、Client lint、`git diff --check` |
| 2026-07-24 | 建立后续业务 To-do，记录饭局参与者、重复导入、购物缺口、空间计量和图片能力的待确认问题 | `business-development-todo.md`、`docs/AGENT.md`、`docs/project.md`、`docs/architecture.md`、`docs/index.md` | 文档差异检查；明确 To-do 不作为接口或数据库契约 |
| 2026-07-24 | 补录 20 日至 23 日缺失的 23 个提交，并将中央变更记录设为每次交付必检项 | `docs/plans/minor_change_log.md`、`docs/index.md` | `git log` 与逐提交文件清单核对；`git diff --check` |
