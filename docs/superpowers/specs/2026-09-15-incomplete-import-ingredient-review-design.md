# 导入缺失单位食材待审核设计

## 目标

JSON 菜谱导入中，名称未匹配到系统食材的条目即使缺少可用单位，也必须形成可治理的 `PENDING` 系统食材。管理员可在“待审核食材”补齐分类和默认单位后通过、归并或拒绝；同一记录同时出现在“系统食材 -> 待归类”。不新增独立候选表，不创建虚假的占位单位，也不放宽正式菜谱的精确数量和系统单位要求。

## 已确认边界

1. 未匹配名称是进入审核队列的充分条件；默认单位不是创建待审核记录的前置条件。
2. 缺少单位的待审核记录使用现有 `Ingredient(status=PENDING)`，不新增候选表。
3. `ACTIVE` 食材必须具有系统默认单位；`PENDING`、`DISABLED` 和 `MERGED` 可以没有默认单位。缺失默认单位只表示尚未完成治理，不是一个单位事实。
4. 所有导入待审核食材仍属于系统食材，固定使用 `ownerId=null`；缺少明确分类时放入隐藏分类 `UNCLASSIFIED / 待归类`。
5. 管理员通过为系统食材前必须明确选择可用分类和系统默认单位。页面不得自动选择第一个分类或第一个单位。
6. 正式菜谱正文仍只接受大于零的精确数量和系统单位；`适量 / 少许 / 按需` 继续使导入条目保持 `NEEDS_FIX`，本次不恢复模糊用量能力。
7. 当前未发布 JSON 导入草稿纳入一次性修复；已发布菜谱和固定正文版本不改写。

## 业务流程和页面行为

### 新导入

1. 服务端按规范解析 JSON，数量或单位不合法时继续记录对应字段错误。
2. 对每个名称非空、非导入占位且 `ingredientId` 为空的食材，按 `searchKey` 查找系统食材。
3. 同名匹配优先级固定为 `ACTIVE > PENDING > DISABLED`：三种状态都保留真实引用，并以系统分类覆盖 JSON 分类；`DISABLED` 不自动恢复，也不新建重复项；完全未命中时创建 `PENDING` 食材。
4. 创建 `PENDING` 时，分类写入 `UNCLASSIFIED`；若导入单位已严格匹配系统单位，则记录该单位，否则 `defaultUnitId=null`。
5. 导入草稿保存新建食材 ID。因为食材未审核或用量不完整，条目继续保持 `NEEDS_FIX`，不得发布。

### 待审核食材

1. `GET /admin/pending-ingredients` 继续合并用户推荐与 JSON 导入食材，并返回 JSON 导入项的 `defaultUnitId/defaultUnitName=null`。
2. 列表对空单位显示“待补充”，不显示破折号或虚构单位；缺分类时同样显示“待补充”。
3. 缺分类或默认单位的记录不提供“快捷通过”，但始终提供“审核”。
4. 打开审核弹窗时只回填记录中真实存在且仍可选的分类和单位；缺失项保持空值，由管理员手动选择。
5. `APPROVE_CREATE` 和 `APPROVE_MERGE` 继续由服务端强制校验名称、可选分类和系统默认单位。通过、归并、拒绝继续使用既有幂等、版本、事务、导入引用回写和审计逻辑。

### 系统食材待归类

1. `PENDING` 记录继续计入 `UNCLASSIFIED` 分类数量，并通过 `status=ALL` 展示。
2. 卡片允许 `defaultUnit=null`，显示“默认单位待补充”；操作仅保留“处理”，进入待审核工作台。
3. 普通 `ACTIVE` 和 `DISABLED` 系统食材的编辑、上下架和排序行为不变。

### 导入修正页

1. 有真实 `PENDING` 食材 ID 的行显示“名称 · 待归类”，且该项只用于表示当前引用，不可作为正式可发布食材选择。
2. `ingredientId` 为空的异常行显示“名称 · 未匹配”，不得伪装成已经进入待审核队列。
3. 已有 `DISABLED` 食材 ID 的行显示“名称 · 已下架”，当前项只读禁选且导入条目保持不可发布；不得显示成“未匹配”。
4. 待审核记录通过或归并后，既有引用回写把未发布导入草稿切换到最终 `ACTIVE` 食材；拒绝后条目仍保持不可发布并显示字段错误。

## 数据模型和数据库约束

`Ingredient.defaultUnitId` 和 `Ingredient.defaultUnit` 改为可空。使用新的前向 migration：

1. 迁移开始时审计系统 `PENDING` 食材是否存在重复 `searchKey`；存在重复时直接失败并输出冲突键，不静默合并含有 JSON 引用的记录。
2. 移除 `ingredients.default_unit_id` 的 `NOT NULL`，保留到 `units.id` 的外键和既有删除行为。
3. 增加 Check：`status <> 'ACTIVE' OR default_unit_id IS NOT NULL`。数据库最终保证正式可用食材一定有默认单位。
4. 增加系统待审核名称部分唯一索引：`owner_id IS NULL AND status = 'PENDING'` 时 `search_key` 唯一，避免并发导入产生重复待审记录。

不改变 `IngredientStatus` 枚举，不改变食材 ID 规则，不新增 JSON 扩展列或通用候选模型。

## API 和类型

公共路径保持不变：

