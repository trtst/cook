# 菜谱批量导出与图片回填执行单

## 目标

在 CMS 系统菜谱页，按当前筛选结果批量导出提示词资料；批量选择以版本 ID、菜谱 ID 和槽位命名的 JPG 图片，上传到现有存储，并只回填封面、菜谱步骤或 Wiki 步骤的图片 URL。

## 已确认流程

1. 导出当前分类、状态、关键词筛选匹配的全部系统菜谱，不受当前分页影响。
2. JSON 以菜谱 ID 为 key，字段为 `contentVersionId / title / description / keywords / tips / steps[].imagePrompt / wikiSteps[].imagePrompt`。
3. 后台多选本地图片，文件名格式为：
   - `{contentVersionId}_{recipeId}.jpg`
   - `{contentVersionId}_{recipeId}_step{n}.jpg`
   - `{contentVersionId}_{recipeId}_step_wiki{n}.jpg`
4. `n` 从 1 开始，菜谱步骤与 Wiki 步骤各自编号。
5. 图片经现有后台菜谱图片临时上传链路进入正式存储；服务端按菜谱、内容版本和目标槽位校验，只写回对应图片 URL。
6. 步骤图片变更创建一个新当前内容版本，新版本除图片 URL 外复制原正文；复制现有版本标签、营养、完整度、Wiki 快照及已解锁记录。封面仍写 `Recipe.coverImageUrl`。旧版本与既有固定引用不变。
7. 每道菜谱独立提交，部分菜谱失败不影响其他菜谱；页面按图片项展示成功或失败原因。

## 本轮不做

- 不修改菜谱名称、故事、关键词、小贴士、步骤文字、图片提示词、系统分类或其他内容字段。
- 不改动客户端菜谱、食谱数据、图片生成或其他内容类型。
- 不处理用户私房菜；范围为 CMS 系统菜谱。
- 不新增数据库表或字段。

## API 边界

- 导出接口按当前 `categoryId / keyword / status` 查询筛选全部命中系统菜谱，仅返回本导出所需字段。
- 回填接口按菜谱 ID 一次接收该菜谱已上传临时图片的文件名与临时 key；服务端解析文件名并重新核对 `contentVersionId`。
- 写操作要求 `SUPER_ADMIN` 与数字字符串 `Idempotency-Key`。
- 版本或目标槽位不匹配时拒绝该菜谱整批回填，丢弃本次已发布但未被引用的文件。

## 验收边界

- 后台 Admin type-check、Admin build、API type-check、API build、OpenAPI 校验、Prisma validate 和 `git diff --check`。
- 不运行自动化测试；不以代码构建替代真实后台操作和 OSS 验收。
- 需要后续人工验收导出 JSON、三类图片回填、版本冲突拒绝、上传失败和部分菜谱失败状态。

## 范围自检

- 仅涉及 CMS 系统菜谱列表导出、图片临时上传复用、图片 URL 回填及对应契约文档。
- 未增加 schema、菜谱文本编辑、跨应用功能或通用图片管理抽象。
