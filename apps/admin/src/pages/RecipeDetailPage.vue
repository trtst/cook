<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, EditPen, Plus, Upload } from "@element-plus/icons-vue";
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
  type RecipeIngredientInput,
  type UpdateAdminRecipePayload
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { difficultyOptions, difficultyText, durationOptions, durationText } from "@/utils/recipe-meta";
import { formatStatusText } from "@/utils/status";

type Difficulty = AdminRecipeContentInput["difficulty"];
type Duration = AdminRecipeContentInput["duration"];
type FuzzyText = "适量" | "少许" | "按需";
type CropScene = "COVER" | "STEP";

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

interface EditStepRow {
  text: string;
  imageUrl: string | null;
  imageTempKey: string | null;
  previewUrl: string | null;
}

interface EditFormState {
  inspirationCategoryId: UUID | "";
  coverImageUrl: string | null;
  coverImageTempKey: string | null;
  content: {
    name: string;
    story: string;
    baseServings: number;
    difficulty: Difficulty;
    duration: Duration;
    estimatedCalories: number | null;
    tips: string;
    ingredients: EditIngredientRow[];
    steps: EditStepRow[];
  };
}

interface IngredientOptionItem {
  id: UUID;
  label: string;
  disabled?: boolean;
}

const coverFrameWidth = 320;
const coverFrameHeight = 240;
const exportCoverWidth = 1200;
const exportCoverHeight = 900;

const fuzzyOptions: FuzzyText[] = ["适量", "少许", "按需"];

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const optionLoading = ref(false);
const saving = ref(false);
const imageSaving = ref(false);
const editVisible = ref(false);
const cropDialogVisible = ref(false);

