# apps/client 小程序工程基线

> 当前客户端以个人数据为默认上下文，饭搭子 Store 保存关系列表、关系用量和页面选择，不承担数据空间切换。

## 目标

本文固化 `apps/client` 的 uni-app 小程序脚手架基线。

通用 uni-app 小程序工程规则见 `docs/uniapp.md`。本文只记录当前项目的小程序目录骨架、主包与分包规划、登录组件边界、请求层位置、平台适配层位置、Pinia store 边界和首批验证命令。

## 最终目录结构

```text
apps/client/
  src/
    App.vue
    main.ts
    pages.json
    manifest.json
    uni.scss

    pages/                     # 主包页面
      home/index.vue
      recipe/index.vue
      me/index.vue
      error/index.vue

    pages_restaurant/          # 当前历史目录名：饭搭子管理，重命名须独立执行
      create/
      invite/
      members/
      settings/
      switch/                  # v0.1 历史页；v0.2 不开放普通切换入口

    pages_recipe/              # 分包：菜谱
      list/
      detail/
      edit/
      import/
      system/

    pages_meal/                # 分包：计划与点菜
      plan/
      poll/
      wish/
      random/
      result/

    pages_pantry/              # 分包：食材与采购
      index/
      item-edit/
      gap/
      list/
      supermarket/
      history/

    pages_share/               # 分包：分享
      preview/
      import/
      memory/

    components/                # 根公共组件
      login/
      login-guard/
      common/
        app-page/              # 页面壳：主题、顶部导航、底部 tabbar 占位
        app-navbar/            # 自定义顶部导航
        app-tabbar/            # 自定义底部 tabbar
        app-button/            # 纯 UI 按钮
        app-card/              # 纯 UI 卡片
        skeleton/              # 纯 UI 骨架屏

    composables/               # 通用组合式能力
      useSystemInfo.ts         # 状态栏、胶囊、安全区
      useTheme.ts              # system/light/dark 主题模式

    apis/                      # 请求层
      http.ts
      auth.ts
      user.ts
      dining-group.ts
      recipe.ts
      meal.ts
      poll.ts
      fridge.ts
      shopping.ts
      share.ts

    stores/                    # Pinia stores
      app.ts
      session.ts
      user.ts
      dining-group.ts
      settings.ts

    platform/                  # 平台适配层注册
      uni.ts

    router/                    # 路由辅助，不替代 uni 路由
    styles/                    # 全局样式
    utils/                     # 工具函数
```

## 扁平化约束

`apps/client` 目录和页面路由默认保持浅层。

1. 主包页面保持 `pages/{page}/index.vue`，不再继续嵌套业务目录。
2. 分包页面保持 `pages_xxx/{page}/index.vue` 或项目实际等价形式，不新增 `detail/edit/result` 之上的业务中间层。
3. 分包 root 只表达一级产品域：`dining_group`、`recipe`、`meal`、`pantry`、`share`。
4. 页面名称直接表达入口：`detail`、`edit`、`poll`、`gap`、`supermarket`。
5. 饭搭子、菜谱、版本、计划、状态等上下文通过 query、store 当前态和接口校验承载，不进入路由层级。
6. 后台、小程序和 API 的路径不需要一一对应；三端都各自保持短路径。
7. `src/themes/{skinId}` 是主题目录上限，不增加 `skins/`、`templates/`、`variants/` 等中间层。

## 主包页面

主包只保留启动必需页、tabbar 页、兜底错误页和轻量公共能力。

主包页面固定为 4 个：

```text
pages/home/index
pages/recipe/index
pages/me/index
pages/error/index
```

登录不做页面，不占用主包页面路径。

冰箱不作为 tabbar 页面，也不占主包页面路径。冰箱库存、食材缺口和购物清单合并到 `pages_pantry/` 分包，由首页的“食材与采购”入口进入。

## 分包规划

分包按功能域拆，不按页面类型拆。

