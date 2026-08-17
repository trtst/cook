# 菜谱数据补全、营养分析与实施优先级规则

## 一、文档状态

本文是菜谱创建、导入、后台补全、营养分析与后续健康规划的当前确认稿。

当前结论：

1. 现有菜谱创建流程保持不变，不做大改。
2. 后续能力优先通过后台补全、派生计算和待确认机制接入，不扩大首屏录入负担。
3. 当前阶段只先落规则，不导入营养基础表；营养基础表的数据源、映射步骤和后续实施顺序先记入本文，等单独执行时再展开。

本文用于冻结规则边界，不自动代表 API、数据库或三端实现已完成。

## 二、现状确认

### 2.1 当前创建流程结论

当前菜谱创建流程已经符合“减少用户心智、先完成核心事实输入”的目标，能够支撑首版主链路：

```text
我的菜谱 -> 用餐计划 -> 购物清单 -> 下厨执行
```

### 2.2 当前阶段不改什么

当前阶段明确不做：

1. 不重做菜谱创建主流程。
2. 不把未来可能用到的字段平铺到首屏录入表单。
3. 不要求用户手填营养、健康标签、推荐标签。
4. 不把后台推断结果静默写成正文事实。
5. 不为导入能力提前增加录入负担。

## 三、用户输入边界

### 3.1 草稿最小必填

草稿最小必填仅保留：

1. `name`

### 3.2 发布必填

菜谱发布时必须具备：

1. `name`
2. `categoryId`
3. `baseServings`
4. `difficulty`
5. `duration`
6. 至少 1 条有效食材
7. 至少 1 条有效步骤

### 3.3 选填字段

以下字段允许用户按需填写，不作为发布前强制补齐项：

1. `story`
2. `sceneIds`
3. `tips`
4. `coverImage`
5. `steps[].image`

### 3.4 不要求用户输入的字段

以下字段不要求用户主动填写，由后台补全、推导或计算：

1. `estimatedCalories`
2. 营养素明细
3. `dishRoles`
4. `mealTypes`
5. `mainProteinType`
6. `primaryIngredientIds`
7. `flavorProfile`
8. `spiceLevel`
9. 过敏原提示
10. 健康标签
11. 数据完整度
12. 解析置信度

## 四、数据分层规则

### 4.1 正文字段

正文字段指用户明确输入并进入固定版本的事实数据。

正文事实包括：

1. `name`
2. `story`
3. `baseServings`
4. `difficulty`
5. `duration`
6. `tips`
7. `ingredients`
8. `steps`

正文事实规则：

1. 正文字段进入固定版本后，供计划、购物、分享、推荐、饭局等链路引用。
2. 食材事实以结构化 `ingredientId + amount` 为准。
3. 用量事实只允许两类：`EXACT` 与 `FUZZY`。
4. 后台不得用推断值静默覆盖正文事实。

### 4.2 派生字段

派生字段指后台根据正文、食材基表、单位换算、规则模型或算法生成的结果。

派生字段包括：

1. 热量
2. 蛋白质
3. 脂肪
4. 碳水
5. 纤维
6. 糖
7. 钠
8. 推荐标签
9. 健康标签
10. 完整度评分
11. 解析置信度

派生字段规则：

1. 派生字段可重算。
2. 派生字段不得反向覆盖正文事实。
3. 派生字段必须保留来源与生成时间。
4. 派生字段允许随着规则升级重新计算。

### 4.3 待确认字段

待确认字段指后台能够推断，但置信度不足，不应直接写死为正文或高可信派生事实。

待确认字段包括：

1. `mainProteinType`
2. `dishRoles`
3. `mealTypes`
4. `flavorProfile`
5. `spiceLevel`
6. 部分营养估算结果
7. 部分健康建议标签

待确认字段规则：

1. 必须带 `confidence`。
2. 必须支持 `needsReview` 标记。
3. 低置信度结果只允许提示或待确认，不得直接写入正文事实层。

## 五、导入缺失字段处理规则

### 5.1 直接拦截条件

导入数据出现以下情况时，直接拦截，不进入导入草稿：

1. 缺 `title`
2. `ingredients` 与 `steps` 同时为空

### 5.2 允许进入导入草稿但发布前必须补齐

以下字段允许缺失，但导入后必须在发布前补齐：

1. `baseServings`
2. `difficulty`
3. `duration`
4. `categoryId`

### 5.3 食材解析规则

食材导入处理按以下优先级执行：

