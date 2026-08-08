<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, Plus, Upload } from "@element-plus/icons-vue";
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
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { difficultyOptions, durationOptions } from "@/utils/recipe-meta";

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

const coverFrameWidth = 320;
const coverFrameHeight = 240;
const exportCoverWidth = 1200;
const exportCoverHeight = 900;

const fuzzyOptions: FuzzyText[] = ["适量", "少许", "按需"];

const loading = ref(false);
const saving = ref(false);
const imageSaving = ref(false);
const cropDialogVisible = ref(false);
const coverPreviewUrl = ref<string | null>(null);
const router = useRouter();
const inspirationCategories = ref<AdminInspirationCategorySummary[]>([]);
const ingredientCategories = ref<AdminIngredientCategorySummary[]>([]);
const ingredientOptions = ref<AdminIngredientSummary[]>([]);
const unitOptions = ref<AdminUnitSummary[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
useAdminHeaderRefresh(() => {
  void loadOptions();
});

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
  coverImageUrl: null as string | null,
  coverImageTempKey: null as string | null,
  content: {
    name: "",
    story: "",
    baseServings: 1,
    difficulty: "BEGINNER" as Difficulty,
    duration: "WITHIN_15" as Duration,
    estimatedCalories: null as number | null,
    tips: "",
    ingredients: [] as EditIngredientRow[],
    steps: [] as EditStepRow[]
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

const cropImageStyle = computed(() => ({
  width: `${cropState.sourceWidth * cropState.scale}px`,
  height: `${cropState.sourceHeight * cropState.scale}px`,
  transform: `translate(${cropState.x}px, ${cropState.y}px)`
}));

function resetForm() {
  replaceCoverPreviewUrl(null);
  for (const step of form.content.steps) {
    revokePreviewUrl(step.previewUrl);
  }
  form.inspirationCategoryId = inspirationCategories.value[0]?.id ?? "";
  form.coverImageUrl = null;
  form.coverImageTempKey = null;
  form.content.name = "";
  form.content.story = "";
  form.content.baseServings = 1;
  form.content.difficulty = "BEGINNER";
  form.content.duration = "WITHIN_15";
  form.content.estimatedCalories = null;
  form.content.tips = "";
  form.content.ingredients = [];
  form.content.steps = [];
  addIngredient();
  addStep();
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
  revokePreviewUrl(coverPreviewUrl.value);
  coverPreviewUrl.value = nextUrl;
}

function replaceStepPreviewUrl(step: EditStepRow | undefined, nextUrl: string | null) {
  if (!step) return;
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

onMounted(() => {
  void loadOptions();
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
    <div class="toolbar-panel page-toolbar">
      <el-button text :icon="ArrowLeft" @click="goBack">返回系统菜谱</el-button>
      <div class="toolbar-spacer" />
      <el-button type="primary" :loading="saving" @click="saveRecipe">创建系统菜谱</el-button>
    </div>

    <div v-loading="loading" class="table-panel">
      <el-form label-position="top">
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
              <div class="image-editor__hint">封面图上传前裁成 `4:3`，列表和详情统一按封面图展示。</div>
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
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #f8fafc;
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

.image-editor__hint,
.step-card__hint,
.crop-dialog__hint {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
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
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
}

.step-card__preview {
  overflow: hidden;
  min-height: 140px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f8fafc;
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

@media (max-width: 960px) {
  .edit-grid,
  .ingredient-row,
  .image-editor,
  .step-card__body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
