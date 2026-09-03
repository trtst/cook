# 主题系统设计规范与开发落地约束

## 1. 目标与边界

本文定义一套可复用的主题系统规则，用于约束多端产品中的颜色设计、主题派生、材质表达与工程落地方式。

本文解决的问题：

1. 限制主题源头色数量，避免主题越做越散。
2. 把颜色按职责拆分成稳定的语义层，而不是让页面自行配色。
3. 让浅色与暗黑模式都沿同一派生链路生成，而不是靠页面补丁修色。
4. 让前台、后台或不同终端可以各自维护 token，但仍遵守同一套主题规则。
5. 为后续新增主题、扩展主题模式和静态校验提供统一依据。

本文不直接定义任何业务页面、品牌文案、运营模块或产品专属视觉资产。

本文约束的是主题规则，不要求不同端共用同一份 token 文件。

### 1.1 适用范围

本文适用于同一产品体系内的不同终端主题建设，包括但不限于：

1. 功能型前台
2. 高密度治理后台
3. PC 官网或品牌展示站点

这些终端可以各自维护独立 token，但都应遵守同一套主题规则。

推荐边界：

1. 功能型前台优先强调可操作性、状态反馈与长期使用稳定性
2. 高密度治理后台优先强调信息密度、对比度、可读性与弱干扰
3. PC 官网优先强调品牌表达、叙事感、视觉节奏与内容承载

三者允许拥有不同的材质表达、组件 token 和页面层结构，但不应拥有彼此冲突的 seed 模型、语义分层规则或暗黑模式派生逻辑。

## 2. 总模型

主题系统必须采用严格单向的四层结构：

`seed -> semantic -> material -> component/page`

### 2.1 Seed 层

Seed 是主题源头色层，只负责定义主题气质，不负责页面语义。

Seed 层允许定义：

1. `primary`
2. `secondary`
3. 极少量中性色基准，例如 `bg`、`surface`、`text`

Seed 层禁止定义：

1. 页面级颜色
2. 组件级颜色
3. 状态标签颜色
4. 阴影、边框、透明度、模糊等材质表达

### 2.2 Semantic 层

Semantic 层负责把 seed 翻译成职责清晰的颜色语义。

它回答的是“这个颜色是拿来做什么的”，而不是“这个颜色来自哪一页”。

Semantic 层必须覆盖：

1. `theme`
2. `text`
3. `icon`
4. `tag`
5. `support`
6. `background`
7. `border`
8. `state`

### 2.3 Material 层

Material 层负责把 semantic 色落到实际表面材质上。

它回答的是“同一套语义色，在不同承载壳层上应该如何呈现”。

例如：

1. `chrome`
2. `panel`
3. `card`
4. `toolbar`
5. `input`
6. `table`
7. `popover`
8. `overlay`

Material 层允许组合 semantic 色、透明度、边框、阴影、模糊与高光。

Material 层禁止新增独立源头色。

### 2.4 Component/Page 层

页面和组件只能消费 semantic token 与 material token。

组件优先复用共享 token。

页面只有在确实存在局部结构语义时，才允许定义极少量 page-level token，但仍必须由 semantic 或 material token 组合得到，不得直接跳回 seed 层。

补充规则：

1. 页面专属前缀如 `home-*`、`me-*` 不能成为新的全局主题 token 类别
2. 如果一组视觉 token 本质是“插画 / 装饰 / 图形语义”，应收成通用命名，例如 `illustration-*`
3. 尺寸、线宽、半径这类纯结构值，不应混入全局颜色派生函数

## 3. 源头色规则

### 3.1 主题模式

主题模式指的是源头色数量，不是最终页面上能出现的颜色数量。

首批只要求落地：

1. `1 色主题`
2. `2 色主题`

暂不要求首批实现，但应预留结构：

1. `3 色主题`

工程约束：

