# 客户端主题 Token 收口方案（2026-08-27）

## 目标

在不改业务功能的前提下，先把 `apps/client` 的主题系统收口到“少源头、强语义、弱散点”的结构，支撑后续 `1 色主题` 与 `2 色主题` 落地。

本轮不直接重做页面视觉，只先冻结：

1. 颜色变量的分层规则。
2. `1 色 / 2 色` 主题的源头约束。
3. 现有 token 的 `保留 / 合并 / 废弃 / 改派生` 清单。
4. 第二维色的使用边界。
5. 阴影和按钮等全局视觉基线的收口方向。

## 当前实现基线

当前主题能力分成三处：

1. [apps/client/src/themes/presets.ts](/Users/yangpenghui/personal/cook/apps/client/src/themes/presets.ts)
   负责主题 seed 源头，目前一级源头已经收口到 `bg / surface / text / primary / secondary`。
2. [apps/client/src/composables/useTheme.ts](/Users/yangpenghui/personal/cook/apps/client/src/composables/useTheme.ts)
   负责运行态派生 `themeVars`，把 seed 映射成 `--color-*`、`--shadow-*`、`--button-*`、`--entry-*` 等变量。
3. [apps/client/src/styles/colors.scss](/Users/yangpenghui/personal/cook/apps/client/src/styles/colors.scss)
   负责首屏 fallback 和全局基础 token。

额外现状：

1. 页面和组件已广泛消费 `--color-primary-soft`、`--shadow-card`、`--button-primary-gradient-start/end`。
2. 个别主题皮肤文件仍会覆盖通用语义色，例如 [apps/client/src/themes/bold-contrast/skins.scss](/Users/yangpenghui/personal/cook/apps/client/src/themes/bold-contrast/skins.scss)。
3. 个别页面继续直接写更重的局部阴影，导致全局 token 即使统一，页面视觉仍可能发散。

## 正式分层规则

后续主题变量按四层组织。

### 1. 原始层

命名：

- `--color-raw-primary`
- `--color-raw-secondary`
- `--color-raw-bg`
- `--color-raw-surface`
- `--color-raw-text`

规则：

1. 只作为设计变量来源。
2. 不允许页面和业务组件直接使用。
3. 不在页面 `style` 中直接出现。

### 2. 主题色系层

命名：

- `--color-primary`
- `--color-primary-soft`
- `--color-primary-active`
- `--color-primary-contrast`
- `--color-secondary`
- `--color-secondary-soft`
- `--color-secondary-active`
- `--color-secondary-contrast`

规则：

1. 只由原始层派生。
2. `1 色主题` 只启用 `primary` 色系。
3. `2 色主题` 才启用 `secondary` 色系。
4. 页面代码默认也不应直接使用这层，除非该元素本身就是“主题强调元素”。

### 3. 语义层

命名建议：

- 背景：`--color-page`、`--color-surface`、`--color-surface-soft`、`--color-surface-muted`
- 文本：`--color-text`、`--color-text-secondary`、`--color-text-tertiary`、`--color-text-inverse`
- 图标：`--color-icon`、`--color-icon-secondary`、`--color-icon-active`
- 标签：`--color-tag-neutral-*`、`--color-tag-primary-*`、`--color-tag-secondary-*`、`--color-tag-success-*`、`--color-tag-warning-*`、`--color-tag-danger-*`
- 边框：`--color-border`、`--color-border-light`、`--color-divider`
- 状态：`--color-success`、`--color-warning`、`--color-danger`
- 阴影：`--shadow-card`、`--shadow-floating`、`--shadow-tabbar`

规则：

1. 页面和组件默认只允许使用这一层。
2. 所有业务页面新样式默认先找语义层，不允许重新造颜色。
3. 语义层的值只能引用“主题色系层”或中性色派生，不能回跳原始层。

### 4. 组件层

命名示例：

- `--button-primary-bg`
- `--button-primary-text`
- `--button-primary-shadow`
- `--entry-board-bg`
- `--login-popup-sheet-shadow`

规则：

1. 只允许引用语义层。
2. 不允许在组件层再引入新的 hex / rgba 来源色。
3. 不允许反向成为新的全局主题源头。

