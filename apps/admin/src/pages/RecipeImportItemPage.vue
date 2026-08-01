<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Plus } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  recipeApi,
  type AdminInspirationCategorySummary,
  type RecipeImportImageSummary,
  type RecipeImportItemDetail,
  type RecipeImportRecipeBody
} from "@/apis/recipe";
import {
  ingredientApi,
  type AdminIngredientCategorySummary,
  type AdminIngredientSummary,
  type AdminUnitSummary
} from "@/apis/ingredient";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

type Difficulty = "BEGINNER" | "EASY" | "SKILLED" | "CHALLENGING";
type Duration = "WITHIN_15" | "BETWEEN_15_30" | "BETWEEN_30_60" | "OVER_60";
type FuzzyText = "适量" | "少许" | "按需";

interface EditIngredientRow {
  line: string;
  ingredientName: string;
  ingredientId: UUID | "";
  amountKind: "EXACT" | "FUZZY";
  quantity: string;
  unitText: string;
  unitId: UUID | "";
  fuzzyText: FuzzyText;
  note: string;
}

interface EditStepRow {
  text: string;
  imageKey: string | "";
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

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const optionLoading = ref(false);
const saving = ref(false);
const publishing = ref(false);
const detail = ref<RecipeImportItemDetail | null>(null);
const inspirationCategories = ref<AdminInspirationCategorySummary[]>([]);
const ingredientCategories = ref<AdminIngredientCategorySummary[]>([]);
const ingredientOptions = ref<AdminIngredientSummary[]>([]);
const unitOptions = ref<AdminUnitSummary[]>([]);
let detailRequestId = 0;

const form = reactive({
  inspirationCategoryId: "" as UUID | "",
  title: "",
  story: "",
  baseServings: null as number | null,
  difficulty: "" as Difficulty | "",
  duration: "" as Duration | "",
  estimatedCalories: null as number | null,
  tips: "",
  coverImageKey: "" as string | "",
  ingredients: [] as EditIngredientRow[],
  steps: [] as EditStepRow[]
});

function parseRouteId(value: unknown) {
  const next = typeof value === "string" ? Number(value) : Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(next) && next > 0 ? next : null;
}

const itemId = computed<UUID | null>(() => parseRouteId(route.params.itemId));
const selectableCategoryIds = computed(() => new Set(ingredientCategories.value.filter(item => item.isSelectable).map(item => item.id)));
const ingredientSelectOptions = computed(() =>
  ingredientOptions.value
    .filter(item => selectableCategoryIds.value.has(item.categoryId))
    .map(item => ({
      id: item.id,
      label: `${item.name} · ${item.categoryName}`
    }))
);
const unitSelectOptions = computed(() =>
  unitOptions.value.map(item => ({
    id: item.id,
    label: item.name
  }))
);
const coverOptions = computed(() => (detail.value?.sourceImages ?? []).filter(item => item.canUseAsCover));
const imageOptions = computed(() => detail.value?.sourceImages ?? []);
useAdminHeaderRefresh(() => {
  void loadDetail();
});

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
  ingredientOptions.value = items;
}

