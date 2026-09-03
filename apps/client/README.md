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
pnpm check:theme:static
```

## 主题验证

主题系统收口后，优先按两层验证：

1. 静态主题规则：`pnpm check:theme:static`
2. 运行态主题切换：从仓库根目录串行执行 HBuilderX CLI

```bash
/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages/home/theme.test.js
/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages/recipe/theme.test.js
/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages_me/theme/index.test.js
/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages_meal/random/theme.test.js
```

注意：

- `HBuilderX CLI uniapp.test` 会改写 `src/jest.config.js` 的 `testMatch`，一次只跑一个用例，避免并发抢占 automator 端口。
- 当前环境下，通过 `pnpm` 或 bash 脚本二次包裹 HBuilderX CLI 可能触发 Qt `neon` 崩溃；运行态主题回归请直接执行上面的原始命令。
- 运行态测试依赖微信开发者工具已开启服务端口，并且 `apps/client/src/env.js` 可被 HBuilderX 自动写入测试配置。
- `pages_me/theme/visual-capture.test.js` 当前保留为手工视觉留档候选，并已显式 `it.skip(...)`；在 CLI 下 `program.screenshot()` 会卡在 `App.captureScreenshot` 超时，不算稳定回归项。

## 请求环境切换

请求地址通过 `VITE_APP_MODE` 切换，地址映射集中放在 `src/config/env_profiles.ts`，不要手改 `src/config/env.ts`：

```bash
pnpm dev:mp-weixin:dev
pnpm dev:mp-weixin:prod
pnpm build:mp-weixin:dev
pnpm build:mp-weixin:prod
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
