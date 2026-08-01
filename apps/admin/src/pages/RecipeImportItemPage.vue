<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Plus, Upload } from "@element-plus/icons-vue";
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
type CropScene = "COVER" | "STEP";

interface EditIngredientRow {
  line: string;
  ingredientName: string;
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
  unitText: string;
  note: string;
}

interface EditStepRow {
  text: string;
  imageKey: string | "";
  imageTempKey: string | null;
  previewUrl: string | null;
}

const coverFrameWidth = 320;
const coverFrameHeight = 240;
const exportCoverWidth = 1200;
const exportCoverHeight = 900;

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

const servingOptions = Array.from({ length: 20 }, (_, index) => index + 1);
const fuzzyOptions: FuzzyText[] = ["适量", "少许", "按需"];

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const optionLoading = ref(false);
const saving = ref(false);
const publishing = ref(false);
const imageSaving = ref(false);
const cropDialogVisible = ref(false);
const detail = ref<RecipeImportItemDetail | null>(null);
const coverPreviewUrl = ref<string | null>(null);
const inspirationCategories = ref<AdminInspirationCategorySummary[]>([]);
const ingredientCategories = ref<AdminIngredientCategorySummary[]>([]);
const ingredientOptions = ref<AdminIngredientSummary[]>([]);
const unitOptions = ref<AdminUnitSummary[]>([]);
const ingredientCategoryFilter = ref<UUID | "">("");
const ingredientKeyword = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
let detailRequestId = 0;

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

const form = reactive({
  inspirationCategoryId: "" as UUID | "",
  title: "",
  story: "",
  baseServings: 1 as number | null,
  difficulty: "" as Difficulty | "",
  duration: "" as Duration | "",
  estimatedCalories: null as number | null,
  tips: "",
  coverImageKey: "" as string | "",
  coverImageTempKey: null as string | null,
  ingredients: [] as EditIngredientRow[],
  steps: [] as EditStepRow[]
});

function parseRouteId(value: unknown) {
  const next = typeof value === "string" ? Number(value) : Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(next) && next > 0 ? next : null;
}

const itemId = computed<UUID | null>(() => parseRouteId(route.params.itemId));
const sourceImageMap = computed(() => new Map((detail.value?.sourceImages ?? []).map(item => [item.key, item])));
const ingredientOptionMap = computed(() => new Map(ingredientOptions.value.map(item => [item.id, item])));
const unitOptionMap = computed(() => new Map(unitOptions.value.map(item => [item.id, item])));
const unitSelectOptions = computed(() =>
  unitOptions.value.map(item => ({
    id: item.id,
    label: item.name
  }))
);
const coverOptions = computed(() => (detail.value?.sourceImages ?? []).filter(item => item.canUseAsCover));
const currentCoverPreview = computed(() => {
  if (coverPreviewUrl.value) return coverPreviewUrl.value;
  if (!form.coverImageKey) return null;
  return sourceImageMap.value.get(form.coverImageKey)?.dataUrl ?? null;
});

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

function buildSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function matchesIngredientOption(option: AdminIngredientSummary) {
  if (ingredientCategoryFilter.value && option.categoryId !== ingredientCategoryFilter.value) {
    return false;
  }
  const normalizedKeyword = buildSearchText(ingredientKeyword.value);
  if (!normalizedKeyword) {
    return true;
  }
  return buildSearchText(`${option.name}${option.categoryName}`).includes(normalizedKeyword);
}

function formatIngredientOption(option: AdminIngredientSummary) {
  return {
    id: option.id,
    label: `${option.name} · ${option.categoryName}`
  };
}

function getIngredientSelectOptions(currentId: UUID | "", draftName: string) {
  const nextOptions: Array<{ id: UUID | ""; label: string }> = [];
  const items = ingredientOptions.value.filter(matchesIngredientOption);
  if (currentId) {
    const current = ingredientOptionMap.value.get(currentId);
    if (current && !items.some(option => option.id === currentId)) {
      items.unshift(current);
    }
    return items.map(formatIngredientOption);
  }
  nextOptions.push(...items.map(formatIngredientOption));
  const fallbackName = draftName.trim();
  if (fallbackName) {
    nextOptions.unshift({
      id: "",
      label: `${fallbackName} · 待归类`
    });
  }
  return nextOptions;
}

