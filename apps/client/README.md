# apps/client

uni-app 小程序应用。小程序只负责用户侧体验，不承载后台管理能力。

## 边界

- 平台能力在 `src/platform/uni.ts` 内维护；请求和类型在 `src/apis/` 内维护。
- 不 import `apps/api` 或 `apps/admin` 源码。
- 页面、分包和主题规则见 `docs/uniapp-architecture.md`。
- 小程序平台能力统一走 `src/platform/uni.ts` 或请求层，业务页面不直接调用 `wx.*`。

## 命令

```bash
pnpm dev:mp-weixin
pnpm type-check
pnpm lint
pnpm build:mp-weixin
```

## 请求环境切换

请求地址通过 `src/config/env.ts` 的 `mode` 切换，地址映射集中放在 `src/config/env_profiles.ts`：

```ts
const mode: AppMode = "dev"; // dev, prod
```

- `dev` 默认走 `http://127.0.0.1:3100/api` 和 `http://127.0.0.1:5176`
- `prod` 默认走 `https://api.trtst.com/api` 和 `https://www.trtst.com`
- 小程序真机不能直连 `127.0.0.1`；如果要真机联调，把 `dev.apiUrl / dev.domain / dev.authDomain` 改成手机可访问的局域网 IP 或 HTTPS 域名

小程序端不再内置 mock 请求通道。没有本地数据时，先启动 API 并执行 seed，或通过真实创建接口生成数据。

小程序请求层默认附加：

```text
X-Cook-From: mini_program
X-Cook-Version: 0.1.0
```

`X-Cook-From` 支持 `mini_program`、`h5`、`pc`、`ios`、`android`、`harmony`。请求封装优先使用 `VITE_COOK_FROM`；未配置时按 userAgent 实时判断，无法判断时回退 `mini_program`。

全局客户端配置在 `src/config/`。API 根层只放业务接口入口；`src/apis/adapters/uni.ts` 负责 `uni.request`、`uni.uploadFile`、`uni.downloadFile` 平台封装，`src/apis/http.ts` 负责 token、401 和对业务侧导出上传下载方法。

保留的环境变量：

```bash
VITE_COOK_FROM=mini_program
VITE_COOK_VERSION=0.1.0
```
