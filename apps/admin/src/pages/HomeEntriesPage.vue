<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Delete, Picture } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  homeEntriesApi,
  type AdminHomeEntriesResponse,
  type AdminHomeEntryItem,
  type HomeEntryPageTarget,
  type HomeEntryPlacement,
  type HomeEntryStatus,
  type HomeEntryTargetType
} from "@/apis/home-entries";
import { adminAppConfig } from "@/apis/config";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type HomeEntryFormItem = {
  id: string;
  placement: HomeEntryPlacement;
  version: number;
  title: string;
  subtitle: string;
  status: HomeEntryStatus;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string;
  badgeText: string;
};

const quickOrder: HomeEntryPlacement[] = ["QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"];

const loading = ref(true);
const saveBusyPlacement = ref<HomeEntryPlacement | null>(null);
const statusBusyPlacement = ref<HomeEntryPlacement | null>(null);
const imageSavingPlacement = ref<HomeEntryPlacement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedPlacement = ref<HomeEntryPlacement | null>(null);
const pageTargets = ref<HomeEntryPageTarget[]>([]);
const items = ref<HomeEntryFormItem[]>([]);

const placementMeta: Record<HomeEntryPlacement, { label: string; description: string }> = {
  QUICK_1: { label: "快捷入口 1", description: "建议放首页最高频的快捷入口。" },
  QUICK_2: { label: "快捷入口 2", description: "建议放首页第二优先级的快捷入口。" },
  QUICK_3: { label: "快捷入口 3", description: "建议放首页第三优先级的快捷入口。" },
  QUICK_4: { label: "快捷入口 4", description: "建议放首页补充型的快捷入口。" }
};

const titleMaxMap: Record<HomeEntryPlacement, number> = {
  QUICK_1: 4,
  QUICK_2: 4,
  QUICK_3: 4,
  QUICK_4: 4
};

const apiOrigin = resolveApiOrigin();
const itemMap = computed(() => new Map(items.value.map(item => [item.placement, item] as const)));
const pageReady = computed(() => quickOrder.every(placement => itemMap.value.has(placement)));
const quickItems = computed(() => (pageReady.value ? quickOrder.map(placement => itemMap.value.get(placement)!) : []));
const listedQuickItems = computed(() => quickItems.value.filter(item => item.status === "LISTED"));

useAdminHeaderRefresh(() => {
  void loadEntries();
});

function resolveApiOrigin() {
  try {
    return new URL(adminAppConfig.apiBaseUrl).origin;
  } catch {
    return window.location.origin;
  }
}

function getTitleMax(placement: HomeEntryPlacement) {
  return titleMaxMap[placement];
}

function resolvePreviewClass(placement: HomeEntryPlacement) {
  if (placement === "QUICK_1") return "entry-preview-shell--main";
  if (placement === "QUICK_2") return "entry-preview-shell--mint";
  if (placement === "QUICK_3") return "entry-preview-shell--aqua";
  return "entry-preview-shell--soft";
}

function entryStatusText(status: HomeEntryStatus) {
  return status === "LISTED" ? "已上架" : "已下架";
}

function entryStatusActionText(status: HomeEntryStatus) {
  return status === "LISTED" ? "下架" : "上架";
}

function mapFormItem(item: AdminHomeEntryItem): HomeEntryFormItem {
  return {
    id: item.id,
    placement: item.placement,
    version: item.version,
    title: item.title,
    subtitle: item.subtitle || "",
    status: item.status,
    targetType: item.targetType,
    targetValue: item.targetValue,
    imageUrl: item.imageUrl || "",
    badgeText: item.badgeText || ""
  };
}

function assignResponse(result: AdminHomeEntriesResponse) {
  pageTargets.value = result.pageTargets;
  items.value = result.items.map(mapFormItem);
}

function patchItemImage(item: AdminHomeEntryItem) {
  const target = items.value.find(entry => entry.placement === item.placement);
  if (!target) return;
  target.version = item.version;
  target.status = item.status;
  target.imageUrl = item.imageUrl || "";
}

