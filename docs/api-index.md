# API 接口索引

## 目的

本文用于快速查看当前已经创建的接口、待创建的接口、实现位置和详情位置。

接口调用详情、请求响应示例和调用说明见 `docs/client-api.md`。DTO、错误码、权限、幂等和版本规则仍以 `docs/api-contract.md` 为准。

本文只做状态索引，不重复维护完整接口说明。

## 状态说明

| 状态 | 含义 |
| --- | --- |
| 已实现 | 后端 Controller / Service 已存在，`packages/api-client` 已有调用入口 |
| 已契约 | `docs/api-contract.md` 已定义，代码可能未完整接入 |
| 待创建 | V1 范围内需要，但尚未定义接口详情或尚未实现 |
| 暂不创建 | V1 不做、Disabled 或 Reserved 模块，当前不开放业务入口 |
| 待契约 | 产品规则已确认，但 API/DTO/数据库尚未完成 v0.2 评审 |

## 已创建接口

| 模块 | 方法 | 路径 | 端侧 | 状态 | 后端实现 | api-client | 详情 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth | POST | `/auth/login` | 小程序 | 已实现 | `apps/api/src/modules/auth/auth.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：1.1 手机号密码登录 |
| Auth | POST | `/auth/refresh` | 小程序 | 已实现 | `apps/api/src/modules/auth/auth.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：1.1.1 刷新登录态 |
| User | GET | `/users/me` | 小程序 | 已实现 | `apps/api/src/modules/user/user.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：1.2 获取当前用户 |
| User | PUT | `/users/me` | 小程序 | 已实现 | `apps/api/src/modules/user/user.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：1.3 更新当前用户 |
| DiningGroup | GET | `/dining-groups/mine` | 小程序 | 已实现 | `apps/api/src/modules/dining-group/dining-group.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：2.1 我的饭搭子列表 |
| DiningGroup | POST | `/dining-groups` | 小程序 | 已实现 | `apps/api/src/modules/dining-group/dining-group.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：2.2 创建饭搭子 |
| DiningGroup | GET | `/dining-groups/{diningGroupId}` | 小程序 | 已实现 | `apps/api/src/modules/dining-group/dining-group.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：2.3 饭搭子详情 |
| DiningGroup | GET | `/dining-group-members?diningGroupId={diningGroupId}` | 小程序 | 已实现 | `apps/api/src/modules/dining-group/dining-group.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：2.4 饭搭子成员列表 |
| DiningGroup | POST | `/dining-group-invites` | 小程序 | 已实现 | `apps/api/src/modules/dining-group/dining-group.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：2.5 创建邀请 |
| DiningGroup | POST | `/dining-group-invites/{inviteToken}/accept` | 小程序 | 已实现 | `apps/api/src/modules/dining-group/dining-group.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：2.6 接受邀请 |
| AdminAuth | POST | `/admin/auth/login` | 后台 | 已实现 | `apps/api/src/modules/auth/admin.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：3.1 管理员登录 |
| AdminUser | GET | `/admin/users` | 后台 | 已实现 | `apps/api/src/modules/auth/admin.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：3.2 用户只读查询 |
| AdminDiningGroup | GET | `/admin/dining-groups` | 后台 | 已实现 | `apps/api/src/modules/auth/admin.controller.ts` | `packages/api-client/src/client.ts` | `docs/client-api.md`：3.3 饭搭子只读查询 |

## 待创建接口

以下接口属于 V1 主路径，但尚未在 `docs/api-contract.md` 写出完整详情。创建前必须先补契约，再进入三端实现。

