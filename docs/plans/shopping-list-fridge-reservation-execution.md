# 购物清单库存预占执行单

## 一、执行状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 业务流程 | 已确认 | 已确认“用库存 = 预占库存；完成清单入库后才正式结算”的主链路 |
| 页面行为 | 已确认 | 已确认购物清单详情继续在当前页完成 `用库存 / 撤销用库存 / 已购 / 完成入库` |
| 权限与状态 | 已确认 | 预占只作用于清单创建者自己的冰箱；协作者不读取、不操作创建者库存 |
| 最小 API | 草案已确认 | 已确认 `check / fridge / complete / fridge-items` 需要补轻量回包与预占字段 |
| 最小表与约束 | 草案已确认 | 已确认新增“购物项库存预占”主事实，不直接把预占混进冰箱事实或购物项文案 |
| 三端实现 | 未开始 | 本轮只交付执行单，不修改客户端、API、Prisma、SQL 或 migration |
| 真实验收 | 未开始 | 待方案确认后编码并验证 |

## 二、本轮目标

在不引入共享冰箱和通用细粒度权限中心的前提下，为购物清单补齐“库存预占”闭环：

1. 点击 `用库存` 时，不立即扣减真实冰箱库存。
2. 购物项先占用一部分或全部可用库存，形成独立的预占事实。
3. 购物清单详情后续都按 `可用库存 = 实际库存 - 已预占库存` 计算是否还需购买。
4. 清单完成并确认入库时，才把预占正式结算成真实库存扣减。
5. 撤销 `用库存`、移除食材、作废清单、删除清单时，释放未结算预占。

本轮只交付文档，不修改客户端、API、Admin、Prisma、SQL 或 migration。

## 三、本轮范围

- 小程序端：
  - `pages_pantry/list-detail`
  - `ShoppingCompleteSheet`
  - 冰箱列表页可用库存文案
- 后端 API：
  - `GET /shopping-lists/{listId}`
  - `POST /shopping-lists/{listId}/items/{itemId}/check`
  - `POST /shopping-lists/{listId}/items/{itemId}/fridge`
  - `POST /shopping-lists/{listId}/items/{itemId}/remove`
  - `POST /shopping-lists/{listId}/complete`
  - `GET /fridge-items`
- 共享契约：
  - `docs/api-contract.md`
  - `apps/api/src/contracts/*`
  - `apps/client/src/pages_pantry/apis/*`

## 四、本轮不做

1. 不做共享冰箱。
2. 不做跨清单的人工调拨、优先级或抢占策略。
3. 不做后台库存预占管理页。
4. 不做库存结算历史报表或库存流水查询页。
5. 不做 Worker 异步清理；首版用同步事务释放预占。

## 五、已确认产品决策

1. `用库存` 的语义从“改购物项文案”升级为“预占库存”。
2. 允许部分预占：
   - 需求 `250g`
   - 当前可用库存 `100g`
   - 则自动预占 `100g`
   - 页面显示剩余需买 `150g`
3. 预占只基于清单创建者自己的冰箱；协作者不能消费或锁定创建者冰箱。
4. 冰箱真实库存不在 `用库存` 时立即扣减。
5. 只有 `POST /shopping-lists/{listId}/complete` 完成入库时，才正式结算预占。
6. 购物项被删除、清单被作废/删除、或用户撤销 `用库存` 时，预占必须释放。
7. 购物项的勾选、用库存、移除等高频动作不再回整份 `ShoppingListDetail`，改成轻量回包。
8. 冰箱页的食材详情需要显式展示三段库存口径：
   - `实际库存`
   - `已预占`
   - `可用库存`
9. 冰箱页的食材详情需要继续展示“已被哪张清单预占了多少”的明细列表，而不是只给总量差值。

## 六、业务闭环

```text
冰箱有实际库存
-> 购物项点击“用库存”
-> 形成一条预占事实
-> 购物项按可用库存重算剩余需买
-> 用户继续勾选采购、完成清单
-> 入库确认
-> 事务性结算预占并扣真实库存
-> 清单完成
```

反向要求：

1. 能知道某条预占属于哪张清单、哪个购物项。
2. 冰箱“可用库存”不能把已预占部分重复算给另一张清单。

## 七、页面行为门禁

### 7.1 购物清单详情页

页面职责：

1. `用库存` 按可用库存创建或撤销预占。
2. 当可用库存足够时，购物项显示 `不需购买`，并禁用 `已购`。
3. 当可用库存不足时，购物项数量显示剩余需买量，`已购` 仍可点击。
4. `库存` 文案显示基于可用库存的摘要，不再只看原始实际库存。