## 1 色 / 2 色主题规则

### 1 色主题

定义：

- 只配置一个主源头色 `primary`。
- `secondary` 不再强制必填；`mono` 主题由运行态从 `primary` 自动派生第二色。

适用方向：

- 清新食材感
- 极简黑白灰
- 单一品牌主色主题

派生原则：

1. 浅色模式下，弱底色优先降饱和、提亮、降低透明度。
2. 深色模式下，弱底色和高亮态优先提亮，不照搬浅色模式算法。
3. 同一个 `primary` 必须显式产出浅色/深色两套映射，不把深浅模式强行塞进一套 CSS 混色逻辑。

### 2 色主题

定义：

- 配置 `primary + secondary` 两个主题源头色。
- `primary` 是品牌色。
- `secondary` 是食物感辅助色，不是第二品牌色。

适用方向：

- 清新食材绿 + 暖食欲橙
- 主品牌冷静色 + 少量暖提味色

边界规则：

1. `secondary` 默认不能进入全局主按钮。
2. `secondary` 默认不能进入大面积页面背景。
3. `secondary` 默认不能作为通用标题字色和通用图标默认色。
4. `secondary` 只允许出现在“饭相关”的点缀语义中。

首批允许使用第二色的范围：

1. 食物相关插画细节。
2. 食材、餐具、饭点氛围类标签。
3. 局部食欲导向强调块。
4. 少量与“吃”直接相关的辅助按钮或提示。

超出上面列表的使用，视为越界。

## 现有 Token 整理结论

以下结论面向当前客户端主题实现。

### 一、保留

这些变量继续保留，但职责要写死：

1. `--color-page`
2. `--color-surface`
3. `--color-surface-muted`
4. `--color-text`
5. `--color-text-secondary`
6. `--color-text-tertiary`
7. `--color-text-inverse`
8. `--color-primary`
9. `--color-primary-soft`
10. `--color-primary-active`
11. `--color-border`
12. `--color-divider`
13. `--shadow-card`
14. `--shadow-floating`
15. `--shadow-tabbar`

保留原因：

1. 页面已有大量使用，强行删除会造成大范围替换风险。
2. 这些变量本身属于语义层，方向是对的。
3. 后续可以在不改页面调用方式的前提下，先改内部派生逻辑。

### 二、合并

这些变量建议后续合并或压缩职责：

1. 原先保留的 `--theme-bg / --theme-surface / --theme-text / --theme-primary / --theme-secondary / --theme-accent` 已不再需要继续对外输出。
2. 运行态主题变量只保留 `--color-raw-*` 作为设计来源记录，以及 `--color-* / --button-* / --shadow-* / 页面语义 token` 作为真实消费层。
3. 页面和组件继续禁止引用已移除的 `theme-*` 变量。
6. `--button-primary-gradient-start/end` 保留给按钮组件消费，但不再视为一级主题色来源。

合并原因：

1. `theme-*` 与 `color-*` 语义重复，继续保留只会增加变量噪音。
2. `button-primary-gradient-start/end` 已经是表现层，不应继续承担主题源头角色。
3. 页面如果继续直接依赖这些变量，会让“1 色 / 2 色”的规则难以落地。

### 三、废弃

这些变量不建议继续扩散，后续逐步废弃：

1. 各皮肤里直接覆盖的通用语义色副本。
2. 页面内直接写死的主题 hex / rgba。
3. 页面内独立定义、但实际只是 `primary-soft` 变体的临时背景色。
4. 页面内独立定义、但本质属于全局卡片阴影的局部 `box-shadow`。

废弃原则：

1. 不要求本轮一次删光。
2. 从新增代码开始禁止继续增加。
3. 后续按页面迁移逐步回收。

### 四、改派生

这些是本轮后续实现的重点：

1. `accent`
   目前在 `ThemeSeed` 里可选，且 `useTheme.ts` 用 `deriveAccent()` 统一派生。
   后续改成：
   - `1 色主题`：运行态派生
   - `2 色主题`：显式给 `secondary`
2. `--button-primary-shadow`
   目前体积偏大，后续继续保留，但数值改为更克制。
