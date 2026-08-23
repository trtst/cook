# 功能执行单：菜谱详情营养展示

## 目标

- 本功能要跑通的最小业务闭环：用户进入菜谱详情页时，若该菜谱版本已具备首批主要系统食材的稳定营养映射与可计算用量，则详情页展示每份与整份的四项营养信息；若数据不足，则展示统一降级文案。
- 对应 V1 范围：第三批辅助层能力，只服务菜谱详情页，不新增独立营养页、Wiki 页、推荐页或新的创建录入流程。

## 本轮范围

- 小程序端：
  - 菜谱详情页新增只读营养展示区。
  - 只展示 `热量 / 蛋白质 / 脂肪 / 碳水`。
  - 只消费服务端返回的营养结果与降级文案，不做前端自行计算。
- 后端 API：
  - 为菜谱详情补充营养结果读取能力。
  - 建立“数据源子集导入 -> 主要系统食材映射 -> 菜谱营养快照”的最小闭环。
  - 只导入当前首批主要系统食材实际需要的营养源数据，不做全量导入。
- 后台管理：
  - 本轮不新开通用营养库管理页面。
  - 首批人工维护通过固定导入脚本、映射清单和必要审校记录完成。
- 共享契约：
  - 冻结菜谱详情 `nutrition` 返回结构。
  - 冻结首批导入范围、映射状态和降级语义。

## 本轮不做

