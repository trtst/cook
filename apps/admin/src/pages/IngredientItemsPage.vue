<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { Plus, Refresh, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  ingredientApi,
  type AdminIngredientCategorySummary,
  type AdminIngredientSummary,
  type AdminUnitSummary
} from "@/apis/ingredient";

type IngredientDialogMode = "create" | "edit";
type IngredientStatusFilter = "ACTIVE" | "DISABLED" | "ALL";

const cropFrameSize = 240;
const exportImageSize = 50;
const pageSize = 15;

const unitTypeLabelMap: Record<AdminUnitSummary["type"], string> = {
  WEIGHT: "重量",
  VOLUME: "体积",
  COUNT: "数量",
  SHAPE: "形态",
  CONTAINER: "容器",
  PACKAGE: "包装",
  OTHER: "其他"
};

const loading = ref(false);
const saving = ref(false);
const batchSaving = ref(false);
const imageSaving = ref(false);
const dialogVisible = ref(false);
const batchDialogVisible = ref(false);
const cropDialogVisible = ref(false);
const dialogMode = ref<IngredientDialogMode>("create");
const editingIngredientId = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const categories = ref<AdminIngredientCategorySummary[]>([]);
const ingredients = ref<AdminIngredientSummary[]>([]);
const units = ref<AdminUnitSummary[]>([]);
const total = ref(0);
const page = ref(1);
const hasMoreIngredients = ref(false);
const draggingIngredientId = ref("");
const loadMoreRef = ref<HTMLElement | null>(null);

let loadMoreObserver: IntersectionObserver | null = null;
let ingredientsRequest = 0;

const query = reactive({
  keyword: "",
  categoryId: "",
  status: "ACTIVE" as IngredientStatusFilter
});

const form = reactive({
  name: "",
  categoryId: "",
  defaultUnitId: ""
});

const batchForm = reactive({
  categoryId: "",
  text: ""
});

const cropTarget = reactive({
  ingredientId: "",
  expectedVersion: 0,
  ingredientName: ""
});

