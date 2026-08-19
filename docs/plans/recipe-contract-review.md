# 菜谱 R1 契约与数据模型评审稿

> 2026-08-19 方案变更：本文早期合集收藏与个人场景契约属于历史评审记录，当前实现以 `../recipe.md` 和 `../api-contract.md` 为准；前台不再提供合集入口，灵感改编和加入计划统一落入私房菜。

## 一、文档状态

本文于 2026-07-25 完成产品确认，是菜谱 R1 的实现执行基线。正式对外路径、DTO 和错误语义同步写入 `../api-contract.md` 与 `../api-index.md`；现有 DTO、Prisma 和页面仍是候选实现，不因本文确认而自动正确。

后续按本文修改 OpenAPI、三端本地类型、Prisma Schema 和新 migration；不得回退到旧导入、文本份量或按行解析表单。

权威业务输入：

1. `../recipe.md`。
2. `../ingredient.md`。
3. `../configuration.md`。
4. `../api-database-rules.md`。
5. `recipe-execution.md`。

## 二、R1 范围

R1 只跑通第一条真实纵切：

```text
个人分类/场景 -> 选择系统或个人食材与单位 -> 保存草稿
-> 预览 -> 发布到我的 -> 我的列表/详情 -> 编辑草稿 -> 再次发布
```

R1 包含：

1. 个人分类的查询、新建、改名和排序。
2. 个人场景的查询、新建、改名和排序。
3. 系统/个人食材与单位的查询，以及新建、编辑本人食材和新建本人单位。
4. 个人食材显式推荐入系统库、我的推荐记录，以及后台待审、通过、归并和拒绝闭环。
5. 新建草稿、已有菜谱编辑草稿、草稿箱、保存、删除和发布。
6. “我的”菜谱列表、详情、分类内排序、推荐到灵感、撤回待审推荐和正常删除。
7. 后台待审核个人菜谱列表，以及“通过后复制到系统菜谱 / 拒绝”最小闭环。
8. 文本菜谱的完整字段、结构化食材用量和纯文本步骤。

R1 不包含：

1. 图片上传、临时区、封面和图文步骤写入。
2. 合集收藏、升级为“我的”和再次导入原版。
3. 点赞、收藏统计和推荐排序。
4. 个人单位推荐入系统库与跨单位换算。
5. 个人分类删除和个人场景删除。
6. 分享、计划和饭局现有契约改造。

未开放能力继续返回明确 `503` 或不注册入口，不能返回虚假成功。

## 三、Owner、状态与权限

### 个人分类和场景

1. Owner 是当前用户。
2. 仅本人可读写，不因饭搭子关系共享。
3. 名称和排序是可变个人管理事实，写入需要 `version`。
4. 同一用户同类型下不允许两个有效对象使用相同标准化名称。

### 草稿

1. Owner 是当前用户，任何其他用户不可读取。
2. 新建菜谱草稿计入菜谱数量和个人空间。
3. 已有菜谱的编辑草稿不增加菜谱数量，但新增内容计入空间。
4. 一道已发布菜谱同一时间最多有一个有效编辑草稿。
5. 草稿不能被计划、饭局、合集、分享或推荐引用。
6. 草稿是可变事实，使用乐观锁；发布后删除草稿并保留发布出的不可变内容版本。

### 我的菜谱

1. Owner 是当前用户，仅本人可编辑和删除。
2. 已发布菜谱必须且只能属于一个有效个人分类。
3. 可以关联 `0～N` 个本人场景。
4. 发布和再次发布都创建新的不可变内容版本，历史计划或饭局引用不随之变化。
5. 当前可见正文由菜谱入口指向的固定版本或既有基础版本加覆盖规则决定。

### 系统/个人食材和单位

1. 系统项由平台维护，登录用户只读。
2. 个人项 Owner 是当前用户，仅本人可读写。
3. 个人食材必须引用一个系统分类和一个本人可用的默认单位。
4. 菜谱版本保存食材、单位名称快照；平台或个人后续改名不能改变已发布菜谱正文。

### 灵感匿名读取