function patchItem(item: AdminHomeEntryItem) {
  const target = items.value.find(entry => entry.placement === item.placement);
  if (!target) return;
  target.version = item.version;
  target.title = item.title;
  target.subtitle = item.subtitle || "";
  target.status = item.status;
  target.targetType = item.targetType;
  target.targetValue = item.targetValue;
  target.imageUrl = item.imageUrl || "";
  target.badgeText = item.badgeText || "";
}

function getPreviewUrl(item: HomeEntryFormItem) {
  const raw = item.imageUrl.trim();
  if (!raw) return "";

  const baseUrl = raw.startsWith("/") ? new URL(raw, apiOrigin).toString() : raw;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${item.version}`;
}

async function loadEntries() {
  loading.value = true;
  try {
    const result = await homeEntriesApi.getEntries();
    assignResponse(result);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载首页快捷入口失败");
  } finally {
    loading.value = false;
  }
}

function validateItem(item: HomeEntryFormItem) {
  const title = item.title.trim();
  const titleMax = getTitleMax(item.placement);

  if (!title) {
    throw new Error(`${placementMeta[item.placement].label}标题不能为空`);
  }
  if (title.length > titleMax) {
    throw new Error(`${placementMeta[item.placement].label}标题最多 ${titleMax} 个字`);
  }
  if (item.targetType === "PAGE") {
    if (!pageTargets.value.some(target => target.value === item.targetValue)) {
      throw new Error(`${placementMeta[item.placement].label}请选择有效的站内页面`);
    }
    return;
  }

  if (!/^https:\/\//iu.test(item.targetValue.trim())) {
    throw new Error(`${placementMeta[item.placement].label}外链必须以 https:// 开头`);
  }
}