const cropState = reactive({
  sourceUrl: "",
  sourceWidth: 0,
  sourceHeight: 0,
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

const unitGroups = computed(() => {
  const groups = new Map<AdminUnitSummary["type"], AdminUnitSummary[]>();
  for (const item of units.value) {
    const list = groups.get(item.type) || [];
    list.push(item);
    groups.set(item.type, list);
  }
  return Array.from(groups.entries()).map(([type, items]) => ({
    type,
    label: unitTypeLabelMap[type],
    items
  }));
});

const unitNameMap = computed(() => {
  const map = new Map<string, AdminUnitSummary[]>();
  for (const unit of units.value) {
    const list = map.get(unit.name) || [];
    list.push(unit);
    map.set(unit.name, list);
  }
  return map;
});

const selectableCategories = computed(() => categories.value.filter(item => item.isSelectable));

const categoryFormOptions = computed(() => {
  const options = selectableCategories.value.slice();
  if (!form.categoryId) return options;
  if (options.some(item => item.id === form.categoryId)) return options;
  const current = categories.value.find(item => item.id === form.categoryId);
  return current ? [current, ...options] : options;
});

const editingIngredient = computed(() => ingredients.value.find(item => item.id === editingIngredientId.value) || null);

const cropImageStyle = computed(() => ({
  width: `${cropState.sourceWidth * cropState.scale}px`,
  height: `${cropState.sourceHeight * cropState.scale}px`,
  transform: `translate(${cropState.x}px, ${cropState.y}px)`
}));

function resetForm() {
  form.name = "";
  form.categoryId = selectableCategories.value.find(item => item.id === query.categoryId)?.id || selectableCategories.value[0]?.id || "";
  form.defaultUnitId = units.value[0]?.id || "";
  editingIngredientId.value = null;
}

function resetBatchForm() {
  batchForm.categoryId = selectableCategories.value.find(item => item.id === query.categoryId)?.id || selectableCategories.value[0]?.id || "";
  batchForm.text = "";
}

function resetCropState() {
  if (cropState.sourceUrl) {
    URL.revokeObjectURL(cropState.sourceUrl);
  }
  cropState.sourceUrl = "";
  cropState.sourceWidth = 0;
  cropState.sourceHeight = 0;
  cropState.scale = 1;
  cropState.minScale = 1;
  cropState.x = 0;
  cropState.y = 0;
  cropTarget.ingredientId = "";
  cropTarget.expectedVersion = 0;
  cropTarget.ingredientName = "";
  dragState.active = false;
}

function clampCropPosition() {
  const width = cropState.sourceWidth * cropState.scale;
  const height = cropState.sourceHeight * cropState.scale;
  const minX = cropFrameSize - width;
  const minY = cropFrameSize - height;
  cropState.x = Math.min(0, Math.max(minX, cropState.x));
  cropState.y = Math.min(0, Math.max(minY, cropState.y));
}

function centerCropImage(width: number, height: number) {
  cropState.minScale = Math.max(cropFrameSize / width, cropFrameSize / height);
  cropState.scale = cropState.minScale;
  cropState.x = (cropFrameSize - width * cropState.scale) / 2;
  cropState.y = (cropFrameSize - height * cropState.scale) / 2;
}

async function loadCategories() {
  categories.value = await ingredientApi.listCategories();
  if (!query.categoryId || !categories.value.some(item => item.id === query.categoryId)) {
    query.categoryId = selectableCategories.value[0]?.id || categories.value[0]?.id || "";
  }
  if (!form.categoryId) {
    form.categoryId = selectableCategories.value.find(item => item.id === query.categoryId)?.id || selectableCategories.value[0]?.id || "";
  }
  if (!batchForm.categoryId) {
    batchForm.categoryId = selectableCategories.value.find(item => item.id === query.categoryId)?.id || selectableCategories.value[0]?.id || "";
  }
}

async function loadUnits() {
  units.value = await ingredientApi.listUnits();
  if (!form.defaultUnitId) {
    form.defaultUnitId = units.value[0]?.id || "";
  }
}

async function loadIngredients(reset = true) {
  if (!query.categoryId) {
    ingredients.value = [];
    total.value = 0;
    page.value = 1;
    hasMoreIngredients.value = false;
    return;
  }
  const requestId = ++ingredientsRequest;
  const nextPage = reset ? 1 : page.value + 1;
  loading.value = true;
  try {
    const result = await ingredientApi.listIngredients({
      page: nextPage,
      pageSize,
      categoryId: query.categoryId,
      keyword: query.keyword.trim() || undefined,
      status: query.status
    });
    if (requestId !== ingredientsRequest) return;
    ingredients.value = reset ? result.items : [...ingredients.value, ...result.items];
    total.value = result.total;
    page.value = result.page;
    hasMoreIngredients.value = result.hasNext;
  } catch (error) {
    if (requestId !== ingredientsRequest) return;
    ElMessage.error(error instanceof Error ? error.message : "加载系统食材失败");
  } finally {
    if (requestId === ingredientsRequest) {
      loading.value = false;
    }
  }
}

async function loadPage() {
  try {
    await Promise.all([loadCategories(), loadUnits()]);
    await loadIngredients();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载系统食材失败");
  }
}

async function selectCategory(categoryId: string) {
  if (query.categoryId === categoryId) return;
  query.categoryId = categoryId;
  query.keyword = "";
  await loadIngredients();
}

async function changeStatus(status: IngredientStatusFilter) {
  await loadIngredients();
}

function loadMoreIngredients() {
  if (loading.value || !hasMoreIngredients.value) return;
  void loadIngredients(false);
}

function stopLoadMoreObserver() {
  if (!loadMoreObserver) return;
  loadMoreObserver.disconnect();
  loadMoreObserver = null;
}

function startLoadMoreObserver() {
  stopLoadMoreObserver();
  if (!loadMoreRef.value || !hasMoreIngredients.value) return;
  loadMoreObserver = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        loadMoreIngredients();
      }
    },
    {
      rootMargin: "120px 0px"
    }
  );
  loadMoreObserver.observe(loadMoreRef.value);
}

function openCreateIngredient() {
  dialogMode.value = "create";
  resetForm();
  dialogVisible.value = true;
}