1. 每个主题 preset 必须显式声明自身属于 `mono` 或 `duo`
2. `mono` 只能暴露 `primary`
3. `duo` 只能暴露 `primary + secondary`
4. `presets.ts` 只声明 `mono / duo`、palette、dark、权限和素材类型，不保存颜色 seed
5. 颜色 seed 只写在全局 fallback 或对应 `themes/{skin}/skins.scss` 的开头
6. `mono` 主题的 `skins.scss` 仍可声明 `--theme-secondary` 作为派生后的辅助色，但它不是第二个源头色
7. `supportsPalette`、`palettes` 与 `supportsDark` 必须和对应 skin stylesheet 中的选择器能力一致

### 3.1.1 当前默认基线

客户端当前默认基线固定为 `default / default`：用户侧标签为“清新食材”，属于 `duo`，支持浅色 palette 与暗黑模式。它是现有主题派生和自动校验的基准，不将“基础”作为另一个皮肤或历史兼容别名保留。

### 3.2 1 色主题

`1 色主题` 只有一个品牌主色 `primary`。

其他浅底、强调、弱提示、标签、边框高亮与背景氛围，必须从 `primary + 中性色基准` 派生，不得额外新增独立彩色源头。

适用场景：

1. 极简主题
2. 品牌收敛度要求高的产品
3. 希望降低页面噪音的后台系统

### 3.3 2 色主题

`2 色主题` 使用 `primary + secondary` 两个源头色。

推荐分工：

1. `primary` 负责主品牌气质、主按钮、主高亮、主选中态
2. `secondary` 负责补充氛围、辅助强调、次级标签、装饰弱底或局部引导

禁止把 `secondary` 用成另一套与 `primary` 争主次关系的主色系统。

### 3.4 3 色主题预留

`3 色主题` 只预留结构，不作为首批默认方案。

引入第三色前，必须先证明：

1. 现有 `primary + secondary` 无法覆盖真实视觉需求
2. 第三色不会与状态色职责冲突
3. 第三色有明确边界，不会退化成任意散色入口

## 4. 语义层规范

### 4.1 Theme

`theme` 用于表达品牌主气质，不直接承担页面所有具体颜色职责。

建议最小集合：

1. `theme.primary`
2. `theme.secondary`
3. `theme.primarySoft`
4. `theme.secondarySoft`
5. `theme.primaryHalo`
6. `theme.secondaryHalo`

### 4.2 Text

字体色必须按可读层级拆分，而不是按页面拆分。

建议最小集合：

1. `text.primary`
2. `text.secondary`
3. `text.tertiary`
4. `text.disabled`
5. `text.inverse`

规则：

1. `text.primary` 用于主信息
2. `text.secondary` 用于补充信息
3. `text.tertiary` 用于弱提示
4. `text.disabled` 只表达不可用，不承担“低优先级但可操作”
5. 深色底上的文字统一走 `text.inverse` 及其派生，不另起页面私色

### 4.3 Icon

图标色必须独立于文字色命名，避免图标语义长期寄生在文字体系上。

建议最小集合：

1. `icon.primary`
2. `icon.secondary`
3. `icon.tertiary`
4. `icon.accent`
5. `icon.inverse`

规则：

1. 默认信息型图标优先使用 `icon.secondary`
2. 强调型图标才使用 `icon.accent`
3. 图标不可长期直接使用品牌源头色或裸状态色

### 4.4 Tag

标签颜色必须区分“普通分类标签”与“状态标签”。

建议最小集合：

1. `tag.neutralBg`
2. `tag.neutralText`
3. `tag.primaryBg`
4. `tag.primaryText`
5. `tag.secondaryBg`
6. `tag.secondaryText`
7. `tag.successBg`
8. `tag.successText`
9. `tag.warningBg`
10. `tag.warningText`
11. `tag.dangerBg`
12. `tag.dangerText`

规则：

1. 分类标签优先走 `neutral / primary / secondary`
2. 状态标签优先走 `success / warning / danger`
3. 不要把“品牌色标签”和“风险状态标签”混成一个体系