3. `--shadow-card` / `--shadow-floating`
   继续保留，但由统一暖灰或主色极浅染色派生，不允许页面再随意加重。
4. `--entry-*`
   继续保留为组件层变量，但统一改为只引用语义层。
5. `--login-popup-*`
   继续保留为组件层变量，但统一改为只引用语义层。

## 需要新增的语义 Token

为支撑“主题色、字体色、图标色、标签色、辅助色”等职责拆分，建议新增：

1. `--color-surface-soft`
2. `--color-icon`
3. `--color-icon-secondary`
4. `--color-icon-active`
5. `--color-tag-bg`
6. `--color-tag-text`
7. `--color-tag-accent-bg`
8. `--color-tag-accent-text`
9. `--color-secondary`
10. `--color-secondary-soft`
11. `--color-secondary-active`
12. `--color-secondary-contrast`

说明：

1. `1 色主题` 下，`secondary` 系列可以由 `primary` 派生，或保持未启用。
2. 页面只消费标签语义色，不关心它来自 `primary` 还是 `secondary`。

## 阴影收口规则

当前全局阴影偏重，尤其：

1. 普通 `card / panel / tabbar` 仍应继续压到小偏移、浅色阴影，默认基线以 `0 2rpx 8rpx` 一档为主。
2. 普通主按钮和危险按钮不应再维持过重投影，默认基线以 `0 3rpx 10rpx` 一档为主。
3. 登录弹层、玻璃弹层这类浮层即使保留材质感，也不应再依赖 `0 -20rpx 60rpx` 这类重阴影制造存在感。

## 当前剩余边界（2026-08-27 审计）

经过本轮持续收口后，客户端里还残留的 `entry-*` 使用，已经基本收缩到明确的 hero / 插画 / cover-fill 层，不再视为普通内容层漏网。

当前已确认应暂时保留在 hero 或氛围层的页面包括：

1. [apps/client/src/pages/home/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages/home/index.vue)
   首页主视觉、插画、运营入口卡和相关按钮仍大量依赖 `entry-*`。
   这是当前最高风险区域，而且该文件是 `MM`，后续要单独按 hero 边界审。
2. [apps/client/src/pages/me/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages/me/index.vue)
   `profile-hero` 与 `profile-hero--halo` 使用 `entry-*`，属于“我的”页顶部氛围层，不是普通卡片或正文内容层。
3. [apps/client/src/pages_pantry/list-detail/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_pantry/list-detail/index.vue)
   `detail-hero` 顶部大 Hero 使用 `entry-*`，属于页面头图承接层。
4. [apps/client/src/pages_pantry/list-complete/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_pantry/list-complete/index.vue)
   `complete-hero` 顶部大 Hero 使用 `entry-*`，属于页面完成态头图层。
5. [apps/client/src/pages_recipe/detail/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_recipe/detail/index.vue)
   `hero__cover-fill` 使用 `entry-*`，属于详情封面填充层，不是正文承接层。

结论：

1. 非首页普通内容层里的 `entry-*`、局部重阴影、重复状态弱底、局部白色提亮，已经基本收完。
2. 后续如果继续推进，就不该再用“扫散点”的方式处理这些残留位，而应单独定义“hero / 插画层允许使用哪些组件层 token”。
3. 在没有单独确认首页 hero 规则前，不建议继续批量删除剩余 `entry-*`。

### 2026-08-28 状态更新

经过 2026-08-28 的连续收口，当前边界可以进一步明确为：

1. 非首页普通内容页里，原先高频重复的浅底、弱状态底、弱光斑、图片遮罩和覆盖层，已经基本回收到统一语义层。
2. 当前已稳定可复用的新增语义包括：
   - `--button-secondary-*`
   - `--button-primary-border`
   - `--button-primary-filter`
   - `--button-secondary-border`
   - `--button-secondary-filter`
   - `--page-hero-*`
   - `--page-cover-fresh-bg`
   - `--color-surface-soft-*`
   - `--color-surface-overlay-*`
   - `--color-primary-soft-fill-*`
   - `--color-*-halo`
   - `--color-overlay-*`
   - `--overlay-image-mask`
   - `--material-mask-filter`
   - `--material-card-*`
   - `--material-panel-*`
   - `--material-tabbar-*`