1. `pages_restaurant/`：当前历史目录名，承载饭搭子列表、邀请、成员、设置、退出和超额处理。目录重命名必须作为独立迁移执行。
2. `pages_recipe/`：菜谱列表、详情、编辑、导入和系统菜谱。
3. `pages_meal/`：下一餐计划、点菜征集、想吃池、随机和结果汇总。
4. `pages_pantry/`：食材与采购首页、食材编辑、食材缺口、购物清单、超市模式和采购记录。
5. `pages_share/`：分享预览、分享导入和饭搭子卡。

首页可以预加载 `pages_recipe` 和 `pages_meal` 两个分包。

## 首页结构

首页按“氛围 -> 提醒 -> 操作”的顺序组织。

1. 顶部是大图背景，用插画承接温馨家庭用餐氛围，不在大图里堆功能入口。
2. 大图下方是一条通知横条，只展示当前最高优先级事项，例如投票未完成、采购缺口或邀请待处理。
3. 通知下方保留 `home-board`，使用左大右二结构。
4. 左侧大模块固定为“今晚吃啥”，进入下一餐计划。
5. 右上模块为“我的菜谱”，进入私人菜谱列表。
6. 右下模块为“食材与采购”，进入 `pages_pantry/index`。

首页通知横条不做消息列表。需要多条消息时先在业务层排出最高优先级，只传入一条给首页展示。

## 登录组件边界

登录使用根公共组件，不做独立页面。

```text
components/
  login/
    index.vue
    login.scss
    types.ts
  login-guard/
    index.vue
```

登录组件只做：

1. 展示登录入口。
2. 调用已冻结的登录 API。
3. 写入 `sessionStore`。
4. 通过 `success` 或 `error` 事件通知调用方。

登录组件不做：

1. 不主动弹出。
2. 不跳转页面。
3. 不刷新饭搭子、用户资料或页面数据。
4. 不维护重试队列。
5. 不包含饭搭子、菜谱、冰箱、购物等业务逻辑。

页面或具体操作负责决定登录成功后的行为，例如刷新当前数据、继续执行当前操作或停留在原页面。

## 根公共组件边界

根 `components/` 只放三类：

```text
components/login/
components/login-guard/
components/common/
```

`components/common/` 只放无业务依赖的基础 UI 和页面壳。当前允许优先沉淀：

```text
components/common/app-page/
components/common/app-navbar/
components/common/app-tabbar/
components/common/app-button/
components/common/app-card/
components/common/skeleton/
```

不提前创建根级领域组件目录，例如：

```text
components/recipe/
components/meal/
components/fridge/
components/shopping/
components/pantry/
```

领域组件默认放在各自页面或分包内：

```text
pages_recipe/components/
pages_meal/components/
pages_pantry/components/
```

只有发生真实跨主包和跨分包复用，并确认不会明显拖大主包后，才允许提升到根公共组件。

## 主题与样式 token

样式层复用成熟项目的 token 结构，不复用业务变量。

全局样式必须沉淀为 CSS 变量，而不是在页面里散落硬编码颜色和字号。

主题分三层：

1. `themeSkin`：控制整体皮肤包，包含组件 token 和素材目录。
2. `themeMode`：控制明暗，取值为 `system`、`light`、`dark`。
3. `themePalette`：只在支持色系切换的 skin 内控制浅色色系。

当前 skin 固定为：

| skin | 权限标识 | 色系 | 说明 |
| --- | --- | --- | --- |
| `default` | 免费 | `default` / `warm` / `olive` / `cool` | 基础皮肤，免费用户可切 4 套色系 |
| `handdrawn-food` | 会员标识，当前测试期放开 | 无 | 手绘食物皮肤，样式和素材由 skin 自身决定 |
| `warm-couple` | 会员标识，当前测试期放开 | 无 | 温馨插画皮肤，样式和素材由 skin 自身决定 |
| `apple-glass` | 会员标识，当前测试期放开 | 无 | 轻玻璃皮肤，样式和素材由 skin 自身决定 |

暗黑模式只保留一套，不随浅色色系切换。

`default` skin 的浅色色系固定为 4 套：

