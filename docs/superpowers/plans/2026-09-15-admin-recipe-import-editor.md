# 后台菜谱导入与统一编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持单菜/批次 JSON 与 ZIP 导入，并以一个共享后台编辑器完成导入条目和系统菜谱的图片、图片提示词、食材分类、标签和美食助理编辑。

**Architecture:** `recipe.import.v1` 保持单菜谱包络，`recipe.import.batch.v1` 展开为独立导入项；ZIP 仅安全地承载 JSON。后台图片通过记录化的受保护暂存资产跨页面存续。`RecipeEditor` 只维护编辑草稿，导入页和系统菜谱页分别负责其不同的保存/发布生命周期。

**Tech Stack:** Vue 3、Element Plus、NestJS、Prisma、PostgreSQL、`adm-zip`、Node test。

**Spec:** `docs/superpowers/specs/2026-09-15-admin-recipe-editor-design.md`

## Global Constraints

- `recipe.import.v1` 顶层永远只表示一条菜谱；多菜必须使用 `recipe.import.batch.v1` 的 `recipes[]`。
- 导入只创建待审核 `RecipeImportItem`；每一项仍由管理员独立发布为正式 `Recipe`。
- ZIP 只接受 `.json`，拒绝绝对/回退路径、符号链接、非 JSON 条目和超出展开限制的内容。
- `imagePrompt` 是原始步骤和助手步骤各自的版本内容；本计划不实现图片生成或自动生成提示词。
- 输入食材分类使用八个公开 `categoryCode`，不传内部 ID 或 `UNCLASSIFIED`；已匹配系统食材的实际分类为权威事实。
- 只有 `MEAL_TYPE` 可以拥有多个候选值；任何 `tagCode` 最多一条 `CONFIRMED`。
- 已保存的导入图片是受保护的导入暂存资产；未绑定图片 24 小时后失效。临时图片不得提供公开 URL。
- 保持 `SUPER_ADMIN`、`Idempotency-Key`、`expectedVersion`、审计和固定正文版本语义。
- 工作区已有用户的暂存和未暂存修改。只触碰本计划列出的文件，不重置、恢复、批量暂存或提交其他改动；没有用户明确要求不创建 commit。

---

### Task 1: 冻结可导入的单菜、批次和分类规范

**Files:**
- Modify: `docs/plans/recipe-admin-json-conversion.md`
- Modify: `docs/api-contract.md`
- Test: `apps/api/src/modules/admin/recipe-import-json.test.ts`

**Interfaces:**
- Consumes: 现有 `recipe.import.v1` 单菜 `recipe + wiki` 包络。
- Produces: `recipe.import.batch.v1` 和 `ingredients[].categoryCode` 的唯一文档规范。

- [ ] **Step 1: 写入失败测试，定义批次解析期待的来源路径**

```ts
test("expands a recipe.import.batch.v1 document into independent sources", () => {
  const sources = readJsonSourcesFromFiles([{ originalname: "week.json", buffer: Buffer.from(JSON.stringify({
    schemaVersion: "recipe.import.batch.v1",
    recipes: [singleRecipe(), singleRecipe({ name: "第二道菜" })]
  })), size: 1 }]);

  assert.deepEqual(sources.map(item => item.sourcePath), ["week.json#1", "week.json#2"]);
});
```