3. 非首页剩余扫描里，已经没有新的批量 `color-mix(...)` 热点；最后留下的只是个别直接消费语义 token 的组件层外环或系统 fallback 定义，不再属于“页面私自造色”问题。
4. 共享组件层当前也没有发现新的成批原始色来源，绝大多数变化已经回到 `button / shadow / surface / border / overlay` 这些主题主干语义。
5. 因此，后续如果继续推进到 90% 以上，代码层主战场已经不再是普通内容卡或统一按钮壳，而主要收缩为首页和少数详情页的 Hero / 插画 / 氛围层细节，不适合再按普通页面散点修色。

### 2026-08-28 材质层补充

为支撑 `apple-glass` 这类“可切换皮肤”，当前主题系统已经不再只定义颜色和阴影，也补进了一层共享材质 token：

1. 遮罩滤镜：`--material-mask-filter`
2. 卡片壳：`--material-card-bg / border / shadow / filter`
3. 浮层壳：`--material-panel-bg / border / shadow / filter`
4. 底部导航壳：`--material-tabbar-bg / border / shadow / filter`
5. 按钮材质补充：`--button-primary-border / filter`、`--button-secondary-border / filter`

约束：

1. 默认皮肤下，这些 token 主要作为“统一入口”，值尽量回指现有 `surface / border / shadow / button` 语义，不另造新色。
2. `apple-glass` 这类皮肤只覆写材质 token，不要求页面自己写新的 blur / rgba 公式。
3. 共享壳组件优先吃这层 token，页面业务样式不直接承担毛玻璃实现细节。

### 2026-08-28 收口后状态

截至 2026-08-28 当前代码状态，可以再明确四点：

1. 首页 `pages/home/index.vue` 里普通导航壳、主/次按钮壳、主内容卡壳和 quick action 图标壳，已经并入 `material-tabbar`、`material-card`、`button-primary`、`button-secondary`。
2. `pages_share/preview`、`pages_share/memory`、`pages_home/topic`、`pages_meal/plan`、`pages_pantry/list-detail` 这批高频页面的普通 card / button 壳，也已经被 `skin-material.test.ts` 明确锁住，不再允许回退成各页自己维护的 `surface / shadow / blur`。
3. `token-usage.test.ts` 现在也额外扫描普通页面和组件里的直接 `#hex` / `rgb(a)` 色值，最后残留的 `pages_recipe/detail` 营养环 `#000` 已经改回 `--color-mask-solid`。这意味着普通内容层当前不只是“不该乱写色”，而是已经有自动回归防止再引入。
4. 因此，当前剩余的高风险点已经从“普通内容层不统一”切换为“多主题在 Hero / 插画 / 半透明层上的真实视觉表现是否稳定”。下一步更重要的是 WeChat 开发者工具或真机验收，而不是继续机械扫普通卡片。

当前已经接入这层材质 token 的共享组件包括：

1. `Confirm`
2. `SheetShell`
3. `TabBar`
4. `Empty`
5. `MenuConfirmSheet`
6. `ShoppingListPickerSheet`
7. `PlanArrangeSheet`
8. `TextFieldSheet`
9. `AddToPrivateSheet`
10. `AddToPlanSheet`
11. `InviteShareSheet`
12. `EventScheduleSheet`
13. `RecipeSearchBar`
14. `LoginEmptyState` 使用的 `login.scss`
15. `Toast`
16. `ImageField`

补充说明：

1. 共享输入壳也开始并入 `material-card-*`，避免玻璃主题下卡片是半透明、输入框却退回普通实底。
2. `Toast` 归到 `material-panel-*`，因为它本质上是顶部浮层而不是普通内容卡。
3. `ImageField` 的小操作按钮也改为直接消费主按钮材质 token，保证“按钮风格统一”不只停留在大按钮。

## Hero / 插画层规则

`entry-*` 后续不再被视为“页面可以自由使用的一套私色”，而是明确收口为 hero / 插画层专用的组件层 token。

