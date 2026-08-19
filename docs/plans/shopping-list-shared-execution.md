# 共享购物清单执行单

## 一、执行状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 业务流程 | 已确认 | 已确认“计划/饭局/菜谱 -> 清单 -> 采购勾选 -> 入库确认 -> 冰箱”的最小闭环 |
| 页面行为 | 已确认 | 已确认购物首页、清单详情、完成清单入库 sheet 和菜谱页“添加到清单”入口 |
| 权限与状态 | 已确认 | 已确认 `创建者 / 协作者`、`ACTIVE / COMPLETED / VOIDED`、非实时协作和 `version` 冲突语义 |
| 最小 API | 草案已确认 | `shopping-lists* / shopping-shares*` 草案已写入 `api-contract.md`，后续实现以正式契约为准 |
| 最小表与约束 | 草案已确认 | 已明确新增清单头、成员、分享 token，并给出现有 `shopping_items / fridge_items` 的演进方案 |
| 三端实现 | 未开始 | 当前只交付执行基线，不修改客户端、API、Admin、Prisma 或 migration |
| 真实验收 | 未开始 | 待后端与客户端主链路落地后执行 |

## 二、本轮目标

把当前“个人购物条目 + 旧聚合板”改造成“共享购物清单”模型，并明确：

1. 购物首页以“清单列表”而不是“食材平铺列表”为主。
2. 共享对象是单张清单，不是共享空间。
3. 完成清单必须串到“入库确认”。
4. 菜谱、计划、饭局、购物和冰箱之间的来源链要能回看。

本轮只交付文档，不修改客户端、API、Admin、Prisma、SQL 或 migration。

## 三、本轮范围

- 小程序端：
  - 购物首页
  - 清单详情页
  - 完成清单入库确认 sheet
  - 菜谱详情页“添加到清单”新交互
- 后端 API：
  - `shopping-lists*`
  - `shopping-shares*`
  - `shopping-gap` 写入共享清单的归属规则
  - 完成清单与冰箱入库事务
- 后台管理：
  - 本轮不新增后台页面
- 共享契约：
  - `docs/api-contract.md`
  - `docs/api-index.md`
  - 购物边界相关文档

## 四、本轮不做

1. 不做管理员或通用权限中心。
2. 不做实时协作、SSE 或 WebSocket。
3. 不做共享冰箱、食材认领、采购认领或多人在线状态。
4. 不做订单、模板、整单一键采购或历史统计报表。
5. 不做按大分类批量设置到期时间。

## 五、已确认产品决策

1. 首页顶部参考菜谱首页，用 3 张状态卡切换 `采购中 / 已完成 / 已作废`。
2. 首页列表 item 展示：`清单名`、`创建时间`、`采购进度`、`共享入口`。
3. 采购进度按“食材项数”计算。
4. 角色先只做 `创建者 / 协作者`。
5. 协作者可退出、编辑内容、勾选采购完成、从菜谱加入和复制清单；复制后得到自己的个人新清单。
6. 分享首版只支持 `分享链接`；链接加入必须登录。
7. 清单详情默认按食材聚合展示，保留来源摘要；先不强制上“按菜谱 / 按食材”双视图。
8. 完成清单先弹 `入库确认 sheet`，只处理 `是否入库 / 数量 / 到期时间`。
9. 到期时间默认 `7 天`，支持快捷值、全选批量、同食材批量和单项修改。
10. 共享清单先不做实时；用 `操作后刷新 + 下拉刷新 + 轻轮询 + version 冲突` 即可。

## 六、业务闭环

```text
菜谱 / 计划 / 饭局 / 手动补充
-> 写入某张购物清单
-> 清单内勾选已采购项
-> 完成清单
-> 入库确认
-> 写入个人冰箱
```

这条链要同时满足两个方向：

1. 前向可看：某个食材为什么会出现在这张清单里。
2. 反向可看：冰箱里的某个库存来自哪次采购、哪张清单、哪道菜。

## 七、页面执行顺序

### 7.1 购物首页

页面职责：

1. 顶部 3 张状态卡展示数量与切换状态。
2. 下方展示当前状态的清单卡片列表。
3. 右下角固定 `新建清单` 浮动按钮。

当前不在首页承担的事情：

1. 不直接编辑食材行。
2. 不直接承担入库。
3. 不在首页展示复杂来源树。

### 7.2 清单详情页

页面职责：

