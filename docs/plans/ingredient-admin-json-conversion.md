# 食材转 JSON 规范

输入一个或多个食材名称，输出完整的 `ingredient.import.v1` JSON。命名结构参考 `recipe.import.v1`：根级使用 `schemaVersion`，食材内容放在 `ingredients` 数组中。只有一个食材时，数组也保留一项。

## 1. 固定 JSON

```json
{
  "schemaVersion": "ingredient.import.v1",
  "ingredients": [
    {
      "name": "土豆",
      "aliases": ["马铃薯", "洋芋"],
      "categoryCode": "PRODUCE",
      "defaultUnitName": "个",
      "proteinType": null,
      "isStaple": true,
      "isSpicyIngredient": false,
      "imageUrl": null,
      "nutrition": {
        "sourceVersion": "2026-08-22-primary-subset-v1",
        "foodCode": "021101",
        "foodName": "马铃薯[土豆、洋芋]",
        "matchType": "ALIAS",
        "confidence": 0.98,
        "conversions": [
          { "unitName": "个", "gramsPerUnit": 200 }
        ]
      }
    }
  ]
}
```

所有字段都必须出现；无法确定的可选事实使用 `null` 或 `[]`，不得猜测。

`ingredients` 数组内，所有正式名称和别名在去除首尾空白、统一大小写并移除空白后不得重复；正式名称也不能出现在自己的 `aliases` 中。

## 2. 字段说明

| 字段 | 说明 |
| --- | --- |
| `schemaVersion` | 固定为 `ingredient.import.v1`。 |
| `ingredients[].name` | 食材正式名称，例如“土豆”。 |
| `ingredients[].aliases` | 别名，例如“马铃薯”“洋芋”。 |
| `ingredients[].categoryCode` | 稳定分类，取值见下表。 |
| `ingredients[].defaultUnitName` | 默认单位，例如“个”“克”；无法确定时为 `null`。 |
| `ingredients[].proteinType` | 主蛋白类型，取值见下表，或为 `null`。 |
| `ingredients[].isStaple` | 是否主食。 |
| `ingredients[].isSpicyIngredient` | 是否为辣味驱动食材。 |
| `ingredients[].imageUrl` | 食材图片地址；没有时为 `null`。 |
| `ingredients[].nutrition` | 对应的营养食品数据；没有可靠对应项时为 `null`。 |
| `nutrition.sourceVersion` | 营养数据来源版本。 |
| `nutrition.foodCode` | 营养食品编码，例如 `021101`。 |
| `nutrition.foodName` | 营养库中的食品名称。 |
| `nutrition.matchType` | 营养食品对应方式，取值见下表。 |
| `nutrition.confidence` | 对应可信度，范围 `0~1`。 |
| `nutrition.conversions` | 非克单位的克数换算，例如 `1 个 = 200 克`。 |

## 3. 食材选取优先级

本规范优先用于常见食材的 JSON 转换，不追求一次覆盖完整的水果或食品百科。需要整理多个食材名称时，按以下顺序选择：

1. 优先常见的蔬菜、肉禽蛋、水产、豆乳制品、米面杂粮和常用调味料。
2. 其次选择日常较常见、且能用于做饭、饮品、小吃或烘焙的水果、干果和果脯。
3. 山竹、鳄梨、菠萝蜜等低频、地域性或特殊用途食材可以转换，但作为后续补充，不占用首批常见食材优先级。

多用途只能作为同一优先级内的排序依据，不能让低频食材超过高频基础食材。JSON 不新增“饮品食材”或“小吃食材”等分类，也不新增优先级字段；食材仍按自身类别填写 `categoryCode`，具体用途由菜谱表达。营养库用于补充营养关联，不作为食材清单的全量来源。

### 系统单位参考

`defaultUnitName` 和 `nutrition.conversions[].unitName` 只能填写以下系统单位名称，不填写单位 ID。`适量` 不是系统单位，不能作为这里的单位值。

| 类型 | 可用单位 |
| --- | --- |
| `WEIGHT` 重量 | `克`、`千克` |
| `VOLUME` 体积 | `毫升`、`升` |
| `COMMON` 通用 | `个`、`瓣`、`汤匙`、`片` |
| `PACKAGE` 包装 | `包`、`盒`、`瓶` |

默认单位和营养换算中的 `unitName` 必须从上表选择，例如：`"defaultUnitName": "克"`、`{ "unitName": "个", "gramsPerUnit": 200 }`。

### 固定值对照

| `categoryCode` | 中文 |
| --- | --- |
| `PRODUCE` | 蔬果菌菇 |
| `MEAT_POULTRY_EGG` | 肉禽蛋 |
| `SEAFOOD` | 水产海鲜 |
| `SOY_DAIRY` | 豆乳制品 |
| `GRAINS_STAPLES` | 米面杂粮 |
| `SEASONING` | 调味料 |
| `DRIED_PRESERVED` | 干货腌制 |
| `BEVERAGE_ALCOHOL` | 酒水饮料 |

| `proteinType` | 中文 |
| --- | --- |
| `PORK` | 猪 |
| `CHICKEN` | 鸡 |
| `BEEF` | 牛 |
| `LAMB` | 羊 |
| `DUCK` | 鸭 |
| `SEAFOOD` | 海鲜 |
| `EGG` | 鸡蛋 |
| `TOFU` | 豆腐 |
| `NONE` | 无 |

| `matchType` | 中文 |
| --- | --- |
| `EXACT_NAME` | 名称完全对应 |
| `ALIAS` | 别名对应 |
| `REPRESENTATIVE` | 代表值 |
| `LEAN_REPRESENTATIVE` | 瘦肉代表值 |
| `MANUAL` | 人工指定 |
| `REVIEW_NEEDED` | 待人工确认 |

## 4. 营养数据来源

- 来源：`Sanotsu/china-food-composition-data`。
- 当前版本：`2026-08-22-primary-subset-v1`。
- 项目数据文件：[food_composition_primary.csv](/Users/yangpenghui/personal/cook/apps/api/data/nutrition/food_composition_primary.csv)。