### 允许承担的职责

1. 顶部大 Hero 的背景渐变、氛围光斑和封面承接层。
2. 与“吃”直接相关的插画色块、餐具/食材装饰色、封面占位图形。
3. Hero 内部少量专属按钮或运营入口壳子，但前提是它们确实属于该 Hero 视觉的一部分。

### 不允许承担的职责

1. 普通正文卡片背景。
2. 通用按钮底色。
3. 通用标签、通用图标、通用正文文字颜色。
4. 普通弹层、普通底部操作区、普通列表项的背景和阴影。

### Hero 层允许引用的来源

1. `entry-*` 本身只能由 `color-page / color-surface / color-primary / color-secondary / color-text / color-mask / shadow-*` 这些既有语义层继续派生。
2. 不允许在页面 Hero 样式里直接新增新的 `hex / rgba / white-black 常量` 作为长期来源。
3. 如果需要第二色，只能走 `secondary` 或 `secondary-soft` 的既有派生，不重新造“第三品牌色”。

### Hero 层的阴影和材质约束

1. Hero 内普通承接卡面优先继续使用 `shadow-card`，不要再为 Hero 内卡片单独放大投影。
2. Hero 本体如果确实需要景深，优先靠背景渐变、mask、blur、装饰形状表达，不优先靠更重 box-shadow。
3. Hero 内的表层提亮优先复用 `color-surface-raised`、`color-shimmer-*`、`color-mask-*`，不再继续增加新的局部调白公式。

### 首页后续收口顺序

1. 先把首页里的 `entry-*` 按“Hero 本体 / 插画 / 运营入口卡 / 普通内容层”重新分组。
2. 先证明哪些节点确实属于 Hero 组件层，哪些只是普通内容层误借用了 Hero 色。
3. 只先回收“普通内容层误借用 Hero 色”的节点，不先动真正的主视觉插画和 Hero 结构。
4. 等首页分组稳定后，再决定是否把 `entry-*` 进一步拆成更少的 Hero 组件 token。

### 首页当前分组（2026-08-27 代码审计）

基于 [apps/client/src/pages/home/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages/home/index.vue) 当前代码，首页里的 `entry-*` 可以先按下面四组理解。

#### A. Hero 本体

这些节点仍应视为首页主视觉的一部分，暂不按普通内容层处理：

1. `.table-hero`
2. `.hero-copy__eyebrow`
3. `.hero-copy__title`
4. `.hero-copy__description`
5. `.hero-copy__button--primary`
6. `.hero-copy__button--ghost`
7. `.hero-banner`
8. `.hero-banner__shade`

说明：

1. 这组直接决定首页第一屏的主氛围、文案承接和主行动区。
2. 即使后续要改，也应按“首页 hero 组件”整体处理，而不是逐条扫颜色。

#### B. 插画与装饰物

这些节点属于“饭桌 / 食材 / 餐具”插画，不应直接压平到普通语义色：

1. `.table-scene__plate`
2. `.table-scene__rice`
3. `.table-scene__leaf`
4. `.table-scene__egg`
5. `.table-scene__bowl`
6. `.table-scene__cup`
7. `.feature-card__plate`
8. `.feature-card__food`
9. `.feature-card__mini-dot`
10. `.dock-action__dot`

说明：

1. 这组是“食欲感”和“食材感”的主要来源。
2. 后续如果要缩 token，也应保留插画层可用的 `food / plate / leaf / outline` 一类专用组件 token。

#### C. 运营入口卡

这些节点视觉上贴近首页主视觉，但仍然属于首页专属运营模块：

1. `.feature-card--main`
2. `.feature-card--mint`
3. `.feature-card--green`
4. `.feature-card__title`
5. `.feature-card__subtitle`
6. `.feature-card__status-action`
7. `.feature-card__status-action-text`
8. `.feature-card__mini-text`
9. `.dock-action__icon.quick-action--primary`
10. `.dock-action__icon.quick-action--mint`
11. `.dock-action__icon.quick-action--aqua`
12. `.dock-action__badge`

说明：

