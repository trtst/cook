# 菜谱转 JSON 规范

菜谱 JSON 有两种用途，必须区分目标：

- **新建菜谱**：使用 `recipe.import.batch.v1`，每项是完整的 `{ recipe, wiki }`，`recipe` 不带 `recipeId / contentVersionId`，导入到菜谱新建入口。
- **已有菜谱的完整导出与定向修订**：从菜谱管理页导出完整当前内容，保留 `recipeId / contentVersionId` 作为目标和版本依据；按菜谱内容推导后，通过 Wiki 修订入口导回，并在页面勾选要替换的字段。不得把带 ID 的文件提交到新建入口。

完整导出是后续转换的**输入资料**，不能为了缩短 JSON 删除原有字段、标签、食材角色、步骤或 Wiki 助理内容。统一的“批量导出”包含菜谱正文、当前标签、食材角色及 Wiki 助理步骤，足以结合菜谱原始上下文进行推导；营养分析和食材库主数据属性由系统派生/维护，不属于菜谱正文导出字段。导出限定为 ACTIVE 系统菜谱，单次最多 100 道；不要求 Wiki READY，也不要求已有食材角色。缺少角色导出为 `null`，不存在的 Wiki 内容以空值或空数组保留，便于后续按完整上下文推导。

“批量导出”文件包含数值型 `recipeId` 和 `contentVersionId`，格式为 `recipe.import.batch.v1`，并保留当前正文及 Wiki 上下文。营养数据由后台根据食材、用量与基准份量派生，不能从 JSON 直接导入，相关内容变化后重算营养快照。新建菜谱 JSON 的每条食材必须包含 `recipeRole`；已有菜谱回导时，通过 Wiki 导入入口按所选字段定向修订，服务端只读取版本 ID、Wiki 和所选正文字段。不得把带 ID 的修订文件提交到菜谱新建导入入口。缺少角色不会阻止导出；按规范推导并回导时仍需补齐角色。

本文的有效 JSON 字段和枚举以当前导入校验器为准。食材行只描述该食材在本菜谱中的名称、用量、稳定分类和菜谱内角色；食材库的 `proteinType / isStaple / isSpicyIngredient / aliases` 是系统食材主数据，不是菜谱 JSON 字段。菜谱营养、完整度和 `PRIMARY_INGREDIENT` 由后台基于已匹配的食材及菜谱内容派生，不在 JSON 中伪造或重复填写。

## 1. 完整导出文件结构示例

除可省略的 `recipe.coverImageUrl` 外，字段都必须出现。

```json
{
  "schemaVersion": "recipe.import.batch.v1",
  "recipes": [
    {
      "recipe": {
        "recipeId": 10002437,
        "contentVersionId": 10001608,
        "inspirationCategoryId": 6001,
        "coverImageUrl": null,
        "content": {
          "name": "海带排骨汤",
          "story": "海带和排骨一起炖煮，汤味鲜美，适合家庭晚餐。",
          "baseServings": 4,
          "difficulty": "EASY",
          "duration": "OVER_60",
          "tips": "排骨先焯水。",
          "keywords": ["清淡", "家常", "炖煮", "海带", "海带排骨汤"],
          "ingredients": [
            { "name": "排骨", "quantity": "500", "unit": "克", "fuzzyText": null, "categoryCode": "MEAT_POULTRY_EGG", "recipeRole": "MAIN" },
            { "name": "海带", "quantity": "200", "unit": "克", "fuzzyText": null, "categoryCode": "PRODUCE", "recipeRole": "ACCOMPANIMENT" },
            { "name": "食盐", "quantity": null, "unit": null, "fuzzyText": "适量", "categoryCode": "SEASONING", "recipeRole": "SEASONING" }
          ],
          "tools": [
            { "name": "汤锅" }
          ],
          "steps": [
            {
              "text": "排骨冷水下锅焯水，撇去浮沫后捞出洗净。",
              "imageUrl": null,
              "imagePrompt": "家常中式厨房中，排骨在冷水锅中焯水，水面浮起灰色浮沫，漏勺准备捞出，真实烹饪过程特写，不出现文字"
            },
            {
              "text": "海带浸泡、清洗并切段。",
              "imageUrl": null,
              "imagePrompt": "厨房台面上，泡发后的海带被切成段，旁边放着装海带的碗，真实备菜场景，不出现文字"
            },
            {
              "text": "汤锅中加水，放入排骨和海带，大火煮开后转小火炖至排骨熟透，最后调味盛出。",
              "imageUrl": null,
              "imagePrompt": "汤锅中排骨和海带一起炖煮，汤汁微沸，热气升起，家常炖汤场景，不出现文字"
            }
          ]
        }
      },
      "wiki": {
        "tags": [
          { "tagCode": "CUISINE", "tagValue": "HOME_STYLE" },
          { "tagCode": "DISH_STYLE", "tagValue": "SOUP" },
          { "tagCode": "MEAL_TYPE", "tagValue": "LUNCH" },
          { "tagCode": "MEAL_TYPE", "tagValue": "DINNER" },
          { "tagCode": "DISH_ROLE", "tagValue": "SOUP" },
          { "tagCode": "MAIN_PROTEIN_TYPE", "tagValue": "PORK" },
          { "tagCode": "FLAVOR_PROFILE", "tagValue": "LIGHT" },
          { "tagCode": "SPICE_LEVEL", "tagValue": "NONE" }
        ],
        "assistant": {
          "steps": [
            {
              "order": 1,
              "phase": "PREP",
              "action": "BLANCH",
              "title": "排骨焯水",
              "detail": "排骨冷水下锅，水开后撇去浮沫，捞出用温水洗净。冷水下锅能让血水慢慢逼出来，汤更清。",
              "imageUrl": null,
              "imagePrompt": "家常中式厨房中，排骨在冷水锅中焯水，水面浮起灰色浮沫，漏勺准备捞出，真实操作指导画面，不出现文字",
              "durationMinutes": 5,
              "durationText": "约 5 分钟"
            },
            {
              "order": 2,
              "phase": "PREP",
              "action": "CUT",
              "title": "处理海带",
              "detail": "海带提前泡发，洗净后切成段。海带表面黏液要冲洗干净，不然汤会发腥。",
              "imageUrl": null,
              "imagePrompt": "厨房台面上，泡发后的海带被切成段，旁边放着装海带的碗，真实切配教学场景，不出现文字",
              "durationMinutes": 10,
              "durationText": "约 10 分钟"
            },
            {
              "order": 3,
              "phase": "COOK",
              "action": "SIMMER",
              "title": "炖煮",
              "detail": "汤锅加水，放入排骨和海带，大火煮开后转小火慢炖。炖到排骨软烂、海带入味即可。最后加盐调味，盛出。",
              "imageUrl": null,
              "imagePrompt": "汤锅中排骨和海带一起炖煮，汤汁微沸，热气升起，家常炖汤场景，真实操作指导画面，不出现文字",
              "durationMinutes": 60,
              "durationText": "约 60 分钟"
            },
            {
              "order": 4,
              "phase": "SERVE",
              "action": "PLATE",
              "title": "调味装盘",
              "detail": "调味后盛入汤碗。",
              "imageUrl": null,
              "imagePrompt": "调味完成的海带排骨汤盛入白色汤碗，排骨和海带清晰可见，热气轻起，家常晚餐摆盘，真实食物摄影，不出现文字",
              "durationMinutes": 5,
              "durationText": "约 5 分钟"
            }
          ]
        }
      }
    }
  ]
}
```

