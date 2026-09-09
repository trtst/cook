import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRecipeImportBody,
  parseJsonSource,
  readJsonSourcesFromFiles,
  type RecipeImportJsonRefs
} from "./recipe-import-json";

const refs: RecipeImportJsonRefs = {
  ingredientByName: new Map([
    ["排骨", { id: 101, name: "排骨", categoryId: 1 }],
    ["海带", { id: 102, name: "海带", categoryId: 1 }]
  ]),
  unitByName: new Map([
    ["克", { id: 201, name: "克", type: "WEIGHT" }],
    ["毫升", { id: 202, name: "毫升", type: "VOLUME" }]
  ])
};

function validDocument() {
  return {
    schemaVersion: "recipe.import.v1",
    recipe: {
      inspirationCategoryId: 1,
      coverImageUrl: null,
      content: {
        name: "海带排骨汤",
        story: "海带和排骨一起炖煮，汤味鲜美。",
        baseServings: 4,
        difficulty: "EASY",
        duration: "OVER_60",
        tips: "排骨先焯水。",
        ingredients: [
          { name: "排骨", quantity: "500", unit: "克" },
          { name: "海带", quantity: "200", unit: "克" }
        ],
        tools: [{ name: "汤锅" }],
        steps: [{ text: "排骨焯水后洗净。", imageUrl: null }]
      }
    },
    wiki: {
      tags: [
        { tagCode: "MEAL_TYPE", tagValue: "DINNER" },
        { tagCode: "DISH_ROLE", tagValue: "SOUP" },
        { tagCode: "MAIN_PROTEIN_TYPE", tagValue: "PORK" },
        { tagCode: "FLAVOR_PROFILE", tagValue: "LIGHT" },
        { tagCode: "SPICE_LEVEL", tagValue: "NONE" }
      ],
      assistant: {
        steps: [
          {
            order: 1,
            phase: "PREP",
            action: "BLANCH",
            title: "排骨焯水",
            detail: "排骨焯水后洗净。",
            imageUrl: null,
            durationMinutes: 8,
            durationText: "约 8 分钟"
          }
        ]
      }
    }
  };
}

test("parses recipe.import.v1 and strictly matches ingredient and unit names", () => {
  const result = parseJsonSource(
    { sourcePath: "soup.json", jsonText: JSON.stringify(validDocument()) },
    refs
  );

  assert.deepEqual(result.errorItems, []);
  assert.equal(result.recipeBody.title, "海带排骨汤");
  assert.equal(result.recipeBody.ingredients[0]?.ingredientId, 101);
  assert.equal(result.recipeBody.ingredients[0]?.unitId, 201);
  assert.deepEqual(result.recipeBody.tools, [{ name: "汤锅" }]);
  assert.equal(result.recipeBody.tags?.find(item => item.tagCode === "DISH_ROLE")?.tagValue, "SOUP");
  assert.equal(result.recipeBody.assistantSteps?.[0]?.action, "BLANCH");
});