1. 这组不等于 Hero 本体，但仍然明显挂在首页第一屏的主题插画语言上。
2. 后续建议单独归成“home-entry-*”或等价的首页组件层，而不是直接并入通用卡片语义色。

#### D. 普通内容层误借 Hero 色

这组最适合作为首页后续第一批安全收口目标：

1. `.decision-card`
2. `.candidate-item__rank`
3. `.candidate-item__rank-text`
4. `.feed-item__avatar--rose`
5. `.feed-item__avatar--green`
6. `.feed-item__avatar--blue`
7. `.feed-item__avatar-text`
8. `.pantry-panel`
9. `.pantry-panel__action`
10. `.recent-arrangement__panel`
11. `.recent-arrangement__back`

说明：

1. 这组已经脱离首页主视觉本体，更接近“普通业务卡片 / 列表 / 摘要块”。
2. 它们当前继续借用 `entry-*`，会让首页难以和全局语义层拉开边界。
3. 后续若要在不大改首页结构的前提下继续推进主题系统，这组应先于 A/B/C 被处理。

### 首页第一批安全收口进度（2026-08-27）

已完成回收为语义 token 的节点：

1. `.decision-card`
2. `.candidate-item__rank`
3. `.candidate-item__rank-text`
4. `.feed-item__avatar--rose`
5. `.feed-item__avatar--green`
6. `.feed-item__avatar--blue`
7. `.feed-item__avatar-text`
8. `.pantry-panel`
9. `.pantry-panel__action`
10. `.pantry-summary__stat`
11. `.pantry-item`
12. `.pantry-item__dot--danger`
13. `.pantry-item__dot--warning`
14. `.pantry-item__dot--ok`
15. `.recent-arrangement__panel`
16. `.recent-arrangement__back`

这一批的共同特点：

1. 都是首页普通内容层、列表层或摘要承接层。
2. 改动后已经主要回到 `surface-raised / surface-soft / primary-soft / secondary-soft / button-primary / danger-warning-success` 这组语义 token。

当前仍建议留到下一批、不要和普通内容层混改的节点：

1. `.feature-card--main`
2. `.feature-card--mint`
3. `.feature-card--green`
4. `.feature-card__status-action`
5. `.feature-card__mini-text`
6. `.dock-action__icon.quick-action--primary`
7. `.dock-action__icon.quick-action--mint`
8. `.dock-action__icon.quick-action--aqua`
9. `.dock-action__badge`
10. `.family-recipe__visual`
11. `.family-recipe__visual--warm`
12. `.family-recipe__visual--fresh`
13. `.family-recipe__visual--cool`

原因：

1. 这些节点虽然不一定属于首页 Hero 本体，但仍然带明显的入口卡/缩略图/插画承接属性。
2. 如果直接按普通卡片语义层压平，容易损失首页当前“食材感”和入口识别度。

### 首页第二批组件层收口进度（2026-08-27）

已完成：

1. `.feature-card--main`
2. `.feature-card--mint`
3. `.feature-card--green`
4. `.family-recipe__visual--warm`
5. `.family-recipe__visual--fresh`
6. `.family-recipe__visual--cool`

收口方式：

1. 没有把它们直接压平成普通 `surface` 语义色。
2. 改为单独定义首页组件层 token：`--home-entry-feature-*` 与 `--home-entry-recipe-*`。
3. 这组 token 继续承接首页入口卡与无图缩略图的“清新食材感”，但不再让页面直接消费 `entry-primary / entry-side-* / entry-board-*`。
4. 这一步的目标是先把“首页专属视觉”和“Hero 专属 token”拆开，为后续继续压缩 `entry-*` 职责做准备。

### 首页入口插画层收口进度（2026-08-27）

已完成：

1. `.feature-card__art`
2. `.feature-card__plate`
3. `.feature-card__food`
4. `.feature-card__mini-text`
5. `.feature-card__mini-dot`
6. `.dock-action__dot`
7. `.family-recipe__plate`
8. `.family-recipe__food`

收口方式：

