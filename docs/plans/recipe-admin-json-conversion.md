# 菜谱导入 JSON 规范

> 版本：`recipe.import.v1` / `recipe.import.batch.v1`
> 用途：将来源菜谱转换为后台待审核系统项。

导入可混选 `.json` 与 `.zip`。单菜使用 `recipe.import.v1`；多菜使用一个 `recipe.import.batch.v1`，其中每个 `recipes[]` 元素都是完整的 `{ recipe, wiki }`，会展开为独立待审核项。ZIP 只允许 JSON 文件；单 JSON 不超过 10 MB，展开后最多 100 道菜、总 JSON 不超过 20 MB。

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
      "keywords": ["鲜香", "炖汤"],
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
          "text": "排骨冷水下锅焯水，撇去浮沫后捞出洗净。海带浸泡、清洗并切段。汤锅中加水，放入排骨和海带，大火煮开后转小火炖至排骨熟透，最后调味盛出。",
          "imageUrl": null,
          "imagePrompt": "家常中式厨房中，排骨和切段海带放入汤锅，加水后以大火煮开，锅内汤汁微沸并有少量浮沫，真实烹饪过程特写，不出现文字"
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

### 1.1 灵感分类 ID

`recipe.inspirationCategoryId` 填已确认 ID；无法确认填 `null`，不猜测。分类不替代 `wiki.tags`。

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
| `content.story` | 必填，保留来源故事或介绍；没有依据时待补全 |
| `content.baseServings` | 必填，正数 |
| `content.difficulty` | 必填，使用难度枚举 |
| `content.duration` | 必填，使用加热烹饪时长枚举；不表示从切配到出锅的全流程耗时 |
| `content.tips` | 必填字符串，格式见 2.5；没有依据时填空字符串，待补全 |
| `content.keywords` | 字段必须出现，正文关键词；用于前台展示、聚合和搜索 |
| `content.ingredients` | 必填，至少一条 |
| `content.tools` | 必填数组，尽量填写明确厨具；无法确认时使用 `[]`，不得填写猜测值 |
| `content.steps` | 必填，至少一条完整步骤 |

### 2.2 明细字段

| 字段 | 要求 |
| --- | --- |
| `content.keywords` | 中文数组，通常 3～6 项，最多 8 项；具体提取规则见下方；不写分类或结构化标签（如“川湘菜”“重辣”） |
| `ingredients[].name` | 来源食材名称 |
| `ingredients[].quantity / unit / fuzzyText` | 三个字段都必须出现；精确用量为“字符串数量 / 项目单位名称 / null”，模糊用量为“null / null / 适量” |
| `ingredients[].categoryCode` | 必填稳定分类代码；不写分类 ID 或 `UNCLASSIFIED` |
| `tools[].name` | 明确厨具；无依据填 `[]` |
| `steps[].text` | 按顺序拆分核心操作；不补造事实 |
| `steps[].imageUrl` | 必须出现；无图为 `null` |
| `steps[].imagePrompt` | 必填中文；只基于本步骤正文生成菜谱步骤图片 |

关键词提取规则：

- 关键词主体只从 `content.story`、`content.ingredients`、`content.steps` 提取。
- 不从 `content.name` 拆分关键词；菜名中的词只有同时在故事、食材或步骤中独立出现时，才可作为正文关键词。
- 完整菜名默认不纳入关键词；如确需保留，最多 1 项，且必须放在 `keywords` 数组最后。
- 顺序固定为：描述性关键词在前，完整菜名在最后。
- 不得写分类或结构化标签，如“川湘菜”“重辣”“下饭好菜”。
- 无可靠依据时填 `[]`。

食材分类代码固定为：`PRODUCE`（蔬果菌菇）、`MEAT_POULTRY_EGG`（肉禽蛋）、`SEAFOOD`（水产海鲜）、`SOY_DAIRY`（豆乳制品）、`GRAINS_STAPLES`（米面杂粮）、`SEASONING`（调味料）、`DRIED_PRESERVED`（干货腌制）、`BEVERAGE_ALCOHOL`（酒水饮料）。

分类判定：

`categoryCode` 是系统食材的稳定分类属性，不随单道菜谱中的用途、用量或角色变化。命中系统食材时，必须以系统食材当前分类为准。

未命中系统食材、需要给出分类建议时，按食材的稳定身份判断：

- `SEASONING`（调味料）：主要、稳定用途是赋味或增香，如盐、糖、酱油、醋、料酒、蚝油、豆瓣酱、番茄酱、八角、香叶、花椒、胡椒粉、十三香等。
- `DRIED_PRESERVED`（干货腌制）：食材身份主要由干燥、腌制、风干等加工形态形成，通常作为可食用材料使用，如干香菇、木耳、海米、虾皮、干辣椒、榨菜、酸菜、梅干菜、萝卜干等。
- 菜谱中的“主体/调味”属于菜谱食材关系，不通过 `categoryCode` 表达。
- 无法确定分类时，标记为需要人工确认；确认有效 `categoryCode` 后再生成或提交导入 JSON，不得填写 `UNCLASSIFIED` 或猜测。