| 主题 | 用途 | 页面背景 | 卡片背景 | 主色 | 浅主色 | 文字主色 | 辅助文字 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `default` 清新绿 | 默认主题 | `#F4F7F5` | `#FFFFFF` | `#216E4E` | `#DFF1E8` | `#17231D` | `#607168` |
| `warm` 温馨暖黄 | 家庭温馨 | `#FBF4E5` | `#FFFAF0` | `#B9771F` | `#F6DFAD` | `#2D2418` | `#7B6A52` |
| `olive` 橄榄自然 | 食材自然 | `#F2F4EA` | `#FFFEF8` | `#647A2F` | `#E5EBCF` | `#202719` | `#687059` |
| `cool` 冷蓝清爽 | 协作工具 | `#F0F5F8` | `#FFFFFF` | `#326FA8` | `#E0EDF8` | `#17242D` | `#60727C` |

暗黑色系统固定为：

| 主题 | 页面背景 | 卡片背景 | 主色 | 浅主色 | 文字主色 | 辅助文字 |
| --- | --- | --- | --- | --- | --- | --- |
| `dark` 深绿黑 | `#0F1713` | `#17211C` | `#6ECA94` | `rgba(110, 202, 148, 0.16)` | `rgba(255,255,255,.94)` | `rgba(255,255,255,.62)` |

语义色保持稳定，不按浅色色系大幅变化：

| 语义 | token | 色值 |
| --- | --- | --- |
| 成功 | `--color-success` | `#216E4E`，暗黑为 `#6ECA94` |
| 警告 | `--color-warning` | `#D9902F` |
| 缺口/错误 | `--color-danger` | `#F47C35` |
| 协作/信息 | `--color-info` | `#326FA8` |

基础 token 至少包含：

1. 主题色：`--color-primary` 和必要的状态色。
2. 背景色：`--color-page`、`--color-surface`、`--color-surface-muted`。
3. 文字色：`--color-text`、`--color-text-secondary`、`--color-text-tertiary`、`--color-text-inverse`。
4. 边界色：`--color-border`、`--color-divider`。
5. 字号：`--font-size-xs`、`--font-size-sm`、`--font-size-md`、`--font-size-lg`、`--font-size-xl`、`--font-size-hero`。
6. 字重：`--font-weight-regular`、`--font-weight-medium`、`--font-weight-semibold`、`--font-weight-bold`、`--font-weight-heavy`。
7. 间距：`--space-xs`、`--space-sm`、`--space-md`、`--space-lg`、`--space-xl`、`--space-page`。
8. 圆角：`--radius-xs`、`--radius-sm`、`--radius-md`、`--radius-lg`、`--radius-xl`、`--radius-pill`。
9. 阴影：`--shadow-card`、`--shadow-floating`。
10. 组件尺寸：`--size-navbar-content`、`--size-tabbar`、`--size-button-primary`、`--size-button-secondary`、`--size-input`、`--size-list-item`。

字体统一使用系统字体，不引入外部字体包：

```css
-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", Arial, sans-serif
```

字号固定为：

| token | 值 | 用途 |
| --- | --- | --- |
| `--font-size-xs` | `22rpx` | 标签、辅助信息 |
| `--font-size-sm` | `24rpx` | tabbar、弱提示 |
| `--font-size-md` | `28rpx` | 正文、说明 |
| `--font-size-lg` | `32rpx` | 卡片标题、列表主信息 |
| `--font-size-xl` | `40rpx` | 页面标题 |
| `--font-size-hero` | `52rpx` | 首页主标题 |

圆角固定为：

| token | 值 | 用途 |
| --- | --- | --- |
| `--radius-xs` | `8rpx` | 小标签、小图标底 |
| `--radius-sm` | `12rpx` | 小按钮、小输入 |
| `--radius-md` | `16rpx` | 普通按钮、表单 |
| `--radius-lg` | `24rpx` | 卡片 |
| `--radius-xl` | `32rpx` | 重点卡片、登录卡片 |
| `--radius-pill` | `999rpx` | 标签、胶囊按钮 |

间距固定为：