1. 这组仍然属于首页入口卡和菜谱缩略图的插画层，但不再继续直接消费 `entry-photo-* / entry-food-* / entry-outline / entry-ink`。
2. 新增 `home-entry-illustration-*` 等价的一组首页组件层 token，当前命名为 `--home-entry-art-* / plate-* / food-* / mini-* / dot-*`。
3. 这样首页入口插画语言仍保留“食材感”，但 `entry-*` 的剩余职责更集中到首页桌面 Hero 与桌面场景插画。

### 首页普通结构 token 收口进度（2026-08-27）

已完成：

1. `.decision-card`

收口方式：

1. `decision-card` 属于普通业务摘要卡，不再继续借用 `entry-board-radius`。
2. 统一改回全局结构 token `--radius-card`。
3. 这一步之后，首页残余的 `entry-*` 更接近只剩 Hero 文案、Hero 按钮和桌面主场景插画。

### 首页 Hero / 桌面场景组件层收口进度（2026-08-27）

已完成：

1. `.table-hero`
2. `.restaurant-bar__label`
3. `.restaurant-bar__name`
4. `.hero-banner`
5. `.hero-copy__eyebrow`
6. `.hero-copy__title`
7. `.hero-copy__description`
8. `.hero-copy__button--primary`
9. `.table-scene__plate`
10. `.table-scene__rice`
11. `.table-scene__leaf`
12. `.table-scene__egg`
13. `.table-scene__bowl`
14. `.table-scene__cup`

收口方式：

1. 这组仍然是首页专属主视觉，不改语义归属。
2. 但页面不再直接消费 `entry-primary / entry-board / entry-ink / entry-food / entry-outline`。
3. 改为通过 `--home-hero-*` 与 `--home-scene-*` 组件层 token 承接。
4. 这样 `entry-*` 在实现层可以继续作为内部来源存在，但页面层已经不直接依赖它。

### 主题 seed 源头收口进度（2026-08-27）

已完成：

1. `apps/client/src/themes/presets.ts` 的现有主题预设不再使用 `accent` 作为显式 seed 源头。
2. 统一改成 `secondary` 作为双色主题的第二源头色。

说明：

1. `ThemeSeed` 结构已正式移除旧 `accent` 兼容字段。
2. 运行态和正式预设都统一到 `primary + secondary`，更符合“1 色 / 2 色源头”目标。

### 非首页页面头图共享层收口进度（2026-08-27）

已完成：

1. `pages/me/index.vue` 的 `profile-hero`
2. `pages/me/index.vue` 的 `profile-hero--halo`
3. `pages_pantry/list-detail/index.vue` 的 `detail-hero`
4. `pages_pantry/list-complete/index.vue` 的 `complete-hero`
5. `pages_recipe/detail/index.vue` 的 `hero__cover-fill`

收口方式：

1. 这组不是首页 Hero 本体，而是普通页面里复用的“头图承接层 / 无图封面层”。
2. 新增共享页面层 token：`--page-hero-bg`、`--page-hero-halo-bg`、`--page-cover-fresh-bg`。
3. 这些 token 继续保留“清新食材感”的轻渐变和浅色光斑，但来源改成 `surface-muted / secondary-soft / primary-soft / surface-raised` 这组统一派生。
4. 这样非首页页面不再直接引用 `entry-primary / entry-side-* / entry-board-*`，`entry-*` 的职责更集中到首页 Hero/插画层。

### 普通暖背景页面收口进度（2026-08-27）

已完成：

1. `pages_meal/cook-mode/index.vue` 的页面底色
2. `pages_meal/assistant/index.vue` 的页面底色

收口方式：

1. 这类页面只是普通内容页的暖氛围底，不应该继续各自写死一套米色渐变。
2. 新增共享页面层 token：`--page-warm-bg`。
3. 由 `page / surface / secondary` 统一派生出轻暖背景，既保留食欲感，也回到少源头和可整体替换的规则。

### 高频派生公式语义化进度（2026-08-27）

已完成首批新增：

1. `--color-surface-soft-card`
2. `--color-surface-soft-panel`
3. `--color-surface-overlay`
4. `--color-primary-soft-fill`
5. `--color-warning-soft-fill`

已完成第二批新增：

1. `--color-surface-overlay-soft`
2. `--color-primary-soft-fill-subtle`