此示例代表**已有菜谱的完整导出/修订资料**，其中菜谱 ID 与正文版本 ID 必须原样保留。实际转换时，原始步骤与助理步骤必须分别拆分；助理步骤应体现 `PREP → COOK → SERVE` 的阶段变化。未勾选替换的字段只是推断上下文，导入时保持现值。

### 1.1 新建菜谱导入结构

```json
{
  "schemaVersion": "recipe.import.batch.v1",
  "recipes": [
    {
      "recipe": {
        "inspirationCategoryId": 6001,
        "coverImageUrl": null,
        "content": { "...": "完整 content 结构" }
      },
      "wiki": {
        "tags": [],
        "assistant": { "steps": [] }
      }
    }
  ]
}
```

每个 `recipes[]` 元素必须为完整单菜 `recipe + wiki`；`"..."` 仅为占位，不能直接导入。新建菜谱不带 `recipeId / contentVersionId`；已有菜谱的修订文件必须保留两者，并通过 Wiki 修订入口按勾选字段定向替换。

### 1.2 灵感分类 ID

`recipe.inspirationCategoryId` **必须填写**，不能为 `null`。根据菜谱主体内容推测选择 `6001–6009` 中一个 ID；推测失败时进入草稿并标 `NEEDS_FIX`，不允许提交有效 JSON。

分类不替代 `wiki.tags`。

| ID | 分类名称 |
| --- | --- |
| `6001` | 家常便饭 |
| `6002` | 下饭好菜 |
| `6003` | 快手小炒 |
| `6004` | 减脂轻食 |
| `6005` | 周末大餐 |
| `6006` | 一人食光 |
| `6007` | 地方风味 |
| `6008` | 清淡养生 |
| `6009` | 宴客硬菜 |

**推测优先级**（从上到下取第一个匹配）：
1. 明确减脂/低卡/高蛋白/轻食/健身餐 → `6004`
2. 明确快手/小炒/15分钟内 → `6003`
3. 明确下饭/重口/下饭菜 → `6002`
4. 明确清淡/养生/少油少盐 → `6008`
5. 明确一人份/单人食 → `6006`
6. 明确宴客/硬菜/大菜 → `6009`
7. 明确地方风味/菜系特色 → `6007`
8. 明确周末/慢炖/耗时较长 → `6005`
9. 以上都不明显 → `6001`

推测依据来自：菜名、特点标签、食材、做法、份量、烹饪时长。不允许瞎猜，必须有依据。

## 2. 字段规则

### 2.1 菜谱字段

| 字段 | 要求 |
| --- | --- |
| `schemaVersion` | 固定为 `recipe.import.batch.v1` |
| `recipe.recipeId` | 仅 Wiki 修订文件出现，数值型，原样保留 |
| `recipe.contentVersionId` | 仅 Wiki 修订文件出现，数值型，原样保留 |
| `recipe.inspirationCategoryId` | 字段必须出现；填写上方 `6001–6009` 中已确认的 ID，无法确认时进入草稿标 `NEEDS_FIX` |
| `recipe.coverImageUrl` | 可省略；有可靠图片地址时填写 |
| `content.name` | 必填，保留来源菜名 |
| `content.story` | **必填，必须根据菜名、食材、做法、特点写一段简短介绍，不能留空** |
| `content.baseServings` | 必填，正数 |
| `content.difficulty` | 必填，使用难度枚举 |
| `content.duration` | 必填，使用加热烹饪时长枚举；不表示从切配到出锅的全流程耗时 |
| `content.tips` | 必填字符串，格式见 2.5；无依据时写空字符串 `""`，可保存为草稿并产生错误项，补全前不得发布 |
| `content.keywords` | 字段必须出现，正文关键词；用于前台展示、聚合和搜索 |
| `content.ingredients` | 必填，至少一条；每条必须标注 `recipeRole` |
| `content.tools` | 必填数组，尽量填写明确厨具；无法确认时使用 `[]`，不得填写猜测值 |
| `content.steps` | 必填，至少一条；语义保留规则见 2.2 节 `steps[].text` |

