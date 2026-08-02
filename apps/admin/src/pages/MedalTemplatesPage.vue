<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Plus, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  medalApi,
  type AdminMedalTemplateSummary,
  type MedalImageType,
  type MedalAwardRule,
  type MedalCategory,
  type MedalTemplateStatus
} from "@/apis/medal";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type DialogMode = "create" | "edit";
type ImageAction = "keep" | "upload" | "clear";
type ImageState = {
  originalUrl: string;
  previewUrl: string;
  file: File | null;
  action: ImageAction;
};

const awardRuleLabelMap: Record<MedalAwardRule, string> = {
  MEAL_COMPLETION: "完成餐次",
  DINING_EVENT_COMPLETION: "完成饭局",
  GROUP_MEAL_COMPLETION: "多人饭局吃成",
  FULL_LOOP_COMPLETION: "完整闭环",
  RECOMMENDATION_ADOPTED_TOTAL: "推荐收录累计"
};

const categoryLabelMap: Record<MedalCategory, string> = {
  MEAL_CHECKIN: "开饭打卡",
  DINING_COLLABORATION: "饭局协作",
  RECOMMENDATION_CONTRIBUTION: "推荐贡献",
  HOLIDAY_LIMITED: "节假日限定"
};

const statusLabelMap: Record<MedalTemplateStatus, string> = {
  DRAFT: "草稿",
  LISTED: "已上架",
  UNLISTED: "已下架",
  ARCHIVED: "已归档"
};

const statusTagTypeMap: Record<MedalTemplateStatus, "" | "success" | "warning" | "info" | "danger"> = {
  DRAFT: "info",
  LISTED: "success",
  UNLISTED: "warning",
  ARCHIVED: "danger"
};

const awardRuleOptions = Object.entries(awardRuleLabelMap).map(([value, label]) => ({
  value: value as MedalAwardRule,
  label
}));

const categoryOptions = Object.entries(categoryLabelMap).map(([value, label]) => ({
  value: value as MedalCategory,
  label
}));

const statusOptions = Object.entries(statusLabelMap).map(([value, label]) => ({
  value: value as MedalTemplateStatus,
  label
}));

const createStatusOptions = statusOptions.filter(item => item.value !== "ARCHIVED");
const categoryTabs = [
  { key: "", label: "全部" },
  ...categoryOptions.map(item => ({
    key: item.value,
    label: item.label
  }))
];

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const dialogMode = ref<DialogMode>("create");
const editingRow = ref<AdminMedalTemplateSummary | null>(null);
const items = ref<AdminMedalTemplateSummary[]>([]);
const total = ref(0);
const earnedFileInput = ref<HTMLInputElement | null>(null);
const lockedFileInput = ref<HTMLInputElement | null>(null);

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: "" as MedalTemplateStatus | "",
  category: "" as MedalCategory | ""
});

const form = reactive({
  awardRule: "MEAL_COMPLETION" as MedalAwardRule,
  category: "MEAL_CHECKIN" as MedalCategory,
  name: "",
  description: "",
  condition: "",
  status: "DRAFT" as "DRAFT" | "LISTED" | "UNLISTED",
  targetCount: 1,
  sortOrder: 0,
  isLimited: false,
  startAt: null as string | null,
  endAt: null as string | null
});

const imageState = reactive<Record<MedalImageType, ImageState>>({
  earned: {
    originalUrl: "",
    previewUrl: "",
    file: null,
    action: "keep"
  },
  locked: {
    originalUrl: "",
    previewUrl: "",
    file: null,
    action: "keep"
  }
});

useAdminHeaderRefresh(() => {
  void loadList();
});

const dialogTitle = computed(() => (dialogMode.value === "create" ? "新增勋章模板" : "编辑勋章模板"));
const limitedMode = computed({
  get: () => (form.isLimited ? "LIMITED" : "OPEN"),
  set: value => {
    form.isLimited = value === "LIMITED";
    if (!form.isLimited) {
      form.startAt = null;
      form.endAt = null;
    }
  }
});