| 模块 | 建议路径 | 端侧 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| Recipe | `GET /recipes` | 小程序 | 待创建 | 饭搭子菜谱列表 |
| Recipe | `GET /recipes/{recipeId}` | 小程序 | 待创建 | 菜谱详情，需引用固定内容版本 |
| Recipe | `POST /recipes` | 小程序 | 待创建 | 创建饭搭子菜谱，写操作需要 `operationId` |
| Recipe | `PUT /recipes/{recipeId}` | 小程序 | 待创建 | 编辑菜谱入口或创建新内容版本，需明确 version 规则 |
| Recipe | `GET /system-recipes` | 小程序 | 待创建 | 系统推荐广场 / 系统模板列表 |
| RecipeImport | `POST /recipe-imports` | 小程序 | 待创建 | v0.1 建议路径；v0.2 产品操作名为“收录”，最终路径待契约 |
| Meal | `POST /meal-plans` | 小程序 | 待创建 | 创建下一餐计划，需事务和 `operationId` |
| Meal | `GET /meal-plans` | 小程序 | 待创建 | 下一餐计划列表或当前计划 |
| Poll | `POST /meal-polls` | 小程序 | 待创建 | 创建点菜征集 |
| Poll | `POST /meal-poll-votes` | 小程序 | 待创建 | 参与点菜 / 我想吃 |
| Fridge | `GET /fridge-items` | 小程序 | 待创建 | 冰箱库存列表 |
| Fridge | `PUT /fridge-items/{fridgeItemId}` | 小程序 | 待创建 | 更新库存三态，需 version |
| Shopping | `GET /shopping-lists/current` | 小程序 | 待创建 | 当前购物清单 |
| Shopping | `POST /shopping-items` | 小程序 | 待创建 | 添加购物项，需 `operationId` 和合并规则 |
| Shopping | `POST /shopping-items/check` | 小程序 | 待创建 | 勾选 / 取消勾选购物项 |
| Share | `POST /share-snapshots` | 小程序 | 待创建 | 创建分享快照 |
| Share | `GET /share-snapshots/{snapshotId}` | 小程序 | 待创建 | 只读预览分享快照 |
| AdminRecipe | `GET /admin/recipes` | 后台 | 待创建 | 系统菜谱 / 导入治理列表 |
| AdminRecipe | `POST /admin/imports` | 后台 | 待创建 | 后台导入批次 |
| AdminRecipe | `POST /admin/imports/{batchId}/publish` | 后台 | 待创建 | 发布导入结果 |
| DiningGroup | `GET /dining-groups/current` | 小程序 | 待契约 | 唯一活跃饭搭子、原空间摘要和服务端权益 |
| DiningGroup | `POST /dining-groups/{diningGroupId}/leave` | 小程序 | 待契约 | 退出、原空间恢复、快照与参与关系事务 |
| OriginalSpace | `GET /original-space/importable-data` | 小程序 | 待契约 | 原空间可迁入白名单 |
| OriginalSpace | `POST /original-space/imports` | 小程序 | 待契约 | 容量预检、幂等、源数据不移动 |
| CarryBack | `GET /carry-back-snapshots` | 小程序 | 待契约 | 私有快照列表与有效期 |
| CarryBack | `POST /carry-back-snapshots/{snapshotId}/imports` | 小程序 | 待契约 | 分批幂等带回 |
| Storage | `GET /storage-usage` | 小程序 | 待契约 | 统一逻辑空间与模块明细 |
| Entitlement | `GET /entitlements/current` | 小程序 | 待契约 | 服务端解析个人/饭搭子权益 |
| Taste | `GET /users/me/taste-profile` | 小程序 | 待契约 | 用户级口味与安全资料 |
| Taste | `PUT /users/me/taste-profile` | 小程序 | 待契约 | 更新用户级资料 |
| MealGuest | `POST /meal-plans/{mealPlanId}/guest-invitations` | 小程序 | 待契约 | 临时饭局邀请，不占长期席位 |
| MealGuest | `POST /meal-guest-invitations/{invitationId}/respond` | 小程序 | 待契约 | 接受、拒绝、取消和本次口味快照 |
| Membership | 待冻结 | 小程序 | 待契约 | 个人 Plus、饭搭子 Plus、正常补差升级与到期选择 |

## 暂不创建接口

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| Public | 暂不创建 | V1 不开放用户公共投稿和公开 UGC 运营闭环 |
| Worker / Outbox | 暂不创建 | V1 建表但不启动 Worker，不开放业务接口 |
| Point / OCR / AI / Pro | 暂不创建 | Reserved，不开放服务、接口或客户端入口 |
| Receipt / FridgePhoto | 暂不创建 | 当前不做小票识别和冰箱物品图片 |
| Chat / Comment / Follow / PrivateMessage | 暂不创建 | V1 明确不做聊天、评论、关注和私信 |

## 维护规则

1. 新增接口前，先在本文加入 `待创建` 或 `已契约` 记录。
2. 接口详情确认后，补充 `docs/client-api.md` 的调用说明，并同步 `docs/api-contract.md` 的 DTO、错误码、权限和规则。
3. 后端、`packages/api-client`、小程序或后台接入完成后，再把本文状态改为 `已实现`。
4. 不在本文复制大段请求响应结构，避免和 `docs/client-api.md` / `docs/api-contract.md` 漂移。
5. v0.1 已实现接口与 v0.2 待契约接口必须保持状态区分，不能仅修改文档就标记已实现。