function resolveIngredientDraftName(item: EditIngredientRow) {
  const matched = item.ingredientId ? ingredientOptionMap.value.get(item.ingredientId)?.name : null;
  return matched ?? item.ingredientName.trim();
}

function resolveUnitDraftText(item: EditIngredientRow) {
  if (item.amount.kind !== "EXACT") return null;
  const matched = item.amount.unitId ? unitOptionMap.value.get(item.amount.unitId)?.name : null;
  return matched ?? (item.unitText.trim() || null);
}

function resolveStepPreviewUrl(item: EditStepRow) {
  if (item.previewUrl) return item.previewUrl;
  if (!item.imageKey) return null;
  return sourceImageMap.value.get(item.imageKey)?.dataUrl ?? null;
}

function revokeCropSource() {
  if (cropState.sourceUrl) {
    URL.revokeObjectURL(cropState.sourceUrl);
  }
}

function revokePreviewUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function replaceCoverPreviewUrl(nextUrl: string | null) {
  if (coverPreviewUrl.value === nextUrl) {
    coverPreviewUrl.value = nextUrl;
    return;
  }
  revokePreviewUrl(coverPreviewUrl.value);
  coverPreviewUrl.value = nextUrl;
}

function replaceStepPreviewUrl(step: EditStepRow | undefined, nextUrl: string | null) {
  if (!step || step.previewUrl === nextUrl) return;
  revokePreviewUrl(step.previewUrl);
  step.previewUrl = nextUrl;
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

function collectStepPreviewMap() {
  return new Map(
    form.steps
      .filter(item => item.imageTempKey && item.previewUrl)
      .map(item => [item.imageTempKey as string, item.previewUrl as string])
  );
}

function resetFormFromDetail() {
  if (!detail.value) return;
  const body = detail.value.recipeBody;
  const previousCoverTempKey = form.coverImageTempKey;
  const previousCoverPreviewUrl = coverPreviewUrl.value;
  const previousStepPreviewMap = collectStepPreviewMap();

  form.inspirationCategoryId = body.inspirationCategoryId ?? "";
  form.title = body.title;
  form.story = body.story ?? "";
  form.baseServings = body.baseServings ?? 1;
  form.difficulty = body.difficulty ?? "";
  form.duration = body.duration ?? "";
  form.estimatedCalories = body.estimatedCalories;
  form.tips = body.tips ?? "";
  form.coverImageKey = body.coverImageKey ?? "";
  form.coverImageTempKey = body.coverImageTempKey ?? null;
  form.ingredients = body.ingredients.map(item => ({
    line: item.line,
    ingredientName: item.ingredientName,
    ingredientId: item.ingredientId ?? "",
    amount: item.fuzzyText
      ? {
          kind: "FUZZY",
          text: item.fuzzyText
        }
      : {
          kind: "EXACT",
          quantity: item.quantity ?? "",
          unitId: item.unitId ?? ""
        },
    unitText: item.unitText ?? "",
    note: item.note ?? ""
  }));
  form.steps = body.steps.map(item => ({
    text: item.text,
    imageKey: item.imageKey ?? "",
    imageTempKey: item.imageTempKey ?? null,
    previewUrl: item.imageTempKey ? previousStepPreviewMap.get(item.imageTempKey) ?? null : null
  }));

  if (previousCoverTempKey !== form.coverImageTempKey) {
    replaceCoverPreviewUrl(null);
  } else if (previousCoverPreviewUrl) {
    coverPreviewUrl.value = previousCoverPreviewUrl;
  }

  for (const [tempKey, url] of previousStepPreviewMap) {
    if (!form.steps.some(item => item.imageTempKey === tempKey)) {
      revokePreviewUrl(url);
    }
  }

  if (form.ingredients.length === 0) addIngredient();
  if (form.steps.length === 0) addStep();
}

function clearForm() {
  replaceCoverPreviewUrl(null);
  for (const step of form.steps) {
    revokePreviewUrl(step.previewUrl);
  }
  form.inspirationCategoryId = "";
  form.title = "";
  form.story = "";
  form.baseServings = 1;
  form.difficulty = "";
  form.duration = "";
  form.estimatedCalories = null;
  form.tips = "";
  form.coverImageKey = "";
  form.coverImageTempKey = null;
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
    ingredientId: "",
    amount: {
      kind: "EXACT",
      quantity: "",
      unitId: unitSelectOptions.value[0]?.id ?? ""
    },
    unitText: "",
    note: ""
  });
}

