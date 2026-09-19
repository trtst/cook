# 菜谱转 JSON 规范

单菜使用 `recipe.import.v1`；批量使用 `recipe.import.batch.v1`，每个 `recipes[]` 元素都是完整的 `{ recipe, wiki }`。

## 1. 固定 JSON

除可省略的 `recipe.coverImageUrl` 外，字段都必须出现；无依据不猜测。

```json
{
  "schemaVersion": "recipe.import.v1",
  "recipe": {
    "inspirationCategoryId": 6001,
    "coverImageUrl": null,
    "content": {
      "name": "海带排骨汤",
      "story": "海带和排骨一起炖煮，汤味鲜美，适合家庭晚餐。",
      "baseServings": 4,
      "difficulty": "EASY",
      "duration": "OVER_60",
      "tips": "排骨先焯水。",
      "keywords": ["炖煮", "汤", "家常", "海带排骨汤"],
      "ingredients": [
        { "name": "排骨", "quantity": "500", "unit": "克", "fuzzyText": null, "categoryCode": "MEAT_POULTRY_EGG" },
        { "name": "海带", "quantity": "200", "unit": "克", "fuzzyText": null, "categoryCode": "PRODUCE" },
        { "name": "盐", "quantity": null, "unit": null, "fuzzyText": "适量", "categoryCode": "SEASONING" }
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
      { "tagCode": "CUISINE", "tagValue": "OTHER" },
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
```

示例仅展示字段结构。实际转换时，原始步骤与助理步骤必须分别拆分；助理步骤应体现 `PREP → COOK → SERVE` 的阶段变化。

### 1.1 批量导入最小结构（结构示意）

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

每个 `recipes[]` 元素必须为完整单菜 `recipe + wiki`；`"..."` 仅为占位，不能直接导入。

### 1.2 灵感分类 ID

`recipe.inspirationCategoryId` 填已确认 ID；无法确认填 `null`，不猜测。分类不替代 `wiki.tags`。

这里的 `null` 仅表示灵感分类待人工选择，不适用于 `ingredients[].categoryCode`。

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

## 2. 字段规则

### 2.1 菜谱字段

| 字段 | 要求 |
| --- | --- |
| `schemaVersion` | 固定为 `recipe.import.v1` |
| `recipe.inspirationCategoryId` | 字段必须出现；填写上方 `6001–6009` 中已确认的 ID，无法确认时为 `null` |
| `recipe.coverImageUrl` | 可省略；有可靠图片地址时填写 |
| `content.name` | 必填，保留来源菜名 |
| `content.story` | 必填，保留来源故事或介绍；无依据时写空字符串 `""`，可保存为草稿并产生错误项，补全前不得发布 |
| `content.baseServings` | 必填，正数 |
| `content.difficulty` | 必填，使用难度枚举 |
| `content.duration` | 必填，使用加热烹饪时长枚举；不表示从切配到出锅的全流程耗时 |
| `content.tips` | 必填字符串，格式见 2.5；无依据时写空字符串 `""`，可保存为草稿并产生错误项，补全前不得发布 |
| `content.keywords` | 字段必须出现，正文关键词；用于前台展示、聚合和搜索 |
| `content.ingredients` | 必填，至少一条 |
| `content.tools` | 必填数组，尽量填写明确厨具；无法确认时使用 `[]`，不得填写猜测值 |
| `content.steps` | 必填，至少一条；语义保留规则见 2.2 节 `steps[].text` |

### 2.2 明细字段

| 字段 | 要求 |
| --- | --- |
| `content.keywords` | 中文数组，通常 3～6 项，最多 8 项；具体提取规则见下方；不写分类或结构化标签（如“川湘菜”“重辣”） |
| `ingredients[].name` | 来源食材名称 |
| `ingredients[].quantity / unit / fuzzyText` | 三个字段都必须出现；精确用量为“字符串数量 / 项目单位名称 / null”，模糊用量为“null / null / 适量” |
| `ingredients[].categoryCode` | 有效 JSON 中必填稳定分类代码；无法确定时不生成有效 JSON，保留草稿标记 `NEEDS_FIX`，不得填 `null` 或 `UNCLASSIFIED` |
| `tools[].name` | 明确厨具；无依据填 `[]` |
| `steps[].text` | 按顺序拆分核心操作；允许分句、去重和统一表达，但必须保留关键动作、用量、顺序和等待节点 |
| `steps[].imageUrl` | 必须出现；无图为 `null` |
| `steps[].imagePrompt` | 必填中文；只基于本步骤正文生成菜谱步骤图片 |

关键词提取规则：

