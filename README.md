# Next Meal Workspace

`next-meal` 当前采用单仓库、多应用结构。三端独立开发、独立启动、独立构建，共享契约只放在 `packages/`。

## 应用入口

```text
apps/api      后端 API
apps/client   uni-app 小程序
apps/admin    后台管理端
apps/worker   异步任务 Worker，V1 保留禁用态骨架
```

## 共享包

```text
packages/domain      领域类型和值对象
packages/api-client  API 契约、响应类型和错误类型
packages/platform    平台能力接口
```

## 常用命令

```bash
pnpm dev:api
pnpm dev:client
pnpm dev:admin
pnpm dev:worker

pnpm build:api
pnpm build:client
pnpm build:admin
pnpm build:worker

pnpm type-check
```

三端不能互相 import 对方源码。需要共享的类型、错误码、接口契约先进入 `packages/domain` 或 `packages/api-client`。
