<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  ingredientApi,
  type AdminIngredientCategorySummary,
  type AdminIngredientSummary,
  type AdminUnitSummary
} from "@/apis/ingredient";
import {
  recipeApi,
  type AdminInspirationCategorySummary,
  type AdminRecipeContentInput,
  type CreateAdminRecipePayload,
  type RecipeIngredientInput
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { createOperationId } from "@/utils/operation-id";

type Difficulty = "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
type Duration = "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
type FuzzyText = "适量" | "少许" | "按需";

interface EditIngredientRow {
  ingredientId: UUID | "";
  amount:
    | {
        kind: "EXACT";
        quantity: string;
        unitId: UUID | "";
      }
    | {
        kind: "FUZZY";
        text: FuzzyText;
      };
}

const difficultyOptions: Array<{ label: string; value: Difficulty }> = [
  { label: "新手友好", value: "BEGINNER" },
  { label: "轻松上手", value: "EASY" },
  { label: "需要经验", value: "SKILLED" },
  { label: "进阶挑战", value: "CHALLENGING" }
];

const durationOptions: Array<{ label: string; value: Duration }> = [
  { label: "15 分钟内", value: "WITHIN_15" },
  { label: "15~30 分钟", value: "BETWEEN_15_30" },
  { label: "30~60 分钟", value: "BETWEEN_30_60" },
  { label: "1 小时以上", value: "OVER_60" }
];

const fuzzyOptions: FuzzyText[] = ["适量", "少许", "按需"];

const loading = ref(false);
const saving = ref(false);
const router = useRouter();
const inspirationCategories = ref<AdminInspirationCategorySummary[]>([]);
const ingredientCategories = ref<AdminIngredientCategorySummary[]>([]);
const ingredientOptions = ref<AdminIngredientSummary[]>([]);
const unitOptions = ref<AdminUnitSummary[]>([]);

const form = reactive({
  inspirationCategoryId: "" as UUID | "",
  content: {
    name: "",
    story: "",
    baseServings: 1,
    difficulty: "BEGINNER" as Difficulty,
    duration: "WITHIN_15" as Duration,
    tips: "",
    ingredients: [] as EditIngredientRow[],
    steps: [] as Array<{ text: string }>
  }
});

const selectableCategoryIds = computed(() => new Set(ingredientCategories.value.filter(item => item.isSelectable).map(item => item.id)));
const ingredientOptionList = computed(() =>
  ingredientOptions.value.map(item => ({
    id: item.id,
    label: `${item.name} · ${item.categoryName}`
  }))
);
const unitOptionList = computed(() =>
  unitOptions.value.map(item => ({
    id: item.id,
    label: item.name
  }))
);

function resetForm() {
  form.inspirationCategoryId = inspirationCategories.value[0]?.id ?? "";
  form.content.name = "";
  form.content.story = "";
  form.content.baseServings = 1;
  form.content.difficulty = "BEGINNER";
  form.content.duration = "WITHIN_15";
  form.content.tips = "";
  form.content.ingredients = [];
  form.content.steps = [];
  addIngredient();
  addStep();
}

async function loadAllIngredients() {
  const items: AdminIngredientSummary[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const result = await ingredientApi.listIngredients({
      page,
      pageSize: 100,
      status: "ACTIVE"
    });
    items.push(...result.items);
    hasNext = result.hasNext;
    page += 1;
  }
  ingredientOptions.value = items.filter(item => selectableCategoryIds.value.has(item.categoryId));
}

async function loadOptions() {
  loading.value = true;
  try {
    const [recipeCategories, categories, units] = await Promise.all([
      recipeApi.listInspirationCategories(),
      ingredientApi.listCategories(),
      ingredientApi.listUnits()
    ]);
    inspirationCategories.value = recipeCategories;
    ingredientCategories.value = categories;
    unitOptions.value = units;
    await loadAllIngredients();
    resetForm();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载创建选项失败");
  } finally {
    loading.value = false;
  }
}

function addIngredient() {
  form.content.ingredients.push({
    ingredientId: ingredientOptionList.value[0]?.id ?? "",
    amount: {
      kind: "EXACT",
      quantity: "",
      unitId: unitOptionList.value[0]?.id ?? ""
    }
  });
}

function addStep() {
  form.content.steps.push({ text: "" });
}

function removeIngredient(index: number) {
  form.content.ingredients.splice(index, 1);
}

function removeStep(index: number) {
  form.content.steps.splice(index, 1);
}

function resolveEditId(value: UUID | ""): UUID | null {
  return value === "" ? null : value;
}

function buildIngredientInput(item: EditIngredientRow): RecipeIngredientInput | null {
  const ingredientId = resolveEditId(item.ingredientId);
  if (!ingredientId) {
    ElMessage.error("请选择系统食材");
    return null;
  }

  if (item.amount.kind === "EXACT") {
    const unitId = resolveEditId(item.amount.unitId);
    if (!unitId) {
      ElMessage.error("请选择单位");
      return null;
    }
    return {
      ingredientId,
      amount: {
        kind: "EXACT",
        quantity: item.amount.quantity.trim(),
        unitId
      }
    };
  }

  return {
    ingredientId,
    amount: {
      kind: "FUZZY",
      text: item.amount.text
    }
  };
}

function buildPayload(): CreateAdminRecipePayload | null {
  const inspirationCategoryId = resolveEditId(form.inspirationCategoryId);
  if (!inspirationCategoryId) {
    ElMessage.error("请选择系统菜谱分类");
    return null;
  }

  const ingredients: RecipeIngredientInput[] = [];
  for (const item of form.content.ingredients) {
    const ingredient = buildIngredientInput(item);
    if (!ingredient) return null;
    ingredients.push(ingredient);
  }

  return {
    operationId: createOperationId(),
    inspirationCategoryId,
    content: {
      name: form.content.name.trim(),
      story: form.content.story.trim() ? form.content.story.trim() : null,
      baseServings: form.content.baseServings,
      difficulty: form.content.difficulty,
      duration: form.content.duration,
      tips: form.content.tips.trim() ? form.content.tips.trim() : null,
      ingredients,
      steps: form.content.steps.map(item => ({
        text: item.text
      }))
    } satisfies AdminRecipeContentInput
  };
}

async function saveRecipe() {
  const payload = buildPayload();
  if (!payload) return;
  saving.value = true;
  try {
    const detail = await recipeApi.create(payload);
    ElMessage.success("系统菜谱已创建");
    await router.replace(`/recipes/${detail.id}`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建系统菜谱失败");
  } finally {
    saving.value = false;
  }
}

function goBack() {
  void router.push("/recipes/list");
}

onMounted(() => {
  void loadOptions();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <div class="page-title-block">
        <el-button text :icon="ArrowLeft" @click="goBack">返回系统菜谱</el-button>
        <strong>新增系统菜谱</strong>
        <div class="page-subtitle">后台直接创建一条新的系统菜谱，正文只允许引用系统分类、系统食材和系统单位。</div>
      </div>
      <div class="toolbar-spacer" />
      <el-button :icon="Refresh" @click="loadOptions">刷新</el-button>
      <el-button type="primary" :loading="saving" @click="saveRecipe">创建系统菜谱</el-button>
    </div>

    <div v-loading="loading" class="table-panel">
      <el-form label-position="top">
        <el-form-item label="系统菜谱分类" required>
          <el-select v-model="form.inspirationCategoryId" placeholder="请选择系统菜谱分类">
            <el-option v-for="item in inspirationCategories" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="菜谱名称" required>
          <el-input v-model="form.content.name" maxlength="120" show-word-limit />
        </el-form-item>
        <el-form-item label="故事">
          <el-input v-model="form.content.story" type="textarea" :rows="3" maxlength="2000" show-word-limit />
        </el-form-item>

        <div class="edit-grid">
          <el-form-item label="基准人数" required>
            <el-input-number v-model="form.content.baseServings" :min="1" :max="20" />
          </el-form-item>
          <el-form-item label="难度" required>
            <el-select v-model="form.content.difficulty">
              <el-option v-for="item in difficultyOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="时长" required>
            <el-select v-model="form.content.duration">
              <el-option v-for="item in durationOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </div>

        <div class="edit-section">
          <div class="edit-section__header">
            <strong>食材与用量</strong>
            <el-button text :icon="Plus" @click="addIngredient">新增食材</el-button>
          </div>
          <div v-for="(item, index) in form.content.ingredients" :key="index" class="ingredient-row">
            <el-select v-model="item.ingredientId" class="ingredient-row__ingredient" filterable placeholder="选择系统食材">
              <el-option
                v-for="option in ingredientOptionList"
                :key="option.id"
                :label="option.label"
                :value="option.id"
              />
            </el-select>
            <el-select
              :model-value="item.amount.kind"
              class="ingredient-row__kind"
              @update:model-value="
                (value: 'EXACT' | 'FUZZY') =>
                  (form.content.ingredients[index].amount =
                    value === 'FUZZY'
                      ? { kind: 'FUZZY', text: '适量' }
                      : { kind: 'EXACT', quantity: '', unitId: unitOptionList[0]?.id ?? '' })
              "
            >
              <el-option label="精确用量" value="EXACT" />
              <el-option label="模糊用量" value="FUZZY" />
            </el-select>
            <template v-if="item.amount.kind === 'EXACT'">
              <el-input v-model="item.amount.quantity" class="ingredient-row__quantity" placeholder="数量" />
              <el-select v-model="item.amount.unitId" class="ingredient-row__unit" placeholder="单位">
                <el-option v-for="option in unitOptionList" :key="option.id" :label="option.label" :value="option.id" />
              </el-select>
            </template>
            <el-select v-else v-model="item.amount.text" class="ingredient-row__unit" placeholder="模糊用量">
              <el-option v-for="option in fuzzyOptions" :key="option" :label="option" :value="option" />
            </el-select>
            <el-button text type="danger" @click="removeIngredient(index)">删除</el-button>
          </div>
        </div>

        <div class="edit-section">
          <div class="edit-section__header">
            <strong>制作步骤</strong>
            <el-button text :icon="Plus" @click="addStep">新增步骤</el-button>
          </div>
          <div v-for="(item, index) in form.content.steps" :key="index" class="step-row">
            <el-input v-model="item.text" type="textarea" :rows="2" maxlength="1000" show-word-limit />
            <el-button text type="danger" @click="removeStep(index)">删除</el-button>
          </div>
        </div>

        <el-form-item label="小贴士">
          <el-input v-model="form.content.tips" type="textarea" :rows="3" maxlength="1000" show-word-limit />
        </el-form-item>
      </el-form>
    </div>
  </section>
</template>

<style scoped lang="scss">
.edit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.edit-section {
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
}

.edit-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ingredient-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 140px minmax(0, 120px) minmax(0, 140px) auto;
  gap: 12px;
  align-items: center;
}

.ingredient-row__ingredient,
.ingredient-row__kind,
.ingredient-row__quantity,
.ingredient-row__unit {
  width: 100%;
}

.step-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}
</style>
