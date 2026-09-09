import type { IngredientNutrientMappingStatus } from "@prisma/client";
import { seedResourceId } from "./seed-resource-ids";

export const recipeNutritionSourceRepo = "Sanotsu/china-food-composition-data";
export const recipeNutritionSourceVersion = "2026-08-22-primary-subset-v1";

export interface NutritionFoodSeed {
  sourcePath: string;
  sourceFoodCode: string;
  sourceFoodName: string;
  edibleRate: number | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbohydrate: number | null;
}

export interface NutritionUnitConversionSeed {
  unitId: number;
  unitName: string;
  gramsPerUnit: number;
}

export interface IngredientNutritionSeed {
  ingredientId: number;
  ingredientName: string;
  status: IngredientNutrientMappingStatus;
  matchType: string;
  confidence: number;
  nutrientFood: NutritionFoodSeed | null;
  conversions: NutritionUnitConversionSeed[];
}

const jsonData = (fileName: string) => `json_data/${fileName}`;

const legacyPrimaryIngredientNutritionSeeds: IngredientNutritionSeed[] = [
  {
    ingredientId: 4001,
    ingredientName: "番茄",
    status: "CONFIRMED",
    matchType: "EXACT_NAME",
    confidence: 1,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-茄果瓜菜类.json"),
      sourceFoodCode: "043119",
      sourceFoodName: "番茄[西红柿]",
      edibleRate: 97,
      calories: 15,
      protein: 0.9,
      fat: 0.2,
      carbohydrate: 3.3
    },
    conversions: [{ unitId: 3007, unitName: "个", gramsPerUnit: 180 }]
  },
  {
    ingredientId: 4002,
    ingredientName: "鸡蛋",
    status: "CONFIRMED",
    matchType: "REPRESENTATIVE",
    confidence: 0.98,
    nutrientFood: {
      sourcePath: jsonData("merged-蛋类及其制品-鸡蛋.json"),
      sourceFoodCode: "111101x",
      sourceFoodName: "鸡蛋 (代表值)",
      edibleRate: 87,
      calories: 139,
      protein: 13.1,
      fat: 8.6,
      carbohydrate: 2.4
    },
    conversions: [{ unitId: 3007, unitName: "个", gramsPerUnit: 50 }]
  },
  {
    ingredientId: 4003,
    ingredientName: "土豆",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.98,
    nutrientFood: {
      sourcePath: jsonData("merged-薯类淀粉及其制品-薯类.json"),
      sourceFoodCode: "021101",
      sourceFoodName: "马铃薯[土豆、洋芋]",
      edibleRate: 94,
      calories: 81,
      protein: 2.6,
      fat: 0.2,
      carbohydrate: 17.8
    },
    conversions: [{ unitId: 3007, unitName: "个", gramsPerUnit: 200 }]
  },
  {
    ingredientId: 4004,
    ingredientName: "牛肉",
    status: "CONFIRMED",
    matchType: "LEAN_REPRESENTATIVE",
    confidence: 0.88,
    nutrientFood: {
      sourcePath: jsonData("merged-畜肉类及其制品-牛.json"),
      sourceFoodCode: "082108x",
      sourceFoodName: "牛肉（代表值，瘦，fat3g）",
      edibleRate: 100,
      calories: 113,
      protein: 21.3,
      fat: 2.5,
      carbohydrate: 1.3
    },
    conversions: []
  },
  {
    ingredientId: 4005,
    ingredientName: "青椒",
    status: "CANDIDATE",
    matchType: "REVIEW_NEEDED",
    confidence: 0.4,
    nutrientFood: null,
    conversions: []
  },
  {
    ingredientId: 4006,
    ingredientName: "里脊肉",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.95,
    nutrientFood: {
      sourcePath: jsonData("merged-畜肉类及其制品-猪.json"),
      sourceFoodCode: "081129",
      sourceFoodName: "猪肉 (里脊)",
      edibleRate: null,
      calories: 150,
      protein: 19.6,
      fat: 7.9,
      carbohydrate: 0
    },
    conversions: []
  },
  {
    ingredientId: 4007,
    ingredientName: "白菜",
    status: "CONFIRMED",
    matchType: "REPRESENTATIVE",
    confidence: 0.92,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-嫩茎叶花菜类.json"),
      sourceFoodCode: "045101x",
      sourceFoodName: "大白菜（代表值）",
      edibleRate: 89,
      calories: 20,
      protein: 1.6,
      fat: 0.2,
      carbohydrate: 3.4
    },
    conversions: [{ unitId: 3007, unitName: "个", gramsPerUnit: 500 }]
  },
  {
    ingredientId: 4010,
    ingredientName: "黄瓜",
    status: "CANDIDATE",
    matchType: "REVIEW_NEEDED",
    confidence: 0.45,
    nutrientFood: null,
    conversions: []
  },
  {
    ingredientId: 4011,
    ingredientName: "胡萝卜",
    status: "CONFIRMED",
    matchType: "EXACT_NAME",
    confidence: 0.97,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-根菜类.json"),
      sourceFoodCode: "041204",
      sourceFoodName: "胡萝卜",
      edibleRate: 97,
      calories: 32,
      protein: 1,
      fat: 0.2,
      carbohydrate: 8.1
    },
    conversions: [{ unitId: 3007, unitName: "个", gramsPerUnit: 150 }]
  },
  {
    ingredientId: 4013,
    ingredientName: "西兰花",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.97,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-嫩茎叶花菜类.json"),
      sourceFoodCode: "045217",
      sourceFoodName: "西兰花[绿菜花】",
      edibleRate: 83,
      calories: 27,
      protein: 3.5,
      fat: 0.6,
      carbohydrate: 3.7
    },
    conversions: [{ unitId: 3007, unitName: "个", gramsPerUnit: 250 }]
  },
  {
    ingredientId: 4014,
    ingredientName: "洋葱",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.98,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-葱蒜类.json"),
      sourceFoodCode: "044301",
      sourceFoodName: "洋葱（鲜）[葱头]",
      edibleRate: 90,
      calories: 40,
      protein: 1.1,
      fat: 0.2,
      carbohydrate: 9
    },
    conversions: [{ unitId: 3007, unitName: "个", gramsPerUnit: 150 }]
  },
  {
    ingredientId: 4015,
    ingredientName: "大葱",
    status: "CONFIRMED",
    matchType: "EXACT_NAME",
    confidence: 0.99,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-葱蒜类.json"),
      sourceFoodCode: "044206",
      sourceFoodName: "大葱",
      edibleRate: 82,
      calories: 28,
      protein: 1.6,
      fat: 0.3,
      carbohydrate: 5.8
    },
    conversions: [{ unitId: 3007, unitName: "个", gramsPerUnit: 120 }]
  },
  {
    ingredientId: 4016,
    ingredientName: "生姜",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.97,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-薯芋类.json"),
      sourceFoodCode: "047301",
      sourceFoodName: "姜（鲜）[黄姜】",
      edibleRate: 95,
      calories: 46,
      protein: 1.3,
      fat: 0.6,
      carbohydrate: 10.3
    },
    conversions: []
  },
  {
    ingredientId: 4017,
    ingredientName: "大蒜",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.97,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-葱蒜类.json"),
      sourceFoodCode: "044101",
      sourceFoodName: "大蒜（白皮，鲜）[蒜头]",
      edibleRate: 85,
      calories: 128,
      protein: 4.5,
      fat: 0.2,
      carbohydrate: 27.6
    },
    conversions: [{ unitId: 3014, unitName: "瓣", gramsPerUnit: 5 }]
  },
  {
    ingredientId: 4018,
    ingredientName: "香菇",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.86,
    nutrientFood: {
      sourcePath: jsonData("merged-菌藻类-菌类.json"),
      sourceFoodCode: "051019",
      sourceFoodName: "香菇（鲜）[香草，冬菇]",
      edibleRate: 100,
      calories: 26,
      protein: 2.2,
      fat: 0.3,
      carbohydrate: 3.3
    },
    conversions: []
  },
  {
    ingredientId: 4020,
    ingredientName: "莲藕",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.98,
    nutrientFood: {
      sourcePath: jsonData("merged-蔬菜类及其制品-水生蔬菜类.json"),
      sourceFoodCode: "046010",
      sourceFoodName: "藕[莲藕]",
      edibleRate: 88,
      calories: 47,
      protein: 1.2,
      fat: 0.2,
      carbohydrate: 11.5
    },
    conversions: []
  },
  {
    ingredientId: 4025,
    ingredientName: "排骨",
    status: "CONFIRMED",
    matchType: "REPRESENTATIVE",
    confidence: 0.85,
    nutrientFood: {
      sourcePath: jsonData("merged-畜肉类及其制品-猪.json"),
      sourceFoodCode: "081131",
      sourceFoodName: "猪小排 (杜长大猪)",
      edibleRate: null,
      calories: 295,
      protein: 16.8,
      fat: 25.3,
      carbohydrate: 0
    },
    conversions: []
  },
  {
    ingredientId: 4026,
    ingredientName: "鸡翅",
    status: "CANDIDATE",
    matchType: "REVIEW_NEEDED",
    confidence: 0.42,
    nutrientFood: null,
    conversions: []
  },
  {
    ingredientId: 4033,
    ingredientName: "虾仁",
    status: "CANDIDATE",
    matchType: "REVIEW_NEEDED",
    confidence: 0.4,
    nutrientFood: null,
    conversions: []
  },
  {
    ingredientId: 4037,
    ingredientName: "海带",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.93,
    nutrientFood: {
      sourcePath: jsonData("merged-菌藻类-藻类.json"),
      sourceFoodCode: "052003",
      sourceFoodName: "海带[江白菜，昆布]",
      edibleRate: 98,
      calories: 90,
      protein: 1.8,
      fat: 0.1,
      carbohydrate: 23.4
    },
    conversions: []
  },
  {
    ingredientId: 4039,
    ingredientName: "北豆腐",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.99,
    nutrientFood: {
      sourcePath: jsonData("merged-干豆类及其制品-大豆.json"),
      sourceFoodCode: "031306",
      sourceFoodName: "豆腐 (北豆腐)",
      edibleRate: 100,
      calories: 116,
      protein: 9.2,
      fat: 8.1,
      carbohydrate: 3
    },
    conversions: []
  },
  {
    ingredientId: 4090,
    ingredientName: "牛腩",
    status: "CONFIRMED",
    matchType: "ALIAS",
    confidence: 0.96,
    nutrientFood: {
      sourcePath: jsonData("merged-畜肉类及其制品-牛.json"),
      sourceFoodCode: "082116",
      sourceFoodName: "牛肉（腹部肉）[牛腩］",
      edibleRate: 100,
      calories: 332,
      protein: 17.1,
      fat: 29.3,
      carbohydrate: 0
    },
    conversions: []
  }
];

export const primaryIngredientNutritionSeeds = legacyPrimaryIngredientNutritionSeeds.map(seed => ({
  ...seed,
  ingredientId: seedResourceId(seed.ingredientId)
}));
