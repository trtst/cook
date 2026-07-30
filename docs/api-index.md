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
| AdminDashboard | GET | `/admin/dashboard/summary` | 后台首页摘要统计 |
| AdminUser | GET | `/admin/users` | 用户查询 |
| AdminUser | POST | `/admin/users` | 新增用户 |
| AdminUser | PUT | `/admin/users/{userId}` | 更新用户昵称或手机号 |
| AdminUser | POST | `/admin/users/{userId}/status` | 启用或禁用用户 |
| AdminUser | POST | `/admin/users/{userId}/reset-password` | 重置用户密码 |
| AdminDiningGroup | GET | `/admin/dining-groups` | 饭搭子只读查询 |
| AdminEntitlement | GET | `/admin/user-entitlements` | SUPER_ADMIN 查询用户会员、关系和分域策略摘要 |
| Inspiration | GET | `/inspiration-categories` | 匿名灵感分类列表 |
| Inspiration | GET | `/inspiration-recipes` | 匿名灵感菜谱分页 |
| Inspiration | GET | `/inspiration-recipes/{recipeId}` | 匿名灵感菜谱详情 |
| Recipe | GET | `/recipe-categories` | 当前用户个人分类列表 |
| Recipe | POST | `/recipe-categories` | 新建个人分类 |
| Recipe | PUT | `/recipe-categories/{categoryId}` | 修改个人分类 |
| Recipe | POST | `/recipe-categories/reorder` | 重排个人分类 |
| Recipe | GET | `/recipe-scenes` | 当前用户个人场景列表 |
| Recipe | POST | `/recipe-scenes` | 新建个人场景 |
| Recipe | PUT | `/recipe-scenes/{sceneId}` | 修改个人场景 |
| Recipe | POST | `/recipe-scenes/reorder` | 重排个人场景 |
| Recipe | GET | `/recipe-drafts` | 当前用户草稿分页 |
| Recipe | POST | `/recipe-drafts` | 首次保存草稿或创建编辑草稿 |
| Recipe | GET | `/recipe-drafts/{draftId}` | 草稿详情 |
| Recipe | PUT | `/recipe-drafts/{draftId}` | 保存已有草稿 |
| Recipe | POST | `/recipe-drafts/{draftId}/delete` | 删除草稿 |
| Recipe | POST | `/recipe-drafts/{draftId}/publish` | 发布草稿到“我的” |
| Recipe | GET | `/recipes` | 当前用户已发布菜谱分页 |
| Recipe | GET | `/recipes/{recipeId}` | 当前用户已发布菜谱详情 |
| Recipe | POST | `/recipes/reorder` | 当前分类下重排我的菜谱 |
| Recipe | POST | `/recipes/{recipeId}/delete` | 回收或删除菜谱 |
| Recipe | POST | `/recipes/{recipeId}/report` | 举报菜谱 |
| Collection | GET | `/collections` | 当前用户合集场景摘要 |
| Collection | GET | `/collections/recipes` | 当前用户收藏快照分页 |
| Collection | GET | `/collections/recipes/{collectionRecipeId}` | 当前用户收藏快照详情 |
| Collection | POST | `/collections/recipes` | 收藏灵感固定版本到合集，`sceneIds` 至少一个 |
| AdminRecipeDomain | GET | `/admin/users/{userId}/recipe-domain` | 后台按用户读取菜谱域概览 |
| AdminRecipeDomain | GET | `/admin/users/{userId}/recipes` | 后台按用户读取已发布菜谱 |
| AdminRecipeDomain | GET | `/admin/users/{userId}/recipe-drafts` | 后台按用户读取菜谱草稿 |
| AdminRecipeDomain | GET | `/admin/users/{userId}/collections` | 后台按用户读取合集场景摘要 |
| AdminRecipeDomain | GET | `/admin/users/{userId}/collections/{sceneId}/recipes` | 后台按用户读取某合集内容 |
| AdminIngredient | GET | `/admin/ingredient-categories` | 后台系统食材分类列表 |
| AdminIngredient | POST | `/admin/ingredient-categories` | 后台新建系统食材分类 |
| AdminIngredient | PUT | `/admin/ingredient-categories/{categoryId}` | 后台编辑系统食材分类 |
| AdminIngredient | POST | `/admin/ingredient-categories/reorder` | 后台重排系统食材分类 |
| AdminIngredient | GET | `/admin/units` | 后台系统单位列表 |
| AdminIngredient | POST | `/admin/units` | 后台新建系统单位 |
| AdminIngredient | PUT | `/admin/units/{unitId}` | 后台编辑系统单位 |
| AdminIngredient | DELETE | `/admin/units/{unitId}` | 后台删除系统单位 |
| AdminIngredient | POST | `/admin/units/reorder` | 后台重排同类型系统单位 |
| AdminIngredient | GET | `/admin/ingredients` | 后台系统食材分页列表 |
| AdminIngredient | POST | `/admin/ingredients` | 后台新建系统食材 |
| AdminIngredient | PUT | `/admin/ingredients/{ingredientId}` | 后台编辑系统食材 |
| AdminIngredient | POST | `/admin/ingredients/{ingredientId}/status` | 后台下架或恢复系统食材 |
| AdminIngredient | POST | `/admin/ingredients/{ingredientId}/image` | 后台上传或替换系统食材图片 |
| AdminIngredient | DELETE | `/admin/ingredients/{ingredientId}/image` | 后台清空系统食材图片 |
| AdminIngredient | POST | `/admin/ingredients/reorder` | 后台重排系统食材 |
| AdminIngredient | GET | `/admin/pending-ingredients` | 后台待审核个人食材分页列表 |
| AdminIngredient | POST | `/admin/pending-ingredients/{ingredientId}/review` | 后台审核个人食材推荐 |
| Ingredient | GET | `/ingredient-categories` | 系统食材分类列表 |
| Ingredient | GET | `/ingredients` | 分页查询系统/本人食材 |
| Ingredient | POST | `/ingredients` | 新建个人食材 |
| Ingredient | PUT | `/ingredients/{ingredientId}` | 编辑个人食材 |
| Ingredient | POST | `/ingredients/{ingredientId}/recommendations` | 显式推荐个人食材入系统库 |
| Ingredient | GET | `/ingredient-recommendations` | 分页查询我的食材推荐记录 |
| Unit | GET | `/units` | 分页查询系统/本人单位 |
| Unit | POST | `/units` | 新建个人单位 |
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
| AdminRecipe | GET | `/admin/recipes` | 后台菜谱列表 |
| AdminRecipe | GET | `/admin/recipes/{recipeId}` | 后台菜谱详情 |
| AdminRecipe | PUT | `/admin/recipes/{recipeId}` | 后台编辑灵感菜谱正文 |
| AdminRecipe | GET | `/admin/recipe-reports` | 后台举报查询 |
| AdminRecipe | POST | `/admin/recipes/{recipeId}/block` | 下架菜谱 |
| AdminRecipe | POST | `/admin/recipes/{recipeId}/unblock` | 恢复菜谱 |
| AdminRecipe | POST | `/admin/recipe-reports/{reportId}/resolve` | 处理举报 |

## 待补契约

### 已冻结待继续扩展：菜谱 R1

| 模块 | 方法与路径 | 状态 |
| --- | --- | --- |
| RecipePromotion | 升级合集快照为“我的” | 已确认非本轮范围，待契约 |
| InspirationGovernance | 用户推荐到灵感审核、点赞与收藏统计治理 | 已确认非本轮范围，待契约 |

| 模块 | 路径 | 缺失内容 |
| --- | --- | --- |
| Membership | 待冻结 | 订单、补差、回调和到期选择 |
| Activity / Achievement | 待冻结 | 服务端完成事实、成就规则和勋章墙摘要 |

## 暂不创建

菜谱图片上传与修改、升级合集快照为“我的”、用户推荐到灵感审核、点赞、背景图上传、完整 Worker 运行、饭票、积分商城、OCR、AI、多家庭、冰箱图片、聊天、评论、关注和私信当前均不开放。R1 草稿请求包含图片字段时返回 `400`。

## 维护规则

1. 先更新 `api-contract.md` 和后端 OpenAPI，再同步各端本地 API 类型。
2. 只有后端真实路径和最小验证通过后才能标记“已实现”。
3. 客户端不得自行补字段或合并权益；饭搭子选择只作为页面状态，不得改变个人数据归属。