| token | 值 | 用途 |
| --- | --- | --- |
| `--space-xs` | `8rpx` | 小元素间距 |
| `--space-sm` | `12rpx` | 标签、文字组 |
| `--space-md` | `24rpx` | 列表项、卡片内间距 |
| `--space-lg` | `32rpx` | 卡片 padding |
| `--space-xl` | `48rpx` | 页面区块间距 |
| `--space-page` | `32rpx` | 页面左右边距 |

组件尺寸固定为：

| token | 值 | 用途 |
| --- | --- | --- |
| `--size-navbar-content` | `88rpx` | 自定义顶部内容区 |
| `--size-tabbar` | `100rpx` | tabbar 内容区 |
| `--size-button-primary` | `88rpx` | 主按钮 |
| `--size-button-secondary` | `72rpx` | 次按钮 |
| `--size-input` | `88rpx` | 输入框 |
| `--size-list-item` | `104rpx` | 普通列表项最小高度 |

明暗模式支持 `system/light/dark` 三种模式：

1. `system`：跟随系统主题。
2. `light`：用户强制浅色。
3. `dark`：用户强制深色。

主题模式属于本地配置，归 `stores/settings.ts` 管理。系统主题检测归 `composables/useTheme.ts` 管理。

浅色色系也属于本地配置，归 `stores/settings.ts` 管理。页面只绑定 `useTheme()` 返回的主题 class，不直接判断某个色系。

没有 `palettes` 的 skin 不叠加 `theme-palette-*` class。此类 skin 的颜色、圆角、阴影和素材由 `theme-skin-*` 自身提供。

skin 的样式和素材集中放在 `src/themes/`。

```text
src/
  themes/                  # theme 公共文件 + 皮肤包目录
    config.ts              # skin 注册、资源约定说明、tabbarAssetType、assets 自动生成
    index.ts               # theme 查询函数与统一导出
    tokens.scss            # 全局 token、palette token，不引用具体 skin
    default/
      skins.scss           # 默认皮肤样式与字体图标
    handdrawn-food/
      skins.scss           # 手绘皮肤样式
      home.svg
      home-active.svg
      recipe.svg
      recipe-active.svg
      me.svg
      me-active.svg
    warm-couple/
      skins.scss
    apple-glass/
      skins.scss
```

组件不直接拼素材路径。组件通过 `src/themes/index.ts` 读取当前 skin 的 `assets`，没有素材时回退到 `FALLBACK_ASSET_SKIN`。

皮肤包目录直接使用 skin id，不再增加 `skins/` 或 `template/` 中间目录。主题配置统一放在 `src/themes/config.ts`，并用 `tabbarAssetType` 区分 tabbar 使用 `font` 还是 `svg`。默认主题使用字体图标；带独立素材的皮肤使用 SVG 图片。

新增皮肤只做两件事：

1. 新增 `src/themes/{skinId}/`，至少包含 `skins.scss`。
2. 修改 `src/themes/config.ts` 的 `THEME_SKIN_CONFIGS`，增加一条皮肤元信息。

新增皮肤时不修改 `src/themes/` 下其他皮肤目录，也不修改 `src/themes/tokens.scss`。

`src/themes/config.ts` 会自动收集 `src/themes/*/skins.scss` 和 `src/themes/*/*.svg`。SVG 皮肤只需要按固定文件名放置素材，不需要在配置里逐个 import。

字体图标和图片资源使用同一套语义命名：`home`、`recipe`、`me`。tabbar 字体 class 固定为 `icon-home`、`icon-recipe`、`icon-me`；tabbar 图片固定为 `home.svg`、`home-active.svg`、`recipe.svg`、`recipe-active.svg`、`me.svg`、`me-active.svg`。

## 自定义顶部导航

小程序页面统一使用自定义顶部导航。

`pages.json` 中页面样式应设置：

```json
{
  "navigationStyle": "custom"
}
```

自定义顶部导航由 `components/common/app-navbar/` 提供。

页面不自行计算状态栏、胶囊、返回按钮和首页按钮。状态栏、安全区和胶囊信息统一由 `composables/useSystemInfo.ts` 获取。

`navigationBarTitleText` 可以继续保留为页面元信息，但真实标题由 `AppNavbar` 渲染。