function clampPositiveInt(value: unknown, fallback: number, min: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

function getImageState(imageType: MedalImageType) {
  return imageState[imageType];
}

function hasImagePreview(imageType: MedalImageType) {
  return Boolean(getImageState(imageType).previewUrl);
}

function currentImageHint(imageType: MedalImageType) {
  const state = getImageState(imageType);
  if (state.action === "upload") return "已选择新图片，保存后生效。";
  if (state.action === "clear") return "当前图片将在保存后清空。";
  if (state.originalUrl) return "当前图片已生效。";
  return "当前未上传图片。";
}

function revokePreviewUrl(state: ImageState) {
  if (state.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(state.previewUrl);
  }
}

function resetOneImageState(imageType: MedalImageType) {
  const state = getImageState(imageType);
  revokePreviewUrl(state);
  state.originalUrl = "";
  state.previewUrl = "";
  state.file = null;
  state.action = "keep";
}

function resetImageState() {
  resetOneImageState("earned");
  resetOneImageState("locked");
}

function syncImageState(imageType: MedalImageType, url: string | null) {
  const state = getImageState(imageType);
  resetOneImageState(imageType);
  state.originalUrl = url ?? "";
  state.previewUrl = url ?? "";
}

function resetForm() {
  form.awardRule = "MEAL_COMPLETION";
  form.category = "MEAL_CHECKIN";
  form.name = "";
  form.description = "";
  form.condition = "";
  form.status = "DRAFT";
  form.targetCount = 1;
  form.sortOrder = 0;
  form.isLimited = false;
  form.startAt = null;
  form.endAt = null;
  editingRow.value = null;
  resetImageState();
}

function fillForm(row: AdminMedalTemplateSummary) {
  form.awardRule = row.awardRule;
  form.category = row.category;
  form.name = row.name;
  form.description = row.description;
  form.condition = row.condition;
  form.status = row.status === "ARCHIVED" ? "UNLISTED" : row.status;
  form.targetCount = row.targetCount;
  form.sortOrder = row.sortOrder;
  form.isLimited = row.isLimited;
  form.startAt = row.startAt;
  form.endAt = row.endAt;
  syncImageState("earned", row.earnedImageUrl);
  syncImageState("locked", row.lockedImageUrl);
}

async function loadList() {
  loading.value = true;
  try {
    const result = await medalApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      status: query.status || undefined,
      category: query.category || undefined
    });
    items.value = result.items;
    total.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载勋章模板失败");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.page = 1;
  void loadList();
}

function selectCategory(category: MedalCategory | "") {
  if (query.category === category) return;
  query.category = category;
  query.page = 1;
  void loadList();
}

function openCreate() {
  dialogMode.value = "create";
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: AdminMedalTemplateSummary) {
  dialogMode.value = "edit";
  editingRow.value = row;
  fillForm(row);
  dialogVisible.value = true;
}

function normalizeForm() {
  form.targetCount = clampPositiveInt(form.targetCount, 1, 1);
  form.sortOrder = clampPositiveInt(form.sortOrder, 0, 0);
  const name = form.name.trim();
  const description = form.description.trim();
  const condition = form.condition.trim();
  if (!name) throw new Error("请输入勋章名称");
  if (!description) throw new Error("请输入勋章简介");
  if (!condition) throw new Error("请输入获取条件");
  if (form.targetCount < 1) throw new Error("阈值至少为 1");
  if (form.sortOrder < 0) throw new Error("排序不能小于 0");
  if (form.isLimited && !form.startAt) throw new Error("请设置开始时间");
  if (form.isLimited && !form.endAt) throw new Error("请设置结束时间");
  return {
    awardRule: form.awardRule,
    category: form.category,
    name,
    description,
    condition,
    status: form.status,
    targetCount: form.targetCount,
    sortOrder: form.sortOrder,
    isLimited: form.isLimited,
    startAt: form.isLimited ? form.startAt : null,
    endAt: form.isLimited ? form.endAt : null
  };
}

async function syncTemplateImages(template: AdminMedalTemplateSummary) {
  let current = template;
  for (const imageType of ["earned", "locked"] as MedalImageType[]) {
    const state = getImageState(imageType);
    if (state.action === "upload" && state.file) {
      current = await medalApi.uploadImage(current.id, imageType, state.file, {
        operationId: createOperationId(),
        expectedVersion: current.version
      });
      continue;
    }
    if (state.action === "clear" && state.originalUrl) {
      current = await medalApi.clearImage(current.id, imageType, {
        operationId: createOperationId(),
        expectedVersion: current.version
      });
    }
  }
  return current;
}

