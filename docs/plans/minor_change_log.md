# 小改动记录

## 记录规则

1. 这里只记录小型低风险改动。
2. 每条记录都应保持简短。
3. 范围较大的工作应改用独立计划文档。

## 记录项

| 日期 | 改动 | 影响文件 | 验证 |
| --- | --- | --- | --- |
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
| YYYY-MM-DD | 示例：小型前端清理 | `components/...` | `lint`、`type-check` |