### 2.2 明细字段

| 字段 | 要求 |
| --- | --- |
| `content.keywords` | 中文数组，通常 3～6 项，最多 8 项；具体提取规则见下方；不写分类或结构化标签（如“川湘菜”“重辣”） |
| `ingredients[].name` | 来源食材名称；按标准化映射处理，见 2.2.1 |
| `ingredients[].quantity / unit / fuzzyText` | 三个字段都必须出现；精确用量为“字符串数量 / 项目单位名称 / null”，模糊用量为“null / null / 适量” |
| `ingredients[].categoryCode` | 有效 JSON 中必填稳定分类代码；无法确定时不生成有效 JSON，保留草稿标记 `NEEDS_FIX`，不得填 `null` 或 `UNCLASSIFIED` |
| `ingredients[].recipeRole` | 必填；按该食材在这道菜中的实际作用填写 `MAIN / ACCOMPANIMENT / SEASONING`，规则见 2.2.3 |
| `tools[].name` | 明确厨具；无依据填 `[]` |
| `steps[].text` | 按顺序拆分核心操作；允许分句、去重和统一表达，但必须保留关键动作、用量、顺序和等待节点；不得出现“准备食材：”“处理主料：”“调好酱汁：”“下锅烹饪：”等前缀标签 |
| `steps[].imageUrl` | 必须出现；无图为 `null` |
| `steps[].imagePrompt` | 必填中文；只基于本步骤正文生成菜谱步骤图片；不出现“手”、文字、模型参数、URL 或内部 ID |

关键词按「具体菜品类型 > 风味 > 场景 > 具体烹饪方式 > 主要食材 > 完整菜名」排序。

- 只选用户会主动搜索的具体词。
- 不写泛化动词（煮、炒、炖、蒸）和泛化类型词（汤、菜、主食、小吃、点心）。
- 只写具体做法词和具体类型词，如清炒、水煮、凉拌、炖汤、小炒、炒饭、煲仔饭。
- 来源没有具体做法词或具体类型词时，该项跳过，不硬填。
- 不写文案词、功效词、分类或结构化标签。
- 完整菜名不拆分，最多 1 项，放在最后。
- 无可靠依据时填 `[]`。
- 通常 3～6 项，最多 8 项，不重复。

#### 2.2.1 食材标准化映射

| 原始写法 | 标准化 |
| --- | --- |
| 鲜虾、虾仁 | 虾 |
| 葱花、葱末 | 小葱 |
| 盐 | 食盐 |
| 蒜末、蒜片、蒜瓣 | 大蒜 |
| 姜丝、姜片、姜末 | 姜 |
| 黑胡椒粉 | 黑胡椒 |
| 白胡椒粉 | 白胡椒 |

`ingredients[].name` 中的原始写法“盐”必须标准化为“食盐”，不得在导入 JSON 的食材名称中保留“盐”。步骤等自然语言正文可按语句习惯写“加盐调味”。

**水类忽略**：清水、温水、冷水、半碗水、1碗水等，全部不加入 `ingredients`。

#### 2.2.2 用量规则

精确用量：`quantity` 为大于 0 的数字字符串，`unit` 为项目单位名称，`fuzzyText` 必须为 `null`。

模糊用量：`quantity` 和 `unit` 为 `null`，`fuzzyText` 为 `"适量"`；来源的“少许”“几滴”“按需”等统一归一化。所有食材类别均可使用“适量”，菜谱食材分类不限制用量结构。

#### 2.2.3 菜谱内食材角色

`recipeRole` 描述食材在**当前这道菜**中的作用，不是食材库的全局属性。相同食材在不同菜谱中可以有不同角色；不得单凭 `categoryCode`、`proteinType`、`isStaple` 或食材名称决定角色，必须结合菜名、用量、介绍和步骤判断。

| `recipeRole` | 中文 | 判定规则 |
| --- | --- | --- |
| `MAIN` | 主料 | 决定菜品主体或主要蛋白的食材。通常是菜名指向的核心食材，或在菜中份量/作用最突出的主体食材。 |
| `ACCOMPANIMENT` | 配料 | 与主料共同构成菜品主体的食材，如配菜、搭配蔬菜或增加口感的食材；不是单纯用于调味。 |
| `SEASONING` | 调味料 | 在这道菜中主要用于调味、增香、上色或烹调辅助的食材，包括盐、酱油、醋、油、香料，以及少量葱姜蒜等。 |

判定要求：

- 按菜谱中的实际用途标注，不按食材库分类标注。例如蒜在蒜蓉菜中可能是 `MAIN`，少量蒜末用于爆香时是 `SEASONING`。
- `MAIN` 可有一项或多项。必须综合菜名、食材用量、介绍和步骤，按最合理的菜谱语义为每条食材选定一个角色；不因角色判断存在一定不确定性而留空或标记 `NEEDS_FIX`。
- `SEASONING` 只排除出菜品主体、主要食材和主蛋白推导；仍保留在菜谱正文、营养计算、用量展示和购物准备中。
- `PRIMARY_INGREDIENT` 从 `MAIN` 食材派生。主蛋白优先从 `MAIN` 中有可靠蛋白类型的食材推导；没有可靠依据时留空，不回退到食材数组顺序或调味料。
- `ACCOMPANIMENT` 可用于蔬菜与食材多样性等结构分析，不自动替代主料或主蛋白。
- 转换时必须根据菜谱自身信息完成推导并输出角色，不要求额外人工确认，也不调用独立 AI 服务。推导以菜谱实际用途为准，不得只按食材名称或全局分类机械套用。

