<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, EditPen, Plus, Refresh } from "@element-plus/icons-vue";
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
  type AdminRecipeDetail,
  type UpdateAdminRecipePayload
} from "@/apis/recipe";
import { formatStatusText } from "@/utils/status";

type Difficulty = "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
type Duration = "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
type FuzzyText = "适量" | "少许" | "按需";

interface EditIngredientRow {
  ingredientId: string;
  amount:
    | {
        kind: "EXACT";
        quantity: string;
        unitId: string;
      }
    | {
        kind: "FUZZY";
        text: FuzzyText;
      };
}

interface EditFormState {
  inspirationCategoryId: string;
  content: {
    name: string;
    story: string;
    baseServings: number;
    difficulty: Difficulty;
    duration: Duration;
    tips: string;
    ingredients: EditIngredientRow[];
    steps: Array<{ text: string }>;
  };
}

interface IngredientOptionItem {
  id: string;
  label: string;
  disabled?: boolean;
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

const difficultyLabelMap: Record<Difficulty, string> = Object.fromEntries(
  difficultyOptions.map(item => [item.value, item.label])
) as Record<Difficulty, string>;

const durationLabelMap: Record<Duration, string> = Object.fromEntries(
  durationOptions.map(item => [item.value, item.label])
) as Record<Duration, string>;

const fuzzyOptions: FuzzyText[] = ["适量", "少许", "按需"];

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const optionLoading = ref(false);
const saving = ref(false);
const editVisible = ref(false);
const detail = ref<AdminRecipeDetail | null>(null);
const inspirationCategories = ref<AdminInspirationCategorySummary[]>([]);
const ingredientCategories = ref<AdminIngredientCategorySummary[]>([]);
const ingredientOptions = ref<AdminIngredientSummary[]>([]);
const unitOptions = ref<AdminUnitSummary[]>([]);

const form = reactive<EditFormState>({
  inspirationCategoryId: "",
  content: {
    name: "",
    story: "",
    baseServings: 1,
    difficulty: "BEGINNER",
    duration: "WITHIN_15",
    tips: "",
    ingredients: [],
    steps: []
  }
});

const recipeId = computed(() => String(route.params.recipeId ?? ""));
const selectableCategoryIds = computed(() => new Set(ingredientCategories.value.filter(item => item.isSelectable).map(item => item.id)));
const validIngredientIdSet = computed(() => new Set(ingredientOptions.value.map(item => item.id)));
const activeIngredientLabelMap = computed(() => new Map(ingredientOptions.value.map(item => [item.id, `${item.name} · ${item.categoryName}`])));
const currentIngredientLabelMap = computed(
  () => new Map((detail.value?.content.ingredients ?? []).map(item => [item.ingredientId, item.ingredientName]))
);

const ingredientOptionList = computed<IngredientOptionItem[]>(() => {
  const items: IngredientOptionItem[] = ingredientOptions.value.map(item => ({
    id: item.id,
    label: `${item.name} · ${item.categoryName}`
  }));
  const known = new Set(items.map(item => item.id));
  for (const current of detail.value?.content.ingredients ?? []) {
    if (!known.has(current.ingredientId)) {
      items.push({
        id: current.ingredientId,
        label: `${current.ingredientName} · 当前正文（已下架或不可选，保存前需替换）`,
        disabled: true
      });
      known.add(current.ingredientId);
    }
  }
  return items;
});

const unitOptionList = computed(() => {
  const items = unitOptions.value.map(item => ({
    id: item.id,
    label: item.name
  }));
  const known = new Set(items.map(item => item.id));
  for (const current of detail.value?.content.ingredients ?? []) {
    if (current.amount.kind === "EXACT" && !known.has(current.amount.unitId)) {
      items.push({
        id: current.amount.unitId,
        label: `${current.amount.unitName} · 当前正文`
      });
      known.add(current.amount.unitId);
    }
  }
  return items;
});

async function loadDetail() {
  loading.value = true;
  try {
    detail.value = await recipeApi.getDetail(recipeId.value);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载菜谱详情失败");
  } finally {
    loading.value = false;
  }
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

async function ensureEditOptions() {
  if (
    inspirationCategories.value.length > 0 &&
    ingredientCategories.value.length > 0 &&
    ingredientOptions.value.length > 0 &&
    unitOptions.value.length > 0
  ) {
    return;
  }
  optionLoading.value = true;
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
  } finally {
    optionLoading.value = false;
  }
}

const invalidIngredientNames = computed(() => {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const item of form.content.ingredients) {
    if (validIngredientIdSet.value.has(item.ingredientId)) continue;
    const name = currentIngredientLabelMap.value.get(item.ingredientId) ?? activeIngredientLabelMap.value.get(item.ingredientId) ?? item.ingredientId;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
});

function resetFormFromDetail() {
  if (!detail.value || !detail.value.inspirationCategory || !detail.value.content.difficulty || !detail.value.content.duration) {
    return;
  }
  form.inspirationCategoryId = detail.value.inspirationCategory.id;
  form.content.name = detail.value.content.name;
  form.content.story = detail.value.content.story ?? "";
  form.content.baseServings = detail.value.content.baseServings;
  form.content.difficulty = detail.value.content.difficulty;
  form.content.duration = detail.value.content.duration;
  form.content.tips = detail.value.content.tips ?? "";
  form.content.ingredients = detail.value.content.ingredients.map(item => ({
    ingredientId: item.ingredientId,
    amount:
      item.amount.kind === "EXACT"
        ? {
            kind: "EXACT",
            quantity: item.amount.quantity,
            unitId: item.amount.unitId
          }
        : {
            kind: "FUZZY",
            text: item.amount.text
          }
  }));
  form.content.steps = detail.value.content.steps.map(item => ({ text: item.text }));
}

async function openEdit() {
  await ensureEditOptions();
  resetFormFromDetail();
  if (form.content.ingredients.length === 0) addIngredient();
  if (form.content.steps.length === 0) addStep();
  editVisible.value = true;
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

function buildPayload(): UpdateAdminRecipePayload | null {
  if (!detail.value) return null;
  if (invalidIngredientNames.value.length) {
    ElMessage.error(`请先替换已下架或不可选的系统食材：${invalidIngredientNames.value.join("、")}`);
    return null;
  }
  return {
    operationId: crypto.randomUUID(),
    expectedVersion: detail.value.version,
    inspirationCategoryId: form.inspirationCategoryId,
    content: {
      name: form.content.name.trim(),
      story: form.content.story.trim() ? form.content.story.trim() : null,
      baseServings: form.content.baseServings,
      difficulty: form.content.difficulty,
      duration: form.content.duration,
      tips: form.content.tips.trim() ? form.content.tips.trim() : null,
      ingredients: form.content.ingredients.map(item => ({
        ingredientId: item.ingredientId,
        amount:
          item.amount.kind === "EXACT"
            ? {
                kind: "EXACT",
                quantity: item.amount.quantity.trim(),
                unitId: item.amount.unitId
              }
            : {
                kind: "FUZZY",
                text: item.amount.text
              }
      })),
      steps: form.content.steps.map(item => ({
        text: item.text
      }))
    } satisfies AdminRecipeContentInput
  };
}

async function saveEdit() {
  const payload = buildPayload();
  if (!payload || !detail.value) return;
  saving.value = true;
  try {
    detail.value = await recipeApi.update(detail.value.id, payload);
    ElMessage.success("已保存菜谱正文");
    editVisible.value = false;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

function goBack() {
  void router.push("/recipes/list");
}

function formatDifficulty(value: AdminRecipeDetail["content"]["difficulty"]) {
  return value ? difficultyLabelMap[value] : "-";
}

function formatDuration(value: AdminRecipeDetail["content"]["duration"]) {
  return value ? durationLabelMap[value] : "-";
}

watch(
  () => recipeId.value,
  () => {
    void loadDetail();
  }
);

onMounted(() => {
  void loadDetail();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <div class="page-title-block">
        <el-button text :icon="ArrowLeft" @click="goBack">返回菜谱列表</el-button>
        <strong>菜谱详情</strong>
        <div class="page-subtitle">查看当前固定版本正文。仅灵感菜谱支持后台直接编辑。</div>
      </div>
      <div class="toolbar-spacer" />
      <el-button :icon="Refresh" @click="loadDetail">刷新</el-button>
      <el-button v-if="detail?.canEdit" type="primary" :icon="EditPen" @click="openEdit">编辑正文</el-button>
    </div>

    <div v-loading="loading" class="page-stack">
      <template v-if="detail">
        <div class="table-panel">
          <div class="panel-heading">
            <h2>{{ detail.title }}</h2>
          </div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="来源">{{ detail.ownerUid === null ? "灵感" : "个人" }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ formatStatusText(detail.status) }}</el-descriptions-item>
            <el-descriptions-item label="持有人 UID">{{ detail.ownerUid ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="灵感分类">{{ detail.inspirationCategory?.name ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="个人分类">{{ detail.personalCategory?.name ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="当前版本 ID">{{ detail.contentVersionId }}</el-descriptions-item>
            <el-descriptions-item label="举报数">{{ detail.reportCount }}</el-descriptions-item>
            <el-descriptions-item label="下架原因">{{ detail.blockedReason ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="点赞数">{{ detail.likeCount }}</el-descriptions-item>
            <el-descriptions-item label="收藏数">{{ detail.collectCount }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detail.createdAt }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ detail.updatedAt }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="table-panel">
          <div class="panel-heading">
            <h2>正文内容</h2>
          </div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="菜谱名称">{{ detail.content.name }}</el-descriptions-item>
            <el-descriptions-item label="基准人数">{{ detail.content.baseServings }} 人</el-descriptions-item>
            <el-descriptions-item label="难度">{{ formatDifficulty(detail.content.difficulty) }}</el-descriptions-item>
            <el-descriptions-item label="时长">{{ formatDuration(detail.content.duration) }}</el-descriptions-item>
            <el-descriptions-item label="故事" :span="2">
              <div class="multiline-text">{{ detail.content.story || "-" }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="小贴士" :span="2">
              <div class="multiline-text">{{ detail.content.tips || "-" }}</div>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="table-panel">
          <div class="panel-heading">
            <h2>食材与用量</h2>
          </div>
          <div class="content-list">
            <div v-for="item in detail.content.ingredients" :key="`${item.ingredientId}-${item.ingredientName}`" class="content-list__item">
              <span>{{ item.ingredientName }}</span>
              <span v-if="item.amount.kind === 'EXACT'">{{ item.amount.quantity }} {{ item.amount.unitName }}</span>
              <span v-else>{{ item.amount.text }}</span>
            </div>
          </div>
        </div>

        <div class="table-panel">
          <div class="panel-heading">
            <h2>制作步骤</h2>
          </div>
          <ol class="step-list">
            <li v-for="(item, index) in detail.content.steps" :key="`${index}-${item.text}`">
              {{ item.text }}
            </li>
          </ol>
        </div>
      </template>
    </div>

    <el-dialog v-model="editVisible" title="编辑灵感菜谱正文" width="760px">
      <div v-loading="optionLoading">
        <el-form label-position="top">
          <el-alert
            v-if="invalidIngredientNames.length"
            class="edit-warning"
            type="warning"
            :closable="false"
            show-icon
            :title="`当前正文包含已下架或不可选的系统食材：${invalidIngredientNames.join('、')}。保存前请先替换。`"
          />
          <el-form-item label="灵感分类" required>
            <el-select v-model="form.inspirationCategoryId" placeholder="请选择灵感分类">
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
                  :disabled="option.disabled"
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
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.content-list {
  display: grid;
  gap: 12px;
}

.content-list__item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}

.step-list {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 12px;
}

.multiline-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.edit-warning {
  margin-bottom: 16px;
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