1. 能映射到系统食材且单位可比较时，转为结构化 `EXACT`
2. 能识别食材但数量或单位不稳定时，保留原始输入并标记 `NEEDS_FIX`
3. 能识别模糊用量时，转为 `FUZZY`
4. 无法稳定识别食材时，保留原始行并标记 `NEEDS_FIX`

### 5.4 步骤解析规则

步骤导入处理规则：

1. 有文本则保留文本。
2. 只有图片可保留图片步骤。
3. 不自动补写用户未明确表达的关键烹饪动作。
4. 不静默改写关键时间、火候、顺序语义。

### 5.5 自动补全原则

导入后的自动补全只允许作用于以下领域：

1. 标签
2. 营养分析
3. 数据质量状态
4. 待确认建议

自动补全不得静默篡改以下正文核心事实：

1. 菜名
2. 关键食材
3. 关键步骤
4. 精确数量
5. 基准人数

## 六、营养分析最小字段集

### 6.1 最小输入

营养分析至少依赖以下输入：

1. `recipeVersionId`
2. `baseServings`
3. `ingredients[].ingredientId`
4. `ingredients[].amount.kind`
5. 若为 `EXACT`，则必须具备 `quantity + unitId`
6. 食材营养基表
7. 单位换算基线

### 6.2 最小输出

第一版营养分析最小输出包括：

1. `estimatedCalories`
2. `protein`
3. `fat`
4. `carbohydrate`
5. `fiber`
6. `sugar`
7. `sodium`

### 6.3 第一版前台展示

第一版详情页只展示：

1. 热量
2. 蛋白质
3. 脂肪
4. 碳水

### 6.4 建议附带输出

建议同时输出以下辅助字段：

1. `perRecipe`
2. `perServing`
3. `coverageRate`
4. `ignoredIngredientCount`
5. `confidence`

### 6.5 降级规则

存在模糊用量时，营养分析执行以下降级策略：

1. 允许输出估算值。
2. 必须降低 `confidence`。
3. 必须标明存在未精确覆盖的食材项。
4. 不得把估算结果声明为精确营养事实。

### 6.6 前台文案口径

`coverageRate` 不直接对用户展示数字，前台只展示三档文案：

1. `估算较完整`
2. `结果为估算`
3. `当前数据不足`

## 七、营养基表最小范围与后续步骤

### 7.1 当前阶段结论

当前阶段先确认营养基表的存在、边界和后续实施步骤，不导入正式营养基表数据，不新增当前代码实现。

### 7.2 第一版营养基表覆盖原则

第一版营养基表只覆盖：

1. 高频系统食材
2. 可稳定换算的单位
3. 家常菜高频营养分析场景
4. 能支撑当前计划/购物主链路的食材

### 7.3 第一版营养字段

每个可计算食材至少支持：

1. `calories`
2. `protein`
3. `fat`
4. `carbohydrate`
5. `fiber`
6. `sugar`
7. `sodium`

### 7.4 单位策略

第一版优先支持：

1. `WEIGHT`
2. `VOLUME`
3. `COMMON`
4. `PACKAGE`

规则：

1. `克 / 千克` 直接换算。
2. `毫升 / 升` 只给液态食材和明确密度项换算。
3. `个 / 瓣` 只对已定义标准重量的食材换算。
4. `包 / 盒 / 瓶 / 罐` 只对已定义标准净含量的食材换算。

### 7.5 实施步骤

后续正式推进营养基表时，按以下顺序执行：

1. 选定高频系统食材覆盖清单。
2. 建立食材营养基表落库结构。
3. 建立 `ingredientId -> nutrientFoodId` 映射。
4. 建立常用单位与包装单位标准换算表。
5. 按 `recipeVersionId` 生成并保存营养分析结果。
6. 再接菜谱详情页展示与健康规划。

### 7.6 参考数据源

当前已确认可作为后续营养基表底稿参考的数据源：

1. 中国食物成分表 JSON 整理仓库：仅作为结构化底稿和映射参考，不视为当前阶段已导入生产真值。

## 八、后台补全与质量状态

后台补全结果统一建议带以下元数据：

1. `completionStatus`
2. `missingFields`
3. `confidence`
4. `needsReview`
5. `generatedBy`
6. `generatedAt`
7. `parseVersion`

质量状态规则：

1. 质量状态不进入正文事实层。
2. 质量状态服务于导入校对、后台治理、营养分析、健康规划与推荐质量控制。
3. 后续规则升级时，允许基于 `parseVersion` 做批量重算或重新标记。

## 九、认真填写的用户收益

产品不通过增加表单负担来奖励认真填写的用户，而通过结果质量回报用户。