1. 未登录只允许读取审核通过且允许曝光的灵感摘要和详情。
2. 匿名响应不返回个人持有状态、额度、草稿、分类、场景或可写权限。
3. 点赞、收藏、升级和推荐接口必须使用 `UserBearerAuth`；这些接口不属于 R1。

## 四、R1 最小接口建议

以下路径是待确认建议。所有成功响应继续使用统一 envelope，所有写操作严格白名单映射。

### 个人分类

| 方法 | 路径 | 职责 |
| --- | --- | --- |
| `GET` | `/recipe-categories` | 返回本人全部有效分类，按个人顺序排列 |
| `POST` | `/recipe-categories` | 新建一个个人分类 |
| `PUT` | `/recipe-categories/{categoryId}` | 改名，提交 `expectedVersion` |
| `POST` | `/recipe-categories/reorder` | 一次提交完整分类 ID 顺序 |

R1 不提供删除分类接口，避免尚未确认“分类下已有菜谱如何迁移”的行为。

### 个人场景

| 方法 | 路径 | 职责 |
| --- | --- | --- |
| `GET` | `/recipe-scenes` | 返回本人全部有效场景，按个人顺序排列 |
| `POST` | `/recipe-scenes` | 新建一个个人场景 |
| `PUT` | `/recipe-scenes/{sceneId}` | 改名，提交 `expectedVersion` |
| `POST` | `/recipe-scenes/reorder` | 一次提交完整场景 ID 顺序 |

R1 不提供删除场景接口。菜谱与场景的关联由草稿发布统一写入，不增加逐个关联接口。

### 食材与单位

| 方法 | 路径 | 职责 |
| --- | --- | --- |
| `GET` | `/ingredients` | 按来源、系统分类和关键词分页查询系统/本人食材 |
| `POST` | `/ingredients` | 新建本人食材，立即本人可用 |
| `PUT` | `/ingredients/{ingredientId}` | 编辑本人未处于审核中的个人食材 |
| `POST` | `/ingredients/{ingredientId}/recommendations` | 显式推荐个人食材入系统库 |
| `GET` | `/ingredient-recommendations` | 分页返回“我的推荐”记录 |
| `GET` | `/ingredient-categories` | 返回系统食材分类最小摘要，供选择器左侧分类筛选 |
| `GET` | `/units` | 按来源、类型和关键词分页查询系统/本人单位 |
| `POST` | `/units` | 新建本人单位，立即本人可用 |

系统食材分类使用独立只读接口，便于选择器左侧分类一次加载并保持平台 owner；R1 不把分类清单硬编码进客户端。系统食材同时维护“分类内顺序”和“全局展示顺序”两套事实：前者只服务真实分类管理，后者只服务后台虚拟“全部食材”视图和前台“全部食材”展示；因此 `GET /ingredients` 在未传真实 `categoryId` 时，系统食材部分必须按后台全局展示顺序返回，传了 `categoryId` 时再切回该分类内顺序。个人食材推荐采用独立记录表承接状态，审核通过时要么直接转为系统食材，要么归并到现有系统食材；归并后本人草稿和已发布内容中的食材引用需要同步切到系统食材。`GET /ingredients` 的食材摘要继续保持列表最小字段，但补充 `recommendationStatus: PENDING | REJECTED | null`，仅用于“我的食材”选择态最小展示 `审核中 / 拒绝后隐藏推荐入口`，不把完整推荐记录塞回列表接口；`GET /ingredient-recommendations` 在 `REJECTED` 状态下额外返回 `reviewNote + reviewAdvice`，用于把后台标准拒绝原因和修改建议直接展示给用户。草稿详情和我的菜谱详情额外返回当前内容真实引用到的 `ingredientRefs`、`unitRefs`，编辑页必须优先用这两组引用补齐历史数据，不能依赖第一页食材/单位列表碰运气命中。

### 草稿

| 方法 | 路径 | 职责 |
| --- | --- | --- |
| `GET` | `/recipe-drafts` | 分页返回本人草稿箱摘要 |
| `POST` | `/recipe-drafts` | 首次保存新菜谱草稿或已有菜谱编辑草稿 |
| `GET` | `/recipe-drafts/{draftId}` | 返回本人草稿完整内容 |
| `PUT` | `/recipe-drafts/{draftId}` | 保存草稿，提交 `expectedVersion` |
| `POST` | `/recipe-drafts/{draftId}/delete` | 删除草稿并释放对应数量/空间 |
| `POST` | `/recipe-drafts/{draftId}/publish` | 校验完整内容并发布到“我的” |