function openEditIngredient(row: AdminIngredientSummary) {
  dialogMode.value = "edit";
  editingIngredientId.value = row.id;
  form.name = row.name;
  form.categoryId = row.categoryId;
  form.defaultUnitId = row.defaultUnit.id;
  dialogVisible.value = true;
}

function openBatchDialog() {
  resetBatchForm();
  batchDialogVisible.value = true;
}

function canSortIngredients() {
  return query.status === "ACTIVE" && Boolean(query.categoryId) && !query.keyword.trim() && !hasMoreIngredients.value;
}

async function submitIngredient() {
  const name = form.name.trim();
  if (!name) {
    ElMessage.error("请输入食材名称");
    return;
  }
  if (!form.categoryId) {
    ElMessage.error("请选择分类");
    return;
  }
  if (!form.defaultUnitId) {
    ElMessage.error("请选择默认单位");
    return;
  }
  saving.value = true;
  try {
    if (dialogMode.value === "create") {
      await ingredientApi.createIngredient({
        operationId: crypto.randomUUID(),
        name,
        categoryId: form.categoryId,
        defaultUnitId: form.defaultUnitId
      });
      ElMessage.success("系统食材已创建");
    } else if (editingIngredientId.value) {
      const current = ingredients.value.find(item => item.id === editingIngredientId.value);
      if (!current) {
        ElMessage.error("食材信息缺失");
        return;
      }
      await ingredientApi.updateIngredient(editingIngredientId.value, {
        operationId: crypto.randomUUID(),
        expectedVersion: current.version,
        name,
        categoryId: form.categoryId,
        defaultUnitId: form.defaultUnitId
      });
      ElMessage.success("系统食材已更新");
    }
    dialogVisible.value = false;
    resetForm();
    await Promise.all([loadCategories(), loadIngredients()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存食材失败");
  } finally {
    saving.value = false;
  }
}

function parseBatchText() {
  const categoryId = batchForm.categoryId;
  if (!categoryId) {
    ElMessage.error("请选择分类");
    return null;
  }
  const lines = batchForm.text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter(item => item.line);

  if (!lines.length) {
    ElMessage.error("请先输入批量食材");
    return null;
  }

  const items: Array<{ name: string; defaultUnitId: string }> = [];
  const seen = new Set<string>();
  for (const { line, index } of lines) {
    const parts = line.split(/[,\uFF0C\t]/).map(item => item.trim()).filter(Boolean);
    const name = parts[0] || "";
    const unitName = parts[1] || "";
    if (!name || !unitName) {
      ElMessage.error(`第 ${index} 行格式不正确，请使用“食材名,单位名”`);
      return null;
    }
    if (seen.has(name)) {
      ElMessage.error(`第 ${index} 行食材“${name}”重复`);
      return null;
    }
    seen.add(name);
    const matchedUnits = unitNameMap.value.get(unitName) || [];
    if (matchedUnits.length !== 1) {
      ElMessage.error(
        matchedUnits.length === 0
          ? `第 ${index} 行单位“${unitName}”不存在`
          : `第 ${index} 行单位“${unitName}”不唯一，请改名后重试`
      );
      return null;
    }
    items.push({
      name,
      defaultUnitId: matchedUnits[0].id
    });
  }

  return {
    categoryId,
    items
  };
}

async function submitBatchIngredients() {
  const parsed = parseBatchText();
  if (!parsed) return;
  batchSaving.value = true;
  let createdCount = 0;
  try {
    for (const item of parsed.items) {
      await ingredientApi.createIngredient({
        operationId: crypto.randomUUID(),
        name: item.name,
        categoryId: parsed.categoryId,
        defaultUnitId: item.defaultUnitId
      });
      createdCount += 1;
    }
    batchDialogVisible.value = false;
    resetBatchForm();
    await Promise.all([loadCategories(), loadIngredients()]);
    ElMessage.success(`已导入 ${createdCount} 条系统食材`);
  } catch (error) {
    ElMessage.warning(
      error instanceof Error
        ? `已成功导入 ${createdCount} 条，剩余失败：${error.message}`
        : `已成功导入 ${createdCount} 条，剩余失败`
    );
    await Promise.all([loadCategories(), loadIngredients()]);
  } finally {
    batchSaving.value = false;
  }
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number) {
  const cloned = items.slice();
  const [target] = cloned.splice(fromIndex, 1);
  cloned.splice(toIndex, 0, target);
  return cloned;
}

async function applyIngredientOrder(nextList: AdminIngredientSummary[]) {
  if (!query.categoryId) return;
  const previousList = ingredients.value.slice();
  ingredients.value = nextList;
  try {
    await ingredientApi.reorderIngredients(
      query.categoryId,
      crypto.randomUUID(),
      nextList.map(item => ({
        id: item.id,
        expectedVersion: item.version
      }))
    );
    await loadIngredients();
    ElMessage.success("食材顺序已更新");
  } catch (error) {
    ingredients.value = previousList;
    ElMessage.error(error instanceof Error ? error.message : "食材排序失败");
    await loadIngredients();
  }
}

function handleIngredientDragStart(event: DragEvent, row: AdminIngredientSummary) {
  if (!query.categoryId || query.status !== "ACTIVE" || query.keyword.trim()) {
    event.preventDefault();
    ElMessage.error("筛选中不能拖拽排序，请先清空关键词");
    return;
  }
  if (hasMoreIngredients.value) {
    event.preventDefault();
    ElMessage.error("请先加载完整分类后再排序");
    return;
  }
  draggingIngredientId.value = row.id;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.id);
  }
}