function chooseImageFile(placement: HomeEntryPlacement) {
  if (imageSavingPlacement.value) return;
  selectedPlacement.value = placement;
  fileInput.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const placement = selectedPlacement.value;
  input.value = "";
  selectedPlacement.value = null;
  if (!file || !placement) return;

  const item = items.value.find(entry => entry.placement === placement);
  if (!item) return;

  imageSavingPlacement.value = placement;
  try {
    const result = await homeEntriesApi.uploadEntryImage(placement, file, createOperationId(), item.version);
    patchItemImage(result);
    ElMessage.success(`${placementMeta[placement].label}图片已更新`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传图片失败");
  } finally {
    imageSavingPlacement.value = null;
  }
}

async function clearImage(item: HomeEntryFormItem) {
  try {
    await ElMessageBox.confirm(`清空后，${placementMeta[item.placement].label}将不再展示图片。`, "确认清空", {
      type: "warning",
      confirmButtonText: "清空",
      cancelButtonText: "取消"
    });
  } catch {
    return;
  }

  imageSavingPlacement.value = item.placement;
  try {
    const result = await homeEntriesApi.clearEntryImage(item.placement, createOperationId(), item.version);
    patchItemImage(result);
    ElMessage.success(`${placementMeta[item.placement].label}图片已清空`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "清空图片失败");
  } finally {
    imageSavingPlacement.value = null;
  }
}

function saveReq(item: HomeEntryFormItem) {
  return {
    placement: item.placement,
    title: item.title.trim(),
    subtitle: item.subtitle.trim() || null,
    targetType: item.targetType,
    targetValue: item.targetValue.trim(),
    imageUrl: item.imageUrl.trim() || null,
    badgeText: item.badgeText.trim() || null,
    expectedVersion: item.version
  };
}

async function saveItem(item: HomeEntryFormItem) {
  try {
    validateItem(item);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "表单校验失败");
    return;
  }

  saveBusyPlacement.value = item.placement;
  try {
    const result = await homeEntriesApi.updateEntries([saveReq(item)], createOperationId());
    assignResponse(result);
    ElMessage.success(`${placementMeta[item.placement].label}已保存`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存首页快捷入口失败");
  } finally {
    saveBusyPlacement.value = null;
  }
}

async function toggleStatus(item: HomeEntryFormItem) {
  const nextStatus: HomeEntryStatus = item.status === "LISTED" ? "UNLISTED" : "LISTED";
  statusBusyPlacement.value = item.placement;
  try {
    const result = await homeEntriesApi.setEntryStatus(item.placement, nextStatus, createOperationId(), item.version);
    patchItem(result);
    ElMessage.success(result.status === "LISTED" ? "入口已上架" : "入口已下架");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换入口状态失败");
  } finally {
    statusBusyPlacement.value = null;
  }
}

onMounted(() => {
  void loadEntries();
});
</script>

<template>
  <section class="page-stack">
    <input ref="fileInput" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" @change="handleFileChange" />

    <div v-loading="loading" class="page-stack">
      <template v-if="pageReady">
        <section class="table-panel section-panel">
          <div class="section-panel__header">
            <div>
              <h3>首页快捷入口</h3>
            </div>
          </div>

          <div class="home-layout">
            <section class="surface-panel">
              <div class="surface-panel__header">
                <div>
                  <h5>快捷入口 4 宫格</h5>
                </div>
              </div>

              <div class="preview-stage">
                <div class="dock-preview">
                  <article v-for="item in listedQuickItems" :key="item.placement" class="dock-preview__item">
                    <div class="dock-preview__icon" :class="resolvePreviewClass(item.placement)">
                      <button class="media-upload media-upload--quick" type="button" @click="chooseImageFile(item.placement)">
                        <img
                          v-if="getPreviewUrl(item)"
                          :src="getPreviewUrl(item)"
                          :alt="`${placementMeta[item.placement].label}预览图`"
                          class="media-upload__image media-upload__image--contain"
                        />
                        <span v-else class="media-upload__empty media-upload__empty--quick">
                          <el-icon size="18"><Picture /></el-icon>
                        </span>
                      </button>
                      <el-button
                        v-if="item.imageUrl.trim()"
                        class="media-upload__delete media-upload__delete--quick"
                        circle
                        size="small"
                        :icon="Delete"
                        :disabled="imageSavingPlacement === item.placement"
                        @click="clearImage(item)"
                      />
                    </div>
                    <span class="dock-preview__title">{{ item.title || "请输入标题" }}</span>
                  </article>
                  <div v-if="!listedQuickItems.length" class="dock-preview__empty">当前没有已上架的四宫格入口</div>
                </div>
              </div>

              <div class="editor-list editor-list--quick">
                <article v-for="item in quickItems" :key="item.placement" class="editor-card">
                  <div class="editor-card__header">
                    <div class="editor-card__title-row">
                      <div class="editor-card__title-stack">
                        <h6>{{ placementMeta[item.placement].label }}</h6>
                        <span class="editor-card__status" :class="{ 'editor-card__status--listed': item.status === 'LISTED' }">
                          {{ entryStatusText(item.status) }}
                        </span>
                      </div>
                      <span class="entry-card__version">版本 {{ item.version }}</span>
                    </div>
                    <div>
                      <p>{{ placementMeta[item.placement].description }}</p>
                    </div>
                  </div>

                  <el-form label-position="top" class="entry-form entry-form--stacked">
                    <el-form-item label="标题">
                      <el-input v-model="item.title" :maxlength="getTitleMax(item.placement)" show-word-limit />
                    </el-form-item>

                    <el-form-item label="跳转类型">
                      <el-radio-group v-model="item.targetType">
                        <el-radio value="PAGE">站内页面</el-radio>
                        <el-radio value="WEB_VIEW">外链 / H5</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item v-if="item.targetType === 'PAGE'">
                      <el-select v-model="item.targetValue" class="entry-form__select">
                        <el-option v-for="target in pageTargets" :key="target.value" :label="target.label" :value="target.value" />
                      </el-select>
                    </el-form-item>
                    <el-form-item v-else>
                      <el-input v-model="item.targetValue" maxlength="512" placeholder="https://example.com/topic" />
                    </el-form-item>

                    <div class="entry-form__actions">
                      <el-button
                        :loading="statusBusyPlacement === item.placement"
                        :disabled="saveBusyPlacement === item.placement || imageSavingPlacement === item.placement"
                        @click="toggleStatus(item)"
                      >
                        {{ entryStatusActionText(item.status) }}
                      </el-button>
                      <el-button
                        type="primary"
                        :loading="saveBusyPlacement === item.placement"
                        :disabled="imageSavingPlacement === item.placement || statusBusyPlacement === item.placement"
                        @click="saveItem(item)"
                      >
                        保存
                      </el-button>
                    </div>
                  </el-form>
                </article>
              </div>
            </section>
          </div>
        </section>
      </template>

      <section v-else-if="!loading" class="table-panel section-panel">
        <div class="section-panel__header">
          <div>
            <h4>首页快捷入口数据未就绪</h4>
            <p>后台尚未拿到完整的 4 个快捷入口配置，请刷新后重试。</p>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.section-panel__header h3 {
  margin: 0 0 8px;
  color: #111827;
}

.section-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.home-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}