- [ ] **Step 2: 运行测试，确认当前单文件单来源实现失败**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/admin/recipe-import-json.test.ts`

Expected: FAIL，因为 `readJsonSourcesFromFiles` 当前只返回一个 `week.json` 来源。

- [ ] **Step 3: 更新转换规范**

在文档开头定义：单菜使用现有 `recipe.import.v1`；批次使用：

```json
{
  "schemaVersion": "recipe.import.batch.v1",
  "recipes": [{ "recipe": {}, "wiki": {} }]
}
```

为 `ingredients[]` 增加必填 `categoryCode`，枚举和中文映射固定为：`PRODUCE/蔬果菌菇`、`MEAT_POULTRY_EGG/肉禽蛋`、`SEAFOOD/水产海鲜`、`SOY_DAIRY/豆乳制品`、`GRAINS_STAPLES/米面杂粮`、`SEASONING/调味料`、`DRIED_PRESERVED/干货腌制`、`BEVERAGE_ALCOHOL/酒水饮料`。保留并明确两类 `imagePrompt` 均为必填中文、最大 1000 字、同类步骤内不重复；不描述自动图片生成。

- [ ] **Step 4: 更新 API 契约摘要**

将 `/admin/recipe-import-jobs/json` 改为接受 `.json/.zip` 混选；写明单菜、批次、ZIP 展开、每项独立失败和“最多 100 个展开条目、单 JSON 10 MB、总 JSON 20 MB”。

- [ ] **Step 5: 再次运行解析测试**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/admin/recipe-import-json.test.ts`

Expected: 文档不影响既有测试；新增测试仍失败，等待 Task 2 实现。

### Task 2: 以测试驱动实现批次 JSON、ZIP 和严格导入字段解析

**Files:**
- Modify: `apps/api/src/modules/admin/recipe-import-json.ts`
- Modify: `apps/api/src/modules/admin/recipe-import-json.test.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Test: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`

**Interfaces:**
- Consumes: 上传文件 `{ originalname, buffer, size }[]`。
- Produces: `RecipeImportJsonSource[]`，每一项恰好一条菜谱，`sourcePath` 保留 `file.json#n` 或 `archive.zip/file.json#n`。

- [ ] **Step 1: 为 ZIP 和字段错误写失败测试**

```ts
test("rejects ZIP traversal and non-JSON entries", () => {
  assert.throws(() => readJsonSourcesFromFiles([zipFile([
    { name: "../escape.json", body: singleRecipe() },
    { name: "readme.txt", body: "not-json" }
  ])]), /ZIP/);
});

test("requires a selectable ingredient category code", () => {
  const result = parseJsonSource(source(singleRecipe({ ingredientCategoryCode: "UNCLASSIFIED" })), refs);
  assert.equal(result.errorItems.some(item => item.field === "recipe.content.ingredients.0.categoryCode"), true);
});

test("requires distinct Chinese image prompts for source and assistant steps", () => {
  const result = parseJsonSource(source(singleRecipe({ duplicateStepPrompt: true })), refs);
  assert.equal(result.errorItems.some(item => item.field === "recipe.content.steps.1.imagePrompt"), true);
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/admin/recipe-import-json.test.ts`

Expected: FAIL，因为当前解析器拒绝 ZIP、`imagePrompt` 和 `categoryCode`，且没有批次展开。

- [ ] **Step 3: 实现安全展开与单菜归一化**

在 `recipe-import-json.ts` 增加 `parseImportDocument`，只接受两种根：单菜根直接产出一项；批次根只允许 `schemaVersion + recipes`，每个元素补成单菜根后复用同一校验。用现有 `adm-zip` 安全读取 ZIP：检查文件名、目录层级、条目数量、每条 `header.size`、实际 `getData().byteLength` 和总展开字节；遇到非法非目录条目立即拒绝 ZIP。不要复用旧 Markdown 导入的宽松 `cleanZipPath`，路径含 `..` 必须拒绝而不是折叠。

扩展单菜允许字段：`ingredients[].categoryCode`、`steps[].imagePrompt`、`wiki.assistant.steps[].imagePrompt`。解析器校验分类枚举、提示词非空中文、长度不超过 1000、相同菜谱内各自去重；为每个错误使用准确路径。`MEAL_TYPE` 允许不同值，其他代码保持单值，重复值始终报错。

- [ ] **Step 4: 让导入服务按展开项计数和落库**

保留 `createRecipeImportJob` 的逐来源 `try/catch`。来源列表已经展开后，每一项照现有逻辑创建一个 `RecipeImportItem`；审计 `totalCount` 使用展开条数。来源错误只创建对应 `FAILED` 条目。