**逐项判定顺序**：先确认这条食材是否实际进入成品；再看菜名是否点名它、它是否构成菜品主体；随后结合用量和步骤确认它是在提供主体内容，还是只用于调味、增香、上色或润锅。按这个顺序为每条食材选一个角色；“是否肉类/蔬菜/主食”本身不能决定角色。

| 场景 | 标注示例 | 理由 |
| --- | --- | --- |
| 番茄炒蛋 | 番茄、鸡蛋 `MAIN`；少量葱花 `SEASONING` | 番茄和鸡蛋共同构成菜品主体 |
| 蒜蓉西兰花 | 西兰花 `MAIN`；少量蒜末 `SEASONING` | 菜名中的“蒜蓉”是风味做法，不代表蒜必然是主料 |
| 蒜本身构成主体的菜 | 大量蒜 `MAIN` | 按实际主体标注，不因蒜通常用作调味而固定为 `SEASONING` |
| 海带排骨汤 | 排骨 `MAIN`；海带 `ACCOMPANIMENT`；食盐 `SEASONING` | 排骨承担主体，海带共同构成内容，食盐用于调味 |
| 葱姜蒜爆香后明确弃去 | 不作为成品食材输出 | 避免把最终不食用的烹调材料误记为菜谱食材 |

**导入兼容说明：**`recipe.import.batch.v1` 的菜谱食材必须带 `recipeRole`，后台 Wiki 修订也支持按 `ingredientRoles` 单独修订角色。角色修订沿用 SUPER_ADMIN Wiki 原位替换规则：正文版本 ID 不变，已引用该固定版本的周刊、收藏和计划读取到更新后的角色；修订写入审计并重算自动菜谱标签。`NEEDS_FIX` 仍按其他字段规则使用，不用于食材角色。

**单位处理**：

- 单位优先 克、毫升，可确定换算 kg / 千克、L / 升。
- **汤匙 / 茶匙：保留原单位**。
- **小勺 / 半勺 / 少许 / 几滴：统一转为 `{ quantity: null, unit: null, fuzzyText: "适量" }`**。
- 两种结构互斥；`fuzzyText` 只允许 `null` 或 `"适量"`。

当来源无法确定精确数量时，可保留为“适量”，不得估算；分类不确定仍按分类规则进入草稿，不生成有效 JSON。

#### 2.2.3 食材分类判定

分类代码固定为：PRODUCE（蔬果菌菇）、MEAT_POULTRY_EGG（肉禽蛋）、SEAFOOD（水产海鲜）、SOY_DAIRY（豆乳制品）、GRAINS_STAPLES（米面杂粮）、SEASONING（调味料）、DRIED_PRESERVED（干货腌制）、BEVERAGE_ALCOHOL（酒水饮料）。

分类判定：

`categoryCode` 是系统食材的稳定分类属性，不随单道菜谱中的用途、用量或 `recipeRole` 变化。命中系统食材时，必须与目标环境中该系统食材当前分类完全一致；不得为了匹配菜谱用途而修改系统食材分类。`recipeRole` 只表达食材在当前菜谱中的作用。

已有菜谱修复时，必须保留完整导出中已有食材的 `categoryCode`，不得改写已有导出中的分类。

`categoryCode`、食材主数据的 `isStaple` 和菜谱内的 `recipeRole` 是三个独立属性：是否常作主食不能单独决定食材分类；在当前菜谱中用于调味，也不能单独决定食材分类。项目统一将干辣椒作为调味料，稳定分类为 `SEASONING`；在具体菜谱中通常也标为 `recipeRole: SEASONING`。山药等薯类的 `isStaple` 应独立判断，`categoryCode` 仍沿用目标环境系统食材分类，不能仅据主食属性改成 `GRAINS_STAPLES`。已有食材必须沿用目标环境的系统分类。

未命中系统食材、需要给出分类建议时，按食材的稳定身份判断：

- `PRODUCE`（蔬果菌菇）：新鲜蔬菜、水果、菌菇。例：番茄、口蘑、金针菇、青椒、鲜木耳、香菜。
- `MEAT_POULTRY_EGG`（肉禽蛋）：畜禽肉及蛋类。例：牛里脊、猪肋排、鸡胸肉、鸡蛋、瘦牛肉片。
- `SEAFOOD`（水产海鲜）：鱼、虾、蟹、贝类。例：巴沙鱼、虾滑、虾仁。
- `SOY_DAIRY`（豆乳制品）：豆制品、乳制品。例：嫩豆腐、豆干、豆浆。
- `GRAINS_STAPLES`（米面杂粮）：谷物、面粉、淀粉、粉丝、米饭。例：淀粉、粉丝、面粉。
- `SEASONING`（调味料）：系统食材主数据中归为调味料的食材。当前种子示例：食盐、糖、酱油、醋、料酒、黄酒、米酒、蚝油、豆瓣酱、番茄酱、八角、香叶、花椒、黑胡椒、白胡椒、干辣椒、十三香。
- `DRIED_PRESERVED`（干货腌制）：食材身份主要由干燥、腌制、风干等加工形态形成，通常作为可食用材料使用。例：干香菇、干木耳、海米、虾皮、榨菜、酸菜、梅干菜、萝卜干。
- `BEVERAGE_ALCOHOL`（酒水饮料）：作为饮品或烹饪用饮料的酒水。当前种子示例：啤酒、红酒、洋酒。料酒、黄酒、米酒在当前种子数据中属于 `SEASONING`，不能作为本分类示例。

未命中系统食材时，才按食材稳定身份给出分类候选；不得根据本菜谱中的 `recipeRole`、用量或 `isStaple` 推导 `categoryCode`。候选分类须先在目标环境确认后，才能生成最终 JSON。菜谱中的“主体/调味”属于菜谱食材关系，不通过 `categoryCode` 表达。