test("accepts the converted beef stir-fry example as recipe.import.v1", () => {
  const document = validDocument() as Record<string, any>;
  document.recipe.content = {
    name: "小炒黄牛肉",
    story: "这道湘味小炒以大火爆炒逼出牛肉的嫩滑与椒香，口感鲜辣劲爽、芹菜脆嫩，极具湖南风味。备料与烹饪步骤简单明了，全程旺火快炒，对新手十分友好，从切配到出锅大约一小时即可完成。",
    baseServings: 1,
    difficulty: "EASY",
    duration: "BETWEEN_15_30",
    tips: "牛肉切薄片，大火快炒才能嫩滑；酱油已含盐，后续调味可酌情减少。",
    ingredients: [
      { name: "牛里脊", quantity: "400", unit: "克" },
      { name: "芹菜", quantity: "200", unit: "克" },
      { name: "小米椒", quantity: "30", unit: "克" },
      { name: "野山椒", quantity: "30", unit: "克" },
      { name: "香菜", quantity: "30", unit: "克" },
      { name: "食用油", quantity: "15", unit: "毫升" },
      { name: "酱油", quantity: "6", unit: "毫升" }
    ],
    tools: [{ name: "炒锅" }, { name: "锅铲" }],
    steps: [
      { text: "牛里脊切成不超过3cm宽、3mm厚的薄片，倒入6ml酱油抓匀备用。", imageUrl: null },
      { text: "芹菜切成不超过5cm的小段，小米椒切丝，野山椒切粒，香菜切段，分别备用。", imageUrl: null },
      { text: "热锅，倒入15ml食用油，大火烧热约30秒。", imageUrl: null },
      { text: "放入小米椒和野山椒爆香。", imageUrl: null },
      { text: "放入牛里脊和芹菜，大火翻炒1分钟。", imageUrl: null },
      { text: "关火，撒上香菜，盛盘即可。", imageUrl: null }
    ]
  };
  document.wiki.tags = [
    { tagCode: "MEAL_TYPE", tagValue: "DINNER" },
    { tagCode: "DISH_ROLE", tagValue: "MAIN" },
    { tagCode: "MAIN_PROTEIN_TYPE", tagValue: "BEEF" },
    { tagCode: "FLAVOR_PROFILE", tagValue: "SPICY" },
    { tagCode: "SPICE_LEVEL", tagValue: "HOT" }
  ];
  document.wiki.assistant.steps = [
    { order: 1, phase: "PREP", action: "MARINATE", title: "腌制牛肉", detail: "牛里脊切成不超过3cm宽、3mm厚的薄片，倒入6ml酱油抓匀备用。", imageUrl: null, durationMinutes: 5, durationText: "约 5 分钟" },
    { order: 2, phase: "PREP", action: "CUT", title: "切配配菜", detail: "芹菜切段，小米椒切丝，野山椒切粒，香菜切段。", imageUrl: null, durationMinutes: 10, durationText: "约 10 分钟" },
    { order: 3, phase: "COOK", action: "STIR_FRY", title: "爆香快炒", detail: "热锅热油，先放入小米椒和野山椒爆香，再下牛肉和芹菜，大火翻炒1分钟。", imageUrl: null, durationMinutes: 5, durationText: "约 5 分钟" },
    { order: 4, phase: "SERVE", action: "PLATE", title: "装盘", detail: "关火撒香菜，盛出即可。", imageUrl: null, durationMinutes: 2, durationText: "约 2 分钟" }
  ];

  const result = parseJsonSource(
    { sourcePath: "beef-stir-fry.json", jsonText: JSON.stringify(document) },
    {
      ingredientByName: new Map([
        ["牛里脊", { id: 301, name: "牛里脊", categoryId: 1 }],
        ["芹菜", { id: 302, name: "芹菜", categoryId: 1 }],
        ["小米椒", { id: 303, name: "小米椒", categoryId: 1 }],
        ["野山椒", { id: 304, name: "野山椒", categoryId: 1 }],
        ["香菜", { id: 305, name: "香菜", categoryId: 1 }],
        ["食用油", { id: 306, name: "食用油", categoryId: 1 }],
        ["酱油", { id: 307, name: "酱油", categoryId: 1 }]
      ]),
      unitByName: new Map([
        ["克", { id: 201, name: "克", type: "WEIGHT" }],
        ["毫升", { id: 202, name: "毫升", type: "VOLUME" }]
      ])
    }
  );

  assert.deepEqual(result.errorItems, []);
  assert.equal(result.recipeBody.title, "小炒黄牛肉");
  assert.match(result.recipeBody.story ?? "", /从切配到出锅大约一小时/);
  assert.equal(result.recipeBody.ingredients.length, 7);
  assert.equal(result.recipeBody.duration, "BETWEEN_15_30");
  assert.deepEqual(result.recipeBody.assistantSteps?.map(step => step.action), [
    "MARINATE",
    "CUT",
    "STIR_FRY",
    "PLATE"
  ]);
});

test("requires complete source content and blocks fuzzy quantities", () => {
  const document = validDocument();
  document.recipe.content.story = "";
  document.recipe.content.ingredients[0] = { name: "排骨", quantity: "适量", unit: "克" };

  const result = parseJsonSource(
    { sourcePath: "incomplete.json", jsonText: JSON.stringify(document) },
    refs
  );

  assert.equal(result.errorItems.some(item => item.field === "recipe.content.story"), true);
  assert.equal(result.errorItems.some(item => item.field === "recipe.content.ingredients.0.quantity"), true);
});

test("rejects nutrition input and invalid assistant actions without guessing", () => {
  const document = validDocument() as Record<string, unknown>;
  const recipe = document.recipe as Record<string, unknown>;
  const wiki = document.wiki as Record<string, unknown>;
  wiki.nutrition = { perServing: { calories: 1 } };
  const assistant = wiki.assistant as Record<string, unknown>;
  assistant.steps = [
    {
      order: 1,
      phase: "PREP",
      action: "BOIL",
      title: "处理食材",
      detail: "处理食材。",
      imageUrl: null,
      durationMinutes: 5,
      durationText: null
    }
  ];
  recipe.content = { ...(recipe.content as Record<string, unknown>), inspirationCategoryId: 1 };

  const result = parseJsonSource(
    { sourcePath: "invalid.json", jsonText: JSON.stringify(document) },
    refs
  );

  assert.equal(result.errorItems.some(item => item.field === "wiki.nutrition"), true);
  assert.equal(result.errorItems.some(item => item.field === "wiki.assistant.steps.0.action"), true);
});

