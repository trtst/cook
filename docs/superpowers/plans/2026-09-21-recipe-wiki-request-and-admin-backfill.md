# Recipe Wiki 申请与后台补充实现计划

## 目标

补齐菜谱 Wiki 的版本识别、用户申请与预扣、后台待补充列表、JSON 单个/批量导出导入、拒绝反馈、通知和编辑失效提示。

## 已确认边界

- 后台列表只查询 `Recipe.status = ACTIVE` 的已发布当前版本；排除草稿、回收、下架和删除。
- 是否需要补充以当前 `currentVersionId` 的 Wiki 状态判断，不能只以 Wiki 内容是否为空判断；正文发布新版本后旧 Wiki 不继承。
- 后台导入只写 `wiki.tags` 与 `wiki.assistant.steps`，必须携带 `recipeId` 和 `contentVersionId`，版本不一致拒绝；不得创建菜谱或正文版本。
- 用户申请按 `(userId, recipeVersionId)` 独立；申请时冻结 1 次，READY 转正式消耗，拒绝/失败释放；重复申请幂等。
- Wiki READY 后通知申请人；申请人以后打开 Wiki 不再次扣次。
- 编辑前存在 READY Wiki 时，发布确认后才保存新正文版本；新版本 Wiki 重新进入待补充状态。

## 数据与状态

1. `RecipeCookAssistantRequest` 保存用户对固定菜谱版本的申请、最近申请时间、READY/拒绝状态和拒绝原因。
2. `CookAssistantUnlock` 增加 `RESERVED / CONSUMED` 状态；recipe Wiki 申请创建 RESERVED，后台补充 READY 时转 CONSUMED，拒绝时删除 RESERVED。
3. 申请与每日用量查询在同一事务和用户日锁内完成；唯一约束保证同一用户/版本不重复冻结。

## 实现顺序

1. 先补申请状态、预扣释放、READY 转正式消耗的失败测试。
2. 增加 Prisma 模型、枚举、约束和 migration，生成 Prisma Client。
3. 扩充 Recipe Wiki API：查询状态、申请 Wiki；READY 仍返回当前内容，非 READY 返回状态与申请时间，不抛“不可用”错误。
4. 扩充 Admin API：待补充分页列表、单个/批量导出、Wiki JSON 上传导入、拒绝；导入在事务内校验菜谱状态和 `contentVersionId`，只更新 Wiki 并通知申请人。
5. 扩充通知聚合，加入 Wiki READY/拒绝消息及目标路径。
6. 修改小程序详情和 Sheet：无 Wiki 显示申请说明/申请时间，READY 直接打开，拒绝显示原因；用户菜谱和系统菜谱共用逻辑。
7. 修改菜谱编辑发布前确认逻辑，并补客户端静态契约测试；新增后台 Wiki 列表与导入导出页面。
8. 更新 API/OpenAPI、本地类型、执行日志并运行聚焦验证。

## 验收重点

- 当前版本 READY Wiki 不出现在待补充列表；编辑产生新版本后出现。
- 用户 A 的申请/扣次/通知不影响用户 B。
- 重复申请不会重复冻结；拒绝后预扣释放；READY 后只正式消耗一次。
- 旧 JSON 导入新版本被拒绝，导入成功只变更 Wiki，正文内容与版本 ID 不变。
- 系统菜谱显示“来源：公共内容池”，用户菜谱显示 UID/昵称；列表展示最近申请时间和待处理标识。
- 草稿、回收、下架、删除菜谱不进入 Wiki 列表。
