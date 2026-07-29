import { PrismaClient, type EntitlementTier, type UnitType } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { hashPassword } from "../src/common/security/password";
import { buildSearchKey } from "../src/modules/recipe/recipe-content";

loadLocalEnv();

const prisma = new PrismaClient();

type SystemUnitSeed = {
  id: string;
  name: string;
  type: UnitType;
};

type SystemCategorySeed = {
  id: string;
  code: string;
  name: string;
  isSelectable: boolean;
  sortOrder: number;
};

type SystemIngredientSeed = {
  id: string;
  name: string;
  categoryName: string;
  defaultUnitName: string;
};

const defaultSystemUnits: SystemUnitSeed[] = [
  { id: "30000000-0000-4000-8000-000000000001", name: "克", type: "WEIGHT" },
  { id: "30000000-0000-4000-8000-000000000002", name: "千克", type: "WEIGHT" },
  { id: "30000000-0000-4000-8000-000000000003", name: "斤", type: "WEIGHT" },
  { id: "30000000-0000-4000-8000-000000000004", name: "两", type: "WEIGHT" },
  { id: "30000000-0000-4000-8000-000000000005", name: "毫升", type: "VOLUME" },
  { id: "30000000-0000-4000-8000-000000000006", name: "升", type: "VOLUME" },
  { id: "30000000-0000-4000-8000-000000000007", name: "个", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000008", name: "只", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000009", name: "颗", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000010", name: "根", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000011", name: "块", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000012", name: "片", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000013", name: "把", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000014", name: "瓣", type: "SHAPE" },
  { id: "30000000-0000-4000-8000-000000000015", name: "段", type: "SHAPE" },
  { id: "30000000-0000-4000-8000-000000000016", name: "撮", type: "SHAPE" },
  { id: "30000000-0000-4000-8000-000000000017", name: "勺", type: "CONTAINER" },
  { id: "30000000-0000-4000-8000-000000000018", name: "汤匙", type: "CONTAINER" },
  { id: "30000000-0000-4000-8000-000000000019", name: "茶匙", type: "CONTAINER" },
  { id: "30000000-0000-4000-8000-000000000020", name: "碗", type: "CONTAINER" },
  { id: "30000000-0000-4000-8000-000000000021", name: "杯", type: "CONTAINER" },
  { id: "30000000-0000-4000-8000-000000000022", name: "袋", type: "PACKAGE" },
  { id: "30000000-0000-4000-8000-000000000023", name: "包", type: "PACKAGE" },
  { id: "30000000-0000-4000-8000-000000000024", name: "盒", type: "PACKAGE" },
  { id: "30000000-0000-4000-8000-000000000025", name: "瓶", type: "PACKAGE" },
  { id: "30000000-0000-4000-8000-000000000026", name: "罐", type: "PACKAGE" },
  { id: "30000000-0000-4000-8000-000000000027", name: "份", type: "OTHER" },
  { id: "30000000-0000-4000-8000-000000000028", name: "条", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000029", name: "张", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000030", name: "节", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000031", name: "朵", type: "COUNT" },
  { id: "30000000-0000-4000-8000-000000000032", name: "串", type: "COUNT" }
];

const defaultSystemCategories: SystemCategorySeed[] = [
  { id: "50000000-0000-4000-8000-000000000001", code: "PRODUCE", name: "蔬果菌菇", isSelectable: true, sortOrder: 0 },
  { id: "50000000-0000-4000-8000-000000000002", code: "MEAT_POULTRY_EGG", name: "肉禽蛋", isSelectable: true, sortOrder: 1 },
  { id: "50000000-0000-4000-8000-000000000003", code: "SEAFOOD", name: "水产海鲜", isSelectable: true, sortOrder: 2 },
  { id: "50000000-0000-4000-8000-000000000004", code: "SOY_DAIRY", name: "豆乳制品", isSelectable: true, sortOrder: 3 },
  { id: "50000000-0000-4000-8000-000000000005", code: "GRAINS_STAPLES", name: "米面杂粮", isSelectable: true, sortOrder: 4 },
  { id: "50000000-0000-4000-8000-000000000006", code: "SEASONING", name: "调味料", isSelectable: true, sortOrder: 5 },
  { id: "50000000-0000-4000-8000-000000000007", code: "DRIED_PRESERVED", name: "干货腌制", isSelectable: true, sortOrder: 6 },
  { id: "50000000-0000-4000-8000-000000000008", code: "BEVERAGE_ALCOHOL", name: "酒水饮料", isSelectable: true, sortOrder: 7 },
  { id: "50000000-0000-4000-8000-000000000009", code: "UNCLASSIFIED", name: "待归类", isSelectable: false, sortOrder: 8 }
];

const legacyCategoryNameMap = new Map<string, string>([
  ["蔬菜", "蔬果菌菇"],
  ["水果", "蔬果菌菇"],
  ["肉类", "肉禽蛋"],
  ["主食干货", "米面杂粮"],
  ["调味酱料", "调味料"],
  ["冷冻食品", "待归类"],
  ["其他", "待归类"]
]);

const defaultSystemIngredients: SystemIngredientSeed[] = [
  { id: "40000000-0000-4000-8000-000000000001", name: "番茄", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000002", name: "鸡蛋", categoryName: "肉禽蛋", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000003", name: "土豆", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000004", name: "牛肉", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000005", name: "青椒", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000006", name: "里脊肉", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000007", name: "白菜", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000008", name: "菠菜", categoryName: "蔬果菌菇", defaultUnitName: "把" },
  { id: "40000000-0000-4000-8000-000000000009", name: "生菜", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000010", name: "黄瓜", categoryName: "蔬果菌菇", defaultUnitName: "根" },
  { id: "40000000-0000-4000-8000-000000000011", name: "胡萝卜", categoryName: "蔬果菌菇", defaultUnitName: "根" },
  { id: "40000000-0000-4000-8000-000000000012", name: "茄子", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000013", name: "西兰花", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000014", name: "洋葱", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000015", name: "大葱", categoryName: "蔬果菌菇", defaultUnitName: "根" },
  { id: "40000000-0000-4000-8000-000000000016", name: "生姜", categoryName: "蔬果菌菇", defaultUnitName: "块" },
  { id: "40000000-0000-4000-8000-000000000017", name: "大蒜", categoryName: "蔬果菌菇", defaultUnitName: "瓣" },
  { id: "40000000-0000-4000-8000-000000000018", name: "香菇", categoryName: "蔬果菌菇", defaultUnitName: "朵" },
  { id: "40000000-0000-4000-8000-000000000019", name: "金针菇", categoryName: "蔬果菌菇", defaultUnitName: "把" },
  { id: "40000000-0000-4000-8000-000000000020", name: "莲藕", categoryName: "蔬果菌菇", defaultUnitName: "节" },
  { id: "40000000-0000-4000-8000-000000000021", name: "南瓜", categoryName: "蔬果菌菇", defaultUnitName: "块" },
  { id: "40000000-0000-4000-8000-000000000022", name: "猪肉", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000023", name: "鸡肉", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000024", name: "鸭肉", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000025", name: "排骨", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000026", name: "鸡翅", categoryName: "肉禽蛋", defaultUnitName: "只" },
  { id: "40000000-0000-4000-8000-000000000027", name: "鸡腿", categoryName: "肉禽蛋", defaultUnitName: "只" },
  { id: "40000000-0000-4000-8000-000000000028", name: "五花肉", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000029", name: "鲈鱼", categoryName: "水产海鲜", defaultUnitName: "条" },
  { id: "40000000-0000-4000-8000-000000000030", name: "草鱼", categoryName: "水产海鲜", defaultUnitName: "条" },
  { id: "40000000-0000-4000-8000-000000000031", name: "带鱼", categoryName: "水产海鲜", defaultUnitName: "条" },
  { id: "40000000-0000-4000-8000-000000000032", name: "虾", categoryName: "水产海鲜", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000033", name: "虾仁", categoryName: "水产海鲜", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000034", name: "鱿鱼", categoryName: "水产海鲜", defaultUnitName: "只" },
  { id: "40000000-0000-4000-8000-000000000035", name: "花甲", categoryName: "水产海鲜", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000036", name: "蛤蜊", categoryName: "水产海鲜", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000037", name: "海带", categoryName: "水产海鲜", defaultUnitName: "片" },
  { id: "40000000-0000-4000-8000-000000000038", name: "紫菜", categoryName: "水产海鲜", defaultUnitName: "张" },
  { id: "40000000-0000-4000-8000-000000000039", name: "北豆腐", categoryName: "豆乳制品", defaultUnitName: "块" },
  { id: "40000000-0000-4000-8000-000000000040", name: "南豆腐", categoryName: "豆乳制品", defaultUnitName: "块" },
  { id: "40000000-0000-4000-8000-000000000041", name: "豆干", categoryName: "豆乳制品", defaultUnitName: "片" },
  { id: "40000000-0000-4000-8000-000000000042", name: "千张", categoryName: "豆乳制品", defaultUnitName: "张" },
  { id: "40000000-0000-4000-8000-000000000043", name: "腐竹", categoryName: "豆乳制品", defaultUnitName: "根" },
  { id: "40000000-0000-4000-8000-000000000044", name: "豆皮", categoryName: "豆乳制品", defaultUnitName: "张" },
  { id: "40000000-0000-4000-8000-000000000045", name: "豆浆", categoryName: "豆乳制品", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000046", name: "牛奶", categoryName: "豆乳制品", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000047", name: "酸奶", categoryName: "豆乳制品", defaultUnitName: "盒" },
  { id: "40000000-0000-4000-8000-000000000048", name: "黄油", categoryName: "豆乳制品", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000049", name: "大米", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000050", name: "面粉", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000051", name: "挂面", categoryName: "米面杂粮", defaultUnitName: "把" },
  { id: "40000000-0000-4000-8000-000000000052", name: "意面", categoryName: "米面杂粮", defaultUnitName: "把" },
  { id: "40000000-0000-4000-8000-000000000053", name: "燕麦", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000054", name: "小米", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000055", name: "红豆", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000056", name: "绿豆", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000057", name: "木耳", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000058", name: "银耳", categoryName: "干货腌制", defaultUnitName: "朵" },
  { id: "40000000-0000-4000-8000-000000000059", name: "盐", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000060", name: "糖", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000061", name: "生抽", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000062", name: "老抽", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000063", name: "蚝油", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000064", name: "醋", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000065", name: "料酒", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000066", name: "黄酒", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000067", name: "米酒", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000068", name: "豆瓣酱", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000069", name: "番茄酱", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000070", name: "食用油", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000071", name: "香油", categoryName: "调味料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000072", name: "胡椒粉", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000073", name: "苹果", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000074", name: "香蕉", categoryName: "蔬果菌菇", defaultUnitName: "根" },
  { id: "40000000-0000-4000-8000-000000000075", name: "橙子", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000076", name: "柠檬", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000077", name: "梨", categoryName: "蔬果菌菇", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000078", name: "葡萄", categoryName: "蔬果菌菇", defaultUnitName: "串" },
  { id: "40000000-0000-4000-8000-000000000079", name: "速冻饺子", categoryName: "米面杂粮", defaultUnitName: "袋" },
  { id: "40000000-0000-4000-8000-000000000080", name: "速冻馄饨", categoryName: "米面杂粮", defaultUnitName: "袋" },
  { id: "40000000-0000-4000-8000-000000000081", name: "丸子", categoryName: "肉禽蛋", defaultUnitName: "袋" },
  { id: "40000000-0000-4000-8000-000000000082", name: "手抓饼", categoryName: "米面杂粮", defaultUnitName: "袋" },
  { id: "40000000-0000-4000-8000-000000000083", name: "冷冻玉米粒", categoryName: "蔬果菌菇", defaultUnitName: "袋" },
  { id: "40000000-0000-4000-8000-000000000084", name: "冷冻虾仁", categoryName: "水产海鲜", defaultUnitName: "袋" },
  { id: "40000000-0000-4000-8000-000000000085", name: "啤酒", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000086", name: "红酒", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000087", name: "洋酒", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000088", name: "罐头", categoryName: "干货腌制", defaultUnitName: "罐" },
  { id: "40000000-0000-4000-8000-000000000089", name: "猪里脊", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000090", name: "牛腩", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000091", name: "羊肉", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000092", name: "羊排", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000093", name: "鸡胸肉", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000094", name: "鸡爪", categoryName: "肉禽蛋", defaultUnitName: "只" },
  { id: "40000000-0000-4000-8000-000000000095", name: "鸭翅", categoryName: "肉禽蛋", defaultUnitName: "只" },
  { id: "40000000-0000-4000-8000-000000000096", name: "鹌鹑蛋", categoryName: "肉禽蛋", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000097", name: "三文鱼", categoryName: "水产海鲜", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000098", name: "鲫鱼", categoryName: "水产海鲜", defaultUnitName: "条" },
  { id: "40000000-0000-4000-8000-000000000099", name: "鲳鱼", categoryName: "水产海鲜", defaultUnitName: "条" },
  { id: "40000000-0000-4000-8000-000000000100", name: "黄鱼", categoryName: "水产海鲜", defaultUnitName: "条" },
  { id: "40000000-0000-4000-8000-000000000101", name: "生蚝", categoryName: "水产海鲜", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000102", name: "扇贝", categoryName: "水产海鲜", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000103", name: "螃蟹", categoryName: "水产海鲜", defaultUnitName: "只" },
  { id: "40000000-0000-4000-8000-000000000104", name: "鲍鱼", categoryName: "水产海鲜", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000105", name: "墨鱼", categoryName: "水产海鲜", defaultUnitName: "只" },
  { id: "40000000-0000-4000-8000-000000000106", name: "内酯豆腐", categoryName: "豆乳制品", defaultUnitName: "盒" },
  { id: "40000000-0000-4000-8000-000000000107", name: "豆腐泡", categoryName: "豆乳制品", defaultUnitName: "个" },
  { id: "40000000-0000-4000-8000-000000000108", name: "豆腐乳", categoryName: "豆乳制品", defaultUnitName: "罐" },
  { id: "40000000-0000-4000-8000-000000000109", name: "奶酪", categoryName: "豆乳制品", defaultUnitName: "片" },
  { id: "40000000-0000-4000-8000-000000000110", name: "芝士片", categoryName: "豆乳制品", defaultUnitName: "片" },
  { id: "40000000-0000-4000-8000-000000000111", name: "淡奶油", categoryName: "豆乳制品", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000112", name: "椰浆", categoryName: "豆乳制品", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000113", name: "炼乳", categoryName: "豆乳制品", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000114", name: "奶粉", categoryName: "豆乳制品", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000115", name: "马苏里拉芝士", categoryName: "豆乳制品", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000116", name: "糯米", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000117", name: "玉米面", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000118", name: "河粉", categoryName: "米面杂粮", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000119", name: "米粉", categoryName: "米面杂粮", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000120", name: "年糕", categoryName: "米面杂粮", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000121", name: "黑米", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000122", name: "薏米", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000123", name: "藜麦", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000124", name: "玉米淀粉", categoryName: "米面杂粮", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000125", name: "鸡精", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000126", name: "辣椒粉", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000127", name: "花椒", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000128", name: "孜然粉", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000129", name: "甜面酱", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000130", name: "黄豆酱", categoryName: "调味料", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000131", name: "海米", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000132", name: "虾皮", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000133", name: "干香菇", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000134", name: "干辣椒", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000135", name: "榨菜", categoryName: "干货腌制", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000136", name: "酸菜", categoryName: "干货腌制", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000137", name: "梅干菜", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000138", name: "泡椒", categoryName: "干货腌制", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000139", name: "酸豆角", categoryName: "干货腌制", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000140", name: "雪菜", categoryName: "干货腌制", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000141", name: "笋干", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000142", name: "粉丝", categoryName: "干货腌制", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000143", name: "粉条", categoryName: "干货腌制", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000144", name: "腐乳", categoryName: "干货腌制", defaultUnitName: "罐" },
  { id: "40000000-0000-4000-8000-000000000145", name: "萝卜干", categoryName: "干货腌制", defaultUnitName: "包" },
  { id: "40000000-0000-4000-8000-000000000146", name: "红枣", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000147", name: "枸杞", categoryName: "干货腌制", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000148", name: "清酒", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000149", name: "威士忌", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000150", name: "朗姆酒", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000151", name: "伏特加", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000152", name: "金酒", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000153", name: "白兰地", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000154", name: "苏打水", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000155", name: "气泡水", categoryName: "酒水饮料", defaultUnitName: "瓶" },
  { id: "40000000-0000-4000-8000-000000000156", name: "椰奶", categoryName: "酒水饮料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000157", name: "柠檬汁", categoryName: "酒水饮料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000158", name: "橙汁", categoryName: "酒水饮料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000159", name: "可乐", categoryName: "酒水饮料", defaultUnitName: "罐" },
  { id: "40000000-0000-4000-8000-000000000160", name: "雪碧", categoryName: "酒水饮料", defaultUnitName: "罐" },
  { id: "40000000-0000-4000-8000-000000000161", name: "乌龙茶", categoryName: "酒水饮料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000162", name: "绿茶", categoryName: "酒水饮料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000163", name: "红茶", categoryName: "酒水饮料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000164", name: "咖啡液", categoryName: "酒水饮料", defaultUnitName: "毫升" },
  { id: "40000000-0000-4000-8000-000000000165", name: "猪肝", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000166", name: "鸡胗", categoryName: "肉禽蛋", defaultUnitName: "克" },
  { id: "40000000-0000-4000-8000-000000000167", name: "皮蛋", categoryName: "肉禽蛋", defaultUnitName: "个" }
];

const unitTypes: UnitType[] = ["WEIGHT", "VOLUME", "COUNT", "SHAPE", "CONTAINER", "PACKAGE", "OTHER"];

async function seedOwnedDiningGroup(userId: string, name = "我的饭搭子") {
  const diningGroup = await prisma.diningGroup.upsert({
    where: { ownerId: userId },
    update: {
      name,
      status: "ACTIVE",
      archivedAt: null
    },
    create: {
      name,
      ownerId: userId,
      status: "ACTIVE"
    }
  });

  await prisma.diningGroupMember.upsert({
    where: {
      diningGroupId_userId: {
        diningGroupId: diningGroup.id,
        userId
      }
    },
    update: {
      role: "OWNER",
      status: "ACTIVE",
      statusReason: null,
      restrictedAt: null,
      endedAt: null
    },
    create: {
      diningGroupId: diningGroup.id,
      userId,
      role: "OWNER",
      status: "ACTIVE"
    }
  });

  await prisma.diningGroupMember.updateMany({
    where: {
      diningGroupId: diningGroup.id,
      userId: { not: userId },
      status: { in: ["ACTIVE", "RESTRICTED"] }
    },
    data: {
      status: "ENDED",
      statusReason: "GROUP_DISSOLVED",
      endedAt: new Date()
    }
  });

  await prisma.diningGroupInvite.deleteMany({
    where: { diningGroupId: diningGroup.id }
  });

  return diningGroup;
}

async function seedEntitlement(userId: string, tier: EntitlementTier | null) {
  if (!tier) {
    await prisma.entitlementGrant.deleteMany({ where: { userId } });
    return;
  }

  await prisma.entitlementGrant.upsert({
    where: { userId },
    update: {
      tier,
      startsAt: new Date(),
      endsAt: null
    },
    create: {
      userId,
      tier,
      startsAt: new Date(),
      endsAt: null
    }
  });
}

async function resetUserRelations(userId: string, keepDiningGroupId: string) {
  await prisma.diningGroupMember.updateMany({
    where: {
      userId,
      diningGroupId: { not: keepDiningGroupId },
      status: { in: ["ACTIVE", "RESTRICTED"] }
    },
    data: {
      status: "ENDED",
      statusReason: "LEFT",
      restrictedAt: null,
      endedAt: new Date()
    }
  });

  await prisma.idempotencyRecord.deleteMany({
    where: {
      OR: [{ userId }, { diningGroupId: keepDiningGroupId }]
    }
  });
}

function recipeSearchText(name: string, ingredients: Array<{ name?: string; ingredientName?: string }>) {
  return [name, ...ingredients.map(item => item.name ?? item.ingredientName ?? "").filter(Boolean)].join(" ");
}

function requireSeedItem<T>(value: T | undefined, message: string) {
  if (!value) throw new Error(message);
  return value;
}

function normalizeSeedCategoryName(name: string) {
  return legacyCategoryNameMap.get(name) ?? name;
}

async function seedSystemUnits() {
  const defaultUnitMap = new Map<string, { id: string; type: UnitType; name: string }>();

  for (const item of defaultSystemUnits) {
    const searchKey = buildSearchKey(item.name);
    const existing = await prisma.unit.findFirst({
      where: {
        ownerId: null,
        searchKey
      },
      select: { id: true }
    });

    if (existing) {
      await prisma.unit.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          type: item.type,
          searchKey
        }
      });
      defaultUnitMap.set(searchKey, { id: existing.id, type: item.type, name: item.name });
      continue;
    }

    await prisma.unit.create({
      data: {
        id: item.id,
        ownerId: null,
        name: item.name,
        type: item.type,
        searchKey,
        systemSortOrder: null
      }
    });
    defaultUnitMap.set(searchKey, { id: item.id, type: item.type, name: item.name });
  }

  for (const type of unitTypes) {
    const current = await prisma.unit.findMany({
      where: {
        ownerId: null,
        type
      },
      select: { id: true, name: true, searchKey: true },
      orderBy: [{ systemSortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }]
    });
    if (!current.length) continue;

    const preferredIds = defaultSystemUnits
      .filter(item => item.type === type)
      .map(item => defaultUnitMap.get(buildSearchKey(item.name))?.id ?? null)
      .filter((id): id is string => Boolean(id));
    const preferredIdSet = new Set(preferredIds);
    const orderedIds = [...preferredIds, ...current.filter(item => !preferredIdSet.has(item.id)).map(item => item.id)];

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.unit.update({
          where: { id },
          data: { systemSortOrder: 100000 + index }
        })
      )
    );

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.unit.update({
          where: { id },
          data: { systemSortOrder: index }
        })
      )
    );
  }

  return new Map(defaultSystemUnits.map(item => [item.name, requireSeedItem(defaultUnitMap.get(buildSearchKey(item.name)), `系统单位缺失: ${item.name}`)]));
}

async function seedSystemCategories() {
  const categoryMap = new Map<string, { id: string; sortOrder: number; code: string; isSelectable: boolean }>();

  for (const item of defaultSystemCategories) {
    const existing = await prisma.ingredientCategory.findFirst({
      where: {
        OR: [{ code: item.code }, { name: item.name }]
      },
      select: { id: true }
    });
    const category = existing
      ? await prisma.ingredientCategory.update({
          where: { id: existing.id },
          data: {
            code: item.code,
            name: item.name,
            isSelectable: item.isSelectable,
            sortOrder: item.sortOrder,
            iconKey: null
          },
          select: {
            id: true,
            sortOrder: true,
            code: true,
            isSelectable: true
          }
        })
      : await prisma.ingredientCategory.create({
          data: {
            id: item.id,
            code: item.code,
            name: item.name,
            isSelectable: item.isSelectable,
            sortOrder: item.sortOrder,
            iconKey: null
          },
          select: {
            id: true,
            sortOrder: true,
            code: true,
            isSelectable: true
          }
        });
    categoryMap.set(item.name, {
      id: category.id,
      sortOrder: category.sortOrder,
      code: category.code,
      isSelectable: category.isSelectable
    });
  }

  for (const [from, to] of legacyCategoryNameMap.entries()) {
    const source = await prisma.ingredientCategory.findFirst({
      where: { name: from },
      select: { id: true }
    });
    const target = categoryMap.get(to);
    if (!source || !target || source.id === target.id) continue;

    await prisma.ingredient.updateMany({
      where: { categoryId: source.id },
      data: {
        categoryId: target.id,
        systemSortOrder: null
      }
    });

    await prisma.ingredientRecommendation.updateMany({
      where: { categoryId: source.id },
      data: {
        categoryId: target.id,
        categoryName: to
      }
    });

    const remained = await prisma.ingredient.count({
      where: { categoryId: source.id }
    });
    if (remained === 0) {
      await prisma.ingredientCategory.delete({
        where: { id: source.id }
      });
    }
  }

  return categoryMap;
}

async function seedSystemIngredients(
  categoryMap: Map<string, { id: string; sortOrder: number; code: string; isSelectable: boolean }>,
  unitMap: Map<string, { id: string; type: UnitType; name: string }>
) {
  const ingredientMap = new Map<
    string,
    {
      id: string;
      categoryId: string;
      defaultUnitId: string;
      defaultUnitName: string;
      defaultUnitType: UnitType;
    }
  >();

  const categoryItems = defaultSystemCategories.map(item => item.name);
  for (const categoryName of categoryItems) {
    const currentItems = defaultSystemIngredients.filter(item => normalizeSeedCategoryName(item.categoryName) === categoryName);
    for (let index = 0; index < currentItems.length; index += 1) {
      const item = currentItems[index];
      const searchKey = buildSearchKey(item.name);
      const normalizedCategoryName = normalizeSeedCategoryName(item.categoryName);
      const category = requireSeedItem(categoryMap.get(normalizedCategoryName), `系统分类缺失: ${normalizedCategoryName}`);
      const unit = requireSeedItem(unitMap.get(item.defaultUnitName), `系统单位缺失: ${item.defaultUnitName}`);
      const existing = await prisma.ingredient.findFirst({
        where: {
          ownerId: null,
          searchKey
        },
        select: { id: true }
      });

      const ingredient = existing
        ? await prisma.ingredient.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              searchKey,
              categoryId: category.id,
              defaultUnitId: unit.id,
              systemSortOrder: null
            },
            select: {
              id: true,
              categoryId: true,
              defaultUnitId: true
            }
          })
        : await prisma.ingredient.create({
            data: {
              id: item.id,
              ownerId: null,
              name: item.name,
              searchKey,
              categoryId: category.id,
              defaultUnitId: unit.id,
              systemSortOrder: null
            },
            select: {
              id: true,
              categoryId: true,
              defaultUnitId: true
            }
          });

      ingredientMap.set(item.name, {
        id: ingredient.id,
        categoryId: ingredient.categoryId,
        defaultUnitId: ingredient.defaultUnitId,
        defaultUnitName: unit.name,
        defaultUnitType: unit.type
      });
    }

    const preferredIds = currentItems
      .map(item => ingredientMap.get(item.name)?.id ?? null)
      .filter((id): id is string => Boolean(id));
    if (!preferredIds.length) continue;

    const preferredIdSet = new Set(preferredIds);
    const orderedIds = [
      ...preferredIds,
      ...(
        await prisma.ingredient.findMany({
          where: {
            ownerId: null,
            categoryId: requireSeedItem(categoryMap.get(categoryName), `系统分类缺失: ${categoryName}`).id
          },
          select: { id: true },
          orderBy: [{ systemSortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }]
        })
      )
        .map(item => item.id)
        .filter(id => !preferredIdSet.has(id))
    ];

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.ingredient.update({
          where: { id },
          data: { systemSortOrder: 100000 + index }
        })
      )
    );

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.ingredient.update({
          where: { id },
          data: { systemSortOrder: index }
        })
      )
    );
  }

  return ingredientMap;
}

async function upsertRecipeVersion(
  id: string,
  createdByUserId: string | null,
  content: {
    name: string;
    story: string | null;
    baseServings: number;
    difficulty: "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING" | null;
    duration: "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60" | null;
    tips: string | null;
    ingredients: Array<{
      ingredientId: string;
      ingredientName: string;
      source: "SYSTEM" | "PERSONAL";
      categoryId: string;
      amount:
        | {
            kind: "EXACT";
            quantity: string;
            unitId: string;
            unitName: string;
            unitType: UnitType;
          }
        | {
            kind: "FUZZY";
            text: "适量" | "少许" | "按需";
          };
    }>;
    steps: Array<{ text: string }>;
    images: Array<{ key: string; url: string; sizeBytes: number }>;
  }
) {
  return prisma.recipeContentVersion.upsert({
    where: { id },
    update: {
      createdByUserId,
      name: content.name,
      story: content.story,
      baseServings: content.baseServings,
      difficulty: content.difficulty,
      duration: content.duration,
      tips: content.tips,
      ingredientsJson: content.ingredients,
      stepsJson: content.steps,
      imagesJson: content.images,
      searchText: recipeSearchText(content.name, content.ingredients),
      contentSizeBytes: Math.max(
        1024,
        Buffer.byteLength(
          JSON.stringify({
            name: content.name,
            story: content.story,
            baseServings: content.baseServings,
            difficulty: content.difficulty,
            duration: content.duration,
            tips: content.tips,
            ingredients: content.ingredients,
            steps: content.steps,
            images: content.images.map(item => ({ key: item.key, url: item.url }))
          }),
          "utf8"
        )
      )
    },
    create: {
      id,
      createdByUserId,
      name: content.name,
      story: content.story,
      baseServings: content.baseServings,
      difficulty: content.difficulty,
      duration: content.duration,
      tips: content.tips,
      ingredientsJson: content.ingredients,
      stepsJson: content.steps,
      imagesJson: content.images,
      searchText: recipeSearchText(content.name, content.ingredients),
      contentSizeBytes: Math.max(
        1024,
        Buffer.byteLength(
          JSON.stringify({
            name: content.name,
            story: content.story,
            baseServings: content.baseServings,
            difficulty: content.difficulty,
            duration: content.duration,
            tips: content.tips,
            ingredients: content.ingredients,
            steps: content.steps,
            images: content.images.map(item => ({ key: item.key, url: item.url }))
          }),
          "utf8"
        )
      )
    }
  });
}

async function seedRecipes(
  ownerUserId: string,
  ingredientMap: Map<
    string,
    {
      id: string;
      categoryId: string;
      defaultUnitId: string;
      defaultUnitName: string;
      defaultUnitType: UnitType;
    }
  >
) {
  const tomato = requireSeedItem(ingredientMap.get("番茄"), "系统食材缺失: 番茄");
  const egg = requireSeedItem(ingredientMap.get("鸡蛋"), "系统食材缺失: 鸡蛋");
  const potato = requireSeedItem(ingredientMap.get("土豆"), "系统食材缺失: 土豆");
  const beef = requireSeedItem(ingredientMap.get("牛肉"), "系统食材缺失: 牛肉");
  const pepper = requireSeedItem(ingredientMap.get("青椒"), "系统食材缺失: 青椒");
  const tenderloin = requireSeedItem(ingredientMap.get("里脊肉"), "系统食材缺失: 里脊肉");

  const tomatoVersion = await upsertRecipeVersion("10000000-0000-4000-8000-000000000001", null, {
    name: "番茄炒蛋",
    story: null,
    baseServings: 2,
    difficulty: "BEGINNER",
    tips: "番茄最后下锅，保持一点汁水。",
    ingredients: [
      {
        ingredientId: tomato.id,
        ingredientName: "番茄",
        source: "SYSTEM",
        categoryId: tomato.categoryId,
        amount: {
          kind: "EXACT",
          quantity: "2",
          unitId: tomato.defaultUnitId,
          unitName: tomato.defaultUnitName,
          unitType: tomato.defaultUnitType
        }
      },
      {
        ingredientId: egg.id,
        ingredientName: "鸡蛋",
        source: "SYSTEM",
        categoryId: egg.categoryId,
        amount: {
          kind: "EXACT",
          quantity: "3",
          unitId: egg.defaultUnitId,
          unitName: egg.defaultUnitName,
          unitType: egg.defaultUnitType
        }
      }
    ],
    steps: [{ text: "番茄切块" }, { text: "鸡蛋炒散后和番茄一起翻炒" }],
    duration: "WITHIN_15",
    images: [{ key: "cover", url: "https://example.com/recipe/tomato-egg.jpg", sizeBytes: 128000 }]
  });

  const potatoVersion = await upsertRecipeVersion("10000000-0000-4000-8000-000000000002", null, {
    name: "土豆烧牛肉",
    story: null,
    baseServings: 3,
    difficulty: "SKILLED",
    tips: "牛肉先焯水再炖，口感更稳。",
    ingredients: [
      {
        ingredientId: potato.id,
        ingredientName: "土豆",
        source: "SYSTEM",
        categoryId: potato.categoryId,
        amount: {
          kind: "EXACT",
          quantity: "2",
          unitId: potato.defaultUnitId,
          unitName: potato.defaultUnitName,
          unitType: potato.defaultUnitType
        }
      },
      {
        ingredientId: beef.id,
        ingredientName: "牛肉",
        source: "SYSTEM",
        categoryId: beef.categoryId,
        amount: {
          kind: "EXACT",
          quantity: "400",
          unitId: beef.defaultUnitId,
          unitName: beef.defaultUnitName,
          unitType: beef.defaultUnitType
        }
      }
    ],
    steps: [{ text: "牛肉焯水" }, { text: "土豆与牛肉一起焖煮" }],
    duration: "BETWEEN_30_60",
    images: [{ key: "cover", url: "https://example.com/recipe/beef-potato.jpg", sizeBytes: 156000 }]
  });

  const ownerVersion = await upsertRecipeVersion("10000000-0000-4000-8000-000000000003", ownerUserId, {
    name: "青椒肉丝",
    story: null,
    baseServings: 2,
    difficulty: "EASY",
    tips: "肉丝提前上浆，口感更嫩。",
    ingredients: [
      {
        ingredientId: pepper.id,
        ingredientName: "青椒",
        source: "SYSTEM",
        categoryId: pepper.categoryId,
        amount: {
          kind: "EXACT",
          quantity: "2",
          unitId: pepper.defaultUnitId,
          unitName: pepper.defaultUnitName,
          unitType: pepper.defaultUnitType
        }
      },
      {
        ingredientId: tenderloin.id,
        ingredientName: "里脊肉",
        source: "SYSTEM",
        categoryId: tenderloin.categoryId,
        amount: {
          kind: "EXACT",
          quantity: "250",
          unitId: tenderloin.defaultUnitId,
          unitName: tenderloin.defaultUnitName,
          unitType: tenderloin.defaultUnitType
        }
      }
    ],
    steps: [{ text: "肉丝上浆" }, { text: "大火快炒" }],
    duration: "BETWEEN_15_30",
    images: [{ key: "cover", url: "https://example.com/recipe/pepper-pork.jpg", sizeBytes: 118000 }]
  });

  await prisma.recipe.upsert({
    where: { id: "20000000-0000-4000-8000-000000000001" },
    update: {
      ownerId: null,
      categoryId: null,
      inspirationCategoryId: null,
      currentVersionId: tomatoVersion.id,
      title: tomatoVersion.name,
      searchText: tomatoVersion.searchText,
      coverImageUrl: "https://example.com/recipe/tomato-egg.jpg",
      status: "ACTIVE",
      blockedReason: null,
      blockedAt: null,
      recycledUntil: null,
      deletedAt: null,
      reportCount: 0
    },
    create: {
      id: "20000000-0000-4000-8000-000000000001",
      ownerId: null,
      currentVersionId: tomatoVersion.id,
      title: tomatoVersion.name,
      searchText: tomatoVersion.searchText,
      coverImageUrl: "https://example.com/recipe/tomato-egg.jpg"
    }
  });

  await prisma.recipe.upsert({
    where: { id: "20000000-0000-4000-8000-000000000002" },
    update: {
      ownerId: null,
      categoryId: null,
      inspirationCategoryId: null,
      currentVersionId: potatoVersion.id,
      title: potatoVersion.name,
      searchText: potatoVersion.searchText,
      coverImageUrl: "https://example.com/recipe/beef-potato.jpg",
      status: "ACTIVE",
      blockedReason: null,
      blockedAt: null,
      recycledUntil: null,
      deletedAt: null,
      reportCount: 0
    },
    create: {
      id: "20000000-0000-4000-8000-000000000002",
      ownerId: null,
      currentVersionId: potatoVersion.id,
      title: potatoVersion.name,
      searchText: potatoVersion.searchText,
      coverImageUrl: "https://example.com/recipe/beef-potato.jpg"
    }
  });

  await prisma.recipe.upsert({
    where: { id: "20000000-0000-4000-8000-000000000003" },
    update: {
      ownerId: ownerUserId,
      categoryId: null,
      inspirationCategoryId: null,
      currentVersionId: ownerVersion.id,
      title: ownerVersion.name,
      searchText: ownerVersion.searchText,
      coverImageUrl: "https://example.com/recipe/pepper-pork.jpg",
      status: "ACTIVE",
      blockedReason: null,
      blockedAt: null,
      recycledUntil: null,
      deletedAt: null,
      reportCount: 0
    },
    create: {
      id: "20000000-0000-4000-8000-000000000003",
      ownerId: ownerUserId,
      currentVersionId: ownerVersion.id,
      title: ownerVersion.name,
      searchText: ownerVersion.searchText,
      coverImageUrl: "https://example.com/recipe/pepper-pork.jpg"
    }
  });
}

async function main() {
  const username = process.env.ADMIN_SEED_USERNAME ?? "admin";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
  const displayName = process.env.ADMIN_SEED_DISPLAY_NAME ?? "系统管理员";

  const admin = await prisma.adminAccount.upsert({
    where: { username },
    update: {
      displayName,
      passwordHash: hashPassword(password),
      roles: ["SUPER_ADMIN"],
      status: "ACTIVE"
    },
    create: {
      username,
      displayName,
      passwordHash: hashPassword(password),
      roles: ["SUPER_ADMIN"],
      status: "ACTIVE"
    }
  });

  const ownerUser = await prisma.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {
      uid: 52738164,
      nickname: "下一餐主理人",
      phone: "13800000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      uid: 52738164,
      nickname: "下一餐主理人",
      phone: "13800000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    }
  });

  const guestUser = await prisma.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {
      uid: 83947215,
      nickname: "下一餐成员",
      phone: "13900000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    },
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      uid: 83947215,
      nickname: "下一餐成员",
      phone: "13900000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    }
  });

  const memberUser = await prisma.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000003" },
    update: {
      uid: 91827364,
      nickname: "下一餐协作成员",
      phone: "13700000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    },
    create: {
      id: "00000000-0000-4000-8000-000000000003",
      uid: 91827364,
      nickname: "下一餐协作成员",
      phone: "13700000000",
      passwordHash: hashPassword("change-me"),
      status: "ACTIVE"
    }
  });

  const ownerGroup = await seedOwnedDiningGroup(ownerUser.id, "主理人的饭搭子");
  const guestGroup = await seedOwnedDiningGroup(guestUser.id, "成员的饭搭子");
  const memberGroup = await seedOwnedDiningGroup(memberUser.id, "协作成员的饭搭子");
  await resetUserRelations(ownerUser.id, ownerGroup.id);
  await resetUserRelations(guestUser.id, guestGroup.id);
  await resetUserRelations(memberUser.id, memberGroup.id);
  await seedEntitlement(ownerUser.id, "PRO");
  await seedEntitlement(guestUser.id, null);
  await seedEntitlement(memberUser.id, "PLUS");
  const unitMap = await seedSystemUnits();
  const categoryMap = await seedSystemCategories();
  const ingredientMap = await seedSystemIngredients(categoryMap, unitMap);
  await seedRecipes(ownerUser.id, ingredientMap);

  console.log(
    `Seeded admin ${admin.username}, users ${ownerUser.phone}, ${guestUser.phone}, ${memberUser.phone}, categories ${categoryMap.size}, ingredients ${ingredientMap.size}`
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