辅助理解：用量较小、主要提供风味的食材通常接近 `SEASONING`；用量较大、作为可食用材料的干制或腌制食材通常接近 `DRIED_PRESERVED`，但该理解不作为最终判定规则。

用量规则：

- 精确用量：`quantity` 为大于 `0` 的数字字符串，`unit` 为项目单位名称，`fuzzyText` 必须为 `null`。
- 模糊用量：`quantity` 和 `unit` 必须为 `null`，`fuzzyText` 固定为 `"适量"`。
- 来源出现“少许”“几滴”“按需”等模糊表述时，统一归一化为 `fuzzyText: "适量"`，不得保留原词。
- `fuzzyText = "适量"` 仅允许 `categoryCode = "SEASONING"`；命中系统食材后以该食材当前分类为准，自填分类不能绕过限制。
- 非 `SEASONING` 食材出现“适量”“少许”等模糊表述时，不得写入 `fuzzyText`；只有来源明确给出大于 `0` 的数量和单位时才填写精确用量，否则进入人工确认，不得估算或擅自填写。
- 两种结构互斥；`fuzzyText` 只允许 `null` 或 `"适量"`，缺失、混填、“少许”或“按需”均不通过导入校验。
- 单位优先使用 `克`、`毫升`；可确定地将 `kg / 千克` 转为克、`L / 升` 转为毫升。“适量”不换算；`汤匙`保留原单位。

### 2.3 步骤图片提示词

`imagePrompt` 描述待生成画面，`imageUrl` 记录已有图片。同一菜谱内，每条原始步骤的提示词必须非空、中文且不重复；只写当前步骤有依据的操作、食材、工具和状态，不写模型参数、URL 或内部 ID。

### 2.4 加热烹饪时长估算

`content.duration` 只计从开始加热到最后一项加热完成的实际经过时间。包含灶台、烤箱、蒸箱、空气炸锅、压力锅等加热设备；不包含备菜等非加热操作。

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
- 无依据时写空字符串 `""`；该导入项待补全，不得猜写内容或直接发布。

```json
"tips": "茄子先腌透并挤水。\n醋一定最后放，更提香。\n建议现做现吃，放久会回软。"
```

## 3. 业务标签

`wiki` 是后台结构化资料层，供审核、匹配和检索使用，不直接透传前端。`wiki.tags` 按来源依据填写以下固定标签；导入时填写 `tagCode` 和 `tagValue`，不填写后台状态字段。`tagCode + tagValue` 是标签的文本稳定标识，不填写数字 ID。无法确认的标签进入人工确认，不得猜测。

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

- `MEAL_TYPE` 可多选且值不重复；优先填写最具代表性的餐次，只有来源明确说明或确实跨餐段通用时才多选，不默认同时写 `LUNCH`、`DINNER`。
- 其他标签代码均单选；不确定时进入人工确认。
- 川/湘、江浙/淮扬、北方菜、云贵菜分别归入对应枚举；面食/米饭/粥归 `STAPLE_FOOD`，炖煮/焖/煲归 `STEW`，拌菜归 `COLD_DISH`，煎炸归 `FRIED`。`FUSION` 仅限明确融合菜，`OTHER` 待人工确认。
- `DISH_STYLE.COLD_DISH` 是成品形式，`DISH_ROLE.COLD_DISH` 是餐桌角色；`PRIMARY_INGREDIENT` 由食材派生，不导入。

## 4. 美食助理

原始步骤和助理步骤分开保存：

```text
recipe.content.steps  = 完整原始步骤
wiki.assistant.steps  = 整理后的执行流程
```

助理可以合并啰嗦步骤，但不能修改食材、用量或关键操作事实。

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
| `durationMinutes` | 必填非负整数，单位为分钟；普通步骤为正整数，`SHOP` 填 `0` |
| `durationText` | 字段必须出现；普通步骤为展示文案，`SHOP` 填 `null` |

`content.duration` 的计入范围见 2.4；`durationMinutes` 与 `durationText` 表达同一步时长。`SHOP` 使用 `PREP`、`durationMinutes: 0`、`durationText: null`。

### 4.2 做饭助理步骤图片提示词

`wiki.assistant.steps[].imagePrompt` 用于助理步骤图片，和 `imageUrl` 分开。同一菜谱内，每条提示词必须非空、中文且不重复；只依据当前 `phase / action / title / detail` 的明确事实生成，不写模型参数、URL 或内部 ID，也不复用原始步骤提示词。

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

## 6. 审核规则

- 全部导入项先审核；食材和单位须严格匹配。
- 不匹配或无依据的内容保留原值并人工确认，不进入正式菜谱。
- 营养由后台按确认后的食材、数量和单位计算。