预览使用当前页面表单状态，不增加预览 API。首次保存已有菜谱编辑草稿时，请求携带该菜谱 ID；服务端存在有效编辑草稿时返回已有草稿，不重复创建。`GET /recipe-drafts` 摘要补充 `coverImageUrl`，用于草稿箱列表直接显示当前草稿封面；`POST /recipe-drafts` 与 `PUT /recipe-drafts/{draftId}` 只返回最小保存结果 `id + recipeId + version + updatedAt`；只有 `GET /recipe-drafts/{draftId}` 继续返回完整详情。

### 我的菜谱

| 方法 | 路径 | 职责 |
| --- | --- | --- |
| `GET` | `/recipes` | 只分页返回本人已发布菜谱摘要，支持关键词和分类筛选 |
| `GET` | `/recipes/{recipeId}` | 返回本人持有菜谱详情和当前固定版本 |
| `POST` | `/recipes/{recipeId}/recommendations` | 提交当前个人菜谱固定版本到系统菜谱审核 |
| `POST` | `/recipe-recommendations/{recommendationId}/withdraw` | 撤回一条待审核菜谱推荐 |
| `POST` | `/recipes/reorder` | 在指定分类内提交完整菜谱 ID 顺序 |
| `POST` | `/recipes/{recipeId}/delete` | 按套餐进入回收站或永久删除 |

R1 不再提供直接 `POST /recipes` 或 `PUT /recipes/{recipeId}` 写正文。新建和编辑统一经过草稿发布，避免“保存草稿”和“发布”共享旧创建语义。`GET /recipes/{recipeId}` 额外返回最新一条菜谱推荐摘要，用于展示 `未推荐 / 审核中 / 已驳回 / 已收录 / 已撤回`。提交推荐时，服务端冻结当前 `sourceVersionId`，并在存在待审推荐时阻止该个人菜谱继续创建编辑草稿、发布编辑草稿或删除；用户只有先撤回待审推荐，才能恢复编辑和删除。若该个人菜谱最初由灵感详情带入创建，服务端同时记录当时的来源固定版本和封面快照；后续推荐前会比对当前正文与封面，只要仍与来源版本完全一致，就按“未改动的灵感菜谱”拒绝推荐。对于历史上没有来源快照的旧个人菜谱，服务端再按“是否与现有系统菜谱正文和封面完全一致”做一次兜底识别，同样阻止未改动的灵感菜谱重复推荐。审核通过后，原个人菜谱仍继续保留在“我的”下，不会原地转成系统菜谱。

### 灵感只读

| 方法 | 路径 | 鉴权 | 职责 |
| --- | --- | --- | --- |
| `GET` | `/inspiration-categories` | 匿名 | 返回灵感平台分类，按平台顺序排列 |
| `GET` | `/inspiration-recipes` | 匿名 | 分页返回可曝光灵感摘要 |
| `GET` | `/inspiration-recipes/{recipeId}` | 匿名 | 返回一个可曝光固定版本详情 |

灵感只读接口与本人 `/recipes` 分开，避免可选登录状态影响同一列表的字段、权限和缓存边界。R1 允许两类内容进入该读取面：平台直接创建的系统菜谱，以及后台审核通过后复制进系统库的用户推荐菜谱；后者详情页只补一个 `curatedByName` 昵称快照展示 `由某某整理`，不扩展用户主页跳转。点赞和升级为我的仍不在本阶段建设。

### 后台菜谱治理