async function submitForm() {
  if (saving.value) return;
  let payload: ReturnType<typeof normalizeForm>;
  try {
    payload = normalizeForm();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "表单校验失败");
    return;
  }

  saving.value = true;
  try {
    let result: AdminMedalTemplateSummary;
    if (dialogMode.value === "create") {
      result = await medalApi.create({
        operationId: createOperationId(),
        ...payload
      });
    } else if (editingRow.value) {
      result = await medalApi.update(editingRow.value.id, {
        operationId: createOperationId(),
        expectedVersion: editingRow.value.version,
        category: payload.category,
        name: payload.name,
        description: payload.description,
        condition: payload.condition,
        targetCount: payload.targetCount,
        sortOrder: payload.sortOrder,
        isLimited: payload.isLimited,
        startAt: payload.startAt,
        endAt: payload.endAt
      });
    } else {
      return;
    }

    await syncTemplateImages(result);
    dialogVisible.value = false;
    resetForm();
    await loadList();
    ElMessage.success(dialogMode.value === "create" ? "勋章模板已创建" : "勋章模板已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存勋章模板失败");
  } finally {
    saving.value = false;
  }
}

async function changeStatus(row: AdminMedalTemplateSummary, status: MedalTemplateStatus) {
  const actionMap: Record<MedalTemplateStatus, string> = {
    DRAFT: "改回草稿",
    LISTED: "上架",
    UNLISTED: "下架",
    ARCHIVED: "归档"
  };
  try {
    await ElMessageBox.confirm(`确认${actionMap[status]}“${row.name}”？`, "勋章模板状态", {
      type: status === "ARCHIVED" ? "warning" : "info",
      confirmButtonText: "确认",
      cancelButtonText: "取消"
    });
    await medalApi.setStatus(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version,
      status
    });
    ElMessage.success(`已${actionMap[status]}`);
    await loadList();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "更新勋章状态失败");
  }
}

function chooseImageFile(imageType: MedalImageType) {
  if (imageType === "earned") {
    earnedFileInput.value?.click();
    return;
  }
  lockedFileInput.value?.click();
}

function handleImageFileChange(imageType: MedalImageType, event: Event) {
  const state = getImageState(imageType);
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (input) input.value = "";
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
    ElMessage.error("仅支持 JPG、PNG、WEBP、SVG 图片");
    return;
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    ElMessage.error("图片大小不能超过 5 MB");
    return;
  }
  revokePreviewUrl(state);
  state.file = file;
  state.previewUrl = URL.createObjectURL(file);
  state.action = "upload";
}

function clearSelectedImage(imageType: MedalImageType) {
  const state = getImageState(imageType);
  if (!state.originalUrl && !state.file) return;
  revokePreviewUrl(state);
  state.file = null;
  state.previewUrl = "";
  state.action = state.originalUrl ? "clear" : "keep";
}

function stepTargetCount(delta: number) {
  form.targetCount = Math.max(1, clampPositiveInt(form.targetCount, 1, 1) + delta);
}

function stepSortOrder(delta: number) {
  form.sortOrder = Math.max(0, clampPositiveInt(form.sortOrder, 0, 0) + delta);
}

function normalizeTargetCount() {
  form.targetCount = clampPositiveInt(form.targetCount, 1, 1);
}

function normalizeSortOrder() {
  form.sortOrder = clampPositiveInt(form.sortOrder, 0, 0);
}

