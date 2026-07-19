# apps/admin

后台管理端应用。后台壳只保留本项目需要的 Vue 3 + Element Plus 基础能力，不引入外部模板身份内容。

## 边界

- 后台使用管理员登录态，不复用小程序用户 token。
- 后台只通过 API 契约访问后端，不 import `apps/api` 源码。
- 后台不 import `apps/client` 源码或小程序组件。
- 共享类型和接口契约进入 `packages/domain` 或 `packages/api-client`。

## 当前状态

当前是最小 Vite / Vue / Element Plus 后台壳，已接入后台登录、用户只读查询和饭搭子只读查询。

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