| 方法 | 路径 | 鉴权 | 职责 |
| --- | --- | --- | --- |
| `GET` | `/admin/inspiration-categories` | `AdminBearerAuth` + `SUPER_ADMIN` | 返回后台系统菜谱分类列表 |
| `POST` | `/admin/inspiration-categories` | `AdminBearerAuth` + `SUPER_ADMIN` | 后台新建系统菜谱分类 |
| `PUT` | `/admin/inspiration-categories/{categoryId}` | `AdminBearerAuth` + `SUPER_ADMIN` | 后台编辑系统菜谱分类 |
| `POST` | `/admin/inspiration-categories/reorder` | `AdminBearerAuth` + `SUPER_ADMIN` | 后台重排系统菜谱分类 |
| `GET` | `/admin/recipes` | `AdminBearerAuth` + `SUPER_ADMIN` | 只返回后台系统菜谱列表最小摘要，支持分类、关键词和状态筛选 |
| `POST` | `/admin/recipe-images` | `AdminBearerAuth` + `SUPER_ADMIN` | 后台上传系统菜谱临时封面图/步骤图 |
| `POST` | `/admin/recipes` | `AdminBearerAuth` + `SUPER_ADMIN` | 后台直接创建一条系统菜谱 |
| `GET` | `/admin/recipes/{recipeId}` | `AdminBearerAuth` + `SUPER_ADMIN` | 返回后台菜谱详情，覆盖灵感与个人菜谱 |
| `PUT` | `/admin/recipes/{recipeId}` | `AdminBearerAuth` + `SUPER_ADMIN` | 只编辑系统菜谱正文并切换到新固定版本 |
| `GET` | `/admin/pending-recipes` | `AdminBearerAuth` + `SUPER_ADMIN` | 返回待审核个人菜谱推荐分页 |
| `POST` | `/admin/pending-recipes/{recommendationId}/review` | `AdminBearerAuth` + `SUPER_ADMIN` | 审核个人菜谱推荐，支持通过或拒绝 |

后台系统菜谱分类独立于个人分类，由平台直接维护，分类管理请求统一走 `Idempotency-Key + expectedVersion`。后台系统菜谱列表只收 `ownerId = null` 且仍挂系统分类的菜谱，不再把个人菜谱混入运营列表；个人菜谱继续只从用户菜谱域进入。后台图片链路也独立于用户草稿上传：只有 `SUPER_ADMIN` 可以先调 `POST /admin/recipe-images` 上传临时图，接口只返回 `tempKey + 图片元信息`，不再下发临时公网图片 URL；后台页面预览统一使用浏览器本地 `blob`。封面固定 `4:3`，步骤图保持当前图片比例，再在 `POST /admin/recipes` / `PUT /admin/recipes/{recipeId}` 中通过 `coverImageTempKey / steps[].imageTempKey` 提交本次新图；若继续沿用旧图，则只允许回传当前系统菜谱现有的 `coverImageUrl / steps[].imageUrl`。服务端对 24 小时前仍未消费的后台临时图做过期清理；一旦创建/编辑流程消费了某个 `tempKey`，无论事务成功还是失败，都要清掉对应临时文件。后台可直接新增系统菜谱，创建时服务端新建 `RecipeContentVersion`，并把本次图片固化成正式公开资源后写入系统菜谱。后台详情仍对所有菜谱开放，但正文编辑只允许 `ownerId = null` 且仍挂系统分类的系统菜谱。编辑请求必须携带 `expectedVersion`，服务端保存时新建 `RecipeContentVersion` 再切 `currentVersionId`，不能直接改旧版本内容；否则会破坏收藏、饭局、计划等既有固定版本引用。个人菜谱推荐审核走独立 `/admin/pending-recipes` 队列：本期审核弹窗只处理 `通过/拒绝 + 最终系统分类`，不在后台二次编辑正文；通过时服务端复制推荐记录中的 `sourceVersionId` 为新的系统菜谱，并把 `adoptedRecipeId` 回写到推荐记录。后台系统菜谱创建、推荐收录与正文编辑当前只允许系统食材和系统单位，图片写入仅走这条后台独立临时上传链路。

## 五、建议 DTO

### 分类与场景

下文 `ResourceId` 表示资源 ID（当前为正整数）；幂等键统一通过请求头 `Idempotency-Key` 传递。

```ts
type UUID = number;
type ResourceId = UUID;
type IsoDateTime = string;

interface RecipeCategorySummary {
  id: ResourceId;
  name: string;
  version: number;
}

interface RecipeSceneSummary {
  id: ResourceId;
  name: string;
  version: number;
}
```