无法确定分类时，不生成可通过导入校验的 JSON；保留原始食材和分类问题进入导入草稿，标记 `NEEDS_FIX`，确认系统食材主数据后再生成合法分类。不得填写 `null`、`UNCLASSIFIED` 或猜测。

### 2.3 步骤图片提示词

`imagePrompt` 描述待生成画面，`imageUrl` 记录已有图片。同一菜谱内，每条原始步骤的提示词必须非空、中文且不重复；只写当前步骤有依据的操作、食材、工具和状态，不写模型参数、URL 或内部 ID，**不出现“手”**。去重范围限于同一菜谱，跨菜谱不要求全局去重。

### 2.4 加热烹饪时长规则

`content.duration` 必须根据来源明确的加热时长或人工确认结果填写；无法确认时进入审核，不填写默认值。该字段只表示加热烹饪时长，不表示完整制作耗时。

只计从开始加热到最后一项加热完成的实际经过时间。包含灶台、烤箱、蒸箱、空气炸锅、压力锅等加热设备；不包含备菜等非加热操作。

- 计入：煮、炒、蒸、炖、炸、煎、烤、收汁、焖、卤、红烧等加热操作，以及加热过程中的必要等待。
- 不计入：采购、解冻、浸泡、腌制、洗菜、切配、摆盘，以及关火后的静置。
- 多项加热操作并行时，按实际经过时间计，即从第一项开始加热到最后一项完成加热的时长；不得重复累加并行时段。
- 不按助理步骤的时长简单相加；助理步骤可能包含 `PREP` 等非加热操作。

| 枚举 | 时长边界 | 典型场景 |
| --- | --- | --- |
| `WITHIN_15` | `<= 15` 分钟 | 番茄炒蛋、清炒时蔬 |
| `BETWEEN_15_30` | `> 15` 且 `<= 30` 分钟 | 风味茄子、小炒肉 |
| `BETWEEN_30_60` | `> 30` 且 `<= 60` 分钟 | 红烧肉、大盘鸡 |
| `OVER_60` | `> 60` 分钟 | 老火汤、牛腩、排骨慢炖 |

### 2.5 小贴士格式

`content.tips` 固定为字符串，不使用数组。

- 来源只有一条建议时，直接写字符串。
- 来源有多条独立建议时，按一条一行，用 `\n` 拼接成一个字符串。
- JSON 中写转义换行符，不写数组。
- 无依据时写空字符串 `""`；可保存为草稿并产生错误项，补全前不得猜写或发布。

```json
"tips": "茄子先腌透并挤水。\n醋一定最后放，更提香。\n建议现做现吃，放久会回软。"
```

## 3. 业务标签

`wiki` 是后台结构化资料层，供审核、匹配和检索使用，不直接透传前端。导入时填写 `tagCode` 和 `tagValue`，不填写后台状态字段。`tagCode + tagValue` 是标签的文本稳定标识，不填写数字 ID。

| 标签代码 | 枚举值 | 中文展示 | 选择规则 |
| --- | --- | --- | --- |
| `CUISINE` | `SICHUAN_HUNAN` | 川湘菜 | 单选 |
|  | `CANTONESE` | 粤菜 |
|  | `NORTHERN` | 北方菜 |
|  | `JIANG_ZHE` | 江浙菜 |
|  | `LOCAL_SPECIAL` | 地方风味（闽菜、云贵菜、台湾菜等小众地域风味，以及融合菜） |
|  | `HOME_STYLE` | 家常菜（普通日常做法，或不属于前述特色分类的菜） |
| `DISH_STYLE` | `STIR_FRY` | 炒菜 | 单选 |
|  | `COLD_DISH` | 凉菜 |
|  | `SOUP` | 汤羹 |
|  | `STAPLE_FOOD` | 主食 |
|  | `STEW` | 炖煮 |
|  | `STEAMED` | 蒸菜 |
|  | `BRAISED` | 卤味 |
|  | `FRIED` | 煎炸 |
|  | `BBQ` | 烧烤 |
|  | `HOT_POT` | 火锅 |
|  | `SNACK` | 小吃点心 |
| `MEAL_TYPE` | `BREAKFAST` | 早餐 | 可多选 |
|  | `LUNCH` | 午餐 |
|  | `AFTERNOON_TEA` | 下午茶 |
|  | `DINNER` | 晚餐 |
|  | `LATE_NIGHT` | 夜宵 |
| `DISH_ROLE` | `MAIN` | 主菜/荤菜 | 多选 |
|  | `VEGETABLE` | 素菜 |
|  | `COLD_DISH` | 凉菜 |
|  | `SOUP` | 汤 |
|  | `STAPLE` | 主食 |
| `MAIN_PROTEIN_TYPE` | `PORK` | 猪肉 | 多选 |
|  | `CHICKEN` | 鸡肉 |
|  | `BEEF` | 牛肉 |
|  | `LAMB` | 羊肉 |
|  | `DUCK` | 鸭肉 |
|  | `FISH` | 鱼类 |
|  | `EGG` | 蛋类 |
|  | `SEAFOOD` | 水产海鲜 |
|  | `PLANT` | 植物蛋白 |
|  | `NONE` | 无主蛋白 |
| `FLAVOR_PROFILE` | `LIGHT` | 清淡 | 多选 |
|  | `MILD` | 温和 |
|  | `SPICY` | 辛辣 |
|  | `SOUR` | 酸味 |
|  | `SWEET` | 甜味 |
|  | `UMAMI` | 鲜味 |
|  | `SALTY` | 咸味 |
|  | `NUMBING` | 麻味 |
| `SPICE_LEVEL` | `NONE` | 不辣 | 单选 |
|  | `MILD` | 微辣 |
|  | `MEDIUM` | 中辣 |
|  | `HOT` | 重辣 |

