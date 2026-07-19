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

本地真实 API 联调：

```bash
VITE_API_BASE_URL=http://127.0.0.1:3100/api pnpm --filter @next-meal/client build:mp-weixin
```

小程序端不再内置 mock 请求通道。没有本地数据时，先启动 API 并执行 seed，或通过真实创建接口生成数据。

小程序请求层默认附加：

```text
X-Cook-From: mini_program
X-Cook-Version: 0.1.0
```

`X-Cook-From` 支持 `mini_program`、`h5`、`pc`、`ios`、`android`、`harmony`。请求封装优先使用 `VITE_COOK_FROM`；未配置时按 userAgent 实时判断，无法判断时回退 `mini_program`。

全局客户端配置在 `src/config/`。API 根层只放业务接口入口；`src/apis/adapters/uni.ts` 负责 `uni.request`、`uni.uploadFile`、`uni.downloadFile` 平台封装，`src/apis/http.ts` 负责 token、401 和对业务侧导出上传下载方法。

本地可用环境变量覆盖：

```bash
VITE_COOK_FROM=mini_program
VITE_COOK_VERSION=0.1.0
```