function handleIngredientDragEnd() {
  draggingIngredientId.value = "";
}

function handleIngredientDragOver(event: DragEvent, row: AdminIngredientSummary) {
  if (!draggingIngredientId.value || draggingIngredientId.value === row.id || !canSortIngredients()) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

async function handleIngredientDrop(row: AdminIngredientSummary) {
  if (!draggingIngredientId.value || draggingIngredientId.value === row.id || !canSortIngredients()) return;

  const orderedItems = ingredients.value;
  const fromIndex = orderedItems.findIndex(item => item.id === draggingIngredientId.value);
  const toIndex = orderedItems.findIndex(item => item.id === row.id);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    handleIngredientDragEnd();
    return;
  }

  await applyIngredientOrder(reorderList(orderedItems, fromIndex, toIndex));
  handleIngredientDragEnd();
}

function chooseImageFile(row: AdminIngredientSummary) {
  if (imageSaving.value) return;
  cropTarget.ingredientId = row.id;
  cropTarget.expectedVersion = row.version;
  cropTarget.ingredientName = row.name;
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
  const centerX = (cropFrameSize / 2 - cropState.x) / previousScale;
  const centerY = (cropFrameSize / 2 - cropState.y) / previousScale;
  cropState.scale = nextScale;
  cropState.x = cropFrameSize / 2 - centerX * nextScale;
  cropState.y = cropFrameSize / 2 - centerY * nextScale;
  clampCropPosition();
}

async function renderCropFile() {
  const image = await loadImage(cropState.sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = exportImageSize;
  canvas.height = exportImageSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("裁图失败");

  const sourceX = Math.max(0, -cropState.x / cropState.scale);
  const sourceY = Math.max(0, -cropState.y / cropState.scale);
  const sourceSize = cropFrameSize / cropState.scale;

  context.clearRect(0, 0, exportImageSize, exportImageSize);
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, exportImageSize, exportImageSize);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("裁图失败");
  return new File([blob], `ingredient-${cropTarget.ingredientId}.png`, { type: "image/png" });
}

async function submitIngredientImage() {
  if (!cropTarget.ingredientId || imageSaving.value) return;
  imageSaving.value = true;
  try {
    const file = await renderCropFile();
    await ingredientApi.uploadIngredientImage(
      cropTarget.ingredientId,
      file,
      crypto.randomUUID(),
      cropTarget.expectedVersion
    );
    cropDialogVisible.value = false;
    resetCropState();
    await loadIngredients();
    ElMessage.success("食材图片已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传食材图片失败");
  } finally {
    imageSaving.value = false;
  }
}