1. 展示清单名、进度、协作者入口。
2. 按食材聚合展示当前有效项。
3. 每个食材项展示来源摘要：菜谱、计划、饭局或手动。
4. 提供勾选完成、删除食材和浮动添加入口。

当前不做：

1. 不做复杂拖拽排序。
2. 不做多人光标或在线状态。
3. 不做食材认领。

### 7.3 完成清单入库 sheet

页面职责：

1. 默认只带出当前 `CHECKED` 的食材项。
2. 每项可控制 `是否入库 / 数量 / 到期时间`。
3. 支持全选批量设置、同食材批量设置和单项覆盖。
4. 确认后事务性完成“清单完成 + 冰箱入库”。

### 7.4 菜谱页“添加到清单”

页面职责：

1. 选择目标 `ACTIVE` 清单。
2. 支持现场新建空白清单后加入。
3. 把该菜谱固定版本的食材批次写入目标清单。

## 八、目标接口草案

| 方法 | 路径 | 用途 | 主要权限 | 幂等 | 版本字段 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/shopping-lists/summary` | 首页顶部 3 卡统计 | 当前用户已登录 | 否 | 否 | 只返回计数和默认选中状态 |
| GET | `/shopping-lists` | 按状态取清单列表 | 当前用户已登录 | 否 | 否 | `status=ACTIVE|COMPLETED|VOIDED` |
| POST | `/shopping-lists` | 新建空白清单 | 当前用户已登录 | 是 | 否 | `Idempotency-Key` |
| GET | `/shopping-lists/{listId}` | 清单详情 | 成员可读 | 否 | 否 | 默认按食材聚合 |
| POST | `/shopping-lists/{listId}/rename` | 改名 | 仅创建者 | 是 | 是 | 只改名称 |
| POST | `/shopping-lists/{listId}/items` | 手动加食材 | 成员可写 | 是 | 否 | 轻表单 |
| POST | `/shopping-lists/{listId}/items/from-recipe` | 菜谱加入清单 | 成员可写 | 是 | 否 | 固定版本写入 |
| POST | `/shopping-lists/{listId}/items/{itemId}/check` | 勾选或取消采购完成 | 成员可写 | 是 | 是 | 项级更新 |
| POST | `/shopping-lists/{listId}/items/{itemId}/remove` | 移出当前有效采购项 | 成员可写 | 是 | 是 | 保留来源事实 |
| POST | `/shopping-lists/{listId}/void` | 作废清单 | 仅创建者 | 是 | 是 | 仅 `ACTIVE -> VOIDED` |
| POST | `/shopping-lists/{listId}/restore` | 恢复清单 | 仅创建者 | 是 | 是 | 仅 `VOIDED -> ACTIVE` |
| POST | `/shopping-lists/{listId}/copy` | 复制清单 | 成员可写 | 是 | 是 | 协作者复制为个人清单 |
| POST | `/shopping-lists/{listId}/complete` | 完成清单并入库 | 仅创建者 | 是 | 是 | 事务操作 |
| POST | `/shopping-lists/{listId}/share-link` | 生成或重置分享链接 | 仅创建者 | 是 | 是 | 返回 token 和 url |
| POST | `/shopping-lists/{listId}/share-link/disable` | 失效分享链接 | 仅创建者 | 是 | 是 | 只关当前活动链接 |
| POST | `/shopping-lists/{listId}/members/{memberUserId}/remove` | 移除一个已加入的普通协作者 | 仅创建者 | 是 | 是 | 创建者本人和 `OWNER` 角色不可通过此入口移除 |
| GET | `/shopping-list-invites` | 读取当前用户清单协作邀请 | 当前用户已登录 | 否 | 否 | 默认返回待处理 `ACTIVE` 邀请；通知中心可用 `filter=ALL/PENDING/RESOLVED` 读取最近 7 天协作消息 |
| POST | `/shopping-list-invites/{inviteId}/accept` | 确认加入共享清单 | 被邀请人本人 | 是 | 否 | 已通过链接先加入时幂等结清邀请 |
| POST | `/shopping-list-invites/{inviteId}/decline` | 忽略一条共享清单邀请 | 被邀请人本人 | 是 | 否 | 只更新邀请状态 |
| POST | `/shopping-lists/{listId}/leave` | 退出共享清单 | 协作者本人 | 是 | 是 | 创建者不可用 |
| GET | `/shopping-shares/{shareToken}` | 链接预览 | 登录后读取 | 否 | 否 | 只返回最小加入信息 |
| POST | `/shopping-shares/{shareToken}/join` | 通过链接加入 | 登录后写入 | 是 | 否 | 已是成员则幂等成功 |

兼容旧链路：

1. `GET/POST /shopping-items`
2. `GET /shopping-items/board`
3. `POST /shopping-items/from-recipe`
4. `POST /shopping-items/{itemId}/status`
5. `POST /shopping-items/group-status`

这些旧路径在新清单链路完成前继续存在，但不再扩展新语义。

## 九、最小数据模型草案

### 9.1 新增表：`shopping_lists`

主事实：一张购物清单。

建议字段：

- `id`
- `owner_user_id`
- `name`
- `status`：`ACTIVE | COMPLETED | VOIDED`
- `version`
- `created_at`
- `updated_at`
- `completed_at`
- `voided_at`

必要约束：

- `owner_user_id` 外键到 `users`
- `version >= 1`
- `completed_at` 只在 `COMPLETED` 有值
- `voided_at` 只在 `VOIDED` 有值

建议索引：

- `(owner_user_id, status, updated_at desc)`
- `(status, updated_at desc)` 仅在需要协作者列表查询时再评估

### 9.2 新增表：`shopping_list_members`

主事实：清单成员关系。

建议字段：

- `id`
- `list_id`
- `user_id`
- `role`：`OWNER | COLLABORATOR`
- `joined_at`
- `added_by_user_id`

必要约束：

- `UNIQUE (list_id, user_id)`
- `list_id` 外键到 `shopping_lists`
- `user_id` 外键到 `users`
- `added_by_user_id` 外键到 `users`

明确不做：

- 不做管理员
- 不做单独权限 bitset
- 不做待接受邀请表

### 9.3 新增表：`shopping_share_tokens`

主事实：可重复失效重建的分享链接。

建议字段：

- `id`
- `list_id`
- `token`
- `created_by_user_id`
- `disabled_at`
- `created_at`

必要约束：

- `token` 唯一
- `list_id` 外键到 `shopping_lists`

规则：

1. 同一清单可保留多条历史 token。
2. 只有 `disabled_at is null` 的 token 可加入。
3. 不要求“每清单只能有一条历史记录”，服务端生成新 token 前先失效旧活动 token 即可。

### 9.4 演进表：`shopping_items`

建议继续复用现有表名，不新增 `shopping_list_items`。原因：

1. 现有服务、脚本和勋章统计都已围绕 `shopping_items` 展开。
2. 购物项本身仍是主事实，只是 owner 从“用户本人”改成“某张清单”。
3. 复用表名能减少迁移和脚本范围。

建议字段调整：

- 新增 `list_id`
- 将现有 `user_id` 语义替换为 `created_by_user_id`
- 保留现有来源字段：
  - `source_type`
  - `source_key`
  - `source_recipe_id`
  - `source_recipe_version_id`
  - `source_recipe_title`
  - `source_base_servings`
  - `source_batch_key`
  - `source_ingredient_sort`
  - `ingredient_id`
  - `amount_json`
- 状态枚举改成：`OPEN | CHECKED | REMOVED`
- 新增：
  - `checked_by_user_id`
  - `checked_at`
  - `removed_by_user_id`
  - `removed_at`

必要约束：

- `list_id` 外键到 `shopping_lists`
- `created_by_user_id` 外键到 `users`
- `checked_by_user_id`、`removed_by_user_id` 外键到 `users`
- `version >= 1`

建议索引：

- `(list_id, status, updated_at desc)`
- `(list_id, ingredient_id, status)`
- `(list_id, source_type, source_recipe_id, source_recipe_version_id, ingredient_id)`

不建议做的事情：

1. 不把“清单状态”继续塞进 `shopping_items.status`。
2. 不给清单项单独增加软删除总开关。
3. 不新增“按菜谱聚合缓存表”。

### 9.5 演进表：`fridge_items`

当前 `fridge_items` 只表达“个人库存项”，缺少过期和来源链。建议最小补齐：

- 新增 `ingredient_id`
- 新增 `expire_at`
- 新增 `source_shopping_list_id`
- 新增 `source_shopping_item_id`

保留现有：

- `name`
- `quantity_text`
- `note`
- `available`
- `consumed_at`
- `version`

必要约束：

- `ingredient_id` 外键到 `ingredients`，允许为空
- `source_shopping_list_id` 外键到 `shopping_lists`，允许为空
- `source_shopping_item_id` 外键到 `shopping_items`，允许为空

当前不新增：

- 不做 `produced_at`
- 不做 `storage_location`
- 不做独立的入库批次头表

## 十、迁移策略草案

### 10.1 总体策略

建议采用“先补新表和新字段，再切接口，再切页面，最后清理旧逻辑”的顺序，不在同一提交里直接硬删旧链路。

### 10.2 旧数据迁移

当前库里已有个人 `shopping_items`。为了不凭空制造“已完成/已作废清单”历史，建议：

1. 为每个仍有 `OPEN` 购物项的用户回填一张默认 `ACTIVE` 清单。
2. 把这些 `OPEN` 项挂到对应默认清单。
3. 旧 `BOUGHT / DELETED` 历史先只留在兼容旧链路，不强行回填成新清单历史。

这样能避免两类问题：

1. 把旧 item 历史硬拼成伪造清单。
2. 为了保历史而把新首页逻辑搞复杂。

### 10.3 兼容期

兼容期内允许：

1. 旧超市模式仍读 `shopping-items`
2. 旧购物聚合板仍可读
3. 新首页和新详情只读 `shopping-lists*`

兼容期结束后再决定是否下线旧路径。

## 十一、实现顺序

### 第 1 步：Schema 与契约骨架

目标：

1. Prisma 增加 `shopping_lists`、`shopping_list_members`、`shopping_share_tokens`
2. 演进 `shopping_items` 和 `fridge_items`
3. DTO / OpenAPI 增加 `shopping-lists*` 与 `shopping-shares*`

不做：

1. 不做客户端页面
2. 不改旧购物页视觉

### 第 2 步：后端读链路

目标：

1. `GET /shopping-lists/summary`
2. `GET /shopping-lists`
3. `GET /shopping-lists/{listId}`
4. 成员与创建者读权限校验

### 第 3 步：后端写链路

目标：

1. 新建清单
2. 改名
3. 手动加食材
4. 菜谱加入清单
5. 勾选 / 删除 / 作废 / 恢复 / 复制
6. 分享链接和成员分享

### 第 4 步：完成清单与入库事务

目标：

1. 完成清单接口
2. `fridge_items` 来源字段写入
3. 默认 `7 天` 到期时间
4. 事务、幂等、版本冲突

### 第 5 步：客户端首页与详情

目标：

1. 新购物首页
2. 新清单详情
3. 新建清单浮动按钮
4. 协作与状态动作入口

### 第 6 步：菜谱页和缺口页接入

目标：

1. 菜谱详情页选择目标清单后加入
2. `shopping-gap` 写入共享清单时遵循责任归属

### 第 7 步：旧链路收口

目标：

1. 判断旧聚合板是否还能保留
2. 判断旧历史页是否改造成清单历史
3. 清理重复入口和冲突文案

## 十二、风险与边界

1. 当前 `shopping_items` 已被勋章、超市模式和旧购物页使用，不能一上来直接删表。
2. `shopping_items.status` 从 `OPEN/BOUGHT/DELETED` 改为 `OPEN/CHECKED/REMOVED` 后，旧历史语义会变化，必须在兼容期内显式分流。
3. `fridge_items` 新增来源字段后，完成清单事务要同时覆盖库存事实和购物清单状态，必须放进同一事务。
4. 购物清单协作当前以 `shopping_list_invites` 为唯一邀请/加入事实；购物清单首页邀请卡片与通知中心里的“清单协作”都只能复用这条事实，不得再额外引入第二套前端猜测状态或独立消息表。
5. 本轮不做后台治理页，后续若需要查看共享清单关系，应单独开新范围。

## 十三、范围自检

1. 本次满足的用户确认规则：
   - 共享清单
   - 顶部 3 状态卡
   - 完成清单入库
   - 默认 `7 天` 到期时间
   - 非实时协作
2. 每个文件为什么必须修改：
   - 本执行单用于把前面确认的产品规则落成具体表结构、接口和实施顺序
3. 明确没有顺手加入的功能：
   - 管理员
   - 实时协作
   - 采购认领
   - 大分类到期模板
   - 后台治理页
4. 因复用未被证明而没有提前增加的抽象：
   - 没有新增“权限中心”
   - 没有新增“购物聚合缓存中心”
   - 没有新增“入库批次头表”
5. 是否还能缩小改动而不破坏需求：
   - 不能再去掉 `shopping_lists` 头表或 `fridge_items` 来源字段，否则首页模型和入库链会断。