`AppNavbar` 默认固定在顶部，并为普通页面插入导航占位，避免内容被导航遮挡。

首页是全屏模式，导航仍然固定，但不插入导航占位。首页内容从屏幕顶部开始渲染，大图背景延伸到导航下方。

```vue
<AppPage
  title="下一餐"
  current-tab="home"
  :show-left="false"
  full-screen
  :navbar-placeholder="false"
  navbar-transparent
>
```

除首页这类明确全屏页面外，普通页面不关闭导航占位。

## 自定义 tabbar

主包 tab 页统一使用自定义 tabbar。

`pages.json` 保留 tabbar 路径声明，并开启：

```json
{
  "tabBar": {
    "custom": true
  }
}
```

自定义底栏由 `components/common/app-tabbar/` 提供。

tab 切换必须使用 `uni.switchTab`，不允许用 `navigateTo` 或 `redirectTo` 切换 tab 页。

分包页面默认不展示 tabbar。只有主包 3 个 tab 页展示 tabbar。

tabbar 不依赖业务 store。角标、红点等业务状态后续需要时，通过显式 props 或轻量配置接入，不能把业务 store 写死在通用组件内。

tabbar 固定为：

```text
首页
菜谱
我的
```

冰箱、购物清单和食材缺口不进入 tabbar。

## 登录访问策略

| 页面 | 未登录行为 | 登录后行为 |
| --- | --- | --- |
| 首页 | 显示品牌占位和登录引导 | 显示下一餐和快捷入口 |
| 菜谱 | 展示系统菜谱大厅 | 默认展示我的菜谱，并提供饭搭子菜谱入口 |
| 我的 | 显示登录组件 | 展示个人信息、饭搭子关系、超额状态和会员入口 |
| 食材与采购 | 显示登录后使用食材与采购 | 展示个人库存、缺口和购物清单 |
| 分享预览 | 直接展示预览内容 | 直接展示预览内容 |

分享预览页不要求登录。导入等需要用户身份的操作，再触发登录组件。

## 请求层边界

`apis/http.ts` 是小程序请求统一入口。

请求层负责：

1. 统一调用底层请求能力。
2. 统一鉴权头、公共 query、超时和 `content-type`。
3. 区分 `ApiError`、`UnauthorizedError`、`HttpError` 和 `NetworkError`。
4. 遇到 401 时清理 `sessionStore` 并抛出 `UnauthorizedError`。

请求层不负责：

1. 不跳转页面。
2. 不展示登录组件。
3. 不维护弹窗状态。
4. 不持有页面操作重试队列。

401 后是否展示登录组件、是否刷新页面、是否继续执行当前操作，由页面或具体按钮调用方决定。

## 平台适配层边界

平台能力及其最小接口统一放在 `apps/client/src/platform/uni.ts`，业务代码不得直接调用 `wx.*`。

业务页面不直接调用 `wx.*`。

登录、存储、分享、导航、上传、下载等平台能力统一经过平台适配层或请求层。

## Pinia store 边界

Pinia 只保存跨页面、跨启动、需要统一清理的状态。

```text
stores/app.ts          # 启动状态、系统信息、全局 ready
stores/session.ts      # token、登录态、用户 id、401 清理
stores/user.ts         # 当前用户资料
stores/dining-group.ts # 本人主理和加入的饭搭子关系、成员角色与超额状态
stores/settings.ts     # 本地配置、持久化 key 统一入口
```

页面临时状态不进入 Pinia，例如列表数据、分页游标、loading、筛选条件、弹窗显示、编辑表单草稿和一次性操作上下文。

食材与采购是否进入 store 暂缓。只有出现跨页勾选、离线队列、全局同步或首页摘要强依赖时，才提升为独立 store。

## 首批验证命令

脚手架落地后至少执行：

```bash
git diff --check
pnpm --filter @next-meal/client type-check
pnpm --filter @next-meal/client lint
pnpm --filter @next-meal/client build:mp-weixin
```

如果当时还没有统一脚本，必须说明缺口，并至少执行当前可用的等价命令。