test("requires a positive durationMinutes for every assistant step", () => {
  const document = validDocument() as Record<string, any>;
  delete document.wiki.assistant.steps[0].durationMinutes;

  const result = parseJsonSource(
    { sourcePath: "missing-duration-minutes.json", jsonText: JSON.stringify(document) },
    refs
  );

  assert.equal(result.errorItems.some(item => item.field === "wiki.assistant.steps.0.durationMinutes"), true);
});

test("rejects zero or fractional assistant durationMinutes", () => {
  const document = validDocument() as Record<string, any>;
  document.wiki.assistant.steps[0].durationMinutes = 0;

  const result = parseJsonSource(
    { sourcePath: "invalid-duration-minutes.json", jsonText: JSON.stringify(document) },
    refs
  );

  assert.equal(result.errorItems.some(item => item.field === "wiki.assistant.steps.0.durationMinutes"), true);
});

test("rejects duplicate required tag codes instead of silently choosing one", () => {
  const document = validDocument();
  document.wiki.tags = [
    ...document.wiki.tags,
    { tagCode: "MEAL_TYPE", tagValue: "LUNCH" }
  ];

  const result = parseJsonSource(
    { sourcePath: "duplicate-tags.json", jsonText: JSON.stringify(document) },
    refs
  );

  assert.equal(result.errorItems.some(item => item.field === "wiki.tags.5.tagCode"), true);
});

test("normalizes only explicit kg and L quantities to the fixed project units", () => {
  const document = validDocument();
  document.recipe.content.ingredients = [
    { name: "排骨", quantity: "1.5", unit: "kg" },
    { name: "海带", quantity: "0.5", unit: "L" }
  ];

  const result = parseJsonSource(
    { sourcePath: "normalized.json", jsonText: JSON.stringify(document) },
    refs
  );

  assert.deepEqual(result.errorItems, []);
  assert.deepEqual(result.recipeBody.ingredients.map(item => ({ quantity: item.quantity, unitText: item.unitText, unitId: item.unitId })), [
    { quantity: "1500", unitText: "克", unitId: 201 },
    { quantity: "500", unitText: "毫升", unitId: 202 }
  ]);
});

test("keeps unmatched source rows for manual confirmation and rejects unknown tool fields", () => {
  const document = validDocument();
  document.recipe.content.ingredients[0] = { name: "未知食材", quantity: "100", unit: "克" };
  document.recipe.content.tools = [{ name: "汤锅", material: "不应导入" } as { name: string }];

  const result = parseJsonSource(
    { sourcePath: "unmatched.json", jsonText: JSON.stringify(document) },
    refs
  );

  assert.equal(result.errorItems.some(item => item.field === "recipe.content.ingredients.0.name"), true);
  assert.equal(result.errorItems.some(item => item.field === "recipe.content.tools.0.material"), true);
  assert.equal(result.recipeBody.ingredients[0]?.ingredientId, null);
});

test("rejects JSON arrays and non-JSON files", () => {
  const arrayResult = parseJsonSource(
    { sourcePath: "array.json", jsonText: "[]" },
    refs
  );
  assert.equal(arrayResult.errorItems.some(item => item.field === "recipe"), true);
  assert.throws(() => readJsonSourcesFromFiles([
    { originalname: "recipes.zip", buffer: Buffer.from("not supported"), size: 1 }
  ]), /只支持 JSON/);
});

test("combines multiple JSON files into one import source list", () => {
  const sources = readJsonSourcesFromFiles([
    { originalname: "first.json", buffer: Buffer.from(JSON.stringify(validDocument())), size: 1 },
    { originalname: "second.json", buffer: Buffer.from(JSON.stringify(validDocument())), size: 1 }
  ]);

  assert.deepEqual(sources.map(item => item.sourcePath), ["first.json", "second.json"]);
});

test("rejects more than 100 selected JSON files", () => {
  const files = Array.from({ length: 101 }, (_, index) => ({
    originalname: `recipe-${index}.json`,
    buffer: Buffer.from(JSON.stringify(validDocument())),
    size: 1
  }));

  assert.throws(() => readJsonSourcesFromFiles(files), /文件数量不能超过 100 个/);
});

test("normalizes historical import bodies before returning them to the admin page", () => {
  const normalized = normalizeRecipeImportBody({
    inspirationCategoryId: null,
    title: "历史菜谱",
    story: null,
    baseServings: 1,
    difficulty: null,
    duration: null,
    tips: null,
    coverImageKey: null,
    coverImageTempKey: null,
    ingredients: [],
    steps: [{ text: "完成", imageKey: null, imageTempKey: null }]
  });

  assert.deepEqual(normalized.tools, []);
  assert.deepEqual(normalized.tags, []);
  assert.deepEqual(normalized.assistantSteps, []);
  assert.equal(normalized.steps[0]?.imageUrl, null);
});