useAdminHeaderRefresh(() => {
  void loadDetail();
});
const coverPreviewUrl = ref<string | null>(null);
const detail = ref<AdminRecipeDetail | null>(null);
const inspirationCategories = ref<AdminInspirationCategorySummary[]>([]);
const ingredientCategories = ref<AdminIngredientCategorySummary[]>([]);
const ingredientOptions = ref<AdminIngredientSummary[]>([]);
const unitOptions = ref<AdminUnitSummary[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const cropTarget = reactive({
  scene: "COVER" as CropScene,
  stepIndex: -1
});

const cropState = reactive({
  sourceUrl: "",
  sourceWidth: 0,
  sourceHeight: 0,
  frameWidth: coverFrameWidth,
  frameHeight: coverFrameHeight,
  outputWidth: exportCoverWidth,
  outputHeight: exportCoverHeight,
  scale: 1,
  minScale: 1,
  x: 0,
  y: 0
});

const dragState = reactive({
  active: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0
});

const form = reactive<EditFormState>({
  inspirationCategoryId: "",
  coverImageUrl: null,
  coverImageTempKey: null,
  content: {
    name: "",
    story: "",
    baseServings: 1,
    difficulty: "BEGINNER",
    duration: "WITHIN_15",
    estimatedCalories: null,
    tips: "",
    ingredients: [],
    steps: []
  }
});

function parseRouteId(value: unknown) {
  const normalized = typeof value === "string" ? Number(value) : Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

const recipeId = computed<UUID | null>(() => parseRouteId(route.params.recipeId));
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

const cropImageStyle = computed(() => ({
  width: `${cropState.sourceWidth * cropState.scale}px`,
  height: `${cropState.sourceHeight * cropState.scale}px`,
  transform: `translate(${cropState.x}px, ${cropState.y}px)`
}));

function revokePreviewUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function replaceCoverPreviewUrl(nextUrl: string | null) {
  revokePreviewUrl(coverPreviewUrl.value);
  coverPreviewUrl.value = nextUrl;
}

function replaceStepPreviewUrl(step: EditStepRow | undefined, nextUrl: string | null) {
  if (!step) return;
  revokePreviewUrl(step.previewUrl);
  step.previewUrl = nextUrl;
}

async function loadDetail() {
  loading.value = true;
  try {
    if (!recipeId.value) throw new Error("菜谱 ID 缺失");
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
    const ingredientId = resolveEditId(item.ingredientId);
    if (ingredientId && validIngredientIdSet.value.has(ingredientId)) continue;
    const name =
      (ingredientId ? currentIngredientLabelMap.value.get(ingredientId) : null) ??
      (ingredientId ? activeIngredientLabelMap.value.get(ingredientId) : null) ??
      String(item.ingredientId);
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
  replaceCoverPreviewUrl(detail.value.coverImageUrl);
  for (const step of form.content.steps) {
    revokePreviewUrl(step.previewUrl);
  }
  form.inspirationCategoryId = detail.value.inspirationCategory.id;
  form.coverImageUrl = detail.value.coverImageUrl;
  form.coverImageTempKey = null;
  form.content.name = detail.value.content.name;
  form.content.story = detail.value.content.story ?? "";
  form.content.baseServings = detail.value.content.baseServings;
  form.content.difficulty = detail.value.content.difficulty;
  form.content.duration = detail.value.content.duration;
  form.content.estimatedCalories = detail.value.content.estimatedCalories;
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
  form.content.steps = detail.value.content.steps.map(item => ({
    text: item.text,
    imageUrl: item.imageUrl,
    imageTempKey: null,
    previewUrl: item.imageUrl
  }));
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
  form.content.steps.push({
    text: "",
    imageUrl: null,
    imageTempKey: null,
    previewUrl: null
  });
}

function removeIngredient(index: number) {
  form.content.ingredients.splice(index, 1);
}

function removeStep(index: number) {
  revokePreviewUrl(form.content.steps[index]?.previewUrl);
  form.content.steps.splice(index, 1);
}

function clearCoverImage() {
  form.coverImageUrl = null;
  form.coverImageTempKey = null;
  replaceCoverPreviewUrl(null);
}

function clearStepImage(index: number) {
  const step = form.content.steps[index];
  if (!step) return;
  replaceStepPreviewUrl(step, null);
  step.imageUrl = null;
  step.imageTempKey = null;
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

function buildPayload(): UpdateAdminRecipePayload | null {
  if (!detail.value) return null;
  if (invalidIngredientNames.value.length) {
    ElMessage.error(`请先替换已下架或不可选的系统食材：${invalidIngredientNames.value.join("、")}`);
    return null;
  }
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
    expectedVersion: detail.value.version,
    inspirationCategoryId,
    coverImageUrl: form.coverImageUrl,
    coverImageTempKey: form.coverImageTempKey,
    content: {
      name: form.content.name.trim(),
      story: form.content.story.trim() ? form.content.story.trim() : null,
      baseServings: form.content.baseServings,
      difficulty: form.content.difficulty,
      duration: form.content.duration,
      estimatedCalories: form.content.estimatedCalories,
      tips: form.content.tips.trim() ? form.content.tips.trim() : null,
      ingredients,
      steps: form.content.steps.map(item => ({
        text: item.text,
        imageUrl: item.imageUrl,
        imageTempKey: item.imageTempKey
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
    resetFormFromDetail();
    ElMessage.success("已保存系统菜谱正文");
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

function revokeCropSource() {
  if (cropState.sourceUrl) {
    URL.revokeObjectURL(cropState.sourceUrl);
  }
}

function resetCropState() {
  revokeCropSource();
  cropState.sourceUrl = "";
  cropState.sourceWidth = 0;
  cropState.sourceHeight = 0;
  cropState.frameWidth = coverFrameWidth;
  cropState.frameHeight = coverFrameHeight;
  cropState.outputWidth = exportCoverWidth;
  cropState.outputHeight = exportCoverHeight;
  cropState.scale = 1;
  cropState.minScale = 1;
  cropState.x = 0;
  cropState.y = 0;
  cropTarget.scene = "COVER";
  cropTarget.stepIndex = -1;
  dragState.active = false;
}

function clampCropPosition() {
  const width = cropState.sourceWidth * cropState.scale;
  const height = cropState.sourceHeight * cropState.scale;
  const minX = cropState.frameWidth - width;
  const minY = cropState.frameHeight - height;
  cropState.x = Math.min(0, Math.max(minX, cropState.x));
  cropState.y = Math.min(0, Math.max(minY, cropState.y));
}

function centerCropImage(width: number, height: number) {
  cropState.minScale = Math.max(cropState.frameWidth / width, cropState.frameHeight / height);
  cropState.scale = cropState.minScale;
  cropState.x = (cropState.frameWidth - width * cropState.scale) / 2;
  cropState.y = (cropState.frameHeight - height * cropState.scale) / 2;
}

function applyCropScene(scene: CropScene, width: number, height: number) {
  cropTarget.scene = scene;
  if (scene === "COVER") {
    cropState.frameWidth = coverFrameWidth;
    cropState.frameHeight = coverFrameHeight;
    cropState.outputWidth = exportCoverWidth;
    cropState.outputHeight = exportCoverHeight;
    return;
  }

  const maxFrame = 320;
  const ratio = width / height;
  if (ratio >= 1) {
    cropState.frameWidth = maxFrame;
    cropState.frameHeight = Math.max(120, Math.round(maxFrame / ratio));
    cropState.outputWidth = 1200;
    cropState.outputHeight = Math.max(1, Math.round(1200 / ratio));
  } else {
    cropState.frameHeight = maxFrame;
    cropState.frameWidth = Math.max(120, Math.round(maxFrame * ratio));
    cropState.outputHeight = 1200;
    cropState.outputWidth = Math.max(1, Math.round(1200 * ratio));
  }
}

function chooseCoverFile() {
  if (imageSaving.value) return;
  cropTarget.scene = "COVER";
  cropTarget.stepIndex = -1;
  fileInput.value?.click();
}

function chooseStepFile(index: number) {
  if (imageSaving.value) return;
  cropTarget.scene = "STEP";
  cropTarget.stepIndex = index;
  fileInput.value?.click();
}

async function handleImageFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    ElMessage.error("请选择图片文件");
    return;
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    resetCropState();
    cropState.sourceUrl = sourceUrl;
    cropState.sourceWidth = image.naturalWidth || image.width;
    cropState.sourceHeight = image.naturalHeight || image.height;
    applyCropScene(cropTarget.scene, cropState.sourceWidth, cropState.sourceHeight);
    centerCropImage(cropState.sourceWidth, cropState.sourceHeight);
    cropDialogVisible.value = true;
  } catch {
    URL.revokeObjectURL(sourceUrl);
    ElMessage.error("图片读取失败，请重试");
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function beginCropDrag(event: PointerEvent) {
  if (!cropState.sourceUrl) return;
  dragState.active = true;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.originX = cropState.x;
  dragState.originY = cropState.y;
}

function handleCropDrag(event: PointerEvent) {
  if (!dragState.active) return;
  cropState.x = dragState.originX + event.clientX - dragState.startX;
  cropState.y = dragState.originY + event.clientY - dragState.startY;
  clampCropPosition();
}

function endCropDrag() {
  dragState.active = false;
}

function updateCropScale(nextScale: number) {
  const previousScale = cropState.scale;
  if (!previousScale || !cropState.sourceWidth || !cropState.sourceHeight) return;
  const centerX = (cropState.frameWidth / 2 - cropState.x) / previousScale;
  const centerY = (cropState.frameHeight / 2 - cropState.y) / previousScale;
  cropState.scale = nextScale;
  cropState.x = cropState.frameWidth / 2 - centerX * nextScale;
  cropState.y = cropState.frameHeight / 2 - centerY * nextScale;
  clampCropPosition();
}

async function renderCropFile() {
  const image = await loadImage(cropState.sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = cropState.outputWidth;
  canvas.height = cropState.outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("裁图失败");

  const sourceX = Math.max(0, -cropState.x / cropState.scale);
  const sourceY = Math.max(0, -cropState.y / cropState.scale);
  const sourceWidth = cropState.frameWidth / cropState.scale;
  const sourceHeight = cropState.frameHeight / cropState.scale;

  context.clearRect(0, 0, cropState.outputWidth, cropState.outputHeight);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, cropState.outputWidth, cropState.outputHeight);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("裁图失败");
  return new File([blob], `recipe-${cropTarget.scene.toLowerCase()}.jpg`, { type: "image/jpeg" });
}

async function submitRecipeImage() {
  if (imageSaving.value || !cropState.sourceUrl) return;
  imageSaving.value = true;
  try {
    const file = await renderCropFile();
    const result = await recipeApi.uploadImage(cropTarget.scene, file, createOperationId());
    const previewUrl = URL.createObjectURL(file);
    if (cropTarget.scene === "COVER") {
      form.coverImageTempKey = result.image.tempKey;
      replaceCoverPreviewUrl(previewUrl);
    } else {
      const step = form.content.steps[cropTarget.stepIndex];
      if (!step) throw new Error("步骤不存在");
      step.imageTempKey = result.image.tempKey;
      replaceStepPreviewUrl(step, previewUrl);
    }
    cropDialogVisible.value = false;
    resetCropState();
    ElMessage.success(cropTarget.scene === "COVER" ? "封面图已更新" : "步骤图已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传菜谱图片失败");
  } finally {
    imageSaving.value = false;
  }
}

watch(
  () => recipeId.value,
  () => {
    void loadDetail();
  }
);

watch(editVisible, value => {
  if (!value && detail.value) {
    resetFormFromDetail();
  }
});

onMounted(() => {
  void loadDetail();
});

onBeforeUnmount(() => {
  resetCropState();
  replaceCoverPreviewUrl(null);
  for (const step of form.content.steps) {
    revokePreviewUrl(step.previewUrl);
  }
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel detail-toolbar">
      <el-button text :icon="ArrowLeft" @click="goBack">返回系统菜谱</el-button>
      <div class="toolbar-spacer" />
      <el-button v-if="detail?.canEdit" class="detail-toolbar__action" type="primary" :icon="EditPen" @click="openEdit">编辑正文</el-button>
    </div>

    <div v-loading="loading" class="page-stack">
      <template v-if="detail">
        <div class="table-panel">
          <div class="panel-heading">
            <h2>{{ detail.title }}</h2>
          </div>
          <div class="detail-cover">
            <img v-if="detail.coverImageUrl" :src="detail.coverImageUrl" alt="系统菜谱封面图" class="detail-cover__image" />
            <div v-else class="detail-cover__empty">当前未上传封面图</div>
          </div>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="来源">{{ detail.ownerUid === null ? "系统" : "个人" }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ formatStatusText(detail.status) }}</el-descriptions-item>
            <el-descriptions-item label="持有人 UID">{{ detail.ownerUid ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="系统菜谱分类">{{ detail.inspirationCategory?.name ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="个人分类">{{ detail.personalCategory?.name ?? "-" }}</el-descriptions-item>
            <el-descriptions-item label="当前版本 ID">{{ detail.contentVersionId }}</el-descriptions-item>
            <el-descriptions-item label="预估卡路里">{{ detail.content.estimatedCalories ?? "-" }}</el-descriptions-item>
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
            <el-descriptions-item label="难度">{{ detail.difficultyText || difficultyText(detail.content.difficulty) }}</el-descriptions-item>
            <el-descriptions-item label="时长">{{ detail.durationText || durationText(detail.content.duration) }}</el-descriptions-item>
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
          <div class="detail-step-list">
            <div v-for="(item, index) in detail.content.steps" :key="`${index}-${item.text}-${item.imageUrl ?? 'no-image'}`" class="detail-step-card">
              <div class="detail-step-card__index">步骤 {{ index + 1 }}</div>
              <img v-if="item.imageUrl" :src="item.imageUrl" :alt="`步骤 ${index + 1} 图片`" class="detail-step-card__image" />
              <div class="multiline-text">{{ item.text || "仅步骤图" }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <el-dialog v-model="editVisible" title="编辑系统菜谱正文" width="960px">
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
          <el-form-item label="系统菜谱分类" required>
            <el-select v-model="form.inspirationCategoryId" placeholder="请选择系统菜谱分类">
              <el-option v-for="item in inspirationCategories" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="封面图">
            <div class="image-editor">
              <div class="image-editor__preview image-editor__preview--cover">
                <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="系统菜谱封面图" class="image-editor__image" />
                <div v-else class="image-editor__empty">未上传封面图</div>
              </div>
              <div class="image-editor__actions">
                <el-button type="primary" :icon="Upload" :loading="imageSaving" @click="chooseCoverFile">上传 / 替换封面</el-button>
                <el-button v-if="coverPreviewUrl" @click="clearCoverImage">删除封面</el-button>
                <div class="image-editor__hint">封面图上传前裁成 `4:3`，系统菜谱列表与详情统一展示封面图。</div>
              </div>
            </div>
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
            <el-form-item label="预估卡路里">
              <el-input-number v-model="form.content.estimatedCalories" :min="0" :max="20000" :step="10" />
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
            <div v-for="(item, index) in form.content.steps" :key="index" class="step-card">
              <div class="step-card__body">
                <el-input v-model="item.text" type="textarea" :rows="3" maxlength="1000" show-word-limit />
                <div class="step-card__image">
                  <div class="step-card__preview">
                    <img v-if="item.previewUrl" :src="item.previewUrl" :alt="`步骤 ${index + 1} 图片`" class="step-card__preview-image" />
                    <div v-else class="step-card__empty">未上传步骤图</div>
                  </div>
                  <div class="step-card__actions">
                    <el-button type="primary" link :icon="Upload" :loading="imageSaving" @click="chooseStepFile(index)">上传 / 替换步骤图</el-button>
                    <el-button v-if="item.previewUrl" link @click="clearStepImage(index)">删除步骤图</el-button>
                    <div class="step-card__hint">步骤图支持裁剪，但不锁定固定比例，详情展示保持原比例。</div>
                  </div>
                </div>
              </div>
              <div class="step-card__footer">
                <el-button text type="danger" @click="removeStep(index)">删除步骤</el-button>
              </div>
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

    <input ref="fileInput" class="hidden-file-input" type="file" accept="image/*" @change="handleImageFileChange" />

    <el-dialog v-model="cropDialogVisible" :title="cropTarget.scene === 'COVER' ? '裁剪封面图' : '裁剪步骤图'" width="680px" @closed="resetCropState">
      <div class="crop-dialog">
        <div
          class="crop-frame"
          :style="{ width: `${cropState.frameWidth}px`, height: `${cropState.frameHeight}px` }"
          @pointermove="handleCropDrag"
          @pointerup="endCropDrag"
          @pointerleave="endCropDrag"
        >
          <img
            v-if="cropState.sourceUrl"
            :src="cropState.sourceUrl"
            :style="cropImageStyle"
            class="crop-image"
            draggable="false"
            @pointerdown.prevent="beginCropDrag"
          />
        </div>
        <el-slider
          :model-value="cropState.scale"
          :min="cropState.minScale"
          :max="Math.max(cropState.minScale + 2, cropState.minScale * 3)"
          :step="0.01"
          @update:model-value="updateCropScale"
        />
        <div class="crop-dialog__hint">
          {{ cropTarget.scene === "COVER" ? "封面固定 4:3" : "步骤图保持当前图片比例" }}
        </div>
      </div>
      <template #footer>
        <el-button @click="cropDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="imageSaving" @click="submitRecipeImage">确认裁剪并上传</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.detail-toolbar__action {
  border-color: #c89b38;
  background: #c89b38;
  color: #fff;
}

.detail-toolbar__action:hover,
.detail-toolbar__action:focus-visible {
  border-color: #d4ad57;
  background: #d4ad57;
  color: #fff;
}

.detail-cover {
  overflow: hidden;
  width: min(420px, 100%);
  margin-bottom: 16px;
  border: 1px solid #ece7df;
  border-radius: 6px;
  background: #f7f5ef;
  aspect-ratio: 4 / 3;
}

.detail-cover__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-cover__empty,
.image-editor__empty,
.step-card__empty {
  display: grid;
  place-items: center;
  min-height: 160px;
  color: #8b7f6a;
  font-size: 13px;
}

.content-list {
  display: grid;
  gap: 12px;
}

.content-list__item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid #ece7df;
  border-radius: 6px;
  background: #fff;
}

.detail-step-list {
  display: grid;
  gap: 16px;
}

.detail-step-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid #ece7df;
  border-radius: 6px;
  background: #fff;
}

.detail-step-card__index {
  font-weight: 600;
  color: #1f1f1f;
}

.detail-step-card__image {
  display: block;
  max-width: min(420px, 100%);
  border-radius: 6px;
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

.image-editor {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.image-editor__preview {
  overflow: hidden;
  border: 1px solid #ece7df;
  border-radius: 6px;
  background: #f7f5ef;
}

.image-editor__preview--cover {
  aspect-ratio: 4 / 3;
}

.image-editor__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-editor__actions,
.step-card__actions {
  display: grid;
  gap: 10px;
  align-content: start;
}

.image-editor__hint,
.step-card__hint,
.crop-dialog__hint {
  color: #78716c;
  font-size: 12px;
  line-height: 1.6;
}

.step-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid #ece7df;
  border-radius: 6px;
  background: #fff;
}

.step-card__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
}

.step-card__preview {
  overflow: hidden;
  min-height: 140px;
  border: 1px solid #ece7df;
  border-radius: 6px;
  background: #f7f5ef;
}

.step-card__preview-image {
  display: block;
  width: 100%;
  height: auto;
}

.step-card__footer {
  display: flex;
  justify-content: flex-end;
}

.hidden-file-input {
  display: none;
}

.crop-dialog {
  display: grid;
  gap: 16px;
}

.crop-frame {
  position: relative;
  overflow: hidden;
  margin: 0 auto;
  border-radius: 6px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.08) 25%, transparent 25%) -12px 0 / 24px 24px,
    linear-gradient(225deg, rgba(15, 23, 42, 0.08) 25%, transparent 25%) -12px 0 / 24px 24px,
    linear-gradient(315deg, rgba(15, 23, 42, 0.08) 25%, transparent 25%) 0 0 / 24px 24px,
    linear-gradient(45deg, rgba(15, 23, 42, 0.08) 25%, transparent 25%) 0 0 / 24px 24px,
    #f1efe9;
  touch-action: none;
}

.crop-image {
  position: absolute;
  top: 0;
  left: 0;
  user-select: none;
  cursor: grab;
}

@media (max-width: 960px) {
  .edit-grid,
  .ingredient-row,
  .image-editor,
  .step-card__body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