排序值不返回客户端。列表顺序就是服务端事实，重排请求提交完整的 `id + expectedVersion` 数组，并通过请求头携带 `Idempotency-Key`；服务端校验没有缺失、重复、越权或过期版本。

### 食材用量

```ts
type RecipeAmountInput =
  | {
      kind: "EXACT";
      quantity: string;
      unitId: ResourceId;
    }
  | {
      kind: "FUZZY";
      text: string;
    };

interface RecipeIngredientInput {
  ingredientId: ResourceId;
  amount: RecipeAmountInput;
}
```

精确数量使用十进制字符串，避免 JSON 浮点误差。客户端不提交食材名、单位名、分类或换算结果；服务端按可访问的食材和单位主事实生成不可变名称快照。

### R1 草稿正文

```ts
interface RecipeDraftContentInput {
  name: string;
  story: string | null;
  categoryId: ResourceId | null;
  sceneIds: ResourceId[];
  coverUploadId: ResourceId | null;
  coverImageUrl: string | null;
  baseServings: number | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  tips: string | null;
  ingredients: RecipeIngredientInput[];
  steps: Array<{
    slotKey: string;
    text: string;
    uploadId: ResourceId | null;
    imageUrl: string | null;
  }>;
}
```

上述 DTO 为客户端一次提交结构。服务端持久化时把 `categoryId` 和 `sceneIds` 分别写入外键与关联表，`contentJson` 只保存草稿正文，不重复保存关系 ID。

草稿允许名称、分类、基准人数、难度、时长、食材和步骤暂时为空，但数组仍受最大 100 项限制。当前图片链路改为“编辑页本地缓存 -> 存草稿/发布时先确保 `draftId` -> `POST /uploads/images` 上传 -> 再把 `uploadId/imageUrl` 写回草稿正文”。步骤允许“纯图 / 纯文 / 图文”，但图片和文字不能同时为空。

发布接口不重复提交正文，只提交：

```ts
interface PublishRecipeDraftRequest {
  expectedVersion: number;
}
```

服务端锁定草稿并使用已保存内容发布，避免校验正文与落库正文不一致。

### 我的列表摘要

```ts
interface MyRecipeSummary {
  id: ResourceId;
  title: string;
  coverImageUrl: string | null;
  difficulty: RecipeDifficulty | null;
  duration: RecipeDuration | null;
  category: RecipeCategorySummary;
  version: number;
  updatedAt: IsoDateTime;
}
```

```ts
interface SaveRecipeDraftResponse {
  id: ResourceId;
  recipeId: ResourceId | null;
  version: number;
  updatedAt: IsoDateTime;
}
```

列表摘要继续只返回 `coverImageUrl`、名称、难度、时长和分类，不把步骤、故事和图片元数据塞进列表。

## 六、建议数据主事实

### 保留并调整现有底座

1. 保留 `RecipeContentVersion` 作为不可变正文版本。
2. 保留 `Recipe` 作为本人可见菜谱入口和当前管理事实。
3. 保留计划、饭局对具体内容版本的固定引用。
4. 现有 `RecipeSourceKind`、`baseVersionId`、`independentVersionId` 和覆盖语义在后续收藏/升级纵切统一复核，R1 不用旧导入接口承载收藏。

### 新增个人管理事实

```text
RecipeCategory
  id, userId, name, searchKey, sortOrder, version, createdAt, updatedAt

RecipeScene
  id, userId, name, searchKey, sortOrder, version, createdAt, updatedAt

RecipeSceneLink
  recipeId, sceneId

RecipeDraft
  id, userId, recipeId?, categoryId?, contentJson, version, createdAt, updatedAt

RecipeDraftScene
  draftId, sceneId
```

`Recipe` 增加必填个人分类引用和分类内 `sortOrder`。对于 owner 为空的系统/平台入口，个人分类保持为空；数据库约束必须保证个人已发布入口与平台入口的组合合法。

草稿正文使用 JSON 是因为它是低频整份保存、不参与食材筛选和业务引用的可变工作副本。个人分类、场景和来源菜谱仍使用外键，不塞进无约束 JSON。

