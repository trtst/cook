# API 接口索引

> 当前索引已经切换到个人数据 + 多饭搭子关系模型。旧的唯一当前空间、冻结恢复、迁出快照和 `/entitlements/current` 不再作为现行合同。

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
| User | GET | `/users/me` | 当前用户资料、展示设置和会员事实 |
| User | PUT | `/users/me` | 更新当前用户昵称和头像 |
| User | PUT | `/users/me/display` | 背景图能力预留，当前固定返回 `503` |
| User | PUT | `/users/me/password` | 修改当前用户登录密码 |
| User | GET | `/users/me/taste-profile` | 当前用户口味与安全资料 |
| User | PUT | `/users/me/taste-profile` | 更新当前用户口味与安全资料 |
| DiningGroup | GET | `/dining-groups` | 本人饭搭子关系列表和关系域用量 |
| DiningGroup | GET | `/dining-group-members` | 指定饭搭子成员 |
| Storage | GET | `/storage-usage` | 个人逻辑空间模块明细 |
| DiningGroupInvite | POST | `/dining-group-invites` | 创建单次长期邀请 |
| DiningGroupInvite | POST | `/dining-group-invites/{inviteToken}/accept` | 接受邀请并建立关系 |
| DiningGroup | POST | `/dining-groups/{diningGroupId}/leave` | 退出指定饭搭子 |
| DiningGroup | POST | `/dining-groups/{diningGroupId}/remove-member` | 主理人移除成员 |
| DiningGroup | POST | `/dining-groups/{diningGroupId}/dissolve` | 主理人解散饭搭子 |
| AdminAuth | POST | `/admin/auth/login` | 管理员登录 |
| AdminUser | GET | `/admin/users` | 用户查询 |
| AdminUser | POST | `/admin/users` | 新增用户 |
| AdminUser | PUT | `/admin/users/{userId}` | 更新用户昵称或手机号 |
| AdminUser | POST | `/admin/users/{userId}/status` | 启用或禁用用户 |
| AdminUser | POST | `/admin/users/{userId}/reset-password` | 重置用户密码 |
| AdminDiningGroup | GET | `/admin/dining-groups` | 饭搭子只读查询 |
| AdminEntitlement | GET | `/admin/user-entitlements` | SUPER_ADMIN 查询用户会员、关系和分域策略摘要 |
| Recipe | GET/POST | `/recipes` | 查询或创建个人菜谱 |
| Recipe | GET/PUT | `/recipes/{recipeId}` | 读取或更新菜谱 |
| Recipe | POST | `/recipes/{recipeId}/import` | 导入系统或其他用户菜谱 |
| Recipe | POST | `/recipes/{recipeId}/delete` | 回收或删除菜谱 |
| Recipe | POST | `/recipes/{recipeId}/report` | 举报菜谱 |
| Meal | GET/POST | `/meal-plans` | 查询或创建个人计划 |
| DiningEvent | POST | `/meal-plans/{planItemId}/dining-event` | 从计划创建饭局 |
| DiningEvent | GET | `/dining-events/{eventId}` | 饭局详情 |
| DiningEvent | POST | `/dining-events/{eventId}/invite-group` | 邀请饭搭子成员 |
| DiningEvent | POST | `/dining-events/{eventId}/respond` | 回应饭局 |
| DiningEvent | POST | `/dining-events/{eventId}/bring` | 选择带菜 |
| Share | GET | `/share/{shareToken}/preview` | 饭局分享预览 |
| Share | POST | `/share/{shareToken}/accept` | 以临时参与人接受分享 |
| Fridge | GET/POST | `/fridge-items` | 查询或创建个人冰箱条目 |
| Fridge | PUT | `/fridge-items/{itemId}` | 更新个人冰箱条目 |
| Fridge | POST | `/fridge-items/consume` | 消耗个人冰箱条目 |
| Shopping | GET/POST | `/shopping-items` | 查询或创建个人购物条目 |
| Shopping | POST | `/shopping-items/{itemId}/status` | 更新购物状态 |
| Shopping | GET | `/shopping-gap` | 查询个人购物缺口 |
| Shopping | POST | `/dining-events/{eventId}/shopping-gap` | 生成饭局购物缺口 |
| AdminRecipe | GET | `/admin/recipes` | 后台菜谱查询 |
| AdminRecipe | GET | `/admin/recipe-reports` | 后台举报查询 |
| AdminRecipe | POST | `/admin/recipes/{recipeId}/block` | 下架菜谱 |
| AdminRecipe | POST | `/admin/recipes/{recipeId}/unblock` | 恢复菜谱 |
| AdminRecipe | POST | `/admin/recipe-reports/{reportId}/resolve` | 处理举报 |

## 待补契约

| 模块 | 路径 | 缺失内容 |
| --- | --- | --- |
| Membership | 待冻结 | 订单、补差、回调和到期选择 |
| Activity / Achievement | 待冻结 | 服务端完成事实、成就规则和勋章墙摘要 |

## 暂不创建

菜谱图片上传与修改、背景图上传、Public UGC、完整 Worker 运行、饭票、积分商城、OCR、AI、多家庭、冰箱图片、聊天、评论、关注和私信当前均不开放。菜谱创建和更新请求包含 `images` 时返回 `400`。

## 维护规则

1. 先更新 `api-contract.md` 和后端 OpenAPI，再同步各端本地 API 类型。
2. 只有后端真实路径和最小验证通过后才能标记“已实现”。
3. 客户端不得自行补字段或合并权益；饭搭子选择只作为页面状态，不得改变个人数据归属。