用户认真填写的收益包括：

1. 精确用量越多，营养分析越准。
2. 结构化食材越稳，购物清单越准。
3. 时长与难度越完整，推荐越准。
4. 标签越稳定，随机推荐与健康规划越准。
5. 导入后的修正越完整，后续复用价值越高。

## 十、实施优先级

| 优先级 | 事项 | 价值 | 实现复杂度 | 是否影响现有契约 | 当前建议 |
| --- | --- | --- | --- | --- | --- |
| P0 | 菜谱数据补全与营养规划规则入档 | 高 | 低 | 高 | 先确认再入档 |
| P0 | 10 条标准样例 JSON 沉淀 | 高 | 低 | 中 | 作为规则附录 |
| P0 | 食材营养基表基线 | 高 | 中 | 高 | 先定义覆盖范围 |
| P0 | 单位换算基线 | 高 | 中 | 高 | 先定规则，不先实现 |
| P0 | 后台补全与质量状态模型 | 高 | 中 | 高 | 先建规则，不急实现 |
| P1 | 网页菜谱导入到导入草稿 | 高 | 中 | 中 | 先导入草稿，不直发 |
| P1 | 导入校对工作台 | 高 | 中 | 中 | 支撑补齐缺失字段 |
| P1 | 导入发布链路 | 高 | 中 | 高 | 与固定版本规则对齐 |
| P2 | 菜谱详情页营养展示 | 高 | 中 | 中 | 先做每份/整份 |
| P2 | 营养覆盖率与缺失提示 | 中高 | 中 | 中 | 与详情营养一起上 |
| P3 | 规则型健康目标 | 高 | 高 | 高 | 先筛选，不先重规划 |
| P3 | 轻约束饮食规划 | 高 | 高 | 高 | 后接计划链路 |
| P3 | 计划与健康筛选联动 | 中高 | 高 | 高 | 等营养基线稳定后做 |
| P4 | 零售配送对接 | 中高 | 很高 | 很高 | 后置 |
| P4 | AI 多模态 / OCR / 语音 | 中 | 很高 | 很高 | 明确后置 |
| P4 | 厨电联动 | 中 | 很高 | 很高 | 不提前开 |

## 十一、待确认项

以下事项当前默认按本稿建议执行；真正进入实现前，如遇实际约束或契约冲突，再针对具体项复核：

1. `estimatedCalories` 是否只保留在派生层，不作为正文事实字段对外宣称保真。
2. 版本级标签是否与正文一同返回，还是独立挂在分析块返回。
3. 健康标签第一版是否只读，不允许用户直接编辑。
4. 导入校对页是否允许一次性补齐 `baseServings / difficulty / duration / categoryId`。
5. 后台补全产生的低置信度标签，是否需要统一人工确认入口。

## 附录 A：标准 JSON 样例

以下样例统一只表达正文事实，不包含派生营养、健康标签、置信度等后台补全字段。

### A.1 家常快手菜：西红柿炒鸡蛋

```json
{
  "name": "西红柿炒鸡蛋",
  "categoryId": "cat-home",
  "sceneIds": [],
  "baseServings": 2,
  "difficulty": "EASY",
  "duration": "WITHIN_15",
  "story": null,
  "tips": "先炒鸡蛋再回锅，口感更嫩。",
  "ingredients": [
    {
      "ingredientId": "ing-tomato",
      "amount": { "kind": "EXACT", "quantity": "2", "unitId": "unit-ge" }
    },
    {
      "ingredientId": "ing-egg",
      "amount": { "kind": "EXACT", "quantity": "3", "unitId": "unit-ge" }
    },
    {
      "ingredientId": "ing-salt",
      "amount": { "kind": "FUZZY", "text": "少许" }
    }
  ],
  "steps": [
    { "text": "鸡蛋打散，热锅下油炒至凝固后盛出。", "imageUrl": null },
    { "text": "番茄下锅翻炒出汁，再倒回鸡蛋炒匀。", "imageUrl": null }
  ]
}
```

### A.2 汤类：紫菜蛋花汤

```json
{
  "name": "紫菜蛋花汤",
  "categoryId": "cat-home",
  "sceneIds": ["scene-dinner"],
  "baseServings": 3,
  "difficulty": "BEGINNER",
  "duration": "WITHIN_15",
  "story": null,
  "tips": null,
  "ingredients": [
    {
      "ingredientId": "ing-laver",
      "amount": { "kind": "EXACT", "quantity": "1", "unitId": "unit-bao" }
    },
    {
      "ingredientId": "ing-egg",
      "amount": { "kind": "EXACT", "quantity": "2", "unitId": "unit-ge" }
    },
    {
      "ingredientId": "ing-sesame-oil",
      "amount": { "kind": "FUZZY", "text": "按需" }
    }
  ],
  "steps": [
    { "text": "锅中水烧开后放入紫菜。", "imageUrl": null },
    { "text": "淋入蛋液，待蛋花成型后调味出锅。", "imageUrl": null }
  ]
}
```