### 新增食材与单位事实

```text
IngredientCategory
  id, name, sortOrder, status

Unit
  id, ownerId?, type, name, searchKey, createdAt, updatedAt

Ingredient
  id, ownerId?, categoryId, defaultUnitId, name, searchKey, imageUpdatedAt?, createdAt, updatedAt
```

`ownerId = null` 表示系统项，非空表示个人项。个人食材不保存图片字段；系统食材图片由后台后传治理，当前终存 `50x50 PNG` 小图，不进入个人食材创建契约。R1 不新增审核、合并目标、换算倍率或别名表。

### 内容版本快照

`RecipeContentVersion` 需要把旧文本字段调整为已确认正文事实：

```text
name
story?
baseServings
difficulty
duration
tips?
ingredientsJson
stepsJson
imagesJson
contentSizeBytes
createdAt
```

`ingredientsJson` 保存食材 ID、食材名快照、精确/模糊用量、单位 ID 和单位名快照。`stepsJson` 当前保存“有序步骤文本 + 已发布步骤图 URL 快照”；`imagesJson` 保存该固定版本实际引用到的封面图与步骤图快照来源。用户菜谱版本里它仍承载草稿绑定后的图片槽位状态；后台系统菜谱版本里则记录本次固化后的封面图和步骤图 URL 快照，用于保持新旧版本图片资源分离。

### 灵感平台分类

```text
InspirationCategory
  id, name, iconKey, sortOrder, status, createdAt, updatedAt
```

平台分类是灵感列表和详情的只读 owner 数据，不复用个人分类。R1 由平台直接维护，客户端通过只读接口加载；不把“灵感分类”硬编码在端上。

## 七、数据库约束建议

1. `RecipeCategory(userId, searchKey)` 唯一。
2. `RecipeScene(userId, searchKey)` 唯一。
3. 分类和场景 `sortOrder >= 0`，同一用户下排序值唯一；使用可延迟唯一约束，或在同一事务内先写临时序号再写最终序号，避免批量换位自撞唯一键。
4. `RecipeSceneLink(recipeId, sceneId)` 唯一，服务端事务校验双方属于同一用户。
5. `RecipeDraft(recipeId)` 在 `recipeId IS NOT NULL` 时唯一，保证一道已发布菜谱只有一个有效编辑草稿。
6. `RecipeDraft.version > 0`，`Recipe.version > 0`。
7. 个人已发布 `Recipe` 必须有 `ownerId`、`categoryId` 和有效内容版本；平台入口不得引用个人分类。
8. `Ingredient(ownerId, searchKey)` 在 owner 非空时唯一；系统食材 `searchKey` 全局唯一。
9. `Unit(ownerId, searchKey)` 在 owner 非空时唯一；系统单位 `searchKey` 全局唯一。
10. `RecipeContentVersion.baseServings` 为 `1～20`，`difficulty` 与 `duration` 都必须属于固定四档之一。

JSON 中食材用量互斥、步骤非空、数组长度和引用权限由服务端发布事务验证。不能用客户端校验代替。

## 八、事务、幂等与额度

### 保存草稿

1. 使用请求头 `Idempotency-Key` 幂等。
2. 更新草稿提交 `expectedVersion`，冲突返回 `409`。
3. 新建菜谱草稿时锁定用户额度事实，校验菜谱数量和预计空间后创建。
4. 保存时重新计算草稿逻辑空间并更新账本。
5. 已发布菜谱编辑草稿的空间按 `max(0, 草稿正文大小 - 当前已发布正文大小)` 计费，不把整份已发布正文重复计入。

### 发布草稿

同一事务内：

1. 锁定草稿并校验 owner、`expectedVersion` 和发布必填项。
2. 校验个人分类、场景、食材和单位均对当前用户可用。
3. 校验当前菜谱数量和空间；编辑草稿不重复增加菜谱数量。
4. 生成不可变 `RecipeContentVersion` 和名称快照。
5. 新建或更新 `Recipe` 当前入口、分类和分类内排序。
6. 重建菜谱场景关联。
7. 更新个人逻辑空间账本。
8. 删除草稿和草稿场景关系。
9. 写入幂等结果和必要审计。