### 4.5 Support

辅助色用于提醒、强调、补充信息，但不得抢主色。

建议最小集合：

1. `support.info`
2. `support.highlight`
3. `support.notice`

规则：

1. 辅助色优先从 `primary / secondary` 的弱变体派生
2. 辅助色不应承担按钮主操作职责
3. 辅助色不应替代状态色

### 4.6 Background

背景色必须明确层级，避免所有容器都只用 `surface`。

建议最小集合：

1. `background.page`
2. `background.pageElevated`
3. `background.panel`
4. `background.card`
5. `background.cardMuted`
6. `background.section`
7. `background.overlay`

规则：

1. 页面底、内容区、弱分区和卡片底要可区分
2. 弱分区背景不等于卡片背景
3. overlay 不得由页面自行写透明黑白值

### 4.7 Border

边框和分割线必须独立成层，不得长期依赖背景色硬凑。

建议最小集合：

1. `border.default`
2. `border.light`
3. `border.strong`
4. `border.divider`
5. `border.active`

规则：

1. 容器描边与分割线可同源，但命名必须可区分
2. `border.active` 只用于选中或聚焦态
3. 不允许组件自己写临时透明描边公式

### 4.8 State

状态色是稳定语义，不应绑定某个页面主题。

建议最小集合：

1. `state.success`
2. `state.warning`
3. `state.danger`
4. `state.info`
5. `state.disabled`

建议每个状态色至少有：

1. `base`
2. `soft`
3. `text`
4. `border`

规则：

1. 状态色优先表达系统语义，不参与品牌主视觉竞争
2. 禁用态不等于弱提示态
3. 危险、警告、成功不允许被 secondary 主题色替代

## 5. 材质层规范

## 5.1 目标

材质层的目标是让颜色之外的“表面表达”也统一，包括：

1. 透明度
2. 边框
3. 阴影
4. 模糊
5. 高光
6. 蒙层

同一项目中，不应让每个页面各自维护一套玻璃、磨砂、轻卡片、浮层阴影公式。

### 5.2 建议分层

建议至少定义：

1. `material.chrome`
2. `material.panel`
3. `material.card`
4. `material.input`
5. `material.control`
6. `material.table`
7. `material.popover`
8. `material.overlay`

每类材质建议包含：

1. `background`
2. `border`
3. `shadow`
4. `filter`
5. `highlight`

补充规则：

1. 普通 `card / button / panel / tabbar` 如果已经依赖外阴影或磨砂材质建立层级，默认应无可见外描边
2. `input` 与 `control` 应独立于 `card` 材质命名，避免输入框、搜索框、选择胶囊长期借用普通卡片 token
3. `border` 优先留给输入态、选中态、聚焦态、分割线和确有结构需要的边界，不应用来重复制造立体感
4. 同一组件不应同时依赖明显 `shadow + border` 去表达普通层级，避免壳层发硬、发脏
5. 当前前台默认基线应保持轻量：普通 `card / panel / tabbar` 优先控制在近似 `0 2rpx 8rpx` 的浅阴影，普通按钮优先控制在近似 `0 3rpx 10rpx` 的浅阴影，避免大偏移和厚重悬浮感

### 5.3 轻玻璃的使用边界

轻玻璃适合用于 site chrome 或 condensed shell，不适合无边界铺满整个信息面。

推荐使用范围：

1. 顶部 header
2. 侧栏壳
3. 搜索条
4. 筛选工具条
5. 小型浮层
6. 悬浮面板

慎用或弱化范围：

1. 大型数据表主体
2. 长列表正文区
3. 高密度数字分析区
4. 需要持续阅读的大段信息区

原因：

1. 玻璃感越强，信息密度越高时越容易影响可读性
2. 后台系统优先级通常是效率、对比度与稳定性，而不是大面积氛围感

