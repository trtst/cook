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
| Home | GET | `/home-entries` | 小程序首页入口配置：固定返回 3 张首屏主卡，四宫格只返回当前已上架入口，统一按布局顺序排序 |
| HomeTopic | GET | `/home-topics/current` | 当前本周灵感专题页 |
| HomeTopic | GET | `/home-topics/{topicId}` | 指定本周灵感专题页 |
| TableTopic | GET | `/table-topics` | 餐桌话题列表，按活动时间倒序返回历次话题摘要 |
| TableTopic | GET | `/table-topics/{topicId}` | 指定餐桌话题详情，公开返回是否已参与需依赖可选用户 token |
| TableTopic | POST | `/table-topics/{topicId}/participate` | 当前用户参与一个餐桌话题，同一用户只记一次 |
| User | GET | `/users/me` | 当前用户资料、展示设置和会员事实 |
| User | GET | `/users/me/medals` | 当前用户勋章墙、分类与获得状态摘要 |
| User | PUT | `/users/me` | 更新当前用户昵称和头像 |
| User | PUT | `/users/me/display` | 背景图能力预留，当前固定返回 `503` |
| User | PUT | `/users/me/password` | 修改当前用户登录密码 |
| User | GET | `/users/me/taste-profile` | 当前用户口味与安全资料 |
| User | PUT | `/users/me/taste-profile` | 更新当前用户口味与安全资料 |
| DiningGroup | GET | `/dining-groups` | 本人饭搭子关系列表和关系域用量 |
| DiningGroup | POST | `/dining-groups` | 显式开启并创建本人主理的首个饭搭子 |
| DiningGroup | GET | `/dining-group-members` | 指定饭搭子成员 |
| DiningGroup | PUT | `/dining-groups/{diningGroupId}` | 主理人更新当前饭搭子名称和简介 |
| DiningGroup | POST | `/dining-groups/{diningGroupId}/cover` | 主理人上传或替换饭搭子主页主图 |
| Storage | GET | `/storage-usage` | 个人逻辑空间模块明细 |
| DiningGroupInvite | POST | `/dining-group-invites` | 创建单次长期邀请 |
| DiningGroupInvite | POST | `/dining-group-invites/{inviteToken}/accept` | 接受邀请并建立关系 |
| DiningGroup | POST | `/dining-groups/{diningGroupId}/leave` | 退出指定饭搭子 |
| DiningGroup | POST | `/dining-groups/{diningGroupId}/remove-member` | 主理人移除成员 |
| DiningGroup | POST | `/dining-groups/{diningGroupId}/dissolve` | 主理人解散饭搭子 |
| AdminAuth | POST | `/admin/auth/login` | 管理员登录 |
| AdminDashboard | GET | `/admin/dashboard/summary` | 后台首页摘要统计 |
| AdminHome | GET | `/admin/home-entries` | 后台读取小程序首页 7 个快捷入口配置和站内页白名单 |
| AdminHome | PUT | `/admin/home-entries` | 后台按提交的 `items` 保存小程序首页快捷入口配置，支持单卡或多卡一起保存 |
| AdminHome | POST | `/admin/home-entries/{placement}/status` | 后台切换首页四宫格入口上架状态 |
| AdminHome | POST | `/admin/home-entries/{placement}/image` | 后台上传或替换指定首页快捷入口图片 |
| AdminHome | DELETE | `/admin/home-entries/{placement}/image` | 后台清空指定首页快捷入口图片 |
| AdminHomeTopic | GET | `/admin/home-topics` | 后台读取本周灵感专题列表与类别选项 |
| AdminHomeTopic | GET | `/admin/home-topics/recipes` | 后台搜索可加入专题的灵感菜谱 |
| AdminHomeTopic | POST | `/admin/home-topics` | 后台新建本周灵感专题 |
| AdminHomeTopic | PUT | `/admin/home-topics/{topicId}` | 后台更新本周灵感专题 |
| AdminHomeTopic | POST | `/admin/home-topics/{topicId}/status` | 后台切换本周灵感专题上架状态 |
| AdminHomeTopic | POST | `/admin/home-topics/{topicId}/image` | 后台上传或替换专题封面图 |
| AdminHomeTopic | DELETE | `/admin/home-topics/{topicId}/image` | 后台清空专题封面图 |
| AdminTableTopic | GET | `/admin/table-topics` | 后台读取餐桌话题列表 |
| AdminTableTopic | POST | `/admin/table-topics` | 后台新建餐桌话题 |
| AdminTableTopic | PUT | `/admin/table-topics/{topicId}` | 后台更新餐桌话题 |
| AdminTableTopic | POST | `/admin/table-topics/{topicId}/status` | 后台切换餐桌话题上架状态 |
| AdminTableTopic | POST | `/admin/table-topics/{topicId}/image` | 后台上传或替换话题封面图 |
| AdminTableTopic | DELETE | `/admin/table-topics/{topicId}/image` | 后台清空话题封面图 |
| AdminMedal | GET | `/admin/medal-templates` | 后台勋章模板分页列表 |
| AdminMedal | POST | `/admin/medal-templates` | 后台新增勋章模板 |
| AdminMedal | PUT | `/admin/medal-templates/{templateId}` | 后台编辑勋章模板 |
| AdminMedal | POST | `/admin/medal-templates/{templateId}/status` | 后台切换勋章模板状态 |
| AdminMedal | POST | `/admin/medal-templates/{templateId}/image/{imageType}` | 后台上传或替换勋章图片，`imageType=earned/locked`，当前支持 `JPG/PNG/WEBP/SVG` |
| AdminMedal | DELETE | `/admin/medal-templates/{templateId}/image/{imageType}` | 后台清空勋章图片，`imageType=earned/locked` |
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
| Recipe | POST | `/recipes/from-inspiration` | 从灵感详情直接加入“我的” |
| Recipe | GET | `/recipes/{recipeId}` | 当前用户已发布菜谱详情 |
| Recipe | POST | `/recipes/{recipeId}/recommendations` | 推荐当前个人菜谱到系统菜谱审核 |
| Recipe | POST | `/recipe-recommendations/{recommendationId}/withdraw` | 撤回待审核的菜谱推荐 |
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
| AdminIngredient | GET | `/admin/ingredient-feedbacks` | 后台待审核系统食材纠错分页列表 |
| AdminIngredient | POST | `/admin/ingredient-feedbacks/{feedbackId}/review` | 后台审核系统食材纠错 |
| AdminRecipe | GET | `/admin/inspiration-categories` | 后台系统菜谱分类列表 |
| AdminRecipe | POST | `/admin/inspiration-categories` | 后台新建系统菜谱分类 |
| AdminRecipe | PUT | `/admin/inspiration-categories/{categoryId}` | 后台编辑系统菜谱分类 |
| AdminRecipe | POST | `/admin/inspiration-categories/reorder` | 后台重排系统菜谱分类 |
| Ingredient | GET | `/ingredient-categories` | 系统食材分类列表 |
| Ingredient | GET | `/ingredients` | 分页查询系统/本人食材 |
| Ingredient | POST | `/ingredients` | 新建个人食材 |
| Ingredient | PUT | `/ingredients/{ingredientId}` | 编辑个人食材 |
| Ingredient | POST | `/ingredients/{ingredientId}/recommendations` | 显式推荐个人食材入系统库 |
| Ingredient | POST | `/ingredients/{ingredientId}/feedbacks` | 提交系统食材纠错 |
| Ingredient | GET | `/ingredient-recommendations` | 分页查询我的食材推荐记录 |
| Unit | GET | `/units` | 分页查询系统/本人单位 |
| Unit | POST | `/units` | 新建个人单位 |
| Meal | GET/POST | `/meal-plans` | 查询或创建个人计划 |
| Meal | POST | `/meal-plans/{planItemId}/complete` | 完成一个计划餐次 |
| MealPoll | GET | `/meal-polls` | 查询当前饭搭子的点菜征集摘要列表 |
| MealPoll | POST | `/meal-polls` | 发起点菜征集 |
| MealPoll | GET | `/meal-polls/{pollId}` | 点菜征集详情与结果汇总 |
| MealPoll | POST | `/meal-polls/{pollId}/vote` | 当前成员提交或覆盖自己的征集回应 |
| MealPoll | POST | `/meal-polls/{pollId}/confirm` | 关闭征集并确认最终菜单 |
| DiningEvent | POST | `/meal-plans/{planItemId}/dining-event` | 从计划创建饭局 |
| DiningGroupActivity | GET | `/dining-group-activities` | 查询当前饭搭子最近轻动态 |
| DiningEvent | GET | `/dining-events/{eventId}` | 饭局详情 |
| DiningEvent | POST | `/dining-events/{eventId}/cook` | 对已确认菜单执行“我来做”认领或释放 |
| DiningEvent | POST | `/dining-events/{eventId}/memory-shares` | 生成一张不可变饭搭子卡快照 |
| DiningEvent | POST | `/dining-events/{eventId}/invite-group` | 邀请饭搭子成员 |
| DiningEvent | POST | `/dining-events/{eventId}/respond` | 回应饭局 |
| DiningEvent | POST | `/dining-events/{eventId}/bring` | 选择带菜 |
| DiningEvent | POST | `/dining-events/{eventId}/complete` | 完成一场饭局 |
| Share | GET | `/share/{shareToken}/preview` | 饭局分享预览 |
| Share | POST | `/share/{shareToken}/accept` | 以临时参与人接受分享 |
| Share | GET | `/memory-shares/{shareToken}/preview` | 读取公开饭搭子卡快照 |
| Fridge | GET/POST | `/fridge-items` | 查询或创建个人冰箱条目 |
| Fridge | PUT | `/fridge-items/{itemId}` | 更新个人冰箱条目 |
| Fridge | POST | `/fridge-items/consume` | 消耗个人冰箱条目 |
| Shopping | GET/POST | `/shopping-items` | 查询或创建当前用户个人购物事实，供超市模式和采购记录使用 |
| Shopping | GET | `/shopping-items/board` | 读取现有旧购物页聚合板，后续将被共享清单首页替代 |
| Shopping | POST | `/shopping-items/from-recipe` | 把一份可读菜谱固定版本写入旧购物事实链路 |
| Shopping | POST | `/shopping-items/{itemId}/status` | 更新个人购物事实状态，供旧超市模式兼容使用 |
| Shopping | POST | `/shopping-items/group-status` | 更新旧购物页聚合板分组状态 |
| Shopping | GET | `/shopping-gap` | 查询当前用户待处理饭局汇总缺口 |
| Shopping | POST | `/dining-events/{eventId}/shopping-gap` | 生成饭局购物缺口 |
| AdminRecipe | GET | `/admin/recipes` | 后台系统菜谱列表 |
| AdminRecipe | POST | `/admin/recipes` | 后台新增系统菜谱 |
| AdminRecipe | GET | `/admin/recipes/{recipeId}` | 后台菜谱详情 |
| AdminRecipe | PUT | `/admin/recipes/{recipeId}` | 后台编辑系统菜谱正文 |
| AdminRecipe | GET | `/admin/pending-recipes` | 后台待审核个人菜谱分页列表 |
| AdminRecipe | POST | `/admin/pending-recipes/{recommendationId}/review` | 后台审核个人菜谱推荐 |
| AdminRecipe | GET | `/admin/recipe-reports` | 后台举报查询 |
| AdminRecipe | POST | `/admin/recipes/{recipeId}/block` | 下架菜谱 |
| AdminRecipe | POST | `/admin/recipes/{recipeId}/unblock` | 恢复菜谱 |
| AdminRecipe | POST | `/admin/recipe-reports/{reportId}/resolve` | 处理举报 |