### 排序

分类、场景和分类内菜谱重排都提交完整作用域的 `id + expectedVersion` 集合。服务端锁定最小作用域、校验 ID 集合完全一致且版本未变化后批量更新；缺失、重复、越权或并发版本变化返回 `409`。

## 九、查询与索引

只为 R1 真实查询建立：

1. `Recipe(ownerId, status, categoryId, sortOrder, id)`：我的分类列表和分页。
2. `RecipeCategory(userId, sortOrder, id)`：个人分类顺序。
3. `RecipeScene(userId, sortOrder, id)`：个人场景顺序。
4. `RecipeDraft(userId, updatedAt, id)`：草稿箱分页。
5. `Ingredient(ownerId, categoryId, searchKey, id)`：来源、分类和关键词选择。
6. `Unit(ownerId, type, searchKey, id)`：来源、类型和关键词选择。

R1 不增加推荐、点赞、收藏统计或全文检索专用索引。关键词先按标准化搜索键和受限分页验证成本，再决定是否需要 PostgreSQL trigram 或全文索引。

## 十、错误语义

1. `400`：字段格式、数组上限、发布必填项、不可用分类/场景/食材/单位或当前状态不允许。
2. `401`：我的、合集或写操作未登录。
3. `403`：已登录但无权操作已知对象。
4. `404`：对象不存在或调用方无权知道其存在；匿名灵感内容不可曝光时同样返回 `404`。
5. `409`：`version`、`Idempotency-Key`、排序集合、重名或并发额度冲突。
6. `503`：图片、点赞、灵感推荐审核或跨单位换算能力尚未开放。

## 十一、已确认决策

以下决策于 2026-07-25 确认：

1. 难度档位：建议首版固定 `新手友好 / 轻松上手 / 需要经验 / 进阶挑战` 四档，对应稳定枚举 `BEGINNER / EASY / SKILLED / CHALLENGING`；发布时必须显式选择。
2. 个人分类删除：建议 R1 暂不提供删除；后续删除时必须先把分类下菜谱批量迁移到另一个分类，不允许产生“未分类”已发布菜谱。
3. 模糊用量：建议首版固定 `适量 / 少许 / 按需` 三项，不允许自由输入；其他表达使用食材备注能力时再单独确认。

4. 工程安全上限：名称 120 字、故事 2000 字、小贴士 1000 字、分类/场景名 20 字、个人分类和个人场景各最多 50 个、食材名 64 字、单位名 16 字、食材和步骤各最多 100 项、精确数量最多 3 位小数。
5. 单位类型固定为重量、体积、常用、包装，对应 `WEIGHT / VOLUME / COMMON / PACKAGE`。

## 十三、历史清空策略

用户已于 2026-07-25 确认允许清空旧候选数据。R1 不做旧菜谱候选兼容迁移，前向 migration 直接执行以下策略：

1. 删除旧 `Recipe`、`RecipeContentVersion`、`RecipeReport` 候选结构及其依赖索引、约束和旧枚举。
2. 清空旧 `MealPlanItem`、`DiningEvent`、`DiningEventParticipant` 中依赖旧菜谱固定版本的数据，不尝试字段级映射。
3. 清空由旧菜单快照生成的候选购物缺口数据，避免沿用旧文本食材结构。
4. 只保留与菜谱无关的用户、饭搭子、会员、冰箱、后台用户和审计底座数据。
5. 不修改历史 migration，新增一条前向 migration 完成清空和重建。

## 十二、实施门禁

按以下顺序执行：

1. 更新 `api-contract.md`、`api-index.md` 和客户端 API 手册状态。
2. 形成新 Prisma Schema 与前向 migration 评审，不修改历史 migration。
3. 同步 API DTO/OpenAPI、Client 本地类型和 Admin 必要类型，不跨应用导入源码。
4. 实现 R1 服务端与客户端纵切。
5. 验证草稿额度、发布事务、版本冲突、分类/场景越权、食材快照和历史固定版本不漂移。
6. 通过真实流程后才把 R1 标记为已实现或已验收。
