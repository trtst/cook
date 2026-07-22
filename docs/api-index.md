# API 接口索引

## 状态说明

| 状态 | 含义 |
| --- | --- |
| 已实现 | 后端、共享调用层和真实验证路径已存在 |
| 已契约 | 请求响应已冻结，后端尚未实现 |
| 待契约 | 产品规则已确认，但仍缺请求或响应字段 |
| 待创建 | V1 需要，但尚未设计完整接口 |
| 暂不创建 | 当前范围不开放 |

## 已实现接口

| 模块 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| Auth | POST | `/auth/login` | 手机号密码登录 |
| Auth | POST | `/auth/refresh` | 刷新用户 token |
| User | GET | `/users/me` | 当前用户 |
| User | PUT | `/users/me` | 更新当前用户 |
| User | PUT | `/users/me/password` | 修改当前用户登录密码 |
| DiningGroup | GET | `/dining-groups/current` | 唯一当前空间、原空间、快照、权益与空间状态 |
| DiningGroup | GET | `/dining-group-members` | 当前饭搭子成员 |
| DiningGroupInvite | POST | `/dining-group-invites` | 创建单次长期邀请 |
| DiningGroupInvite | POST | `/dining-group-invites/{inviteToken}/accept` | 冻结原空间并加入目标饭搭子 |
| DiningGroup | POST | `/dining-groups/{diningGroupId}/leave` | 退出、恢复原空间、创建快照头 |
| CarryBack | GET | `/carry-back-snapshots` | 本人当前可用迁出快照列表 |
| Entitlement | GET | `/entitlements/current` | 服务端解析当前用户与饭搭子有效权益 |
| AdminAuth | POST | `/admin/auth/login` | 管理员登录 |
| AdminUser | GET | `/admin/users` | 用户只读查询 |
| AdminDiningGroup | GET | `/admin/dining-groups` | 饭搭子只读查询 |
| AdminEntitlement | GET | `/admin/user-entitlements` | SUPER_ADMIN 查询用户当前有效权益 |

账号创建后自动拥有单人饭搭子，不提供手动创建和多饭搭子切换接口。

## 已契约、待实现

| 模块 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| OriginalSpace | GET | `/original-space/importable-data` | 原空间可迁入资料 |
| OriginalSpace | POST | `/original-space/imports` | 选择迁入，源数据不移动 |
| CarryBack | GET | `/carry-back-snapshot-items` | 本人分页读取尚可选择的冻结清单摘要 |
| CarryBack | POST | `/carry-back-snapshots/{snapshotId}/imports` | 分批带回 |
| Storage | GET | `/storage-usage` | 逻辑空间模块明细 |
| Taste | GET | `/users/me/taste-profile` | 本人口味与安全资料 |
| Taste | PUT | `/users/me/taste-profile` | 更新本人口味资料 |
| MealGuest | POST | `/meal-plans/{mealPlanId}/guest-invitations` | 饭局临时邀请 |
| MealGuest | POST | `/meal-guest-invitations/{invitationId}/respond` | 饭局接受、拒绝或取消 |
| Recipe | GET | `/recipes/{recipeId}` | 菜谱详情和派生摘要 |
| RecipeImport | POST | `/recipe-imports` | 收录系统或公开菜谱 |
| RecipeVariant | POST | `/recipe-variants` | Plus 另存为新做法 |

## 待补契约

| 模块 | 方法 | 路径 | 缺失内容 |
| --- | --- | --- | --- |
| Recipe | GET | `/recipes` | 筛选与分页请求响应 |
| Recipe | GET | `/system-recipes` | 筛选与分页请求响应 |
| Recipe | POST | `/recipes` | 成功响应 |
| Recipe | PUT | `/recipes/{recipeId}` | 成功响应 |
| Membership | - | 待冻结 | 订单、补差、回调和到期选择 |
| Activity / Achievement | - | 待冻结 | 服务端完成事实、成就规则、勋章墙摘要、领取或自动发放边界 |

## 待创建

| 模块 | 建议路径 | 说明 |
| --- | --- | --- |
| Meal | `/meal-plans` | 当前和历史计划 |
| Poll | `/meal-polls`、`/meal-poll-votes` | 点菜征集与回应 |
| Fridge | `/fridge-items` | 共享冰箱 |
| Shopping | `/shopping-lists/current`、`/shopping-items` | 当前购物清单 |
| Share | `/share-snapshots` | 固定版本分享 |
| AdminRecipe | `/admin/recipes`、`/admin/imports` | 系统菜谱治理 |

## 暂不创建

Public UGC、完整 Worker 运行、饭票、积分商城、OCR、AI、Pro、多家庭、多饭搭子切换、冰箱图片、聊天、评论、关注和私信当前均不开放。

## 维护规则

1. 先更新 `api-contract.md` 和后端 OpenAPI，再同步各端本地 API 类型。
2. 只有后端真实路径和最小验证通过后才能标记“已实现”。
3. 客户端不得自行补字段、合并权益或保存当前饭搭子偏好。