### A.3 早餐：燕麦酸奶杯

```json
{
  "name": "燕麦酸奶杯",
  "categoryId": "cat-breakfast",
  "sceneIds": ["scene-breakfast", "scene-light"],
  "baseServings": 1,
  "difficulty": "BEGINNER",
  "duration": "WITHIN_15",
  "story": null,
  "tips": "水果可按季节替换。",
  "ingredients": [
    {
      "ingredientId": "ing-oats",
      "amount": { "kind": "EXACT", "quantity": "40", "unitId": "unit-g" }
    },
    {
      "ingredientId": "ing-yogurt",
      "amount": { "kind": "EXACT", "quantity": "200", "unitId": "unit-ml" }
    },
    {
      "ingredientId": "ing-blueberry",
      "amount": { "kind": "EXACT", "quantity": "30", "unitId": "unit-g" }
    }
  ],
  "steps": [
    { "text": "杯中依次放入燕麦、酸奶和蓝莓。", "imageUrl": null }
  ]
}
```

### A.4 清淡菜：清炒上海青

```json
{
  "name": "清炒上海青",
  "categoryId": "cat-home",
  "sceneIds": ["scene-light"],
  "baseServings": 2,
  "difficulty": "BEGINNER",
  "duration": "WITHIN_15",
  "story": null,
  "tips": "大火快炒，避免出水过多。",
  "ingredients": [
    {
      "ingredientId": "ing-bokchoy",
      "amount": { "kind": "EXACT", "quantity": "300", "unitId": "unit-g" }
    },
    {
      "ingredientId": "ing-garlic",
      "amount": { "kind": "EXACT", "quantity": "2", "unitId": "unit-ban" }
    },
    {
      "ingredientId": "ing-salt",
      "amount": { "kind": "FUZZY", "text": "少许" }
    }
  ],
  "steps": [
    { "text": "蒜瓣拍碎，热锅下油炒香。", "imageUrl": null },
    { "text": "放入上海青快速翻炒至断生后调味。", "imageUrl": null }
  ]
}
```

### A.5 重口味菜：麻婆豆腐

```json
{
  "name": "麻婆豆腐",
  "categoryId": "cat-home",
  "sceneIds": [],
  "baseServings": 3,
  "difficulty": "SKILLED",
  "duration": "BETWEEN_15_30",
  "story": null,
  "tips": "豆腐先焯水更不易碎。",
  "ingredients": [
    {
      "ingredientId": "ing-tofu",
      "amount": { "kind": "EXACT", "quantity": "1", "unitId": "unit-he" }
    },
    {
      "ingredientId": "ing-minced-pork",
      "amount": { "kind": "EXACT", "quantity": "100", "unitId": "unit-g" }
    },
    {
      "ingredientId": "ing-chili-bean-paste",
      "amount": { "kind": "EXACT", "quantity": "1", "unitId": "unit-tablespoon" }
    }
  ],
  "steps": [
    { "text": "肉末下锅炒散，再加入豆瓣酱炒出红油。", "imageUrl": null },
    { "text": "放入豆腐轻推焖煮，最后勾芡收汁。", "imageUrl": null }
  ]
}
```

### A.6 炖煮长时菜：土豆炖牛腩

```json
{
  "name": "土豆炖牛腩",
  "categoryId": "cat-home",
  "sceneIds": ["scene-weekend"],
  "baseServings": 4,
  "difficulty": "SKILLED",
  "duration": "OVER_60",
  "story": "周末常做的一锅菜。",
  "tips": "牛腩先焯水再炖，汤底更清爽。",
  "ingredients": [
    {
      "ingredientId": "ing-beef-brisket",
      "amount": { "kind": "EXACT", "quantity": "500", "unitId": "unit-g" }
    },
    {
      "ingredientId": "ing-potato",
      "amount": { "kind": "EXACT", "quantity": "2", "unitId": "unit-ge" }
    },
    {
      "ingredientId": "ing-ginger",
      "amount": { "kind": "EXACT", "quantity": "3", "unitId": "unit-ban" }
    }
  ],
  "steps": [
    { "text": "牛腩切块焯水，洗净备用。", "imageUrl": null },
    { "text": "牛腩加姜片和清水炖煮至软烂。", "imageUrl": null },
    { "text": "加入土豆继续炖至入味。", "imageUrl": null }
  ]
}
```

