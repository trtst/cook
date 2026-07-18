# apps/client

uni-app 小程序应用。小程序只负责用户侧体验，不承载后台管理能力。

## 边界

- 可以依赖 `packages/platform` 和 `packages/api-client`。
- 不 import `apps/api` 或 `apps/admin` 源码。
- 页面、分包和主题规则见 `docs/uniapp-architecture.md`。
- 小程序平台能力统一走 `src/platform/uni.ts` 或请求层，业务页面不直接调用 `wx.*`。

## 命令

```bash
pnpm --filter @next-meal/client dev:mp-weixin
pnpm --filter @next-meal/client type-check
pnpm --filter @next-meal/client lint
pnpm --filter @next-meal/client build:mp-weixin
```

根目录等价命令：

```bash
pnpm dev:client
pnpm build:client
```

## 环境变量

复制 `.env.example` 为本地 `.env` 后再按环境填写。