关键词主体从 `content.story`、`content.ingredients`、`content.steps` 提取，只选用户可能主动搜索的具体词，按“烹饪方式 > 菜品类型 > 风味 > 场景 > 主要食材 > 完整菜名”排序。关键词通常 3～6 项，最多 8 项，不重复；完整菜名不拆分，最多 1 项并放在最后。不得写文案词、功效词、分类或结构化标签；无可靠依据时填 `[]`。以上属于写作建议，不参与程序校验。

食材分类代码固定为：`PRODUCE`（蔬果菌菇）、`MEAT_POULTRY_EGG`（肉禽蛋）、`SEAFOOD`（水产海鲜）、`SOY_DAIRY`（豆乳制品）、`GRAINS_STAPLES`（米面杂粮）、`SEASONING`（调味料）、`DRIED_PRESERVED`（干货腌制）、`BEVERAGE_ALCOHOL`（酒水饮料）。

分类判定：

`categoryCode` 是系统食材的稳定分类属性，不随单道菜谱中的用途、用量或角色变化。命中系统食材时，必须以系统食材当前分类为准。

未命中系统食材、需要给出分类建议时，按食材的稳定身份判断：

- `SEASONING`（调味料）：主要、稳定用途是赋味或增香，如盐、糖、酱油、醋、料酒、蚝油、豆瓣酱、番茄酱、八角、香叶、花椒、胡椒粉、十三香等。
- `DRIED_PRESERVED`（干货腌制）：食材身份主要由干燥、腌制、风干等加工形态形成，通常作为可食用材料使用，如干香菇、木耳、海米、虾皮、干辣椒、榨菜、酸菜、梅干菜、萝卜干等。
- 菜谱中的“主体/调味”属于菜谱食材关系，不通过 `categoryCode` 表达。
- 无法确定分类时，不生成可通过导入校验的 JSON；保留原始食材和分类问题进入导入草稿，标记 `NEEDS_FIX`，确认系统食材主数据后再生成合法分类。不得填写 `null`、`UNCLASSIFIED` 或猜测。

用量规则：

- 精确用量：`quantity` 为大于 `0` 的数字字符串，`unit` 为项目单位名称，`fuzzyText` 必须为 `null`。
- 模糊用量：`quantity` 和 `unit` 为 `null`，`fuzzyText` 为 `"适量"`；来源的“少许”“几滴”“按需”等统一归一化，且仅允许 `SEASONING` 使用。
- 非 `SEASONING` 出现模糊用量时，不生成有效 JSON，保留草稿并标记 `NEEDS_FIX`；补充精确数量和单位后再生成，不得估算。
- 两种结构互斥；`fuzzyText` 只允许 `null` 或 `"适量"`。单位优先 `克`、`毫升`，可确定换算 `kg / 千克`、`L / 升`，`汤匙`保留原单位。

### 2.3 步骤图片提示词

`imagePrompt` 描述待生成画面，`imageUrl` 记录已有图片。同一菜谱内，每条原始步骤的提示词必须非空、中文且不重复；只写当前步骤有依据的操作、食材、工具和状态，不写模型参数、URL 或内部 ID。去重范围限于同一菜谱，跨菜谱不要求全局去重。

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

`wiki` 是后台结构化资料层，供审核、匹配和检索使用，不直接透传前端。`wiki.tags` 按来源依据填写以下固定标签；导入时填写 `tagCode` 和 `tagValue`，不填写后台状态字段。`tagCode + tagValue` 是标签的文本稳定标识，不填写数字 ID。无法确认的标签不提交有效 JSON，保留候选标签进入导入草稿并待审核确认，不得猜测。

| 标签代码 | 枚举值 | 中文展示 | 选择规则 |
| --- | --- | --- | --- |
| `CUISINE` | `SICHUAN_HUNAN` | 川湘菜 | 单选 |
|  | `JIANG_ZHE` | 江浙菜 |
|  | `CANTONESE` | 粤菜 |
|  | `FUJIAN` | 闽菜 |
|  | `NORTHERN` | 北方菜 |
|  | `YUN_GUI` | 云贵菜 |
|  | `TAIWAN` | 台湾菜 |
|  | `FUSION` | 融合菜 |
|  | `OTHER` | 其他菜系（待人工确认） |
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
| `DISH_ROLE` | `MAIN` | 荤菜/主菜 | 单选 |
|  | `VEGETABLE` | 素菜 |
|  | `COLD_DISH` | 凉菜 |
|  | `SOUP` | 汤 |
|  | `STAPLE` | 主食 |
| `MAIN_PROTEIN_TYPE` | `PORK` | 猪肉 | 单选 |
|  | `CHICKEN` | 鸡肉 |
|  | `BEEF` | 牛肉 |
|  | `LAMB` | 羊肉 |
|  | `DUCK` | 鸭肉 |
|  | `FISH` | 鱼类 |
|  | `NONE` | 无主蛋白 |
| `FLAVOR_PROFILE` | `LIGHT` | 清淡 | 单选 |
|  | `MILD` | 温和 |
|  | `SPICY` | 辛辣 |
|  | `SOUR` | 酸味 |
|  | `SWEET` | 甜味 |
| `SPICE_LEVEL` | `NONE` | 不辣 | 单选 |
|  | `MILD` | 微辣 |
|  | `MEDIUM` | 中辣 |
|  | `HOT` | 重辣 |