### 5.4 轻玻璃后台基线

当后台采用 condensed 轻玻璃风格时，可使用如下材质基线作为参考：

1. `border: 1px solid rgba(21, 20, 15, 0.08)`
2. `background: rgba(255, 255, 255, 0.42)`
3. `backdrop-filter: blur(12px) saturate(1.4)`
4. `box-shadow: inset 0 0 2px 1px rgba(255, 255, 255, 0.55), inset 0 0 10px 4px rgba(255, 255, 255, 0.22), 0 6px 24px rgba(17, 17, 26, 0.06), 0 12px 40px rgba(17, 17, 26, 0.05)`

说明：

1. 这是材质层参考，不是页面直接拷贝值
2. 实际项目中应收成材质 token
3. 深浅模式下可保留同一结构，但数值需重新派生，不应直接反转
4. 如果产品方向是极简、克制或清淡食材感，应优先继续压低阴影偏移，并去掉普通壳层可见描边

### 5.5 暗黑模式下的材质原则

暗黑模式不是把浅色玻璃整体取反。

暗黑材质必须重新控制：

1. 背景透度
2. 描边亮度
3. 内高光强度
4. 外阴影浓度
5. 模糊与饱和度的实际可读性

原则：

1. 暗黑模式里的玻璃背景通常更接近深色实体底
2. 边框需要更可见，但不能发灰发脏
3. 内高光必须比浅色模式弱
4. 表格、表单、列表的正文区应比导航壳层更实

## 6. 开发落地约束

### 6.1 前后台关系

不同端可以各自维护 token，但必须共享同一份主题规则。

允许：

1. 前台维护自己的 token 文件
2. 后台维护自己的 token 文件
3. 官网维护自己的 token 文件
4. 不同终端保留不同的组件层命名

不允许：

1. 不同终端分别发明不同的 seed 模型
2. 一端按语义层设计，另一端继续散写页面私色
3. 一端支持暗黑派生，另一端靠页面局部补丁

### 6.2 代码消费边界

页面和组件只能直接消费：

1. semantic token
2. material token
3. 必要的 component-level token

禁止：

1. 直接写品牌源头色十六进制
2. 直接写零散 `rgb()` 或 `rgba()`
3. 直接写零散 `blur()`、`backdrop-filter`
4. 直接写页面私有阴影公式
5. 从 seed 层在页面里临时派生颜色

### 6.2.1 快速替换规则

客户端主题收口默认按以下规则批量替换，不再逐页单独发明样式：

1. 普通 `card / panel / tabbar / button` 默认不保留可见 `border`
2. 普通承载层只通过 `background + box-shadow + backdrop-filter` 建立层次
3. `border` 只留给输入框、分隔线、选中态、虚线占位和明确风险态
4. 页面与组件禁止直接写 raw `blur(...)` 或 `saturate(...) blur(...)`
5. 页面与组件禁止直接写 seed 色、raw 色和本地主题 alias，必须走 semantic 或 material token
6. 同类壳体优先机械替换到共享 token，不再逐页重写颜色和材质公式

对应替换映射：

1. 普通卡片壳体 -> `material-card-*`
2. 面板 / sheet 主体 -> `material-panel-*`
3. 顶部或底部悬浮操作壳 -> `material-tabbar-*`
4. 输入框 / 文本域 / 搜索框 -> `material-input-*`
5. 普通可选 chip / 控制块 -> `material-control-*`
6. 主按钮 / 次按钮 / 危险按钮 -> `button-*`

工程要求：

1. 能用全局扫描拦截的规则，优先写进测试
2. 新页面若要例外，必须先说明它不属于“普通壳体”
3. 同一类残留优先批量处理，不再为每个页面单独补一套局部判断
4. 并行收口时，规则式批量替换只覆盖当前尚未修改的消费层文件；已被其他任务修改的文件不回扫、不覆盖，只由其实现 owner 按已确认规则处理
5. 自动测试继续守住已纳入扫描范围的 raw 色、raw filter 与普通共享材质 border，不能把批量替换范围扩大为对已修改文件的二次改写