成功后的页面变化：

1. 当前食材行的数量、库存、按钮态立即更新。
2. 该清单顶部采购进度基于“仍需采购的项”重算。
3. 同一用户其他清单若再次读取库存，会看到扣除预占后的可用库存。

### 7.2 完成清单入库 sheet

页面职责：

1. 只处理已勾选项是否写入冰箱。
2. 完成提交时，除原有“写入冰箱”外，还要同步结算当前清单的库存预占。
3. `store = false` 的已购项不写冰箱，但若此前有预占，也必须结算真实扣减。

### 7.3 冰箱列表

页面职责：

1. 冰箱页的食材详情必须显式展示：
   - `实际库存`
   - `已预占`
   - `可用库存`
2. 当某条库存已被预占时，需要继续展示“被哪张清单预占了多少”的明细。
3. 当某条库存已被预占时，不能继续把整份库存当成全可用。

### 门禁结论

- [x] 业务流程已确认
- [x] 页面行为已确认
- [x] 现有接口、表和页面仅作为候选实现，没有被当作需求证据

## 八、领域与边界

- 数据归属：`USER`
- 权益作用域：`USER`
- Free 基础：可使用库存预占
- 付费增量：本轮无
- 配置来源：`USER` 主事实 + 服务端计算
- 隐私、安全与合规：
  - 预占只影响所有者个人冰箱
  - 协作者不下发创建者可用库存精确口径
- 与当前 V1 边界的关系：
  - 这属于“有限、场景化”的购物清单库存预占
  - 不扩展成通用库存中心、共享库存或跨域自动调度

## 九、最小接口草案

### 9.1 轻量写回包

高频写接口改成返回局部 patch，而不是整份 `ShoppingListDetail`：

| 方法 | 路径 | 用途 | 回包 |
| --- | --- | --- | --- |
| POST | `/shopping-lists/{listId}/items/{itemId}/check` | 勾选或取消已购 | `version + progress + changedItem` |
| POST | `/shopping-lists/{listId}/items/{itemId}/fridge` | 创建或撤销预占 | `version + progress + changedItem` |
| POST | `/shopping-lists/{listId}/items/{itemId}/remove` | 移除食材项 | `version + progress + removedItemId` |

建议最小回包：

```ts
interface ShoppingListItemPatchResponse {
  listId: number;
  version: number;
  progressDoneCount: number;
  progressTotalCount: number;
  item: ShoppingListDetailItem | null;
  removedItemId: number | null;
}
```

### 9.2 详情读取

`GET /shopping-lists/{listId}` 继续返回整份详情，但每条购物项额外补：

```ts
reservedText: string | null;
availableText: string | null;
fridgeActionMode: "NONE" | "APPLY_FULL" | "APPLY_PARTIAL" | "UNDO" | "NEED_CONFIRM";
```

说明：

1. `fridgeText` 可继续保留为展示字段，但其口径改成“可用库存摘要”。
2. 购物清单详情若需要更细展示，可继续新增 `stockText / reservedText / availableText` 三段式字段，但最小必需是 `fridgeText` 已按可用库存重算。

### 9.3 冰箱读取

`GET /fridge-items` 需要补齐食材详情的预占展示字段：

```ts
stockText: string | null;
reservedText: string | null;
availableText: string | null;
reservations: Array<{
  shoppingListId: number;
  shoppingListName: string;
  shoppingItemId: number;
  reservedText: string;
}>;
```

说明：

1. `stockText` 表示实际库存。
2. `reservedText` 表示当前所有有效预占的合计。
3. `availableText` 表示当前仍可继续使用的库存。
4. `reservations[]` 用于展示“已经被哪张清单预占了多少”。

### 9.4 完成清单

`POST /shopping-lists/{listId}/complete` 继续返回整份 `ShoppingListDetail`，因为它会同时改变：

1. 清单状态
2. 冰箱事实
3. 购物项状态
4. 预占结算结果

## 十、最小数据表与约束草案

### 10.1 新增表：`shopping_item_fridge_reservations`

主事实：某个购物项占用了多少冰箱库存。

建议字段：

- `id`
- `user_id`
- `shopping_list_id`
- `shopping_item_id`
- `fridge_item_id`
- `reserved_exact_quantity`
- `reserved_unit_id`
- `reserved_quantity_text`
- `settled_at`
- `released_at`
- `created_at`
- `updated_at`

### 10.2 owner 与生命周期