async function ensureOptions() {
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

function resetFormFromDetail() {
  if (!detail.value) return;
  const body = detail.value.recipeBody;
  form.inspirationCategoryId = body.inspirationCategoryId ?? "";
  form.title = body.title;
  form.story = body.story ?? "";
  form.baseServings = body.baseServings;
  form.difficulty = body.difficulty ?? "";
  form.duration = body.duration ?? "";
  form.estimatedCalories = body.estimatedCalories;
  form.tips = body.tips ?? "";
  form.coverImageKey = body.coverImageKey ?? "";
  form.ingredients = body.ingredients.map(item => ({
    line: item.line,
    ingredientName: item.ingredientName,
    ingredientId: item.ingredientId ?? "",
    amountKind: item.fuzzyText ? "FUZZY" : "EXACT",
    quantity: item.quantity ?? "",
    unitText: item.unitText ?? "",
    unitId: item.unitId ?? "",
    fuzzyText: item.fuzzyText ?? "适量",
    note: item.note ?? ""
  }));
  form.steps = body.steps.map(item => ({
    text: item.text,
    imageKey: item.imageKey ?? ""
  }));
  if (form.ingredients.length === 0) addIngredient();
  if (form.steps.length === 0) addStep();
}

function clearForm() {
  form.inspirationCategoryId = "";
  form.title = "";
  form.story = "";
  form.baseServings = null;
  form.difficulty = "";
  form.duration = "";
  form.estimatedCalories = null;
  form.tips = "";
  form.coverImageKey = "";
  form.ingredients = [];
  form.steps = [];
}

async function loadDetail() {
  const currentRequestId = ++detailRequestId;
  if (!itemId.value) {
    detail.value = null;
    clearForm();
    ElMessage.error("导入条目 ID 缺失");
    return;
  }
  loading.value = true;
  try {
    await ensureOptions();
    const nextDetail = await recipeApi.getImportItemDetail(itemId.value);
    if (currentRequestId !== detailRequestId) return;
    detail.value = nextDetail;
    resetFormFromDetail();
  } catch (error) {
    if (currentRequestId !== detailRequestId) return;
    detail.value = null;
    clearForm();
    ElMessage.error(error instanceof Error ? error.message : "加载导入条目失败");
  } finally {
    if (currentRequestId !== detailRequestId) return;
    loading.value = false;
  }
}

function goBack() {
  if (!detail.value) {
    void router.push("/recipes/imports");
    return;
  }
  void router.push(`/recipes/imports/${detail.value.jobId}`);
}

function openRecipe() {
  if (!detail.value?.recipeId) return;
  void router.push(`/recipes/${detail.value.recipeId}`);
}

function addIngredient() {
  form.ingredients.push({
    line: "",
    ingredientName: "",
    ingredientId: ingredientSelectOptions.value[0]?.id ?? "",
    amountKind: "EXACT",
    quantity: "",
    unitText: "",
    unitId: unitSelectOptions.value[0]?.id ?? "",
    fuzzyText: "适量",
    note: ""
  });
}

function removeIngredient(index: number) {
  form.ingredients.splice(index, 1);
}

function addStep() {
  form.steps.push({
    text: "",
    imageKey: ""
  });
}

function removeStep(index: number) {
  form.steps.splice(index, 1);
}

function buildRecipeBody(): RecipeImportRecipeBody {
  return {
    inspirationCategoryId: form.inspirationCategoryId || null,
    title: form.title.trim(),
    story: form.story.trim() ? form.story.trim() : null,
    baseServings: form.baseServings,
    difficulty: (form.difficulty || null) as RecipeImportRecipeBody["difficulty"],
    duration: (form.duration || null) as RecipeImportRecipeBody["duration"],
    estimatedCalories: form.estimatedCalories,
    tips: form.tips.trim() ? form.tips.trim() : null,
    coverImageKey: form.coverImageKey || null,
    ingredients: form.ingredients.map(item => ({
      line: item.line.trim(),
      ingredientName: item.ingredientName.trim(),
      ingredientId: item.ingredientId || null,
      quantity: item.amountKind === "EXACT" ? (item.quantity.trim() || null) : null,
      unitText: item.amountKind === "EXACT" ? (item.unitText.trim() || null) : null,
      unitId: item.amountKind === "EXACT" ? item.unitId || null : null,
      fuzzyText: item.amountKind === "FUZZY" ? item.fuzzyText : null,
      note: item.note.trim() ? item.note.trim() : null
    })),
    steps: form.steps.map(item => ({
      text: item.text.trim(),
      imageKey: item.imageKey || null
    }))
  };
}

async function saveItem() {
  if (!detail.value) return;
  saving.value = true;
  try {
    detail.value = await recipeApi.updateImportItem(detail.value.id, {
      operationId: createOperationId(),
      expectedVersion: detail.value.version,
      recipeBody: buildRecipeBody()
    });
    resetFormFromDetail();
    ElMessage.success("导入条目已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存导入条目失败");
  } finally {
    saving.value = false;
  }
}

async function publishItem() {
  if (!detail.value) return;
  publishing.value = true;
  try {
    detail.value = await recipeApi.publishImportItem(detail.value.id, {
      operationId: createOperationId(),
      expectedVersion: detail.value.version
    });
    resetFormFromDetail();
    ElMessage.success("系统菜谱已发布");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "发布系统菜谱失败");
  } finally {
    publishing.value = false;
  }
}

