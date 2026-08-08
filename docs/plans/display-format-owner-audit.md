# 展示映射与格式化散点审计

## 目的

本审计文档记录当前仓库内把展示映射、格式化函数和页面辅助判断直接写在页面或组件中的散点，作为后续治理基线。

本文件只记录现状、分类和风险，不替代长期规则。长期规则见 `docs/technical.md` 与 `docs/runbook.md`。

## 分类口径

### A. 领域展示映射

特点：

1. 输入通常是稳定 `key`、枚举值或合同字段。
2. 输出通常是统一中文文案或固定展示标签。
3. 一旦跨页面或跨端复用，就不再属于单页私有逻辑。

典型例子：

- `RecipeDifficulty -> 新手友好 / 轻松上手 / 需要经验 / 进阶挑战`
- `RecipeDuration -> 15分钟内 / 15~30分钟 / 30~60分钟 / 1小时以上`
- `HomeTopicType -> 周末聚餐 / 下班快做 / 家常下饭 ...`

### B. 通用格式化函数

特点：

1. 不携带业务状态机，只做日期、数字、排序序号等稳定格式化。
2. 适合按 app 维度收口，不应在多个页面重复书写。

典型例子：

- `formatDate`
- `formatDateTime`
- `formatSort`
- `formatPlanDate`
- `todayText`

### C. 页面辅助判断

特点：

1. 可能仍然归页面 owner。
2. 但如果表达的是稳定交互规则，且多个页面会复用，就不应继续散写在各页。

典型例子：

- `isQueued`

## 当前散点清单

### client

#### 领域展示映射

- [apps/client/src/pages_home/topic/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_home/topic/index.vue:322)
  - `recTypeText`
  - `formatDuration`
  - `formatDifficulty`
- [apps/client/src/pages/recipe/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages/recipe/index.vue:364)
  - `difficultyItems`
  - `durationItems`
- [apps/client/src/pages/recipe/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages/recipe/index.vue:981)
  - `formatDifficulty`
  - `formatDuration`
- [apps/client/src/pages_recipe/detail/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_recipe/detail/index.vue:715)
  - `formatDuration`
  - `difficultyText` 内部 `labelMap`
- [apps/client/src/pages_recipe/list/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_recipe/list/index.vue:458)
  - `difficultyText`
  - `durationText`
- [apps/client/src/pages_recipe/edit/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_recipe/edit/index.vue:1077)
  - `difficulties`
  - `durations`
- [apps/client/src/pages_recipe/edit/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_recipe/edit/index.vue:1215)
  - `difficultyText`
  - `durationText`

#### 通用格式化函数

- [apps/client/src/pages_home/topic/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_home/topic/index.vue:331)
  - `formatDate`
  - `formatSort`
  - `formatPlanDate`
  - `todayText`
- [apps/client/src/pages_meal/plan/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_meal/plan/index.vue:358)
  - `formatDateTime`
- [apps/client/src/pages_meal/poll/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_meal/poll/index.vue:561)
  - `formatDateTime`
- [apps/client/src/pages_share/memory/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_share/memory/index.vue:413)
  - `formatDateTime`
- [apps/client/src/pages_recipe/list/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_recipe/list/index.vue:501)
  - `formatDateTime`

#### 页面辅助判断

- [apps/client/src/pages_home/topic/index.vue](/Users/yangpenghui/personal/cook/apps/client/src/pages_home/topic/index.vue:375)
  - `isQueued`

### admin

#### 领域展示映射

- [apps/admin/src/pages/RecipeDetailPage.vue](/Users/yangpenghui/personal/cook/apps/admin/src/pages/RecipeDetailPage.vue:501)
  - `formatDifficulty`
  - `formatDuration`
- [apps/admin/src/components/RecipePreviewDrawer.vue](/Users/yangpenghui/personal/cook/apps/admin/src/components/RecipePreviewDrawer.vue:38)
  - `formatDifficulty`
  - `formatDuration`
- [apps/admin/src/pages/HomeTopicEditorPage.vue](/Users/yangpenghui/personal/cook/apps/admin/src/pages/HomeTopicEditorPage.vue:184)
  - `formatDifficulty`
  - `formatDuration`
- [apps/admin/src/pages/HomeTopicsPage.vue](/Users/yangpenghui/personal/cook/apps/admin/src/pages/HomeTopicsPage.vue:74)
  - `recTypeText`

#### 通用格式化函数

- [apps/admin/src/pages/UserRecipeDomainPage.vue](/Users/yangpenghui/personal/cook/apps/admin/src/pages/UserRecipeDomainPage.vue:82)
  - `formatDate`

### api

#### 合同与稳定档位 owner

- [apps/api/src/contracts/types.ts](/Users/yangpenghui/personal/cook/apps/api/src/contracts/types.ts:141)
  - `HomeTopicType`
- [apps/api/src/contracts/types.ts](/Users/yangpenghui/personal/cook/apps/api/src/contracts/types.ts:551)
  - `RecipeDifficulty`
  - `RecipeDuration`

#### 解析与校验链路

- [apps/api/src/modules/recipe/recipe.service.ts](/Users/yangpenghui/personal/cook/apps/api/src/modules/recipe/recipe.service.ts:2504)
  - 发布时强校验 `difficulty` / `duration`
- [apps/api/src/modules/admin/recipe-import-markdown.ts](/Users/yangpenghui/personal/cook/apps/api/src/modules/admin/recipe-import-markdown.ts:204)
  - `pickDifficulty`
  - `pickDuration`
  - `minutesToDuration`

## 风险结论

1. `RecipeDifficulty` / `RecipeDuration` 中文映射已经跨 `client` 与 `admin` 真实复用，继续放在页面内会导致同义逻辑继续复制。
2. `HomeTopicType` 中文映射已至少出现在小程序专题页和后台专题列表页，也不再属于单页私有逻辑。
3. `formatDateTime`、`formatDate` 等纯格式化函数已经在多个页面重复出现，属于稳定共享能力，不应继续散写。
4. 当前仓库缺少一条明确规则来区分：
   - 什么是服务端合同 owner
   - 什么是 app 内共享展示 owner
   - 什么仍然允许留在页面

## 本轮治理目标

1. 把长期规则写入 `docs/technical.md`。
2. 把执行门禁写入 `docs/runbook.md`。
3. 后续按本审计清单分批治理，不再新增新的页面散点。
