# 菜谱导入 JSON 规范

> 版本：`recipe.import.v1`
> 用途：将其他来源的菜谱整理为统一 JSON，进入后台待审核系统项。

后台仅支持批量选择一个或多个 `.json` 文件导入；不支持 ZIP、Markdown 或 Excel 菜谱导入。每个 JSON 作为一个待审核系统项处理。

### 灵感分类 ID

`recipe.inspirationCategoryId` 使用系统灵感分类的稳定 ID。菜谱转 JSON 时，必须根据来源菜谱已经确认的分类写入下表中的 ID；JSON 不填写分类名称，也不使用临时编号或数据库自增占位值。

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

分类转换规则：

1. 转换前先依据来源内容确认菜谱所属分类，再写入对应的 `6001–6009`。
2. 分类名称与 ID 不一致、分类无法确认或来源没有足够依据时，不得猜测；保留为待人工审核项。
3. 导入服务会继续校验该 ID 是否对应当前有效的系统灵感分类；分类不存在、已下架或无权使用时，不能发布正式系统菜谱。
4. 分类 ID 只表示灵感检索分类，不替代 `wiki.tags` 中的菜系、菜式、餐次、菜品角色和风味标签。

## 1. 固定 JSON

除 `recipe.coverImageUrl` 外，本文列出的字段都必须出现。没有可靠依据的内容不得猜测或编造。

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
        { "name": "排骨", "quantity": "500", "unit": "克" },
        { "name": "海带", "quantity": "200", "unit": "克" }
      ],
      "tools": [
        { "name": "汤锅" }
      ],
      "steps": [
        {
          "text": "排骨冷水下锅焯水，撇去浮沫后捞出洗净。海带浸泡、清洗并切段。汤锅中加水，放入排骨和海带，大火煮开后转小火炖至排骨熟透，最后调味盛出。",
          "imageUrl": null
        }
      ]
    }
  },
  "wiki": {
    "tags": [
      { "tagCode": "CUISINE", "tagValue": "OTHER" },
      { "tagCode": "DISH_STYLE", "tagValue": "SOUP" },
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
          "title": "处理排骨和海带",
          "detail": "排骨焯水后洗净，海带浸泡、清洗并切段。",
          "imageUrl": null,
          "durationMinutes": 15,
          "durationText": "约 15 分钟"
        },
        {
          "order": 2,
          "phase": "COOK",
          "action": "SIMMER",
          "title": "炖煮排骨汤",
          "detail": "排骨和海带煮开后转小火，炖至排骨熟透。",
          "imageUrl": null,
          "durationMinutes": 60,
          "durationText": "约 60 分钟"
        },
        {
          "order": 3,
          "phase": "SERVE",
          "action": "PLATE",
          "title": "调味装盘",
          "detail": "调味后盛入汤碗。",
          "imageUrl": null,
          "durationMinutes": 5,
          "durationText": "约 5 分钟"
        }
      ]
    }
  }
}
```

## 2. 字段规则

### 2.1 菜谱字段

| 字段 | 要求 |
| --- | --- |
| `schemaVersion` | 固定为 `recipe.import.v1` |
| `recipe.inspirationCategoryId` | 必填，使用上方 `6001–6009` 中已确认的灵感分类 ID；无法确认、分类不存在或分类不可用时待人工审核 |
| `recipe.coverImageUrl` | 可省略；有可靠图片地址时填写 |
| `content.name` | 必填，保留来源菜名 |
| `content.story` | 必填，保留来源故事或介绍；没有依据时待补全 |
| `content.baseServings` | 必填，正数 |
| `content.difficulty` | 必填，使用难度枚举 |
| `content.duration` | 必填，使用烹饪操作时长枚举；不表示从切配到出锅的全流程耗时 |
| `content.tips` | 必填，保留来源提示；没有依据时待补全 |
| `content.keywords` | 必填，菜谱正文关键词；用于前台展示、聚合和搜索 |
| `content.ingredients` | 必填，至少一条 |
| `content.tools` | 必填数组，尽量填写明确厨具；无法确认时使用 `[]`，不得填写猜测值 |
| `content.steps` | 必填，至少一条完整步骤 |

### 2.2 正文关键词

`content.keywords` 属于菜谱正文版本，不属于 `wiki`。前台展示、关键词聚合和搜索均使用该字段；不得直接展示或透传原始 `wiki` 数据。

```json
"keywords": ["鲜香", "炖汤"]
```

规则：

1. 必须填写 1～8 个短词或短语，去除首尾空格后不得重复。
2. 依据菜名、介绍、食材、步骤和提示提取；没有可靠依据时待补全，不得编造。
3. 不把一级分类或固定结构化属性当作关键词。例如“家常便饭”“晚餐”“主菜”“川湘菜”“重辣”分别属于分类或结构化标签。
4. 关键词变更属于正文变更，发布后的修改创建新的正文版本。
5. JSON 只填写中文关键词文本，不填写关键词内部 ID、状态、来源或词库信息。

### 2.3 食材和单位

```json
{ "name": "排骨", "quantity": "500", "unit": "克" }
```

| 字段 | 要求 |
| --- | --- |
| `ingredients[].name` | 来源食材名称 |
| `ingredients[].quantity` | 数量，按字符串保存 |
| `ingredients[].unit` | 来源单位名称或归一化后的项目单位名称 |
| `tools[].name` | 厨具名称，不填写内部 ID |
| `steps[].text` | 完整原始步骤 |
| `steps[].imageUrl` | 字段必须出现；无图片时为 `null` |

### 2.4 工具填写

- 明确需要砂锅、蒸锅、烤箱等特殊工具时填写。
- 只写“锅中”时不得擅自改成砂锅或汤锅。
- 没有明确工具时使用 `[]`，不填写“普通厨具”等占位内容。
- 使用 `[]` 时，待审核系统项仍须保留来源文本中的工具描述，供审核员复核和匹配项目工具库。

### 2.5 步骤拆分原则

`content.steps` 的拆分属于整理来源内容，不涉及猜测，按以下原则执行。每条按操作顺序描述一个核心操作。

- 清洗、切配、焯水、烹饪、装盘等不同阶段拆分为独立步骤。
- 同阶段的连续操作可以合并，例如“土豆去皮切片，胡萝卜去皮切块”。
- 同阶段的连续操作可以合并，但建议单条步骤不超过 3 个连续动作。

## 3. 单位规范

| 场景 | 优先单位 | 项目单位名称 |
| --- | --- | --- |
| 固体、肉类、蔬菜、米面、粉末 | 克（`g`） | `克` |
| 汤汁、油、饮品 | 毫升（`ml`） | `毫升` |
| 膏状酱料（豆瓣酱、蚝油、番茄酱等） | 克（`g`） | `克` |
| 鸡蛋、蒜瓣、包装等 | 个、瓣、包、盒等 | 使用项目已有单位 |

规则：

1. 导入 JSON 优先使用项目正式单位名称 `克`、`毫升`。
2. 明确的 `kg / 千克` 可以按确定比例归一化为 `克`。
3. 明确的 `L / 升` 可以按确定比例归一化为 `毫升`。
4. `一把`、`适量`、`少许`、`一碗`、`一勺`等模糊表达不得擅自改成克或毫升。
5. 来源没有单位时，只有依据充分才能使用默认单位；否则待人工确认。
6. 严禁猜测、篡改或静默换算。
7. 来源明确使用“汤匙”表示酱料时，保留 `汤匙` 作为项目单位，不强制换算为克或毫升；转换时在后台审核备注中标注“来源为汤匙，未换算”。

## 4. 业务标签

`wiki` 是后台结构化资料层。`wiki.tags` 按来源依据填写以下固定标签；导入时填写 `tagCode` 和 `tagValue`，不填写后台状态字段。无法确认的标签进入人工确认，不得猜测。前台如需筛选，由后台按明确的消费字段提供，不直接透传 `wiki`。

| 标签代码 | 枚举值 | 中文展示 |
| --- | --- | --- |
| `CUISINE` | `SICHUAN_HUNAN` | 川湘菜 |
|  | `JIANG_ZHE` | 江浙菜 |
|  | `CANTONESE` | 粤菜 |
|  | `FUJIAN` | 闽菜 |
|  | `NORTHERN` | 北方菜 |
|  | `YUN_GUI` | 云贵菜 |
|  | `TAIWAN` | 台湾菜 |
|  | `FUSION` | 融合菜 |
|  | `OTHER` | 其他菜系（待人工确认） |
| `DISH_STYLE` | `STIR_FRY` | 炒菜 |
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
| `MEAL_TYPE` | `BREAKFAST` | 早餐 |
|  | `LUNCH` | 午餐 |
|  | `AFTERNOON_TEA` | 下午茶 |
|  | `DINNER` | 晚餐 |
|  | `LATE_NIGHT` | 夜宵 |
| `DISH_ROLE` | `MAIN` | 荤菜/主菜 |
|  | `VEGETABLE` | 素菜 |
|  | `COLD_DISH` | 凉菜 |
|  | `SOUP` | 汤 |
|  | `STAPLE` | 主食 |
| `MAIN_PROTEIN_TYPE` | `PORK` | 猪肉 |
|  | `CHICKEN` | 鸡肉 |
|  | `BEEF` | 牛肉 |
|  | `LAMB` | 羊肉 |
|  | `DUCK` | 鸭肉 |
|  | `FISH` | 鱼类 |
|  | `NONE` | 无主蛋白 |
| `FLAVOR_PROFILE` | `LIGHT` | 清淡 |
|  | `MILD` | 温和 |
|  | `SPICY` | 辛辣 |
|  | `SOUR` | 酸味 |
|  | `SWEET` | 甜味 |
| `SPICE_LEVEL` | `NONE` | 不辣 |
|  | `MILD` | 微辣 |
|  | `MEDIUM` | 中辣 |
|  | `HOT` | 重辣 |

菜系合并规则：

- 川菜、湘菜 → `SICHUAN_HUNAN`（川湘菜）。
- 江浙菜、淮扬菜 → `JIANG_ZHE`（江浙菜）。
- 鲁菜、京菜、豫菜、东北菜、西北菜 → `NORTHERN`（北方菜）。
- 云南菜、贵州菜 → `YUN_GUI`（云贵菜）。
- `FUSION` 仅用于明确的融合菜，不作为未知菜系的兜底值。
- `OTHER` 表示当前无法归入 V1 菜系枚举，进入人工确认，不作为正式公开标签。

菜式合并规则：

- 面食、米饭、粥、煲仔饭 → `STAPLE_FOOD`（主食）。
- 炖菜、煮菜、焖菜、煲类 → `STEW`（炖煮）。
- 拌菜 → `COLD_DISH`（凉菜）。
- 煎制、炸物 → `FRIED`（煎炸）。
- 红烧按成品归入 `STEW`（炖煮）或 `STIR_FRY`（炒菜），不单独设置枚举。

`CUISINE` 表示菜品的地域菜系归属；`DISH_STYLE` 表示成品的菜式、形态或主要烹饪方式；`DISH_ROLE` 表示菜谱在一桌饭菜中的功能角色，三者不互相替代。

示例：

- 麻婆豆腐：`CUISINE=SICHUAN_HUNAN`、`DISH_STYLE=STIR_FRY`、`DISH_ROLE=MAIN`。
- 清蒸鲈鱼：`CUISINE=CANTONESE`、`DISH_STYLE=STEAMED`、`DISH_ROLE=MAIN`。

示例仅用于说明标签关系，不表示同类菜谱都归入相同菜系。无明确菜系依据时使用 `OTHER`，进入人工确认。

`DISH_STYLE` 中的 `COLD_DISH` 表示凉拌、冷盘等成品形式；`DISH_ROLE` 中的 `COLD_DISH` 表示这道菜在一桌中的角色是凉菜。

`COLD_DISH` 可以正常导入和审核。当前随机一桌只消费已支持的主菜、素菜、汤和主食菜位，凉菜菜位列入后续版本；支持完成前，`COLD_DISH` 只用于分类、筛选和后台审核。

标签规则：

- 每个基础标签代码只填写一条；不同标签代码可组合使用，共同描述菜品特征；重复代码进入人工修正。
- 不确定的标签不要猜测，进入人工确认。
- `PRIMARY_INGREDIENT` 由匹配完成后的食材数据派生，不要求导入人员填写。

## 5. 美食助理

原始步骤和助理步骤分开保存：

```text
recipe.content.steps  = 完整原始步骤
wiki.assistant.steps  = 整理后的执行流程
```

助理可以合并啰嗦步骤，但不能修改食材、用量或关键操作事实。

### 5.1 助理字段

| 字段 | 要求 |
| --- | --- |
| `order` | 从 1 开始递增 |
| `phase` | `PREP`、`COOK`、`SERVE` |
| `action` | 阶段内动作；不确定时使用 `OTHER` |
| `title` | 简短标题 |
| `detail` | 整理后的操作说明 |
| `imageUrl` | 字段必须出现；无图片时为 `null` |
| `durationMinutes` | 必填非负整数，单位为分钟；普通步骤为正整数，`SHOP` 填 `0` |
| `durationText` | 字段必须出现；普通步骤为展示文案，`SHOP` 填 `null` |

`content.duration` 表示灶台烹饪阶段的总时长，包含煮、炒、蒸、炖等烹饪过程及其等待时间，不含备菜、腌制、浸泡等非烹饪操作。`story` 可以保留来源中的全流程耗时，例如“从切配到出锅大约一小时”，两者口径不同，不要求数值相等。`durationMinutes` 和 `durationText` 必须表达同一步的同一时长，只允许展示形式不同；后台计算只使用 `durationMinutes`，不解析 `durationText`。

采购不属于核心做饭阶段。有明确采购内容时使用一次 `phase: PREP`、`action: SHOP`，`durationMinutes` 填 `0`、`durationText` 填 `null`，不拆分采购流程。

### 5.2 阶段和动作枚举

| 阶段 | 动作枚举 | 中文展示 |
| --- | --- | --- |
| `PREP` | `SHOP` | 采购食材，一笔带过 |
| `PREP` | `WASH` | 清洗 |
| `PREP` | `SOAK` | 浸泡 |
| `PREP` | `THAW` | 解冻 |
| `PREP` | `CUT`、`SLICE`、`DICE`、`SHRED`、`MINCE` | 切配、切片、切丁、切丝、剁碎 |
| `PREP` | `MARINATE` | 腌制 |
| `PREP` | `BLANCH` | 焯水 |
| `PREP` | `MEASURE` | 称量或备料 |
| `PREP` | `MIX` | 混合搅拌 |
| `PREP` | `OTHER` | 其他备菜动作 |
| `COOK` | `BOIL` | 煮 |
| `COOK` | `SIMMER` | 炖煮或煨 |
| `COOK` | `STEAM` | 蒸 |
| `COOK` | `STIR_FRY` | 炒 |
| `COOK` | `PAN_FRY` | 煎 |
| `COOK` | `DEEP_FRY` | 炸 |
| `COOK` | `BRAISE` | 焖、卤或红烧 |
| `COOK` | `ROAST`、`BAKE` | 烤、烘焙 |
| `COOK` | `PRESSURE_COOK` | 高压烹饪 |
| `COOK` | `REDUCE` | 收汁 |
| `COOK` | `OTHER` | 其他烹饪动作 |
| `SERVE` | `SEASON` | 调味 |
| `SERVE` | `PLATE` | 装盘 |
| `SERVE` | `GARNISH` | 摆盘或点缀 |
| `SERVE` | `PORTION` | 分餐或分装 |
| `SERVE` | `REST` | 静置 |
| `SERVE` | `OTHER` | 其他收尾动作 |

`BRAISE` 涵盖焖、卤、红烧等调味烹制方式，V1 不再单独拆分枚举。

阶段明确但动作不明确时使用对应阶段的 `OTHER`；阶段本身不明确时进入人工确认，不使用 `UNKNOWN`。

### 5.3 PREP 时间估算参考

以下为单人家庭烹饪的估算参考，不是硬校验；实际时间按食材数量和复杂度填写。`SOAK`、`THAW`、`MARINATE` 可包含等待时间；`SHOP` 的 `durationMinutes` 为 `0`，不计入做饭总时长。无可靠来源时允许合理估算，估算依据记录在后台审核备注中，无需写入 JSON。

| `action` | 参考时间 | 中文说明 |
| --- | --- | --- |
| `WASH` | 2～10 分钟 | 清洗；肉类约 2～3 分钟，蔬菜约 5～8 分钟 |
| `CUT` / `SLICE` / `DICE` / `SHRED` / `MINCE` | 5～20 分钟 | 切段较快，切丝、剁碎较慢 |
| `SOAK` | 按实际需求 | 泡发约 15～30 分钟，过夜按实际等待时间填写 |
| `THAW` | 按实际需求 | 冷水解冻通常约 30 分钟，按食材大小调整 |
| `BLANCH` | 8～15 分钟 | 包含烧水、焯煮和捞出冲洗 |
| `MARINATE` | 按实际需求 | 快速腌制约 15 分钟，入味约 30～60 分钟 |
| `MEASURE` | 2～5 分钟 | 称量调味料、分装食材 |

## 6. 基础枚举

### 难度

| 枚举 | 中文展示 |
| --- | --- |
| `BEGINNER` | 新手友好 |
| `EASY` | 轻松上手 |
| `SKILLED` | 需要经验 |
| `CHALLENGING` | 进阶挑战 |

### 烹饪操作时长

| 枚举 | 中文展示 |
| --- | --- |
| `WITHIN_15` | 15 分钟内 |
| `BETWEEN_15_30` | 15～30 分钟 |
| `BETWEEN_30_60` | 30～60 分钟 |
| `OVER_60` | 1 小时以上 |

## 7. 审核规则

1. 所有导入内容先进入待审核系统项。
2. 食材和单位必须严格匹配项目现有主数据。
3. 不匹配、不明确或没有依据的内容保留原值并人工确认。
4. 审核前不进入正式系统菜谱或随机一桌。
5. 营养数据由后台根据匹配后的食材、数量和单位计算。
6. 基于来源和常识的合理估算，如助理步骤时长、确定性单位换算和份量推断，可以进入待审核，但必须在后台审核备注中记录依据；故事、提示等文案没有来源时不得编造。