function sourceImageLabel(image: RecipeImportImageSummary & { canUseAsCover?: boolean }) {
  return image.alt?.trim() || image.fileName;
}

watch(
  () => route.params.itemId,
  () => {
    detail.value = null;
    clearForm();
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
      <el-button text :icon="ArrowLeft" @click="goBack">返回任务详情</el-button>
      <div class="toolbar-spacer" />
      <el-button v-if="detail?.recipeId" @click="openRecipe">查看正式菜谱</el-button>
      <el-button type="primary" :loading="saving" @click="saveItem">保存修正</el-button>
      <el-button
        type="success"
        :loading="publishing"
        :disabled="detail?.status === 'PUBLISHED'"
        @click="publishItem"
      >
        发布到系统菜谱
      </el-button>
    </div>

    <div v-if="detail" class="toolbar-panel item-meta">
      <div>当前状态：<strong>{{ formatStatusText(detail.status) }}</strong></div>
      <div>来源文件：{{ detail.sourcePath }}</div>
      <div v-if="detail.recipeId">正式菜谱 ID：{{ detail.recipeId }}</div>
    </div>

    <div v-loading="loading || optionLoading" class="import-layout">
      <div class="table-panel source-panel">
        <div class="source-block">
          <h3>原文 markdown</h3>
          <pre class="markdown-raw">{{ detail?.rawBody.markdown }}</pre>
        </div>

        <div class="source-block">
          <h3>原图</h3>
          <div v-if="detail?.sourceImages.length" class="image-grid">
            <figure v-for="image in detail?.sourceImages" :key="image.key" class="image-card">
              <img :src="image.dataUrl" :alt="sourceImageLabel(image)" />
              <figcaption>
                <strong>{{ sourceImageLabel(image) }}</strong>
                <span>{{ image.width ?? "-" }} × {{ image.height ?? "-" }}</span>
                <span v-if="image.canUseAsCover">可作封面</span>
              </figcaption>
            </figure>
          </div>
          <div v-else class="empty-tip">当前 markdown 未带可读取图片。</div>
        </div>

        <div v-if="detail?.errorItems.length" class="source-block">
          <h3>待补全字段</h3>
          <ul class="issue-list issue-list--error">
            <li v-for="(item, index) in detail.errorItems" :key="`error-${index}`">{{ item.message }}</li>
          </ul>
        </div>

        <div v-if="detail?.warnItems.length" class="source-block">
          <h3>提醒</h3>
          <ul class="issue-list">
            <li v-for="(item, index) in detail.warnItems" :key="`warn-${index}`">{{ item.message }}</li>
          </ul>
        </div>
      </div>

      <div class="table-panel form-panel">
        <el-form label-position="top">
          <div class="edit-grid">
            <el-form-item label="系统菜谱分类" required>
              <el-select v-model="form.inspirationCategoryId" placeholder="请选择系统菜谱分类">
                <el-option v-for="item in inspirationCategories" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="基准人数" required>
              <el-input-number v-model="form.baseServings" :min="1" :max="20" />
            </el-form-item>
            <el-form-item label="难度" required>
              <el-select v-model="form.difficulty" placeholder="请选择难度">
                <el-option v-for="item in difficultyOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="时长" required>
              <el-select v-model="form.duration" placeholder="请选择时长">
                <el-option v-for="item in durationOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="预估卡路里">
              <el-input-number v-model="form.estimatedCalories" :min="0" :max="20000" :step="10" />
            </el-form-item>
            <el-form-item label="封面图">
              <el-select v-model="form.coverImageKey" placeholder="可不选">
                <el-option label="不设置封面图" value="" />
                <el-option
                  v-for="item in coverOptions"
                  :key="item.key"
                  :label="sourceImageLabel(item)"
                  :value="item.key"
                />
              </el-select>
            </el-form-item>
          </div>

          <el-form-item label="菜谱标题" required>
            <el-input v-model="form.title" maxlength="120" show-word-limit />
          </el-form-item>

          <el-form-item label="故事">
            <el-input v-model="form.story" type="textarea" :rows="4" maxlength="2000" show-word-limit />
          </el-form-item>

          <el-form-item label="小贴士">
            <el-input v-model="form.tips" type="textarea" :rows="4" maxlength="1000" show-word-limit />
          </el-form-item>

          <div class="edit-section">
            <div class="edit-section__header">
              <strong>食材与用量</strong>
              <el-button text :icon="Plus" @click="addIngredient">新增食材</el-button>
            </div>
            <div v-for="(item, index) in form.ingredients" :key="index" class="ingredient-edit-row">
              <el-input v-model="item.ingredientName" placeholder="食材名称" />
              <el-select v-model="item.ingredientId" placeholder="匹配系统食材">
                <el-option label="未匹配" value="" />
                <el-option v-for="option in ingredientSelectOptions" :key="option.id" :label="option.label" :value="option.id" />
              </el-select>
              <el-select v-model="item.amountKind">
                <el-option label="精确用量" value="EXACT" />
                <el-option label="模糊用量" value="FUZZY" />
              </el-select>
              <template v-if="item.amountKind === 'EXACT'">
                <el-input v-model="item.quantity" placeholder="数量" />
                <el-select v-model="item.unitId" placeholder="单位">
                  <el-option label="未匹配" value="" />
                  <el-option v-for="option in unitSelectOptions" :key="option.id" :label="option.label" :value="option.id" />
                </el-select>
              </template>
              <template v-else>
                <el-select v-model="item.fuzzyText">
                  <el-option label="适量" value="适量" />
                  <el-option label="少许" value="少许" />
                  <el-option label="按需" value="按需" />
                </el-select>
                <div />
              </template>
              <el-input v-model="item.note" placeholder="备注（可选）" />
              <el-button text type="danger" @click="removeIngredient(index)">删除</el-button>
              <div class="row-note">原始文本：{{ item.line || "-" }}<span v-if="item.unitText">，原单位：{{ item.unitText }}</span></div>
            </div>
          </div>

          <div class="edit-section">
            <div class="edit-section__header">
              <strong>制作步骤</strong>
              <el-button text :icon="Plus" @click="addStep">新增步骤</el-button>
            </div>
            <div v-for="(item, index) in form.steps" :key="index" class="step-edit-row">
              <el-input v-model="item.text" type="textarea" :rows="3" placeholder="步骤正文" />
              <el-select v-model="item.imageKey" placeholder="关联原图（可选）">
                <el-option label="不关联图片" value="" />
                <el-option
                  v-for="image in imageOptions"
                  :key="image.key"
                  :label="sourceImageLabel(image)"
                  :value="image.key"
                />
              </el-select>
              <el-button text type="danger" @click="removeStep(index)">删除</el-button>
            </div>
          </div>
        </el-form>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.item-meta {
  flex-wrap: wrap;
  align-items: center;
}

.import-layout {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(560px, 1.1fr);
  gap: 16px;
}

.source-panel,
.form-panel {
  padding: 20px;
}

.source-block + .source-block {
  margin-top: 24px;
}

.source-block h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.markdown-raw {
  overflow: auto;
  max-height: 520px;
  padding: 14px;
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  background: #0f172a;
  border-radius: 10px;
  color: #e2e8f0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.image-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  margin: 0;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.image-card img {
  width: 100%;
  border-radius: 8px;
}

.image-card figcaption {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: #475569;
}

.issue-list {
  display: grid;
  gap: 8px;
  padding-left: 18px;
  margin: 0;
  color: #475569;
}

.issue-list--error {
  color: #b91c1c;
}

.empty-tip {
  font-size: 13px;
  color: #6b7280;
}

.edit-section + .edit-section {
  margin-top: 24px;
}

.edit-section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.ingredient-edit-row,
.step-edit-row {
  display: grid;
  gap: 10px;
  padding: 14px;
  margin-bottom: 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.ingredient-edit-row {
  grid-template-columns: 1.1fr 1.2fr 120px 120px 140px 1fr 72px;
  align-items: start;
}

.step-edit-row {
  grid-template-columns: 1fr 240px 72px;
  align-items: start;
}

.row-note {
  grid-column: 1 / -1;
  font-size: 12px;
  color: #64748b;
}
</style>