标签规则：

- `MEAL_TYPE` 可多选且值不重复。按以下顺序判断：
  1. 来源明确只适合午餐时，只填 `LUNCH`；
  2. 来源明确只适合晚餐时，只填 `DINNER`；
  3. 早餐粥、面包、包子、燕麦等明确早餐场景可填 `BREAKFAST`；下午茶点心或夜宵小吃有明确场景依据时，才填 `AFTERNOON_TEA` 或 `LATE_NIGHT`；
  4. 来源没有明确餐次，或未强调餐次区分时，默认填 `LUNCH` 和 `DINNER`。
- `MEAL_TYPE`、`MAIN_PROTEIN_TYPE`、`FLAVOR_PROFILE`、`DISH_ROLE` 可多选；`CUISINE`、`DISH_STYLE`、`SPICE_LEVEL` 单选。不同标签代码之间可同时填写，例如汤类菜谱可以同时有 `DISH_STYLE = SOUP` 和 `DISH_ROLE = SOUP`。
- 菜系只选一个最能代表成品风格的类别：川湘风格选 `SICHUAN_HUNAN`，粤菜选 `CANTONESE`，北方菜选 `NORTHERN`，江浙菜选 `JIANG_ZHE`。闽菜、云贵菜、台湾菜等小众地域风味，以及融合菜，统一选 `LOCAL_SPECIAL`。普通日常做法，或不属于前述特色分类的菜，选 `HOME_STYLE`。结合菜名、食材组合、调味方式和烹饪步骤判断整体风格。
- 菜系分类与 `DISH_STYLE` 是不同维度：菜系表达地域或风格归属；面食/米饭/粥归 `STAPLE_FOOD`，炖煮/焖/煲归 `STEW`，拌菜归 `COLD_DISH`，煎炸归 `FRIED`。
- `DISH_STYLE.COLD_DISH` 是成品形式，`DISH_ROLE.COLD_DISH` 是餐桌角色；`PRIMARY_INGREDIENT` 由食材派生，不导入。
- `DISH_STYLE.SOUP` 与 `DISH_ROLE.SOUP` 不冲突：`DISH_STYLE` 表示成品形式，`DISH_ROLE` 表示餐桌角色，两者可以同时填写。汤面等同时承担汤和主食角色的菜，可在 `DISH_ROLE` 中同时填写 `SOUP` 和 `STAPLE`。
- `MAIN_PROTEIN_TYPE` 根据 `recipeRole = MAIN` 的食材标注所有实际承担主体作用的蛋白类型；鱼使用 `FISH`，非鱼类水产使用 `SEAFOOD`，蛋类使用 `EGG`，豆制品等植物来源使用 `PLANT`。多个主蛋白可同时标注。需要展示单一代表值时，按牛肉、猪肉、羊肉、鸡肉、鸭肉、鱼类、非鱼水产、蛋类、植物蛋白的顺序取首项。没有主蛋白时只填 `NONE`，`NONE` 不与其他主蛋白值并存。
- `FLAVOR_PROFILE` 可多选，只标注成品中明显并存的主要风味；不能为了填满标签而给每道菜硬选一项。酸辣菜可同时标注 `SOUR` 和 `SPICY`；鲜味、咸味和麻味按下方的专门边界判断。
- `DISH_ROLE` 可多选，按成品在一餐中实际承担的角色标注；例如汤面可以同时标注 `SOUP` 和 `STAPLE`。组餐或推荐时，同一道菜在同一餐中只占一个菜品位置，不因多个角色重复出现。
- `NONE` 表示菜谱没有主蛋白。`HOME_STYLE` 用于日常家常菜，以及不属于前述特色分类的菜。
- `SPICE_LEVEL` 只描述辣度强弱，`FLAVOR_PROFILE` 描述成品中明显的风味。先看来源是否明确写明辣或不辣，再看食材表和步骤中是否实际使用辣椒、辣椒酱等产生辣感的材料及其用量；不能只凭成品图片里是否看见辣椒判断。来源未描述辣味，且食材与步骤没有产生辣感的材料时标 `NONE`；有辣感但强弱不明时不得猜具体等级，应记录待确认。`SPICY` 表示辛辣是成品的明显风味，`SPICE_LEVEL` 表示辣感强弱，两者有关但不是同一个标签。

### 风味标签的判定边界

风味标签描述成品吃起来突出的口味，不是食材名、营养属性或调味料清单。一个菜谱可以有多个明显风味；某种食材或调味料出现在列表里，不足以单独证明对应风味明显。

