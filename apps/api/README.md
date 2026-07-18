# apps/api

后端 API 应用。当前使用 NestJS 骨架，优先打通登录、当前用户、餐厅列表和后台只读查询这条纵切链路。

## 边界

- 可以依赖 `packages/domain` 和 `packages/api-client`。
- 不 import `apps/client` 或 `apps/admin` 源码。
- OpenAPI 输出和接口错误码以 `docs/api-contract.md` 为准。
- mock service 只服务第一阶段联调，真实持久化接入后逐步替换。

## 命令

```bash
pnpm --filter @next-meal/api dev
pnpm --filter @next-meal/api type-check
pnpm --filter @next-meal/api build
```

根目录等价命令：

```bash
pnpm dev:api
pnpm build:api
```

## 环境变量

复制 `.env.example` 为本地 `.env` 后再按环境填写。