### A.7 包装单位：可乐鸡翅

```json
{
  "name": "可乐鸡翅",
  "categoryId": "cat-home",
  "sceneIds": ["scene-family"],
  "baseServings": 3,
  "difficulty": "EASY",
  "duration": "BETWEEN_15_30",
  "story": null,
  "tips": "收汁阶段注意观察，避免过甜发苦。",
  "ingredients": [
    {
      "ingredientId": "ing-chicken-wing",
      "amount": { "kind": "EXACT", "quantity": "500", "unitId": "unit-g" }
    },
    {
      "ingredientId": "ing-cola",
      "amount": { "kind": "EXACT", "quantity": "1", "unitId": "unit-ping" }
    },
    {
      "ingredientId": "ing-soy-sauce",
      "amount": { "kind": "EXACT", "quantity": "1", "unitId": "unit-tablespoon" }
    }
  ],
  "steps": [
    { "text": "鸡翅煎至两面微黄。", "imageUrl": null },
    { "text": "加入可乐和生抽焖煮，最后收汁。", "imageUrl": null }
  ]
}
```

### A.8 模糊用量：凉拌黄瓜

```json
{
  "name": "凉拌黄瓜",
  "categoryId": "cat-home",
  "sceneIds": ["scene-light"],
  "baseServings": 2,
  "difficulty": "BEGINNER",
  "duration": "WITHIN_15",
  "story": null,
  "tips": null,
  "ingredients": [
    {
      "ingredientId": "ing-cucumber",
      "amount": { "kind": "EXACT", "quantity": "2", "unitId": "unit-ge" }
    },
    {
      "ingredientId": "ing-garlic",
      "amount": { "kind": "EXACT", "quantity": "3", "unitId": "unit-ban" }
    },
    {
      "ingredientId": "ing-vinegar",
      "amount": { "kind": "FUZZY", "text": "适量" }
    },
    {
      "ingredientId": "ing-chili-oil",
      "amount": { "kind": "FUZZY", "text": "按需" }
    }
  ],
  "steps": [
    { "text": "黄瓜拍碎切段。", "imageUrl": null },
    { "text": "加入蒜末和调味料拌匀即可。", "imageUrl": null }
  ]
}
```

### A.9 多步骤图文组合：香煎三文鱼

```json
{
  "name": "香煎三文鱼",
  "categoryId": "cat-home",
  "sceneIds": ["scene-light", "scene-dinner"],
  "baseServings": 2,
  "difficulty": "EASY",
  "duration": "BETWEEN_15_30",
  "story": null,
  "tips": "先煎带皮面更容易定型。",
  "ingredients": [
    {
      "ingredientId": "ing-salmon",
      "amount": { "kind": "EXACT", "quantity": "250", "unitId": "unit-g" }
    },
    {
      "ingredientId": "ing-black-pepper",
      "amount": { "kind": "FUZZY", "text": "按需" }
    }
  ],
  "steps": [
    {
      "text": "三文鱼擦干表面水分，撒黑胡椒静置。",
      "imageUrl": "https://example.com/recipe-step/salmon-1.jpg"
    },
    {
      "text": "平底锅中火煎带皮面至金黄。",
      "imageUrl": "https://example.com/recipe-step/salmon-2.jpg"
    },
    {
      "text": "翻面继续煎熟后出锅。",
      "imageUrl": null
    }
  ]
}
```

### A.10 缺字段导入草稿：待补全网页导入示例

```json
{
  "name": "红烧鸡翅（网页导入草稿）",
  "categoryId": null,
  "sceneIds": [],
  "baseServings": null,
  "difficulty": null,
  "duration": null,
  "story": null,
  "tips": null,
  "ingredients": [
    {
      "ingredientId": "ing-chicken-wing",
      "amount": { "kind": "EXACT", "quantity": "500", "unitId": "unit-g" }
    },
    {
      "ingredientId": "ing-soy-sauce",
      "amount": { "kind": "FUZZY", "text": "适量" }
    },
    {
      "ingredientId": "ing-rock-sugar",
      "amount": { "kind": "FUZZY", "text": "少许" }
    }
  ],
  "steps": [
    { "text": "鸡翅焯水后煎至表面微黄。", "imageUrl": null },
    { "text": "加入调料焖煮收汁。", "imageUrl": null }
  ]
}
```
