# apps/admin

后台管理端应用。当前先建立独立工程入口，后续确认 UI 框架后再升级为真实后台前端。

## 边界

- 后台使用管理员登录态，不复用小程序用户 token。
- 后台只通过 API 契约访问后端，不 import `apps/api` 源码。
- 后台不 import `apps/client` 源码或小程序组件。
- 共享类型和接口契约进入 `packages/domain` 或 `packages/api-client`。

## 当前状态

当前是最小 TypeScript 骨架，用来固定 workspace、env、命令和边界。等后台页面范围确认后，再补 Vite/Vue、路由、布局和登录页。

## 命令

```bash
pnpm --filter @next-meal/admin dev
pnpm --filter @next-meal/admin type-check
pnpm --filter @next-meal/admin build
```

根目录等价命令：

```bash
pnpm dev:admin
pnpm build:admin
```

## 环境变量

复制 `.env.example` 为本地 `.env` 后再按环境填写。