- 不全量导入 [Sanotsu/china-food-composition-data](https://github.com/Sanotsu/china-food-composition-data) 或其 `json_data` 全部条目。
- 不为现有 `Ingredient` 平铺几十个营养值字段。
- 不做个人食材直接进入正式营养计算主链路。
- 不做列表页、计划页、随机页、采购页营养展示。
- 不做营养推荐、减脂方案、AI 营养师、独立营养页、独立 Wiki 页。
- 不做品牌 SKU 级营养、长尾食材全覆盖或复杂人群个性化方案。

## 业务流程与页面行为门禁

未完成本节，不得设计公共接口、数据库表或 migration，不得进入编码。

### 业务流程

- 用户目标：在菜谱详情页快速看到该菜谱的基础营养信息，辅助判断是否适合当前一餐。
- 触发条件：用户进入任一菜谱详情页。
- 主成功路径：
  - 服务端根据 `recipeVersionId` 读取已缓存的营养快照。
  - 若快照不存在且该版本满足首批主要食材映射与单位换算条件，则由后端生成或回填快照。
  - 服务端返回每份与整份的四项营养值及质量文案。
  - 前端按返回结果展示营养卡片。
- 失败 / 阻断路径：
  - 菜谱食材未覆盖到首批主要系统食材映射。
  - 食材虽然已映射，但单位无法稳定换算。
  - 菜谱结构化食材不足或存在大量模糊用量。
  - 上述情况均不报错中断详情页，只降级为“当前数据不足”或“结果为估算”。
- 结束状态：
  - 有稳定结果时，详情页看到四项营养与 `估算较完整`。
  - 仅部分可算时，详情页看到四项中的可用值与 `结果为估算`。
  - 不可算时，不显示虚假数值，只显示 `当前数据不足`。
- 确认人 / 确认记录：用户于 2026-08-22 确认“数据源只按必要子集导入，先实现主要食材，不做全量导入”。

### 页面行为

- 页面入口：现有菜谱详情页。
- 展示内容及用途：
  - 每份四项营养：用于用户快速判断单次食用的基础营养。
  - 整份四项营养：用于理解整道菜总量。
  - 质量文案：用于解释结果可信度和覆盖程度。
- 用户操作：仅查看，不提供前台编辑、纠错或手动输入营养值。
- 加载 / 空态 / 失败态：
  - 详情主接口加载中时，营养区跟随详情骨架占位。
  - 返回 `status=NONE` 或 `status=INSUFFICIENT` 时显示说明文案，不显示伪数值。
  - 接口异常时营养区静默隐藏，不阻断详情主内容。
- 成功后的页面变化：
  - 有结果时展示营养卡片。
  - 无结果时展示降级文案。
- 本流程不需要的页面数据：
  - 不返回完整营养基表明细。
  - 不返回候选映射列表、人工审校记录、来源仓库原始字段。
  - 不返回维生素、矿物质、GI、过敏原以外的额外展示项。

### 门禁结论

- [x] 业务流程已确认
- [x] 页面行为已确认
- [x] 现有接口、表和页面仅作为候选实现，没有被当作需求证据

## 领域与商业化评估

- 数据归属：`PLATFORM`
- Free 基础：所有登录或可见详情的用户都可读取已生成的营养展示结果。
- 付费增量：无。
- 权益作用域：`不付费`
- 权益类型：`功能`
- 到期与超额行为：无。
- 数据保留与迁出：营养基表、映射和菜谱营养快照属于平台基础数据；当菜谱版本变化时按新 `recipeVersionId` 重新生成，不修改旧快照。
- 配置来源：`GLOBAL`
- 隐私、安全与合规：营养结果是平台派生数据，不开放用户自行写入，不把估算值宣称为医学或精确营养事实。
- 是否涉及 Reserved 的 OCR、AI、Pro 或多家庭：否。

## CTO 拆解

| 端 | 负责人 | 最小任务 | 输入 | 输出 | 依赖 | 验收 |
| --- | --- | --- | --- | --- | --- | --- |
| 小程序 | 已实现 | 详情页新增营养展示区 | 详情接口 `nutrition` block | 四项营养 + 质量文案 UI | 后端详情契约 | 详情页能正确展示三档结果 |
| 后端 | 已实现 | 导入必要数据子集、维护主要食材映射、生成营养快照、补充详情返回 | GitHub 数据源子集、系统食材、菜谱版本内容 | 标准营养底稿、映射结果、详情营养响应 | 首批主要食材清单冻结 | 指定菜谱版本可回填并返回营养结果 |
| 后台 | 本轮不做 | 不新增通用页面 | 导入脚本与映射清单 | 审校记录或固定数据文件 | 后端脚本 | 首批通过脚本可重复导入与复核 |
| 共享契约 | 已实现 | 冻结 `nutrition` 字段和快照状态语义 | 本执行单 | API 契约、三端类型 | 后端返回结构 | 三端类型一致 |

## 开发者最小任务确认

### 小程序确认

- 最小交付：菜谱详情页读取并展示 `nutrition` block。
- 依赖：菜谱详情接口完成扩展。
- 是否先用 mock：否，直接接真实接口。
- 不做项：不在前端做计算、不新增独立营养页、不提供编辑入口。
- 验收方式：真机或小程序预览进入三类菜谱详情，分别验证完整、估算、不足三种展示。

### 后端确认

- 最小交付：
  - 冻结首批主要系统食材覆盖清单。
  - 基于 GitHub 数据源只导入必要条目与必要营养字段。
  - 建立 `ingredientId -> nutrientFoodId` 映射。
  - 生成 `recipeVersionId` 维度的营养快照。
  - 在菜谱详情响应中返回 `nutrition` block。
- 数据表 / 事务边界：
  - 导入与清洗脚本按批次写入。
  - 映射审校写入独立映射表。
  - 快照按 `recipeVersionId + sourceVersion` 幂等生成。
- 错误码：
  - 详情查询不因营养缺失报错。
  - 内部回填失败记录日志，不改变详情主接口成功语义。
- 不做项：
  - 不全量导入源仓库。
  - 不把营养数值平铺写入 `Ingredient`。
  - 不做个人食材正式营养映射。
- 验收方式：
  - 导入脚本可重复执行且不重复写入同批数据。
  - 首批主要食材映射可稳定落库。
  - 指定菜谱详情返回三档结果正确。
- 状态机 / 权限矩阵：
  - `ingredientNutrientMapping.status`: `CONFIRMED / CANDIDATE / UNMAPPED`
  - 详情查询只读公开派生结果，无写权限暴露给前台。
- 配置解析与实例冻结：
  - 数据源版本、导入批次和映射来源必须可追溯。
- 到期 / 清理任务：
  - 无自动过期；后续若切换数据源版本，通过新批次导入与快照重算覆盖。

### 后台确认

- 最小交付：本轮不新增页面。
- 页面入口 / 权限：无。
- 依赖：后端导入脚本与映射清单。
- 不做项：不做通用营养库、通用映射管理、手工逐条录入页面。
- 验收方式：脚本和固定清单能稳定完成首批维护。

## 接口契约

接口契约只能从本执行单已确认的业务流程、页面行为、权限和状态推导。契约必须更新 `docs/api-contract.md`，或在本文写明草案并标记待同步。

| 方法 | 路径 | 用途 | 权限 | 幂等 | 版本字段 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/recipes/{recipeId}` | 返回菜谱详情并附带营养展示块 | 现有详情权限 | 否 | 无 | 已实现 |

### `nutrition` 返回结构

```ts
nutrition: {
  status: "COMPLETE" | "ESTIMATED" | "INSUFFICIENT" | "NONE";
  qualityLabel: "估算较完整" | "结果为估算" | "当前数据不足" | null;
  perServing: {
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbohydrate: number | null;
  } | null;
  perRecipe: {
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbohydrate: number | null;
  } | null;
  calculatedAt: string | null;
  sourceVersion: string | null;
}
```

## 最小数据表与约束

| 主事实 / 关系 | owner | 必要字段 | 生命周期 | 外键 / 唯一 / Check | 对应真实查询 | 是否复用现有结构 |
| --- | --- | --- | --- | --- | --- | --- |
| `nutrient_source_batches` | PLATFORM | `sourceRepo` `sourceVersion` `sourcePath` `importedAt` | 每次导入一批 | `UNIQUE (source_repo, source_version, source_path)` | 追溯当前导入批次 | 新增 |
| `nutrient_source_foods` | PLATFORM | `batchId` `sourceFoodCode` `sourceName` `rawJson` | 跟随批次 | `FK batch_id` `UNIQUE (batch_id, source_food_code)` | 回查原始源条目 | 新增 |
| `nutrient_foods` | PLATFORM | `sourceFoodCode` `name` `edibleRate` `calories` `protein` `fat` `carbohydrate` `sourceVersion` | 可按新版本增量重建 | `UNIQUE (source_version, source_food_code)` | 映射与营养计算 | 新增 |
| `ingredient_nutrient_mappings` | PLATFORM | `ingredientId` `nutrientFoodId` `status` `matchType` `confidence` `sourceVersion` | 映射调整时新增或更新 | `FK ingredient_id` `FK nutrient_food_id` `UNIQUE (ingredient_id, source_version)` | 根据系统食材取营养映射 | 新增 |
| `ingredient_unit_nutrient_conversions` | PLATFORM | `ingredientId` `unitId` `gramsPerUnit` `sourceVersion` | 换算规则调整时维护 | `FK ingredient_id` `FK unit_id` `UNIQUE (ingredient_id, unit_id, source_version)` `CHECK (grams_per_unit > 0)` | 单位换算 | 新增 |
| `recipe_nutrition_snapshots` | PLATFORM | `recipeVersionId` `status` `qualityLabel` `perServingJson` `perRecipeJson` `coverageRate` `calculatedAt` `sourceVersion` | 菜谱版本或营养版本变化时重算 | `FK recipe_version_id` `UNIQUE (recipe_version_id, source_version)` | 菜谱详情直接读取 | 新增 |

- 可以从现有主事实重算、不新增持久化的内容：
  - 前台展示文案可由 `status + qualityLabel` 推导。
  - 营养详情页是否显示由快照状态决定，不单独持久化布尔字段。
- 明确不新增的表、字段、枚举和索引：
  - 不在 `ingredients` 表新增营养数值列。
  - 不新增个人食材营养映射表。
  - 不新增前台可写的营养纠错表。
- migration 部署与回退边界：
  - 本轮新增表必须独立 migration。
  - 若导入失败，可保留空表结构并回滚批次数据，不影响现有食材、菜谱和详情主链路。

## 各端类型

- `apps/api` DTO / 响应：
  - 菜谱详情响应补 `nutrition` block。
  - 内部新增营养快照与映射领域类型。
- `apps/client` API 类型：
  - 菜谱详情返回增加营养展示类型。
- `apps/admin` API 类型：
  - 本轮不新增公共 API 类型。

## 联调清单

- [x] 后端脚本验收通过：`verify:recipe-nutrition` 已覆盖 `COMPLETE / ESTIMATED / INSUFFICIENT`
- [x] 导入脚本验收通过：`backfill:recipe-nutrition --dry-run` 与真实 `backfill:recipe-nutrition` 已跑通
- [x] 小程序类型接真实接口通过：详情返回已补 `nutrition`，客户端类型检查通过
- [x] 真实接口联调通过：本地 `3100` 口子 `GET /api/inspiration-recipes/2101` 已返回 `nutrition.status = ESTIMATED`
- [x] 官方 `mp-weixin` 页面自动化已覆盖：`/pages_recipe/detail/index` 已在真实登录态下分别断言 `COMPLETE / ESTIMATED / INSUFFICIENT` 三档营养展示
- [ ] 真机或小程序预览手动验收通过

## 验收状态

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 开发完成 | 已完成 | 后端营养子集导入、映射、快照与详情返回已接通；小程序详情页营养展示已接通 |
| 联调完成 | 已完成 | 本地 `http://127.0.0.1:3100/api/inspiration-recipes/2101` 已返回真实 `nutrition` block |
| 机器检查 | 已完成 | `prisma generate`、API/Client `type-check`、`verify:recipe-nutrition`、`backfill:recipe-nutrition --dry-run`、`verify:openapi` 已通过；并已于 Sunday, August 23, 2026 再次跑通 `pnpm --filter @next-meal/api verify:recipe-nutrition`，输出 `COMPLETE / ESTIMATED / INSUFFICIENT` 三档真实结果；同日还跑通 `node --check apps/client/src/pages_recipe/detail/index.test.js` 与 `/Applications/HBuilderX.app/Contents/MacOS/cli uniapp.test mp-weixin --project /Users/yangpenghui/personal/cook/apps/client/src --testcaseFile pages_recipe/detail/index.test.js`，在真实 `mp-weixin` 页面级自动化中同时覆盖灵感菜谱正文主状态，以及我的菜谱详情 `COMPLETE / ESTIMATED / INSUFFICIENT` 三档营养展示 |
| 手动验收 | 未完成 | 已补官方 `mp-weixin` 页面自动化，但仍未完成微信开发者工具或真机人工走查 |
| 可发布 | 否 | 尚未完成真机或小程序预览手动验收 |

## 风险与遗留

- 风险：
  - GitHub 数据源存在测试属性和清洗噪声，首批必须通过必要子集筛选与人工映射复核。
  - 主要系统食材若没有稳定单位换算，即使映射成功也无法稳定出营养值。
  - 当前菜谱中若模糊用量占比过高，首批覆盖率会受限。
- 遗留：
  - 后续如要扩充维生素、矿物质、GI 或健康规划，另开执行单，不并入本轮。
  - 后续如要扩到个人食材或长尾食材，另开阶段执行单。
- 发布前必须处理：
  - 首批主要系统食材清单冻结。
  - 首批必要导入字段清单冻结。
  - 至少准备 3 组验收菜谱：完整、估算、不足。

## 范围自检

- 本次满足的用户确认规则：
  - 只导入必要数据，不做全量导入。
  - 先做主要系统食材，不扩到长尾。
  - 只服务菜谱详情四项营养展示。
- 每个文件为什么必须修改：
  - 本文用于冻结后续 API、数据库和详情页实现的业务边界。
- 明确没有顺手加入的功能：
  - 没有顺手加入独立营养页、营养推荐、个人食材营养链路、知识图谱或后台通用管理台。
- 因复用未被证明而没有提前增加的抽象：
  - 未新增通用“营养中心”或“知识中心”抽象。
- 是否还能缩小改动而不破坏需求：
  - 当前已收缩到“必要数据子集 + 主要系统食材 + 详情页只读展示”的最小闭环。