.surface-panel {
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 18px;
  border: 1px solid #eef2f7;
  border-radius: 20px;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
}

.surface-panel__header h5,
.editor-card__header h6 {
  margin: 0 0 6px;
  color: #111827;
}

.surface-panel__header p,
.editor-card__header p {
  margin: 0;
  color: #6b7280;
  line-height: 1.5;
}

.editor-card__title-stack {
  display: flex;
  align-items: center;
  gap: 10px;
}

.editor-card__status {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: #fff4df;
  color: #a16207;
  font-size: 12px;
  line-height: 20px;
}

.editor-card__status--listed {
  background: #e8f7ee;
  color: #166534;
}

.preview-stage {
  padding: 8px;
  border-radius: 18px;
  background: linear-gradient(180deg, #fffaf5, #f8fbff);
  border: 1px solid #edf2f7;
}

.media-upload {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.media-upload:hover {
  border-color: #f97316;
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(249, 115, 22, 0.12);
}

.dock-preview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.dock-preview__empty {
  grid-column: 1 / -1;
  padding: 20px 0;
  color: #6b7280;
  text-align: center;
}

.dock-preview__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.dock-preview__icon {
  position: relative;
  width: 76px;
  height: 76px;
  padding: 0;
  border-radius: 24px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.entry-preview-shell--main {
  background: linear-gradient(180deg, #fff7ed, #ffffff);
}

.entry-preview-shell--mint {
  background: linear-gradient(180deg, #ecfdf5, #ffffff);
}

.entry-preview-shell--aqua {
  background: linear-gradient(180deg, #eff6ff, #ffffff);
}

.entry-preview-shell--soft {
  background: linear-gradient(180deg, #f8fafc, #ffffff);
}

.media-upload--quick {
  border-radius: 24px;
  border: 0;
  background: transparent;
}

.media-upload__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-upload__image--contain {
  object-fit: contain;
}

.media-upload__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}

.media-upload__empty--mini,
.media-upload__empty--quick {
  padding: 0;
}

.media-upload__delete {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.media-upload__delete--mini,
.media-upload__delete--quick {
  top: -8px;
  right: -8px;
}

.dock-preview__title {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}

.editor-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.editor-list--quick {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.editor-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid #e8eef5;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.editor-card__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.entry-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-form--stacked :deep(.el-form-item) {
  margin-bottom: 14px;
}

.entry-form--stacked :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.entry-form__select {
  width: 100%;
}

.entry-form__actions {
  display: flex;
  justify-content: flex-end;
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

@media (max-width: 1200px) {
  .home-layout {
    grid-template-columns: 1fr;
  }

  .dock-preview {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .section-panel__header,
  .editor-card__header {
    flex-direction: column;
    align-items: stretch;
  }

  .editor-list--quick,
  .dock-preview {
    grid-template-columns: 1fr;
  }


  .dock-preview__icon {
    width: 88px;
    height: 88px;
  }
}
</style>