async function toggleIngredientStatus(row: AdminIngredientSummary, status: "ACTIVE" | "DISABLED") {
  try {
    await ElMessageBox.confirm(
      status === "DISABLED" ? `确认下架“${row.name}”？` : `确认重新上架“${row.name}”？`,
      status === "DISABLED" ? "下架食材" : "重新上架",
      {
        type: "warning",
        confirmButtonText: status === "DISABLED" ? "下架" : "上架",
        cancelButtonText: "取消"
      }
    );
  } catch {
    return;
  }

  saving.value = true;
  try {
    await ingredientApi.setIngredientStatus(row.id, {
      operationId: crypto.randomUUID(),
      expectedVersion: row.version,
      status
    });
    await Promise.all([loadCategories(), loadIngredients()]);
    ElMessage.success(status === "DISABLED" ? "系统食材已下架" : "系统食材已重新上架");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : status === "DISABLED" ? "下架食材失败" : "重新上架失败");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadPage();
});

onBeforeUnmount(() => {
  stopLoadMoreObserver();
});

watch(
  ingredients,
  items => {
  if (!items.some(item => item.id === draggingIngredientId.value)) {
    draggingIngredientId.value = "";
  }
  }
);

watch(
  () => [hasMoreIngredients.value, loading.value, ingredients.value.length],
  () => {
    void nextTick(startLoadMoreObserver);
  },
  { flush: "post" }
);
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <div class="page-title-block">
        <strong>系统食材</strong>
        <div class="page-subtitle">按分类维护系统食材，支持单个新增、批量导入、图片后传和分类内排序。</div>
      </div>
      <div class="toolbar-spacer" />
      <el-select v-model="query.status" class="toolbar-select" placeholder="状态" @change="changeStatus">
        <el-option label="启用中" value="ACTIVE" />
        <el-option label="已下架" value="DISABLED" />
        <el-option label="全部" value="ALL" />
      </el-select>
      <el-input
        v-model="query.keyword"
        class="toolbar-search toolbar-search--wide"
        :placeholder="query.categoryId ? '在当前分类内筛选食材' : '请选择分类'"
        :disabled="!query.categoryId"
        clearable
        @clear="loadIngredients"
        @keyup.enter="loadIngredients"
      />
      <el-button type="primary" :icon="Plus" @click="openCreateIngredient">新增系统食材</el-button>
      <el-button @click="openBatchDialog">批量导入</el-button>
      <el-button :icon="Refresh" @click="loadIngredients">刷新</el-button>
    </div>

    <div class="ingredient-layout">
      <aside class="category-panel table-panel">
        <div class="category-panel__title">食材分类</div>
        <button
          v-for="item in categories"
          :key="item.id"
          type="button"
          class="category-item"
          :class="{ 'category-item--active': item.id === query.categoryId }"
          @click="selectCategory(item.id)"
        >
          <span class="category-item__name">
            {{ item.name }}
            <span v-if="!item.isSelectable" class="category-item__tag">兜底</span>
          </span>
          <span class="category-item__count">{{ item.ingredientCount }}</span>
        </button>
      </aside>

      <div class="table-panel ingredient-table-panel">
        <div v-loading="loading" class="ingredient-card-grid">
          <div
            v-for="row in ingredients"
            :key="row.id"
            class="ingredient-card"
            :class="{ 'ingredient-card--dragging': draggingIngredientId === row.id }"
            @dragover="handleIngredientDragOver($event, row)"
            @drop.prevent="handleIngredientDrop(row)"
          >
            <div class="ingredient-card__cover">
              <img v-if="row.imageUrl" :src="row.imageUrl" :alt="`${row.name} 图片`" class="ingredient-card__image" />
              <div v-else class="ingredient-card__empty">暂无主图</div>
              <button
                v-if="canSortIngredients()"
                type="button"
                class="ingredient-card__drag"
                draggable="true"
                @dragstart="handleIngredientDragStart($event, row)"
                @dragend="handleIngredientDragEnd"
                @click.stop.prevent
              >
                拖拽排序
              </button>
              <span v-if="row.status === 'DISABLED'" class="ingredient-card__status">已下架</span>
            </div>
            <div class="ingredient-card__body">
              <div class="ingredient-card__main">
                <div class="ingredient-card__name">{{ row.name }}</div>
                <div class="ingredient-card__unit">{{ row.defaultUnit.name }}</div>
              </div>
            </div>
            <div class="ingredient-card__actions">
              <div class="ingredient-card__actions-left">
                <div class="ingredient-card__action-item">
                  <el-button link type="primary" @click="openEditIngredient(row)">编辑</el-button>
                </div>
                <div class="ingredient-card__action-item">
                  <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="toggleIngredientStatus(row, 'DISABLED')">下架</el-button>
                  <el-button v-else link type="primary" @click="toggleIngredientStatus(row, 'ACTIVE')">重新上架</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="ingredient-table-panel__footer">
          <div class="table-hint">当前分类共 {{ total }} 条。下滑继续按服务端分页加载；仅“启用中 + 无关键词 + 已加载完整分类”支持拖拽排序。</div>
          <div v-if="hasMoreIngredients" ref="loadMoreRef" class="ingredient-load-more">下滑继续加载更多</div>
          <div v-else class="ingredient-load-more ingredient-load-more--end">当前分类已全部加载</div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新增系统食材' : '编辑系统食材'"
      width="560px"
      @closed="resetForm"
    >
      <el-form label-position="top">
        <el-form-item label="食材名称">
          <el-input v-model="form.name" maxlength="64" placeholder="例如：西红柿" />
        </el-form-item>
        <el-form-item label="所属分类">
          <el-select v-model="form.categoryId" placeholder="请选择分类">
            <el-option v-for="item in categoryFormOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认单位">
          <el-select v-model="form.defaultUnitId" placeholder="请选择默认单位">
            <el-option-group v-for="group in unitGroups" :key="group.type" :label="group.label">
              <el-option v-for="item in group.items" :key="item.id" :label="item.name" :value="item.id" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item v-if="dialogMode === 'edit'" label="食材图片">
          <div class="edit-image-panel">
            <img
              v-if="editingIngredient?.imageUrl"
              :src="editingIngredient.imageUrl"
              :alt="`${editingIngredient.name} 图片`"
              class="edit-image-panel__preview"
            />
            <div v-else class="edit-image-panel__empty">当前未上传图片</div>
            <div class="edit-image-panel__actions">
              <el-button type="primary" :icon="Upload" :loading="imageSaving" @click="editingIngredient && chooseImageFile(editingIngredient)">
                上传 / 替换图片
              </el-button>
              <div class="edit-image-panel__hint">上传前可裁成方图，服务端只接收最终 `50x50 PNG`。</div>
            </div>
          </div>
        </el-form-item>
        <el-form-item v-else label="食材图片">
          <div class="table-hint">先创建系统食材，后续再上传 `50x50` 小图。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitIngredient">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchDialogVisible" title="批量导入系统食材" width="560px" @closed="resetBatchForm">
      <el-form label-position="top">
        <el-form-item label="所属分类">
          <el-select v-model="batchForm.categoryId" placeholder="请选择分类">
            <el-option v-for="item in selectableCategories" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="多行文本批量导入">
          <el-input
            v-model="batchForm.text"
            type="textarea"
            :rows="8"
            placeholder="盐,克&#10;糖,克&#10;生抽,毫升&#10;蚝油,毫升"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchSaving" @click="submitBatchIngredients">确定导入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="cropDialogVisible" title="裁切系统食材图片" width="520px" @closed="resetCropState">
      <div class="crop-dialog">
        <div class="crop-dialog__intro">拖动图片调整位置，系统最终保存为 `50x50 PNG` 小图。</div>
        <div class="crop-stage" @pointermove="handleCropDrag" @pointerup="endCropDrag" @pointerleave="endCropDrag">
          <img
            v-if="cropState.sourceUrl"
            :src="cropState.sourceUrl"
            :style="cropImageStyle"
            class="crop-stage__image"
            alt="裁图预览"
            @pointerdown.prevent="beginCropDrag"
          />
          <div class="crop-stage__mask" />
          <div class="crop-stage__frame" />
        </div>
        <div class="crop-dialog__slider">
          <span>缩放</span>
          <el-slider
            :model-value="cropState.scale"
            :min="cropState.minScale"
            :max="Math.max(cropState.minScale, cropState.minScale * 4)"
            :step="0.01"
            @update:model-value="updateCropScale"
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="cropDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="imageSaving" @click="submitIngredientImage">确认上传</el-button>
      </template>
    </el-dialog>

    <input ref="fileInput" class="visually-hidden" type="file" accept="image/*" @change="handleImageFileChange" />
  </section>