function removeIngredient(index: number) {
  form.ingredients.splice(index, 1);
}

function updateIngredientAmountKind(index: number, value: "EXACT" | "FUZZY") {
  form.ingredients[index].amount =
    value === "FUZZY"
      ? { kind: "FUZZY", text: "适量" }
      : { kind: "EXACT", quantity: "", unitId: unitSelectOptions.value[0]?.id ?? "" };
}

function addStep() {
  form.steps.push({
    text: "",
    imageKey: "",
    imageTempKey: null,
    previewUrl: null
  });
}

function removeStep(index: number) {
  const step = form.steps[index];
  if (step) {
    revokePreviewUrl(step.previewUrl);
  }
  form.steps.splice(index, 1);
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
  const nextScene = cropTarget.scene;
  const nextStepIndex = cropTarget.stepIndex;
  try {
    const image = await loadImage(sourceUrl);
    resetCropState();
    cropTarget.scene = nextScene;
    cropTarget.stepIndex = nextStepIndex;
    cropState.sourceUrl = sourceUrl;
    cropState.sourceWidth = image.naturalWidth || image.width;
    cropState.sourceHeight = image.naturalHeight || image.height;
    applyCropScene(nextScene, cropState.sourceWidth, cropState.sourceHeight);
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
  return new File([blob], `recipe-import-${cropTarget.scene.toLowerCase()}.jpg`, { type: "image/jpeg" });
}

async function submitRecipeImage() {
  if (imageSaving.value || !cropState.sourceUrl) return;
  imageSaving.value = true;
  const scene = cropTarget.scene;
  try {
    const file = await renderCropFile();
    const result = await recipeApi.uploadImage(scene, file, createOperationId());
    const previewUrl = URL.createObjectURL(file);
    if (scene === "COVER") {
      form.coverImageKey = "";
      form.coverImageTempKey = result.image.tempKey;
      replaceCoverPreviewUrl(previewUrl);
    } else {
      const step = form.steps[cropTarget.stepIndex];
      if (!step) throw new Error("步骤不存在");
      step.imageKey = "";
      step.imageTempKey = result.image.tempKey;
      replaceStepPreviewUrl(step, previewUrl);
    }
    cropDialogVisible.value = false;
    resetCropState();
    ElMessage.success(scene === "COVER" ? "头图已更新" : "步骤图已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传菜谱图片失败");
  } finally {
    imageSaving.value = false;
  }
}

function setCoverSourceImage(value: string) {
  form.coverImageKey = value;
  form.coverImageTempKey = null;
  replaceCoverPreviewUrl(null);
}

function clearCoverImage() {
  form.coverImageKey = "";
  form.coverImageTempKey = null;
  replaceCoverPreviewUrl(null);
}

function setStepSourceImage(index: number, value: string) {
  const step = form.steps[index];
  if (!step) return;
  step.imageKey = value;
  step.imageTempKey = null;
  replaceStepPreviewUrl(step, null);
}

function clearStepImage(index: number) {
  const step = form.steps[index];
  if (!step) return;
  step.imageKey = "";
  step.imageTempKey = null;
  replaceStepPreviewUrl(step, null);
}

function buildRecipeBody(): RecipeImportRecipeBody {
  return {
    inspirationCategoryId: form.inspirationCategoryId || null,
    title: form.title.trim(),
    story: form.story.trim() ? form.story.trim() : null,
    baseServings: form.baseServings ?? 1,
    difficulty: (form.difficulty || null) as RecipeImportRecipeBody["difficulty"],
    duration: (form.duration || null) as RecipeImportRecipeBody["duration"],
    estimatedCalories: form.estimatedCalories,
    tips: form.tips.trim() ? form.tips.trim() : null,
    coverImageKey: form.coverImageKey || null,
    coverImageTempKey: form.coverImageTempKey,
    ingredients: form.ingredients.map(item => ({
      line: item.line.trim(),
      ingredientName: resolveIngredientDraftName(item),
      ingredientId: item.ingredientId || null,
      quantity: item.amount.kind === "EXACT" ? (item.amount.quantity.trim() || null) : null,
      unitText: item.amount.kind === "EXACT" ? resolveUnitDraftText(item) : null,
      unitId: item.amount.kind === "EXACT" ? item.amount.unitId || null : null,
      fuzzyText: item.amount.kind === "FUZZY" ? item.amount.text : null,
      note: item.note.trim() ? item.note.trim() : null
    })),
    steps: form.steps.map(item => ({
      text: item.text.trim(),
      imageKey: item.imageKey || null,
      imageTempKey: item.imageTempKey
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

onBeforeUnmount(() => {
  resetCropState();
  clearForm();
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
              <el-select v-model="form.baseServings" placeholder="请选择基准人数">
                <el-option v-for="value in servingOptions" :key="value" :label="`${value} 人`" :value="value" />
              </el-select>
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
          </div>

          <el-form-item label="头图">
            <div class="image-editor">
              <div class="image-editor__preview image-editor__preview--cover image-editor__preview--clickable" @click="chooseCoverFile">
                <img v-if="currentCoverPreview" :src="currentCoverPreview" alt="导入条目头图" class="image-editor__image" />
                <div v-else class="image-editor__empty">点击上传头图</div>
              </div>
              <div class="image-editor__actions">
                <el-button type="primary" :icon="Upload" :loading="imageSaving" @click="chooseCoverFile">点击上传</el-button>
                <el-select
                  :model-value="form.coverImageKey"
                  clearable
                  placeholder="或直接选原图"
                  @update:model-value="setCoverSourceImage($event ?? '')"
                >
                  <el-option label="不设置头图" value="" />
                  <el-option
                    v-for="item in coverOptions"
                    :key="item.key"
                    :label="sourceImageLabel(item)"
                    :value="item.key"
                  />
                </el-select>
                <el-button v-if="currentCoverPreview" @click="clearCoverImage">删除头图</el-button>
              </div>
            </div>
          </el-form-item>

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
            <div class="ingredient-tools">
              <el-select v-model="ingredientCategoryFilter" placeholder="按食材分类筛选">
                <el-option label="全部分类" value="" />
                <el-option v-for="item in ingredientCategories" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <el-input v-model="ingredientKeyword" clearable placeholder="搜索系统食材名称或分类" />
            </div>
            <div v-for="(item, index) in form.ingredients" :key="index" class="ingredient-row">
              <el-select v-model="item.ingredientId" filterable class="ingredient-row__ingredient" placeholder="匹配系统食材">
                <el-option
                  v-for="option in getIngredientSelectOptions(item.ingredientId, item.ingredientName)"
                  :key="`${option.id}-${option.label}`"
                  :label="option.label"
                  :value="option.id"
                />
              </el-select>
              <el-select
                :model-value="item.amount.kind"
                class="ingredient-row__kind"
                @update:model-value="updateIngredientAmountKind(index, $event as 'EXACT' | 'FUZZY')"
              >
                <el-option label="精确用量" value="EXACT" />
                <el-option label="模糊用量" value="FUZZY" />
              </el-select>
              <template v-if="item.amount.kind === 'EXACT'">
                <el-input v-model="item.amount.quantity" class="ingredient-row__quantity" placeholder="数量" />
                <el-select v-model="item.amount.unitId" class="ingredient-row__unit" placeholder="单位">
                  <el-option label="请选择单位" value="" />
                  <el-option v-for="option in unitSelectOptions" :key="option.id" :label="option.label" :value="option.id" />
                </el-select>
              </template>
              <el-select v-else v-model="item.amount.text" class="ingredient-row__fuzzy" placeholder="模糊用量">
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
            <div v-for="(item, index) in form.steps" :key="index" class="step-card">
              <div class="step-card__body">
                <el-input v-model="item.text" type="textarea" :rows="3" maxlength="1000" show-word-limit />
                <div class="step-card__image">
                  <div class="step-card__preview step-card__preview--clickable" @click="chooseStepFile(index)">
                    <img
                      v-if="resolveStepPreviewUrl(item)"
                      :src="resolveStepPreviewUrl(item) ?? undefined"
                      :alt="`步骤 ${index + 1} 图片`"
                      class="step-card__preview-image"
                    />
                    <div v-else class="step-card__empty">点击上传步骤图</div>
                  </div>
                  <div class="step-card__actions">
                    <el-button type="primary" link :icon="Upload" :loading="imageSaving" @click="chooseStepFile(index)">点击上传</el-button>
                    <el-select
                      :model-value="item.imageKey"
                      clearable
                      placeholder="或直接选原图"
                      @update:model-value="setStepSourceImage(index, $event ?? '')"
                    >
                      <el-option label="不关联图片" value="" />
                      <el-option
                        v-for="image in detail?.sourceImages ?? []"
                        :key="image.key"
                        :label="sourceImageLabel(image)"
                        :value="image.key"
                      />
                    </el-select>
                    <el-button v-if="resolveStepPreviewUrl(item)" link @click="clearStepImage(index)">删除步骤图</el-button>
                  </div>
                </div>
              </div>
              <div class="step-card__footer">
                <el-button text type="danger" @click="removeStep(index)">删除步骤</el-button>
              </div>
            </div>
          </div>
        </el-form>
      </div>
    </div>

    <input ref="fileInput" class="hidden-file-input" type="file" accept="image/*" @change="handleImageFileChange" />

    <el-dialog v-model="cropDialogVisible" :title="cropTarget.scene === 'COVER' ? '裁剪头图' : '裁剪步骤图'" width="680px" @closed="resetCropState">
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
            :style="{
              width: `${cropState.sourceWidth * cropState.scale}px`,
              height: `${cropState.sourceHeight * cropState.scale}px`,
              transform: `translate(${cropState.x}px, ${cropState.y}px)`
            }"
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
          {{ cropTarget.scene === "COVER" ? "头图固定 4:3" : "步骤图保持当前图片比例" }}
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
.item-meta {
  flex-wrap: wrap;
  align-items: center;
}

.import-layout {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(600px, 1.1fr);
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

.edit-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.edit-section {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}

.edit-section__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ingredient-tools {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 12px;
}

.ingredient-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) 140px minmax(0, 120px) minmax(0, 140px) auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.ingredient-row__ingredient,
.ingredient-row__kind,
.ingredient-row__quantity,
.ingredient-row__unit,
.ingredient-row__fuzzy {
  width: 100%;
}

.image-editor {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.image-editor__preview,
.step-card__preview {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #f8fafc;
}

.image-editor__preview--cover {
  aspect-ratio: 4 / 3;
}

.image-editor__preview--clickable,
.step-card__preview--clickable {
  cursor: pointer;
}

.image-editor__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-editor__empty,
.step-card__empty {
  display: grid;
  place-items: center;
  min-height: 140px;
  color: #94a3b8;
  font-size: 13px;
}

.image-editor__actions,
.step-card__actions {
  display: grid;
  gap: 10px;
  align-content: start;
}

.step-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
}

.step-card__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 16px;
}

.step-card__preview {
  min-height: 140px;
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
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.08) 25%, transparent 25%) -12px 0 / 24px 24px,
    linear-gradient(225deg, rgba(15, 23, 42, 0.08) 25%, transparent 25%) -12px 0 / 24px 24px,
    linear-gradient(315deg, rgba(15, 23, 42, 0.08) 25%, transparent 25%) 0 0 / 24px 24px,
    linear-gradient(45deg, rgba(15, 23, 42, 0.08) 25%, transparent 25%) 0 0 / 24px 24px,
    #eef2f7;
  touch-action: none;
}

.crop-image {
  position: absolute;
  top: 0;
  left: 0;
  user-select: none;
  cursor: grab;
}

.crop-dialog__hint {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1200px) {
  .import-layout,
  .edit-grid,
  .image-editor,
  .step-card__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 960px) {
  .ingredient-tools,
  .ingredient-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