## 待补契约

### 已冻结待继续扩展：菜谱 R1

| 模块 | 方法与路径 | 状态 |
| --- | --- | --- |
| RecipePromotion | 升级合集快照为“我的” | 已确认非本轮范围，待契约 |
| InspirationInteraction | 点赞、收藏统计与推荐排序治理 | 已确认非本轮范围，待契约 |

| 模块 | 路径 | 缺失内容 |
| --- | --- | --- |
| Membership | 待冻结 | 订单、补差、回调和到期选择 |
| Activity / Achievement | 部分已实现 | 勋章模板治理、勋章墙分类详情、完成餐次/饭局/采购闭环勋章与推荐贡献勋章已实现；更广活动与成就系统仍待冻结 |
| ShoppingList | `/shopping-lists*`、`/shopping-list-invites*`、`/shopping-shares*` | 共享购物清单首页、清单详情、待确认邀请卡片、分享链接/饭搭子共享、完成清单入库、删除已完成/已作废清单和版本冲突语义已接入主链路 |

## 暂不创建

菜谱图片上传与修改、升级合集快照为“我的”、点赞、背景图上传、完整 Worker 运行、饭票、积分商城、OCR、AI、多家庭、冰箱图片、聊天、评论、关注和私信当前均不开放。R1 草稿请求包含图片字段时返回 `400`。

## 维护规则

1. 先更新 `api-contract.md` 和后端 OpenAPI，再同步各端本地 API 类型。
2. 只有后端真实路径和最小验证通过后才能标记“已实现”。
3. 客户端不得自行补字段或合并权益；饭搭子选择只作为页面状态，不得改变个人数据归属。