- [ ] **Step 5: 运行解析与导入服务测试**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/admin/recipe-import-json.test.ts src/modules/admin/admin.recipe-import.service.test.ts`

Expected: PASS；批次 JSON、ZIP、上限、路径拒绝、提示词、分类和多餐次得到覆盖。

### Task 3: 扩展共享契约、版本快照和分类匹配

**Files:**
- Modify: `apps/api/src/contracts/types.ts`
- Modify: `apps/api/src/contracts/dtos.ts`
- Modify: `apps/api/src/contracts/openapi.ts`
- Modify: `apps/api/src/modules/recipe/recipe-content.ts`
- Modify: `apps/api/src/modules/recipe/recipe-content.test.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Test: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`

**Interfaces:**
- Produces: `RecipeImportIngredientDraft.categoryCode`、原始/助手步骤 `imagePrompt` 和助手 `imageTempKey`。
- Produces: `RecipeStepSnapshot.imagePrompt` 与 `RecipeAssistantStep.imagePrompt`，历史 JSON 缺字段归一化为 `null`。

- [ ] **Step 1: 写快照往返失败测试**

```ts
test("keeps source and assistant image prompts in version snapshots", () => {
  const content = versionToContent(version({ stepsJson: [{ text: "炒制", imageUrl: null, imagePrompt: "锅中翻炒食材" }] }));
  assert.equal(content.steps[0]?.imagePrompt, "锅中翻炒食材");

  const assistant = buildImportedRecipeAssistantSnapshot([{ ...assistantStep(), imagePrompt: "成菜装盘特写" }]);
  assert.equal(assistant.steps[0]?.imagePrompt, "成菜装盘特写");
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/recipe/recipe-content.test.ts`

Expected: FAIL，因为现有类型和快照丢弃 `imagePrompt`。

- [ ] **Step 3: 同步三层请求/响应类型**

把 `categoryCode`、`imagePrompt` 和 `imageTempKey` 加到 API contracts、DTO 白名单和 OpenAPI schema。导入编辑 DTO 允许 `null` 以便保存待修正草稿，`rebuildJsonItemState` 决定字段错误；原始 JSON 解析和正式发布前校验要求有效值。后台菜谱详情的食材响应加入 `categoryCode`，由系统食材分类读取产生，供导出和显示使用。

- [ ] **Step 4: 保持版本内容与助手快照**

更新 `versionToContent`、`buildImportedRecipeAssistantSnapshot`、`buildRecipeAssistantSnapshot`、`versionAssistantToSnapshot` 和 `buildAdminRecipeContent`：历史字段默认 `null`，新输入不丢失提示词。自动助手沿用原始步骤的提示词；缺失提示词保持 `null`，不猜写。

在导入食材物化和状态重建中，以 `categoryCode -> IngredientCategory` 查询：匹配到 ACTIVE 食材时比较实际分类；未匹配时在声明分类创建/复用 PENDING 食材。分类不匹配把错误写到 `ingredients.n.categoryCode`。

- [ ] **Step 5: 运行契约和内容测试**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/recipe/recipe-content.test.ts src/modules/admin/recipe-import-json.test.ts src/modules/admin/admin.recipe-import.service.test.ts`

Expected: PASS；类型字段、旧版本 `null` 归一化、分类匹配和提示词持久化均有断言。

### Task 4: 实施受保护的导入暂存图片资产与标签数据库约束

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260915XXXXXX_admin_recipe_temp_images_and_confirmed_tag_unique/migration.sql`
- Modify: `apps/api/src/modules/admin/admin-recipe-image.service.ts`
- Modify: `apps/api/src/modules/admin/admin-recipe-image.controller.ts`
- Modify: `apps/api/src/modules/admin/admin-recipe-image.service.test.ts`
- Create: `apps/api/src/modules/admin/admin-recipe-image.controller.test.ts`

**Interfaces:**
- Produces: `AdminRecipeTempImage(tempKey, createdByAdminId, scene, importItemId?, expiresAt?, createdAt, updatedAt)`.
- Produces: `GET /admin/recipe-images/temp/:tempKey`，仅 `SUPER_ADMIN` 可读原始字节。

- [ ] **Step 1: 写暂存资产生命周期失败测试**

```ts
test("binds a saved import image so a reload can read it after its upload window", async () => {
  await service.stageTempImage(request, adminId, "COVER", file);
  await service.bindImportImages(tx, itemId, adminId, [{ tempKey, scene: "COVER" }]);
  await service.getTempImageAsset(adminId, tempKey, nowAfter24Hours);
  assert.equal(storage.reads, 1);
});

test("keeps only one confirmed tag per version and code", async () => {
  await assert.rejects(insertConfirmedTag(versionId, "DISH_ROLE", "MAIN"), /unique/);
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/admin/admin-recipe-image.service.test.ts`

Expected: FAIL，因为没有元数据表、绑定方法或受保护读取接口。

- [ ] **Step 3: 写前向 migration 和 Prisma 模型**

新增 `AdminRecipeImageScene` 枚举和 `AdminRecipeTempImage`。`tempKey` 唯一，`importItemId` 可空，绑定导入项使用 `onDelete: Restrict`，并建立 `[expiresAt]`、`[importItemId]` 索引。迁移先按 `is_locked DESC`、`OPS > USER > AI > AUTO`、`updated_at DESC`、`id DESC` 将每个版本同代码的多余 `CONFIRMED` 标签降为 `CANDIDATE`，再创建：

```sql
CREATE UNIQUE INDEX recipe_version_tags_one_confirmed_code
ON recipe_version_tags (recipe_version_id, tag_code)
WHERE status = 'CONFIRMED';
```

迁移输出冲突行和保留行的审计查询结果；不得修改正文或版本指针。

- [ ] **Step 4: 实现资产服务与控制器**

`stageTempImage` 写对象后创建记录，记录创建失败时删除对象；`bindImportImages` 在导入条目更新事务中验证管理员、场景、未到期和未被其他条目绑定，再清空 `expiresAt`、设置 `importItemId`；`getTempImageAsset` 拒绝不存在或未绑定且过期的记录。`discardTempImages` 同时删记录和对象；为未绑定到期记录提供有上限的受控清理。控制器的二进制 GET 使用 `AdminAuthGuard + SuperAdminGuard`，不返回 JSON envelope，不设置公共缓存。

- [ ] **Step 5: 运行 Prisma 与图片测试**

Run: `pnpm --filter @next-meal/api prisma validate && pnpm --filter @next-meal/api exec tsx --test src/modules/admin/admin-recipe-image.service.test.ts src/modules/admin/admin-recipe-image.controller.test.ts`

Expected: PASS；重复已确认标签被数据库阻止，未保存图片过期，绑定图片仍可鉴权读取。

### Task 5: 收口导入发布和系统菜谱写入的事实所有权

**Files:**
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/modules/admin/admin.recipe-import.service.test.ts`
- Modify: `apps/api/src/modules/recipe/recipe-version-tags.ts`
- Modify: `apps/api/src/modules/recipe/recipe-version-tags.test.ts`
- Modify: `apps/api/src/modules/auth/admin.controller.ts`

**Interfaces:**
- Consumes: 受绑定约束的临时图片、`wiki.tags`、助手步骤 `imageTempKey + imagePrompt`。
- Produces: 导入条目更新后的绑定资产；正式版本的 OPS 标签与助手快照。

- [ ] **Step 1: 为写入规则写失败测试**

```ts
test("does not discard a bound import image when publish later fails", async () => {
  await assert.rejects(() => service.publishRecipeImportItem(request, itemId, adminId, publishBody), /远程图片/);
  assert.deepEqual(imageService.discardedTempKeys, []);
});

test("publishes an assistant temp image and preserves its prompt", async () => {
  const result = await service.publishRecipeImportItem(request, itemId, adminId, publishBodyWithAssistantTempImage);
  assert.equal(result.recipeBody.assistantSteps?.[0]?.imagePrompt, "装盘画面");
  assert.match(savedAssistant.snapshotJson.steps[0].imageUrl, /admin-recipe-images/);
});
```

- [ ] **Step 2: 运行测试确认 RED**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/admin/admin.recipe-import.service.test.ts src/modules/recipe/recipe-version-tags.test.ts`

Expected: FAIL，因为当前助手只接受远程 URL，且失败发布会清理临时键。

- [ ] **Step 3: 实现导入绑定、替换、发布和删除清理**

`updateRecipeImportItem` 计算封面、普通步骤、助手步骤的新旧 temp keys，在同一事务调用绑定/解绑；事务成功后仅删除不再引用的资产。`publishRecipeImportItem` 在发布前读取已绑定资产并创建正式对象，但仅在数据库事务成功后消费绑定资产；失败时删除本次新建的正式对象并保留绑定资产。导入任务删除先删除其绑定资产记录，成功后异步清理对象并记录失败审计。

`stageRecipeImportImages` 对助手步骤优先使用 `imageTempKey`，其次使用既有远程 `imageUrl`；两种路径都保留 `imagePrompt`。普通步骤同样把提示词传入 `AdminRecipeContentInput`。

- [ ] **Step 4: 实现标签和助手写入**

用一个纯函数校验标签：`MEAL_TYPE` 可多候选，其他候选最多一个；每代码最多一个确认；禁止重复值。导入和系统菜谱共用它。`createImportedRecipeVersionTags` 接收编辑器提交的 `status`，只把管理员选择写成 `OPS`；自动推导保持 `AUTO/CANDIDATE`。系统菜谱 `POST/PUT` 扩展 `wiki: { tags, assistantSteps }`，创建新版本时写 OPS 标签、固化助手图片并调用 `syncRecipeAssistant`。老的自动助手只有未提供 OPS 助手步骤时才重建。

- [ ] **Step 5: 运行服务测试**

Run: `pnpm --filter @next-meal/api exec tsx --test src/modules/admin/admin.recipe-import.service.test.ts src/modules/recipe/recipe-version-tags.test.ts`

Expected: PASS；导入资产可重试，三类图片可发布，OPS 标签/助手和候选规则一致。

### Task 6: 用一个 RecipeEditor 替换两套后台编辑逻辑

**Files:**
- Create: `apps/admin/src/components/RecipeEditor.vue`
- Create: `apps/admin/src/components/recipe-editor.test.js`
- Modify: `apps/admin/src/apis/http.ts`
- Modify: `apps/admin/src/apis/recipe.ts`
- Modify: `apps/admin/src/pages/RecipeImportItemPage.vue`
- Modify: `apps/admin/src/pages/RecipeDetailPage.vue`
- Modify: `apps/admin/src/pages/RecipeImportJobsPage.vue`
- Modify: `apps/admin/src/pages/recipe-import-item-layout.test.js`
- Modify: `apps/admin/src/pages/recipe-import-json.test.js`
- Modify: `apps/admin/src/pages/recipe-detail-assistant.test.js`

**Interfaces:**
- Produces: `RecipeEditorDraft`, `RecipeEditorImage`, `RecipeEditor` 的 `v-model` 和 `readonly` 属性。
- Produces: `requestBlob(path)`，使用既有 token/header 读取临时图并由页面生成/回收 Blob URL。

- [ ] **Step 1: 为共享渲染和图片预览写失败测试**

```js
test("both recipe pages render the same RecipeEditor", () => {
  assert.match(importPage, /<RecipeEditor[\s\S]*v-model="form"/);
  assert.match(detailPage, /<RecipeEditor[\s\S]*v-model="form"/);
});

test("shows and edits prompts for ordinary and assistant steps", () => {
  assert.match(editor, /普通步骤图片提示词/);
  assert.match(editor, /助理步骤图片提示词/);
});
```

- [ ] **Step 2: 运行后台页面测试确认 RED**

Run: `node --test apps/admin/src/components/recipe-editor.test.js apps/admin/src/pages/recipe-import-item-layout.test.js apps/admin/src/pages/recipe-detail-assistant.test.js`

Expected: FAIL，因为共享组件和 Blob 读取不存在。

- [ ] **Step 3: 实现草稿组件与受保护预览**

把当前两个页面的分类、字段错误、食材、标签单行、普通步骤、裁剪上传和助手步骤 UI 移入 `RecipeEditor`。组件接收 `sourceImages?:`，只有导入模式展示原图候选。图片使用统一回调：上传后保存 `tempKey`，首次及重进页面时 `requestBlob('/admin/recipe-images/temp/:tempKey')` 生成本地 URL，卸载或替换时 revoke。封面、普通和助手步骤共用该回调；`imagePrompt` 用 `el-form-item` 显示服务器错误。

食材行显示分类名称和代码：导入项可选择来源分类；选中系统食材后显示其权威分类。业务标签显示状态选择并在本地阻止不允许的重复，仍以服务端错误为准。

- [ ] **Step 4: 瘦化路由页面责任**

导入页只保留详情加载、导入/输出草稿映射、`PUT import item`、发布和已发布只读跳转；`PUBLISHED` 不渲染可编辑 `RecipeEditor`。系统详情只保留详情加载、版本保存、Wiki 质量展示和路由；两者调用相同编辑器。更新 API 类型、请求序列化和 `requestBlob` 的鉴权/401 清理。导入入口改为 `.json,.zip`、按钮和提示文案改为“批量导入 JSON / ZIP”。

- [ ] **Step 5: 运行后台测试与类型检查**

Run: `node --test apps/admin/src/components/recipe-editor.test.js apps/admin/src/pages/recipe-import-item-layout.test.js apps/admin/src/pages/recipe-import-json.test.js apps/admin/src/pages/recipe-detail-assistant.test.js && pnpm --filter @next-meal/admin type-check`

Expected: PASS；两页共享组件、发布后只读、三类图片/提示词/分类/标签 UI 均被保护。

### Task 7: 全链路契约审查与真实运行验证

**Files:**
- Modify: `docs/api-contract.md`
- Modify: `docs/plans/minor_change_log.md`
- Modify: `apps/api/scripts/verify-recipe-import-json-flow.ts`
- Modify: `apps/api/scripts/verify-recipe-flow.ts`

**Interfaces:**
- Consumes: 本计划所有最终 DTO、迁移和后台请求。
- Produces: 可重复的本地 API 验收脚本与中央变更记录。

- [ ] **Step 1: 写真实验证脚本断言**

在 `verify-recipe-import-json-flow.ts` 加入：批次 JSON 创建多个条目、ZIP 展开、每个条目独立错误、保存导入后临时图 GET 可读、刷新详情仍保留 tempKey、发布后封面/普通/助手图片均为正式 URL、导入页发布后链接正式菜谱。`verify-recipe-flow.ts` 覆盖系统菜谱保存提示词、分类输出、助手步骤图片和标签确认唯一性。

- [ ] **Step 2: 更新最终文档**

把实际请求字段、权限、图片读取、批次/ZIP 限制、图片资产清理、分类语义、提示词和标签确认规则同步到 `docs/api-contract.md`。在 `minor_change_log.md` 写入实际变更、实际命令结果和未完成的浏览器/OSS 验收；不得沿用计划中的预期结果。

- [ ] **Step 3: 运行静态、迁移和真实 API 验收**

Run: `pnpm --filter @next-meal/api prisma validate && pnpm --filter @next-meal/api type-check && pnpm --filter @next-meal/admin type-check && pnpm --filter @next-meal/api exec tsx scripts/verify-recipe-import-json-flow.ts && pnpm --filter @next-meal/api exec tsx scripts/verify-recipe-flow.ts && git diff --check`

Expected: 全部退出码为 0；真实 API 脚本覆盖导入、保存、刷新、发布和正式菜谱编辑。

- [ ] **Step 4: 做浏览器验收或记录阻塞**

用管理员账号验证：单菜 JSON、批次 JSON、ZIP；导入图片保存后重新进入显示；普通/助手图上传、替换、删除；提示词与分类编辑；发布后的导入页只读并跳转；`10002216` 的标签人工确认。如果浏览器连接不可用，记录具体连接错误和这些待人工动作，不把静态测试表述为浏览器通过。