</template>

<style scoped>
.ingredient-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ingredient-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.category-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: sticky;
  top: 0;
}

.category-panel__title {
  color: #374151;
  font-size: 14px;
  font-weight: 700;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  transition: 0.2s ease;
}

.category-item:hover {
  border-color: #d1d5db;
  background: #f9fafb;
}

.category-item--active {
  border-color: #f59e0b;
  background: #fff7ed;
  color: #9a3412;
}

.category-item__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.category-item__tag {
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

.category-item__count {
  min-width: 28px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  font-size: 12px;
  text-align: center;
}

.category-item--active .category-item__count {
  background: rgba(245, 158, 11, 0.18);
}

.ingredient-table-panel {
  min-width: 0;
  background: transparent;
  border: 0;
  padding: 0;
}

.ingredient-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 148px);
  gap: 16px;
}

.ingredient-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 148px;
  min-width: 148px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.ingredient-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.ingredient-card--dragging {
  opacity: 0.56;
  border-color: #f59e0b;
}

.ingredient-card__cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 16px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  overflow: hidden;
  margin: 0 auto;
}

.ingredient-card__image {
  width: 120px;
  height: 120px;
  object-fit: cover;
}

.ingredient-card__empty {
  color: #9ca3af;
  font-size: 13px;
}