| 主事实 / 关系 | owner | 生命周期 | 说明 |
| --- | --- | --- | --- |
| 购物项库存预占 | 清单创建者 | `创建 -> 释放 / 结算` | 未结算前只能二选一：释放或结算 |

### 10.3 必要约束

1. `shopping_item_id` 外键到 `shopping_items`
2. `shopping_list_id` 外键到 `shopping_lists`
3. `fridge_item_id` 外键到 `fridge_items`
4. `reserved_exact_quantity > 0`
5. `released_at` 与 `settled_at` 不能同时非空
6. 同一购物项在同一时刻最多只有一组“未释放且未结算”的有效预占

建议唯一 / 索引：

- `UNIQUE (shopping_item_id) WHERE released_at IS NULL AND settled_at IS NULL`
- `INDEX (user_id, settled_at, released_at, created_at)`
- `INDEX (fridge_item_id, settled_at, released_at)`

### 10.4 明确不做的数据设计

1. 不把“已预占量”直接写回 `fridge_items` 主表字段。
2. 不把预占 JSON 塞进 `shopping_items.amountJson`。
3. 不新增通用库存流水总账。

## 十一、服务端规则草案

### 11.1 创建预占

点击 `用库存` 时：

1. 只读取 `available = true` 的冰箱条目。
2. 先扣除这些条目上已存在、未释放、未结算的预占，得出可用库存。
3. 若可比较数量：
   - 足够：预占完整需求量
   - 不足：预占全部可用量，并把购物项剩余量改成 `还需购买 X`
4. 若不可比较数量：返回 `NEED_CONFIRM`

### 11.2 撤销预占

撤销 `用库存` 时：

1. 删除或标记释放当前购物项的有效预占
2. 恢复该购物项的 `baseQuantityText`
3. 重新计算 `fridgeCovered / fridgeStatusText / fridgeActionMode`

### 11.3 完成清单并结算

完成清单时，对已勾选项逐条处理：

1. 若该项有未结算预占：
   - 从对应冰箱条目里正式扣减真实库存
   - 若扣减后为 `0`，可标记该冰箱条目不可用或消费完
   - 将预占标记为 `settled`
2. 若该项 `store = true`，再按现有逻辑写入新的冰箱事实
3. 整体事务成功后，清单再转 `COMPLETED`

### 11.4 释放预占

以下场景必须释放有效预占：

1. 撤销 `用库存`
2. 移除购物项
3. 作废清单
4. 删除清单
5. 复制清单时，原清单预占不继承到新清单

## 十二、前端最小任务草案

### 小程序端

- 详情页把 `用库存` 文案从“纯前端换量”改成服务端真实预占结果
- 高频操作改接轻量 patch 回包，避免每次点按钮都刷新整份详情
- 库存展示至少区分：
  - 当前可用库存
  - 库存不足时剩余需买
  - 冰箱页的 `实际库存 / 已预占 / 可用库存`
  - 冰箱页的“被哪张清单预占了多少”

### 后端

- Prisma 新增预占表和迁移
- `check / fridge / remove` 改轻量回包
- `complete` 串入预占结算事务
- 冰箱读取补可用库存计算

### 后台

- 本轮不做后台页

## 十三、风险与待确认项

### 风险

1. 当前冰箱精确数量还不是全量结构化，`NEED_CONFIRM` 仍会频繁出现。
2. 旧购物清单详情页已经存在一轮较多本地状态改动，切轻量 patch 后要避免再次引入高亮错位。
3. 完成清单事务现在只写入新冰箱事实，结算预占后事务更重，必须控制查询与写入条数。

### 待确认项

1. 若某条冰箱库存被同一张清单里的多个购物项分别预占，冰箱页明细是按 `清单聚合` 还是按 `购物项逐条展开` 展示。
2. 冰箱页首版是否需要从列表直接进入“库存预占明细”，还是只在食材详情页展示即可。

## 十四、范围自检

- 本次满足的用户确认规则：
  - `用库存` 改为锁库存
  - 允许部分预占
  - 只在清单完成入库后结算
  - 先出计划文档，确认后再动代码
- 每个文件为什么必须修改：
  - 本轮仅新增专项执行单，并在中央变更日志登记
- 明确没有顺手加入的功能：
  - 共享冰箱
  - 实时协作
  - 库存报表
  - 后台管理页
- 因复用未被证明而没有提前增加的抽象：
  - 未新增通用库存中心、预占服务中心或库存总账层
- 是否还能缩小改动而不破坏需求：
  - 文档阶段已收缩到最小，只冻结本次预占闭环所需规则
