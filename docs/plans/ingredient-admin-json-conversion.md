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

所有字段都必须出现；无法确定的可选事实使用 `null` 或 `[]`，不得猜测。`isStaple` 和 `isSpicyIngredient` 是必填布尔属性，转换时必须逐项判断并填写 `true` 或 `false`，不能漏掉，也不能统一默认 `false`。

这两个属性描述食材本身，不描述它在某道菜中的主料、辅料或调味角色：`isStaple` 表示是否属于日常主食类食材（如米、面、薯类）；`isSpicyIngredient` 表示是否主要提供辣味（如辣椒及辣椒制品）。不符合对应定义时填 `false`。

`categoryCode`、`isStaple` 和菜谱内的 `recipeRole` 互不替代。`isStaple: true` 不代表 `categoryCode` 必须是 `GRAINS_STAPLES`；一道菜里承担调味作用，也不代表食材主分类必须是 `SEASONING`。例如当前系统种子数据中的干辣椒分类为 `DRIED_PRESERVED`，在具体菜谱中仍可标注 `recipeRole: SEASONING`。已有系统食材必须沿用目标环境中的当前分类；不要根据单道菜谱用途或主食属性改动系统分类。

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
| `ingredients[].isStaple` | 必填布尔值；是否属于米、面、薯类等主食食材，不等于“在某道菜里是主料”。 |
| `ingredients[].isSpicyIngredient` | 必填布尔值；是否主要提供辣味，如辣椒及辣椒制品。 |
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
| `FISH` | 鱼类 |
| `SEAFOOD` | 非鱼类水产 |
| `EGG` | 鸡蛋 |
| `PLANT` | 植物蛋白 |
| `NONE` | 当前枚举中无对应主蛋白类型 |

`proteinType: null` 表示尚未判断或没有可靠依据；`NONE` 表示已判断，但不属于当前支持的主蛋白类型。`NONE` 不表示该食材营养中完全没有蛋白质。鱼类统一使用 `FISH`，虾、蟹、贝等非鱼类水产统一使用 `SEAFOOD`；不使用 `OTHER`。植物蛋白使用 `PLANT`，不使用 `TOFU`。

本表描述正常 JSON 转换时的输入要求：来源不可靠的事实仍填 `null`，不得为了凑齐字段猜测。系统食材存量治理可以另行运行有版本记录的规则回填；回填产生的每条推测必须保存食材 ID、字段、旧值、新值和判断依据，不能把推测伪装成来源确认值。

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

## 5. TEST 与线上系统食材存量修复

2026-10-13 已在线上执行一次性存量修复：预览为 991 条系统食材、847 个字段变更和 4 条精确营养映射；按已审阅报告提交后，事务成功并创建 4 条营养映射。执行后的只读预览显示 `changedIngredientCount / changeCount / exactNutritionCandidates` 均为 0。执行报告与复核报告已归档到服务器 `/srv/cook/.run-logs/`。

同日恢复本机 TEST API 后，先执行只读复核：目标为 `SYSTEM_DATA_ENVIRONMENT=TEST`，共 996 条系统食材，属性回填 `changedIngredientCount / changeCount / exactNutritionCandidates` 均为 0，因此未重复执行属性写入。随后通过一次性事务脚本移除 17 个与其他系统食材正式名称冲突的别名，涉及 14 条 ACTIVE 食材；再将 7 组已有明确别名关系的重复 ACTIVE 食材软归并到保留营养映射或既有主档的一侧，并清理 6 条零引用 PENDING 与 3 条零引用 DISABLED 冲突记录。归并按领域规则保留来源身份、固定菜谱版本和营养映射，只迁移可变购物引用；所有写入递增版本并记录 SYSTEM 审计。最终 TEST 有 987 条系统食材：ACTIVE 914、MERGED 7、PENDING 64、DISABLED 2。全库规范化名称/别名冲突、记录内别名重复、自身名称混入别名、searchKey 不一致均为 0；ACTIVE 食材缺分类、缺默认单位、proteinType 未判断均为 0。剩余 64 条 PENDING 是无冲突、字段齐全的待审核记录，不自动转为 ACTIVE；2 条 DISABLED 保留为无冲突下架记录。一次性维护脚本已从本地仓库移除。

同日完成线上名称/别名冲突治理：将 8 条重复 ACTIVE 系统食材按既定主档软归并（含“牛里脊肉”归并到“牛里脊”），删除 6 条零引用 PENDING 重复记录，并清理 14 条 ACTIVE 食材上的冲突/错误别名。最终线上共 985 条系统食材：ACTIVE 913、MERGED 8、PENDING 64、DISABLED 0；字段缺失和 searchKey 不一致均为 0，重复名称检查为空。审计仍报告 8 组历史名称碰撞，每组均为 MERGED 来源名称与 ACTIVE 主档保留的同名别名，符合“归并来源保留历史搜索入口”的规则，不属于待处理的 ACTIVE 重复。完整审计归档于服务器 `/srv/cook/.run-logs/ingredient-online-post-repair-20261013.json`，一次性线上审计和修复脚本已删除。