| 枚举 | 分类含义 | 应标注的依据 | 不应据此标注 |
| --- | --- | --- | --- |
| `LIGHT`（清淡） | 整体油腻感和调味负担较轻，入口清爽 | 来源明确描述清淡、少油少盐，或做法与成品特征共同支持清淡 | 仅因低卡、低脂或用了蔬菜就标清淡；低脂是营养特征，不必然等于清淡口味 |
| `MILD`（温和） | 味道柔和，没有突出的刺激或强烈调味 | 来源明确描述温和、口味柔和，或整体味型有可靠依据 | 不能把它当作“不辣”或“微辣”；辣度只用 `SPICE_LEVEL` 表示。没有其他风味标签也不代表温和 |
| `SPICY`（辛辣） | 成品有清楚可感的辛辣味 | 来源明确写酸辣、香辣、辛辣等，或食材用量与烹饪步骤能确认辣味进入成品 | 不能只因图片装饰有辣椒，或食材表有少量辣椒但最终未入菜，就标辛辣 |
| `SOUR`（酸味） | 酸味是成品可辨认的主要风味之一 | 来源明确描述酸味，或醋、酸菜、番茄等在做法中承担明确的酸味作用 | 不能只因食材名称含番茄或用了少量醋就自动标酸味 |
| `SWEET`（甜味） | 成品甜味明显 | 来源明确描述甜口、糖醋、蜜汁等，或甜味在成品中是有意且明显的风味 | 不能只因配方含少量糖就标甜味；糖也可能只用于平衡或调味 |
| `UMAMI`（鲜味） | 成品的鲜味/咸鲜感突出，属于鲜味维度 | 来源明确描述鲜、鲜香、咸鲜，或多种鲜味来源在菜中承担主要风味且做法支持该判断 | 不能仅因有肉、海鲜、菌菇、酱油或味精中的任一种就标鲜味；“闻起来香”本身也不等于鲜味 |
| `SALTY`（咸味） | 成品咸味明显，是主要口味特征 | 来源明确描述咸口，或有可靠依据表明成品以咸味为主 | 不能因食材表中出现盐、酱油、豆瓣酱就标咸味；这些也可能只是基础调味 |
| `NUMBING`（麻味） | 成品有明确的麻感/麻香 | 来源明确描述麻、麻辣，或花椒、藤椒等在步骤中实际进入成品且用量足以形成麻感 | 不能把辣味等同于麻味；黑胡椒、白胡椒或仅作装饰的花椒也不能单独证明成品有麻感 |

`LIGHT`、`MILD` 是整体风味感受，`SPICY / SOUR / SWEET / UMAMI / SALTY / NUMBING` 是具体风味特征，可以并存，但只记录显著项。若菜品主要是鲜香或咸鲜且没有其他明显味型，可只标 `UMAMI`；若风味不落在当前枚举内，应省略风味标签并在转换工作记录中注明，不得用 `MILD` 兜底。

**导入支持范围提醒**：`FLAVOR_PROFILE` 当前有效值为 `LIGHT / MILD / SPICY / SOUR / SWEET / UMAMI / SALTY / NUMBING`；API 导入校验器、后台导入选项及菜谱详情校验均须同步接受这些值。不要输出 `MAIN_PROTEIN_TYPE = OTHER`、`FLAVOR_PROFILE = PEPPERY`、`DISH_STYLE = AIR_FRY / PAN_FRY` 等不支持值。`PRIMARY_INGREDIENT` 也不是可导入的 `tagCode`。菜谱修订时应逐条依据菜谱内容判断，不按旧枚举值批量替换。

## 4. 美食助理

原始步骤和助理步骤分开保存：

```text
recipe.content.steps  = 完整原始步骤
wiki.assistant.steps  = 整理后的执行流程
```

### 4.1 助理步骤独立重写

- **必须用自己的语言重新组织，不能复制 `content.steps` 的文案。**
- 可以合并、拆分、调整顺序，以“让新手能读懂、能跟着做成功”为目标。
- 事实必须与 `content.steps` 一致，但句式、语气、步骤划分完全独立。
- 应包含新手指导：火候控制、判断标准、防翻车提示、操作要点。
- 按 `PREP → COOK → SERVE` 阶段划分。

助理可以合并连续的重复动作，但不能修改食材、用量、顺序、等待节点或其他关键操作事实。

两类步骤图片和提示词也必须独立：`recipe.content.steps[].imagePrompt` 用于菜谱步骤图片；`wiki.assistant.steps[].imagePrompt` 用于做饭助理步骤图片。两者即使描述同一道菜，也不能互相复用或回退。

### 4.2 助理字段

| 字段 | 要求 |
| --- | --- |
| `order` | 从 1 开始递增 |
| `phase` | `PREP`、`COOK`、`SERVE` |
| `action` | 阶段内动作；不确定时使用 `OTHER` |
| `title` | 简短标题 |
| `detail` | 整理后的操作说明 |
| `imageUrl` | 字段必须出现；无图片时为 `null` |
| `imagePrompt` | 必填中文提示词；只描述该助理步骤对应的做饭助理步骤图片；不出现“手”、文字、模型参数、URL 或内部 ID |
| `durationMinutes` | 非 `SHOP` 步骤必填且为大于 `0` 的整数；`SHOP` 的取值待解析器与正式契约统一后确定，暂不作为最终依据 |
| `durationText` | 字段必须出现；普通步骤为展示文案，`SHOP` 填 `null` |

`content.duration` 的计入范围见 2.4；`durationMinutes` 与 `durationText` 必须表达同一步时长。`SHOP` 时长契约待统一。

### 4.3 做饭助理步骤图片提示词

`wiki.assistant.steps[].imagePrompt` 用于助理步骤图片，和 `imageUrl` 分开。同一菜谱内，每条提示词必须非空、中文且不重复；只依据当前 `phase / action / title / detail` 的明确事实生成，不写模型参数、URL 或内部 ID，也不复用原始步骤提示词。**不出现“手”**。去重范围同 2.3。

### 4.4 阶段和动作枚举

| 阶段 | 动作 |
| --- | --- |
| `PREP` | `SHOP`、`WASH`、`SOAK`、`THAW`、`CUT`、`SLICE`、`DICE`、`SHRED`、`MINCE`、`MARINATE`、`BLANCH`、`MEASURE`、`MIX`、`OTHER` |
| `COOK` | `BOIL`、`SIMMER`、`STEAM`、`STIR_FRY`、`PAN_FRY`、`DEEP_FRY`、`BRAISE`、`ROAST`、`BAKE`、`PRESSURE_COOK`、`REDUCE`、`OTHER` |
| `SERVE` | `SEASON`、`PLATE`、`GARNISH`、`PORTION`、`REST`、`OTHER` |

`BRAISE` 包含焖、卤、红烧；动作不明用对应阶段的 `OTHER`，阶段不明则人工确认。

## 5. 基础枚举