.ingredient-card__drag {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px 8px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #6b7280;
  font-size: 11px;
  line-height: 1;
  cursor: grab;
  user-select: none;
}

.ingredient-card__drag:active {
  cursor: grabbing;
}

.ingredient-card__status {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  font-size: 11px;
  line-height: 1;
}

.ingredient-card__body {
  display: grid;
  gap: 6px;
  width: 120px;
}

.ingredient-card__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ingredient-card__name {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
}

.ingredient-card__unit {
  color: #9a3412;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.ingredient-card__status {
  color: #b91c1c;
}

.ingredient-card__actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  width: 120px;
  padding-top: 4px;
}

.ingredient-card__actions-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ingredient-card__action-item {
  display: flex;
  align-items: center;
}

.ingredient-table-panel__footer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-top: 14px;
}

.ingredient-load-more {
  width: 100%;
  padding: 10px 0 4px;
  color: #6b7280;
  font-size: 12px;
  text-align: center;
}

.ingredient-load-more--end {
  color: #9ca3af;
}

.ingredient-thumb__image,
.edit-image-panel__preview {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  object-fit: cover;
  background: #f3f4f6;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
}

.ingredient-thumb__empty,
.edit-image-panel__empty {
  color: #9ca3af;
  font-size: 12px;
}

.edit-image-panel {
  display: flex;
  align-items: center;
  gap: 16px;
}

.edit-image-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit-image-panel__hint {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.crop-dialog {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.crop-dialog__intro {
  color: #6b7280;
  line-height: 1.6;
}

.crop-stage {
  position: relative;
  width: 240px;
  height: 240px;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 28px;
  background:
    linear-gradient(45deg, #f3f4f6 25%, transparent 25%) -12px 0 / 24px 24px,
    linear-gradient(-45deg, #f3f4f6 25%, transparent 25%) -12px 0 / 24px 24px,
    linear-gradient(45deg, transparent 75%, #f3f4f6 75%) -12px 0 / 24px 24px,
    linear-gradient(-45deg, transparent 75%, #f3f4f6 75%) -12px 0 / 24px 24px,
    #ffffff;
  touch-action: none;
  user-select: none;
}

.crop-stage__image {
  position: absolute;
  top: 0;
  left: 0;
  max-width: none;
  cursor: grab;
  will-change: transform;
}

.crop-stage__image:active {
  cursor: grabbing;
}

.crop-stage__mask {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 999px rgba(15, 23, 42, 0.12);
  pointer-events: none;
}

.crop-stage__frame {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 28px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.1);
  pointer-events: none;
}

.crop-dialog__slider {
  display: grid;
  grid-template-columns: 48px 1fr;
  align-items: center;
  gap: 16px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 1080px) {
  .ingredient-layout {
    grid-template-columns: 1fr;
  }

  .category-panel {
    position: static;
  }

  .ingredient-table-panel__footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