- `GET /admin/pending-ingredients`
- `POST /admin/pending-ingredients/{ingredientId}/review`
- `GET /admin/ingredients`

`AdminPendingIngredientSummary.defaultUnitId/defaultUnitName` 已是可空语义，保持不变。`AdminIngredientSummary.defaultUnit` 改为 `UnitSummary | null`，仅用于后台 `PENDING` 或治理历史状态；Admin 本地类型和 OpenAPI 同步。用户侧食材查询仍只返回满足 `ACTIVE + defaultUnitId非空` 的记录，用户侧 `IngredientSummary.defaultUnit` 契约不改。

服务端所有将食材切换为 `ACTIVE` 的入口继续先校验系统默认单位。对依赖 `defaultUnit` 的内部映射，必须在状态/查询边界证明记录为可用食材，不能用非空断言掩盖未知状态。

## 并发、事务和审计

1. 导入条目创建和 `PENDING` 食材创建保持在同一事务；条目不会保存一个未提交的食材 ID。
2. 待审核名称唯一索引是并发最终兜底。命中唯一冲突时整条导入事务失败并由现有条目级错误处理记录，不返回虚假成功；重试时复用已提交的 `PENDING` 食材。
3. 审核接口继续要求 `Idempotency-Key`、`expectedVersion` 和 `SUPER_ADMIN`，并写现有审核审计事件。
4. 本次不增加缓存、Outbox 或新的权限能力。
5. 回填条目与任务统计分开提交时，`--apply` 每次都重新汇总本次扫描到的任务；即使条目在上次运行已修复、仅任务统计刷新失败，重跑也能恢复任务聚合状态。

## 现有草稿回填

新增仅面向未发布 JSON 导入条目的可重复脚本，默认 dry-run，显式 `--apply` 才写入：

1. 扫描 `sourceType=JSON` 且条目状态不是 `PUBLISHED` 的导入草稿。
2. 只处理 `ingredientId=null`、名称非空且不是导入占位的食材行。
3. 命中现有 `ACTIVE/PENDING/DISABLED` 食材时修复草稿引用并同步系统分类；命中 `DISABLED` 时同时计入下架冲突并保留“已下架”发布错误；无匹配时创建 `UNCLASSIFIED + PENDING` 食材，合法系统单位存在则记录，否则保持空单位。
4. 每个条目按读取到的 `version` 条件更新 `recipeBodyJson/errorJson/warnJson/status/version`；发生并发修改时记录冲突并跳过，不覆盖管理员新修改。
5. 输出扫描条目数、修复引用数、新建待审核数、已下架冲突数、版本冲突数和错误数。重复执行不得再次创建同名 `PENDING` 食材。
6. `--apply` 对本次扫描到的每个任务重算统计，不以本轮是否产生条目修改作为刷新条件。

当前导入任务 `38` 在本地执行 dry-run 后才允许 `--apply`。回填不猜测“白胡椒粉”等食材的默认单位。

## 失败表现

1. 导入内容缺数量或单位：条目仍创建并进入 `NEEDS_FIX`，字段错误继续绑定到对应表单项；待审核食材同时可见。
2. 审核未选择分类或默认单位：服务端返回明确业务错误，记录保持 `PENDING`。
3. 同名已下架食材：保留真实引用并显示“已下架”，不自动恢复，不自动创建重复正式食材，导入条目保持不可发布。
4. 回填遇到版本冲突：跳过该条目并报告，不覆盖正在编辑的数据。
5. migration 发现重复待审核名称：迁移失败并报告，先人工核对引用后再继续。

## 测试与验收

1. 后端先写失败测试，覆盖未知食材在 `unitId=null` 时创建 `PENDING`、有单位时沿用该单位、同名 `PENDING` 复用、同名 `ACTIVE` 复用并以系统分类为准、同名 `DISABLED` 保留引用但不自动恢复。
2. 审核服务测试覆盖缺单位记录可列表、不可快捷通过、审核创建/归并时必须补单位、通过后写入单位并回写所有未发布导入引用及系统分类；保存已有引用的导入草稿时也必须由服务端覆盖系统名称和分类。
3. migration 校验 Prisma schema、外键、Check 和待审名称唯一索引；对 `ACTIVE + null defaultUnitId` 的直接写入必须失败。
4. 回填脚本测试覆盖 dry-run 零写入、apply、重复 apply、合法单位保留、缺失单位为 null、已下架引用保留、版本冲突，以及任务统计刷新失败后的重跑恢复。
5. Admin 测试覆盖待审核列表“待补充”、审核弹窗不预选分类/单位、待归类卡片空单位展示，以及导入页 `PENDING / DISABLED / 未匹配` 三态文案区分。
6. 运行 API/Admin 定向测试、Prisma validate/generate、API/Admin type-check、OpenAPI 校验和 `git diff --check`。
7. 本地 migration 后先对任务 `38` 执行 dry-run，核对“白胡椒粉”和同批其他缺失项，再执行 apply；随后通过真实 API 验证两个治理入口都能看到“白胡椒粉”，并在浏览器确认审核弹窗没有预选分类或单位。

## 非目标

不新增候选表，不新增占位单位，不自动推断默认单位，不恢复模糊用量，不改变用户个人食材推荐流程，不自动恢复已下架食材，不改写已发布菜谱或历史固定版本，也不顺带重构后台食材页面。