| 字段 | 枚举 |
| --- | --- |
| `difficulty` | `BEGINNER`、`EASY`、`SKILLED`、`CHALLENGING` |
| `duration` | `WITHIN_15`、`BETWEEN_15_30`、`BETWEEN_30_60`、`OVER_60` |

## 6. 草稿与可通过校验 JSON 的边界

| 情况 | 可通过导入校验的 JSON | 导入草稿处理 |
| --- | --- | --- |
| 分类不确定 | 不允许提交 | 保留原始食材和分类问题，标记 `NEEDS_FIX` |
| 任一类别使用“适量” | 允许提交 | 按模糊用量保存，不参与人数换算或精确数量合并 |
| 菜系归类 | 按第 3 节的六类规则选择；日常菜或不属于前述特色分类的菜选 `HOME_STYLE` | — |
| 多选标签 | 每个标签代码内不重复值；主蛋白、风味、菜品角色按第 3 节规则填写 | — |
| 其他标签无法判断 | 从 `wiki.tags` 省略该项 | 在转换工作记录中备注待确认项；备注不是可导入 JSON 字段 |
| `story` 为空 | **不允许**，必须补全 | 不生成有效 JSON，返回补全 |
| `tips` 为空 | 不通过校验 | 可保存草稿并产生错误项，补全前不得发布 |
| `inspirationCategoryId` 不确定 | 不允许提交 | 标 `NEEDS_FIX`，待人工选择 |
| `SHOP` 时长 | 暂不判定 | 待解析器与正式契约统一，暂不发布为最终 JSON |

以下仅为**转换过程的工作记录示意，不是可导入 JSON 结构**。不得将 `importStatus`、`needsFix` 或 `candidateTags` 拼进 `recipe.import.batch.v1`：

```json
{
  "importStatus": "NEEDS_FIX",
  "needsFix": ["ingredientCategory", "tips", "inspirationCategoryId"],
  "candidateTags": [ ... ]
}
```

## 7. 审核规则

- 全部导入项先审核；食材和单位须严格匹配。
- 不匹配或无依据的内容保留原值并人工确认；出现上述问题的草稿标记 `NEEDS_FIX`，不进入正式菜谱或可消费快照。
- 营养由后台按确认后的食材、数量和单位计算。

## 8. 导入前一次性校对清单

生成最终 JSON 前逐项检查；全部通过后再导入，避免先导入、再导出修订文件补字段：

1. **食材匹配**：每条食材名称严格匹配当前系统食材；`categoryCode` 与该系统食材当前分类一致；单位严格匹配当前系统单位。未匹配项先处理食材主数据，不靠改写菜谱 JSON 反复试。
2. **食材角色**：每条实际进入成品的食材都恰有一个 `recipeRole`。先判断主体，再判断构成内容的配料，最后判断调味和烹调辅助；同一食材在不同菜谱中可不同。
3. **用量**：精确用量不估数；来源无法确定时使用 `适量`。只忽略本规范明确排除的水，不因是调味料就删除食材行。
4. **结构化标签**：只使用本节允许的 `tagCode/tagValue`；`MEAL_TYPE`、`MAIN_PROTEIN_TYPE`、`FLAVOR_PROFILE`、`DISH_ROLE` 可多选且同一值不重复，`CUISINE`、`DISH_STYLE`、`SPICE_LEVEL` 单选；`CUISINE` 按第 3 节规则选择，其他无法判断的标签省略并记入待确认项。
5. **派生字段**：不写 `PRIMARY_INGREDIENT`、营养分析、完整度、`proteinType`、`isStaple`、`isSpicyIngredient` 或食材别名。这些不是菜谱导入食材行接受的字段。
6. **正文事实**：`baseServings`、数量、时长、步骤顺序和火候均有来源依据；`duration` 仅表达加热时长；故事和小贴士不得引入来源没有的功效或事实。
7. **模式与重复**：顶层为 `recipe.import.batch.v1`，每项为完整 `recipe + wiki`；同一批不重复菜谱 ID；不添加本规范未列字段、临时状态或注释字段。
8. **解析校验**：最终 JSON 先通过现有后台导入预览。预览可检查未知字段、食材/单位是否严格匹配、分类代码是否合法及标签枚举；它不保证自动发现 `categoryCode` 与已匹配食材主数据分类不一致，因此该项必须在生成前按系统食材当前分类核对。不要把未通过预览的文件当作最终转换结果。

## 9. 去重规则

- 不再仅靠菜名去重。
- **重复判定条件**：菜名一致 **且** 食材分类属于以下四类的个数一致：
  - `PRODUCE`（蔬果菌菇）
  - `MEAT_POULTRY_EGG`（肉禽蛋）
  - `SEAFOOD`（水产海鲜）
  - `SOY_DAIRY`（豆乳制品）
- 若菜名相同但上述四类食材个数不同（例如一个版本有肉、另一个没有），不算重复，应作为不同版本正常转换。
- 同一批导入中，不重复菜谱 ID。

## 附录：内容转换写作规范

> 写作指导，不改变字段、枚举和校验规则；与正文冲突时以正文为准。

- `content` 保留来源事实，可整理、拆分、去重，不补数量、时间、温度、替代食材或功效。
- `content.story` 必须根据菜名、食材、做法、特点写一段简短介绍，不能留空。
- `wiki.assistant.steps` 按 `PREP → COOK → SERVE` 重组，只补可观察的完成状态，如“表面凝固”“汤汁收浓”，不补造事实。
- 句数、步骤数、字数等均为建议，不参与校验。
- 转换顺序：读来源 → 写 `story` → 拆 `content.steps` → 建助理步骤 → 补判断标准 → 提取 `keywords / tags` → 写两类 `imagePrompt` → 校对草稿边界。