### 6.3 允许存在的本地 token

以下场景允许定义少量局部 token：

1. 单页 hero
2. 插画层
3. 单组件内部的重复材质片段
4. 同一页中重复出现、但没有必要上升为全局 token 的局部结构

前提：

1. 这些 token 必须由 semantic 或 material 组合得到
2. 不得新增独立源头色
3. 不得与已有全局 token 职责重复

### 6.4 新主题新增流程

新增主题时，至少应经过：

1. 确认是 `1 色主题` 还是 `2 色主题`
2. 在 `presets.ts` 定义主题能力元数据
3. 在对应 `themes/{skin}/skins.scss` 开头定义 `--theme-*` 源头变量
4. 只从 `--theme-*` 或 semantic token 派生 material token
5. 验证 light 与 dark
6. 验证基础组件与高频页面
7. 通过静态检查与真实界面验收

禁止跳过 semantic 层直接手工修组件色。

### 6.5 组件与页面优先级

建议优先级：

1. 先统一共享壳组件
2. 再统一基础组件
3. 再统一高频页面
4. 最后处理局部 hero、插画和装饰层

原因：

1. 壳组件决定整个产品的基调
2. 基础组件决定主题一致性
3. 页面是消费层，不应倒逼主题结构

## 7. 验证与演进

### 7.1 设计验收

设计验收至少检查：

1. 主色与次色职责是否清楚
2. 字体、图标、标签、状态、背景、边框是否分层明确
3. 浅色与暗黑模式是否仍像同一产品
4. 轻玻璃是否只用在合适的壳层
5. 高密度信息区是否保持足够可读性

### 7.2 静态检查建议

建议对页面和组件增加静态约束，至少覆盖：

1. 禁止直接写十六进制色值
2. 禁止直接写散 `rgb()` 和 `rgba()`
3. 禁止直接写 `backdrop-filter`
4. 禁止直接写页面级自定义阴影公式
5. 禁止继续引用已经废弃的 token
6. 验证 preset 的 `mono / duo` 声明、palette 能力、暗黑能力和 skin stylesheet 是否一致
7. 验证共享消费层不会以格式差异绕过普通 `card / panel / tabbar / button` 的默认无可见 border 规则

### 7.3 真实界面验收

以下项目不能只靠静态检查证明完成：

1. 暗黑模式实际对比度
2. 轻玻璃可读性
3. 表格和表单在真实界面下的密度表现
4. 多主题切换时的层次稳定性
5. 不同页面之间的视觉连续性

### 7.4 后续演进

当 `1 色主题` 与 `2 色主题` 稳定后，再考虑：

1. `3 色主题` 的真实边界
2. 更细的材质分层
3. 跨端共享的命名对照表
4. 自动生成 token 或自动校验派生结果

演进原则：

1. 先减少源头，再增加派生
2. 先补职责缺口，再新增命名
3. 先复用已有语义，再考虑扩新层

## 8. 附录：推荐命名骨架

以下命名骨架仅用于说明结构，不要求不同项目逐字一致：

```text
theme.primary
theme.secondary

text.primary
text.secondary
text.tertiary
text.disabled
text.inverse

icon.primary
icon.secondary
icon.tertiary
icon.accent
icon.inverse

background.page
background.panel
background.card
background.section
background.overlay

border.default
border.light
border.strong
border.divider
border.active

tag.neutralBg
tag.neutralText
tag.primaryBg
tag.primaryText
tag.successBg
tag.successText

state.success.base
state.success.soft
state.success.text
state.success.border

material.chrome.background
material.chrome.border
material.chrome.shadow
material.chrome.filter
material.card.background
material.card.border
material.card.shadow
```

命名可以因技术栈、平台或代码风格差异而调整，但不得改变分层职责。