function formatTime(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function awardRuleLabel(rule: MedalAwardRule) {
  return awardRuleLabelMap[rule];
}

function statusTagType(status: MedalTemplateStatus) {
  return statusTagTypeMap[status];
}

function statusLabel(status: MedalTemplateStatus) {
  return statusLabelMap[status];
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="搜索勋章名称 / 简介" clearable @keyup.enter="handleSearch" />
      <el-select v-model="query.status" clearable placeholder="状态" style="width: 140px" @change="handleSearch">
        <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增勋章</el-button>
    </div>

    <div class="category-panel table-panel">
      <div class="category-panel__title">勋章类别</div>
      <div class="category-panel__list">
        <button
          v-for="tab in categoryTabs"
          :key="tab.key || 'ALL'"
          type="button"
          class="category-item"
          :class="{ 'category-item--active': query.category === tab.key }"
          @click="selectCategory(tab.key as MedalCategory | '')"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="work-panel" v-loading="loading">
      <el-table :data="items" border>
        <el-table-column label="图片" width="170">
          <template #default="{ row }">
            <div class="image-pair">
              <div class="image-pair__item">
                <div class="image-pair__label">获得</div>
                <img v-if="row.earnedImageUrl" :src="row.earnedImageUrl" :alt="`${row.name} 获得图`" class="image-cell__img" />
                <div v-else class="image-cell__empty">未传</div>
              </div>
              <div class="image-pair__item">
                <div class="image-pair__label">未获</div>
                <img v-if="row.lockedImageUrl" :src="row.lockedImageUrl" :alt="`${row.name} 未获得图`" class="image-cell__img" />
                <div v-else class="image-cell__empty">未传</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="勋章名称" min-width="180" />
        <el-table-column label="类别" min-width="120">
          <template #default="{ row }">{{ row.categoryName }}</template>
        </el-table-column>
        <el-table-column label="发放规则" min-width="140">
          <template #default="{ row }">{{ awardRuleLabel(row.awardRule) }}</template>
        </el-table-column>
        <el-table-column prop="targetCount" label="阈值" width="88" />
        <el-table-column prop="sortOrder" label="排序" width="88" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="活动时间" min-width="220">
          <template #default="{ row }">
            <span v-if="row.isLimited">{{ formatTime(row.startAt) }} ~ {{ formatTime(row.endAt) }}</span>
            <span v-else>长期开放</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="150">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status !== 'LISTED'" link type="success" @click="changeStatus(row, 'LISTED')">上架</el-button>
            <el-button v-if="row.status === 'LISTED'" link type="warning" @click="changeStatus(row, 'UNLISTED')">下架</el-button>
            <el-button v-if="row.status !== 'ARCHIVED'" link type="danger" @click="changeStatus(row, 'ARCHIVED')">归档</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, prev, pager, next"
          :total="total"
          @current-change="loadList"
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px" destroy-on-close @closed="resetForm">
      <el-form label-position="top">
        <div class="dialog-section">
          <div class="dialog-section__title">基础信息</div>
          <el-form-item label="勋章名称">
            <el-input v-model="form.name" maxlength="64" placeholder="例如：开火第一餐" />
          </el-form-item>
          <el-form-item label="勋章简介">
            <el-input v-model="form.description" type="textarea" :rows="2" maxlength="255" />
          </el-form-item>
          <el-form-item label="勋章类别">
            <el-select v-model="form.category" style="width: 100%">
              <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="勋章图片">
            <div class="image-editor-grid">
              <div class="image-editor-card">
                <div class="image-editor-card__title">已获得图片</div>
                <div class="image-editor">
                  <div v-if="hasImagePreview('earned')" class="image-editor__preview-shell">
                    <img :src="getImageState('earned').previewUrl" alt="已获得图片预览" class="image-editor__preview" />
                  </div>
                  <div v-else class="image-editor__empty">当前未上传图片</div>
                  <div class="image-editor__actions">
                    <el-button type="primary" :icon="Upload" @click="chooseImageFile('earned')">选择图片</el-button>
                    <el-button v-if="hasImagePreview('earned') || getImageState('earned').originalUrl" @click="clearSelectedImage('earned')">
                      清空图片
                    </el-button>
                    <div class="table-hint">{{ currentImageHint('earned') }}</div>
                  </div>
                </div>
              </div>

              <div class="image-editor-card">
                <div class="image-editor-card__title">未获得图片</div>
                <div class="image-editor">
                  <div v-if="hasImagePreview('locked')" class="image-editor__preview-shell">
                    <img :src="getImageState('locked').previewUrl" alt="未获得图片预览" class="image-editor__preview" />
                  </div>
                  <div v-else class="image-editor__empty">当前未上传图片</div>
                  <div class="image-editor__actions">
                    <el-button type="primary" :icon="Upload" @click="chooseImageFile('locked')">选择图片</el-button>
                    <el-button v-if="hasImagePreview('locked') || getImageState('locked').originalUrl" @click="clearSelectedImage('locked')">
                      清空图片
                    </el-button>
                    <div class="table-hint">{{ currentImageHint('locked') }}</div>
                  </div>
                </div>
              </div>
            </div>
          </el-form-item>
        </div>

        <div class="dialog-section">
          <div class="dialog-section__title">发放设置</div>
          <el-form-item label="发放规则">
            <el-select v-model="form.awardRule" :disabled="dialogMode === 'edit'" style="width: 100%">
              <el-option v-for="item in awardRuleOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="阈值">
            <div class="number-editor">
              <el-button @click="stepTargetCount(-1)">-</el-button>
              <el-input v-model="form.targetCount" type="number" inputmode="numeric" min="1" max="9999" @change="normalizeTargetCount" />
              <el-button @click="stepTargetCount(1)">+</el-button>
            </div>
          </el-form-item>
          <el-form-item label="获取条件">
            <el-input v-model="form.condition" type="textarea" :rows="2" maxlength="255" />
          </el-form-item>
        </div>

        <div class="dialog-section">
          <div class="dialog-section__title">展示设置</div>
          <el-form-item label="排序">
            <div class="number-editor">
              <el-button @click="stepSortOrder(-1)">-</el-button>
              <el-input v-model="form.sortOrder" type="number" inputmode="numeric" min="0" max="9999" @change="normalizeSortOrder" />
              <el-button @click="stepSortOrder(1)">+</el-button>
            </div>
          </el-form-item>
          <el-form-item label="限定勋章">
            <el-radio-group v-model="limitedMode">
              <el-radio label="OPEN">长期开放</el-radio>
              <el-radio label="LIMITED">限时活动</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="开始时间">
            <el-date-picker
              v-model="form.startAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss[Z]"
              placeholder="选择开始时间"
              :disabled="!form.isLimited"
              clearable
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker
              v-model="form.endAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss[Z]"
              placeholder="选择结束时间"
              :disabled="!form.isLimited"
              clearable
              style="width: 100%"
            />
            <div class="table-hint">选择“限时活动”后可填写；保存时会校验开始时间早于结束时间。</div>
          </el-form-item>
        </div>

        <div class="dialog-section">
          <div class="dialog-section__title">发布设置</div>
          <el-form-item v-if="dialogMode === 'create'" label="初始状态">
            <el-select v-model="form.status" style="width: 100%">
              <el-option v-for="item in createStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-else label="内部信息">
            <div class="table-hint">内部编码：{{ editingRow?.code }}</div>
          </el-form-item>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <input
      ref="earnedFileInput"
      class="visually-hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      @change="handleImageFileChange('earned', $event)"
    />
    <input
      ref="lockedFileInput"
      class="visually-hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      @change="handleImageFileChange('locked', $event)"
    />
  </section>
</template>

<style scoped>
.category-panel__title,
.dialog-section__title {
  font-weight: 600;
}

.category-panel__list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.category-item {
  padding: 10px 18px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease;
}

.category-item--active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.image-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-pair {
  display: flex;
  gap: 8px;
}

.image-pair__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.image-pair__label,
.image-editor-card__title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.image-cell__img,
.image-editor__preview {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 16px;
  border: 1px solid var(--el-border-color-lighter);
  background: #fff;
}

.image-cell__empty,
.image-editor__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border: 1px dashed var(--el-border-color);
  border-radius: 16px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
}

.table-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.dialog-section + .dialog-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.dialog-section__title {
  margin-bottom: 12px;
}

.image-editor {
  display: flex;
  align-items: center;
  gap: 16px;
}

.image-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  width: 100%;
}

.image-editor-card {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
}

.image-editor-card__title {
  margin-bottom: 12px;
  font-weight: 600;
}

.image-editor__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.number-editor {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.number-editor :deep(.el-input) {
  max-width: 180px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .image-editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