标签规则：

- `MEAL_TYPE` 可多选且值不重复。按以下顺序判断：
  1. 来源明确只适合午餐时，只填 `LUNCH`；
  2. 来源明确只适合晚餐时，只填 `DINNER`；
  3. 来源没有明确餐次，或未强调餐次区分时，默认填 `LUNCH` 和 `DINNER`。
- 其他标签代码均单选；不确定时见第 6 节。
- 川/湘、江浙/淮扬、北方菜、云贵菜分别归入对应枚举；面食/米饭/粥归 `STAPLE_FOOD`，炖煮/焖/煲归 `STEW`，拌菜归 `COLD_DISH`，煎炸归 `FRIED`。`FUSION` 仅限明确融合菜，`OTHER` 待人工确认。
- `DISH_STYLE.COLD_DISH` 是成品形式，`DISH_ROLE.COLD_DISH` 是餐桌角色；`PRIMARY_INGREDIENT` 由食材派生，不导入。

## 4. 美食助理

原始步骤和助理步骤分开保存：

```text
recipe.content.steps  = 完整原始步骤
wiki.assistant.steps  = 整理后的执行流程
```

助理可以合并连续的重复动作，但不能修改食材、用量、顺序、等待节点或其他关键操作事实。

两类步骤图片和提示词也必须独立：`recipe.content.steps[].imagePrompt` 用于菜谱步骤图片；`wiki.assistant.steps[].imagePrompt` 用于做饭助理步骤图片。两者即使描述同一道菜，也不能互相复用或回退。

### 4.1 助理字段

| 字段 | 要求 |
| --- | --- |
| `order` | 从 1 开始递增 |
| `phase` | `PREP`、`COOK`、`SERVE` |
| `action` | 阶段内动作；不确定时使用 `OTHER` |
| `title` | 简短标题 |
| `detail` | 整理后的操作说明 |
| `imageUrl` | 字段必须出现；无图片时为 `null` |
| `imagePrompt` | 必填中文提示词；只描述该助理步骤对应的做饭助理步骤图片 |
| `durationMinutes` | 非 `SHOP` 步骤必填且为大于 `0` 的整数；`SHOP` 的取值待解析器与正式契约统一后确定，暂不作为最终依据 |
| `durationText` | 字段必须出现；普通步骤为展示文案，`SHOP` 填 `null` |

`content.duration` 的计入范围见 2.4；`durationMinutes` 与 `durationText` 必须表达同一步时长。`SHOP` 时长契约待统一。

### 4.2 做饭助理步骤图片提示词

`wiki.assistant.steps[].imagePrompt` 用于助理步骤图片，和 `imageUrl` 分开。同一菜谱内，每条提示词必须非空、中文且不重复；只依据当前 `phase / action / title / detail` 的明确事实生成，不写模型参数、URL 或内部 ID，也不复用原始步骤提示词。去重范围同 2.3。

### 4.3 阶段和动作枚举

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
| 非 `SEASONING` 模糊用量 | 不允许提交 | 保留来源原文，标记 `NEEDS_FIX` |
| 标签不确定 | 不作为可消费快照提交 | 保留候选标签，待审核确认 |
| `story / tips` 为空 | 不通过校验 | 可保存草稿并产生错误项，补全前不得发布 |
| `SHOP` 时长 | 暂不判定 | 待解析器与正式契约统一，暂不发布为最终 JSON |

## 7. 审核规则

- 全部导入项先审核；食材和单位须严格匹配。
- 不匹配或无依据的内容保留原值并人工确认；出现上述问题的草稿标记 `NEEDS_FIX`，不进入正式菜谱或可消费快照。
- 营养由后台按确认后的食材、数量和单位计算。

## 附录：内容转换写作规范

> 写作指导，不改变字段、枚举和校验规则；与正文冲突时以正文为准。

- `content` 保留来源事实，可整理、拆分、去重，不补数量、时间、温度、替代食材或功效。
- `wiki.assistant.steps` 按 `PREP → COOK → SERVE` 重组，只补可观察的完成状态，如“表面凝固”“汤汁收浓”，不补造事实。
- 句数、步骤数、字数等均为建议，不参与校验。
- 转换顺序：读来源 → 拆 `content.steps` → 建助理步骤 → 补判断标准 → 提取 `keywords / tags` → 写两类 `imagePrompt` → 校对草稿边界。