已完成第三批新增：

1. `--color-surface-muted-frost`
2. `--color-primary-soft-fill-strong`
3. `--color-warning-soft-fill-strong`
4. `--color-danger-soft-fill`

已完成第四批新增：

1. `--color-surface-soft-muted`
2. `--color-surface-overlay-weak`
3. `--color-primary-soft-fill-soft`
4. `--color-primary-soft-fill-weak`

已完成第五批新增：

1. `--color-primary-soft-fill-medium`
2. `--color-surface-primary-panel`
3. `--color-surface-primary-panel-soft`

已完成第六批新增：

1. `--color-danger-soft-fill-strong`
2. `--color-success-soft-fill`
3. `--color-info-soft-fill`

适用原则：

1. 页面和组件里重复出现的 `color-mix(surface, surface-soft)`、`color-mix(surface, page)`、`color-mix(primary-soft, surface)`、`color-mix(warning-soft, surface)` 不再继续各写一遍。
2. 这批 token 先承接普通卡面、轻面板、覆盖层和浅状态底，不承担首页 Hero 或插画职责。
3. 后续如果要继续收口，应优先新增这种“高频语义派生 token”，而不是继续在页面里堆 `color-mix(...)`。
4. 当同一语义只是在“强一点 / 弱一点”的层级上重复出现时，允许保留极少量 `fill / fill-subtle`、`overlay / overlay-soft` 这样的成对 token，但不要继续扩成很多页面专用名字。
5. 同理，状态色弱底如果已稳定跨页复用，可以收成 `warning/danger/success/info/primary soft fill`，但仍应限制在普通标签、弱状态块和轻提示层，不应直接替代按钮或首页主视觉。
6. 当 `surface-soft-card / panel`、`surface-primary-panel`、`primary-soft-fill-*` 已经能覆盖同一语义层级时，优先复用现有 token，不再为了剩余单页混色继续扩出更多近义命名。
7. `border-light` 这类被多个页面直接消费的细分边框语义，必须由主题主干统一提供，不能只存在于个别皮肤特例里。

1. `--shadow-card: 0 12rpx 32rpx ...`
2. `--shadow-floating: 0 -8rpx 28rpx ...`
3. `--button-primary-shadow: 0 22rpx 44rpx ...`

后续收口方向：

1. 减少 Y 轴偏移。
2. 减少模糊半径。
3. 降低透明度。
4. 阴影主要表达层级，不表达明显悬浮感。

## 首批迁移顺序

为了最小化和当前脏工作区冲突，后续实施建议分三段：

### 第一段：主题基础层

文件：

1. `apps/client/src/themes/presets.ts`
2. `apps/client/src/composables/useTheme.ts`
3. `apps/client/src/styles/colors.scss`

目标：

1. 建立 `1 色 / 2 色` 源头规则。
2. 新增缺失语义 token。
3. 收紧阴影和按钮派生逻辑。

### 第二段：主题特例皮肤清理

文件：

1. `apps/client/src/themes/default/skins.scss`
2. `apps/client/src/themes/bold-contrast/skins.scss`
3. 其他 `apps/client/src/themes/*/skins.scss`

目标：

1. 只保留皮肤专属表现层变量。
2. 移除对通用语义色的重复覆盖。

### 第三段：页面散点回收

优先页面：

1. `apps/client/src/pages/home/index.vue`
2. `apps/client/src/pages/recipe/index.vue`
3. `apps/client/src/pages/me/index.vue`
4. `apps/client/src/pages_meal/detail/index.vue`
5. `apps/client/src/pages_pantry/list-detail/index.vue`

目标：

1. 回收页面里更重的局部阴影。
2. 回收页面里“近似主题色”的局部写死色。
3. 让重点页面先切回统一语义 token。

## 结论

这套规则可以在现有架构上落地，不需要推翻整个主题系统。

真正需要调整的不是“有没有主题能力”，而是：

1. 主题源头过于松散。
2. 通用语义和表现层变量有重复。
3. 个别皮肤和页面绕过了全局规则。

后续实际实现应先做“主题基础层收口”，再做“页面散点回收”，不要一开始就按页面逐个修色。
