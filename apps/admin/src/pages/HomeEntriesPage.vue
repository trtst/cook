<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Delete, Picture } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { homeEntriesApi, type AdminHomeEntriesResponse, type AdminHomeEntryItem, type HomeEntryPageTarget, type HomeEntryPlacement, type HomeEntryTargetType } from "@/apis/home-entries";
import { adminAppConfig } from "@/apis/config";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type HomeEntryFormItem = {
  id: string;
  placement: HomeEntryPlacement;
  version: number;
  title: string;
  subtitle: string;
  targetType: HomeEntryTargetType;
  targetValue: string;
  imageUrl: string;
  badgeText: string;
};

const featureOrder: HomeEntryPlacement[] = ["MAIN", "SIDE_TOP", "SIDE_BOTTOM"];
const quickOrder: HomeEntryPlacement[] = ["QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"];
const allPlacements: HomeEntryPlacement[] = [...featureOrder, ...quickOrder];

const loading = ref(true);
const saveBusyPlacement = ref<HomeEntryPlacement | null>(null);
const imageSavingPlacement = ref<HomeEntryPlacement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedPlacement = ref<HomeEntryPlacement | null>(null);
const pageTargets = ref<HomeEntryPageTarget[]>([]);
const items = ref<HomeEntryFormItem[]>([]);

const placementMeta: Record<HomeEntryPlacement, { label: string; description: string; kind: "feature" | "quick" }> = {
  MAIN: { label: "主卡", description: "建议放首页本期主推内容、重点活动或核心专题。", kind: "feature" },
  SIDE_TOP: { label: "右上卡", description: "建议放辅助推荐内容，例如节气主题、周末菜单或短期活动。", kind: "feature" },
  SIDE_BOTTOM: { label: "右下卡", description: "建议放补充曝光内容，例如话题专题、城市风味或专题外链。", kind: "feature" },
  QUICK_1: { label: "快捷入口 1", description: "建议放首页最高频的快捷入口。", kind: "quick" },
  QUICK_2: { label: "快捷入口 2", description: "建议放首页第二优先级的快捷入口。", kind: "quick" },
  QUICK_3: { label: "快捷入口 3", description: "建议放首页第三优先级的快捷入口。", kind: "quick" },
  QUICK_4: { label: "快捷入口 4", description: "建议放首页补充型的快捷入口。", kind: "quick" }
};

const titleMaxMap: Record<HomeEntryPlacement, number> = {
  MAIN: 8,
  SIDE_TOP: 6,
  SIDE_BOTTOM: 6,
  QUICK_1: 4,
  QUICK_2: 4,
  QUICK_3: 4,
  QUICK_4: 4
};

const subtitleMaxMap: Record<HomeEntryPlacement, number> = {
  MAIN: 12,
  SIDE_TOP: 10,
  SIDE_BOTTOM: 10,
  QUICK_1: 0,
  QUICK_2: 0,
  QUICK_3: 0,
  QUICK_4: 0
};

const apiOrigin = resolveApiOrigin();
const itemMap = computed(() => new Map(items.value.map(item => [item.placement, item] as const)));
const pageReady = computed(() => allPlacements.every(placement => itemMap.value.has(placement)));
const featureItems = computed(() => (pageReady.value ? featureOrder.map(placement => itemMap.value.get(placement)!) : []));
const quickItems = computed(() => (pageReady.value ? quickOrder.map(placement => itemMap.value.get(placement)!) : []));
const orderedItems = computed(() => [...featureItems.value, ...quickItems.value]);

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

function isFeaturePlacement(placement: HomeEntryPlacement) {
  return placementMeta[placement].kind === "feature";
}

function getTitleMax(placement: HomeEntryPlacement) {
  return titleMaxMap[placement];
}

function getSubtitleMax(placement: HomeEntryPlacement) {
  return subtitleMaxMap[placement];
}

function resolvePreviewClass(placement: HomeEntryPlacement) {
  if (placement === "MAIN") return "entry-preview-shell--main";
  if (placement === "SIDE_TOP") return "entry-preview-shell--mint";
  if (placement === "SIDE_BOTTOM") return "entry-preview-shell--aqua";
  if (placement === "QUICK_1") return "entry-preview-shell--main";
  if (placement === "QUICK_2") return "entry-preview-shell--mint";
  if (placement === "QUICK_3") return "entry-preview-shell--aqua";
  return "entry-preview-shell--soft";
}

function mapFormItem(item: AdminHomeEntryItem): HomeEntryFormItem {
  return {
    id: item.id,
    placement: item.placement,
    version: item.version,
    title: item.title,
    subtitle: item.subtitle || "",
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
  target.imageUrl = item.imageUrl || "";
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
  const subtitle = item.subtitle.trim();
  const titleMax = getTitleMax(item.placement);
  const subtitleMax = getSubtitleMax(item.placement);

  if (!title) {
    throw new Error(`${placementMeta[item.placement].label}标题不能为空`);
  }
  if (title.length > titleMax) {
    throw new Error(`${placementMeta[item.placement].label}标题最多 ${titleMax} 个字`);
  }
  if (isFeaturePlacement(item.placement) && !subtitle) {
    throw new Error(`${placementMeta[item.placement].label}副标题不能为空`);
  }
  if (isFeaturePlacement(item.placement) && subtitle.length > subtitleMax) {
    throw new Error(`${placementMeta[item.placement].label}副标题最多 ${subtitleMax} 个字`);
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
              <h3>小程序首页</h3>
            </div>
          </div>

          <div class="home-layout">
            <section class="surface-panel">
              <div class="surface-panel__header">
                <div>
                  <h5>首屏 3 卡</h5>
                </div>
              </div>

              <div class="preview-stage preview-stage--feature">
                <div class="feature-preview">
                  <article class="feature-card feature-card--main">
                    <div class="feature-card__copy">
                      <span class="feature-card__title">{{ featureItems[0].title || "请输入标题" }}</span>
                      <span class="feature-card__subtitle">{{ featureItems[0].subtitle || "请输入副标题" }}</span>
                    </div>

                    <div class="feature-card__art-wrap">
                      <button class="media-upload media-upload--feature" type="button" @click="chooseImageFile(featureItems[0].placement)">
                        <img
                          v-if="getPreviewUrl(featureItems[0])"
                          :src="getPreviewUrl(featureItems[0])"
                          :alt="`${placementMeta[featureItems[0].placement].label}预览图`"
                          class="media-upload__image"
                        />
                        <span v-else class="media-upload__empty">
                          <el-icon size="26"><Picture /></el-icon>
                          <span>{{ imageSavingPlacement === featureItems[0].placement ? "上传中..." : "点击上传图片" }}</span>
                        </span>
                      </button>
                      <el-button
                        v-if="featureItems[0].imageUrl.trim()"
                        class="media-upload__delete"
                        circle
                        size="small"
                        :icon="Delete"
                        :disabled="imageSavingPlacement === featureItems[0].placement"
                        @click="clearImage(featureItems[0])"
                      />
                    </div>
                  </article>

                  <div class="feature-preview__side">
                    <article
                      v-for="item in featureItems.slice(1)"
                      :key="item.placement"
                      class="feature-card feature-card--side"
                      :class="[item.placement === 'SIDE_TOP' ? 'feature-card--mint' : 'feature-card--aqua']"
                    >
                      <div class="feature-card__copy">
                        <span class="feature-card__title">{{ item.title || "请输入标题" }}</span>
                        <span class="feature-card__subtitle">{{ item.subtitle || "请输入副标题" }}</span>
                      </div>

                      <div class="feature-card__mini feature-card__mini--members">
                        <button class="media-upload media-upload--mini" type="button" @click="chooseImageFile(item.placement)">
                          <img
                            v-if="getPreviewUrl(item)"
                            :src="getPreviewUrl(item)"
                            :alt="`${placementMeta[item.placement].label}预览图`"
                            class="media-upload__image"
                          />
                          <span v-else class="media-upload__empty media-upload__empty--mini">
                            <el-icon size="18"><Picture /></el-icon>
                          </span>
                        </button>
                        <el-button
                          v-if="item.imageUrl.trim()"
                          class="media-upload__delete media-upload__delete--mini"
                          circle
                          size="small"
                          :icon="Delete"
                          :disabled="imageSavingPlacement === item.placement"
                          @click="clearImage(item)"
                        />
                      </div>
                    </article>
                  </div>
                </div>
              </div>

              <div class="editor-list editor-list--feature">
                <article
                  v-for="item in featureItems"
                  :key="item.placement"
                  class="editor-card"
                >
                  <div class="editor-card__header">
                    <div class="editor-card__title-row">
                      <h6>{{ placementMeta[item.placement].label }}</h6>
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

                    <el-form-item label="副标题">
                      <el-input v-model="item.subtitle" :maxlength="getSubtitleMax(item.placement)" show-word-limit />
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
                        type="primary"
                        :loading="saveBusyPlacement === item.placement"
                        :disabled="imageSavingPlacement === item.placement"
                        @click="saveItem(item)"
                      >
                        保存
                      </el-button>
                    </div>
                  </el-form>
                </article>
              </div>
            </section>

            <section class="surface-panel">
              <div class="surface-panel__header">
                <div>
                  <h5>快捷入口 4 宫格</h5>
                </div>
              </div>

              <div class="preview-stage">
                <div class="dock-preview">
                  <article v-for="item in quickItems" :key="item.placement" class="dock-preview__item">
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
                </div>
              </div>

              <div class="editor-list editor-list--quick">
                <article v-for="item in quickItems" :key="item.placement" class="editor-card">
                  <div class="editor-card__header">
                    <div class="editor-card__title-row">
                      <h6>{{ placementMeta[item.placement].label }}</h6>
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
                        type="primary"
                        :loading="saveBusyPlacement === item.placement"
                        :disabled="imageSavingPlacement === item.placement"
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
            <h4>首页入口数据未就绪</h4>
            <p>后台尚未拿到完整的 7 个首页坑位配置，请刷新后重试。</p>
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
  grid-template-columns: minmax(0, 4fr) minmax(0, 3fr);
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

.preview-stage {
  padding: 8px;
  border-radius: 18px;
  background: linear-gradient(180deg, #fffaf5, #f8fbff);
  border: 1px solid #edf2f7;
}

.preview-stage--feature {
  display: flex;
  justify-content: flex-start;
}

.feature-preview {
  display: flex;
  gap: 9px;
  width: 351px;
  max-width: 100%;
}

.feature-preview__side {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 10px;
}

.feature-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  border-radius: 14px;
}

.feature-card--main {
  flex: 1 1 0;
  min-height: 150px;
  padding: 10px;
  background: linear-gradient(180deg, #fff1df, #fff8ee);
}

.feature-card--side {
  flex: 1;
  min-height: 70px;
  padding: 10px;
}

.feature-card--mint {
  background: linear-gradient(180deg, #e7f8ee, #f7fcf9);
}

.feature-card--aqua {
  background: linear-gradient(180deg, #eaf3ff, #f8fbff);
}

.feature-card__copy {
  position: relative;
  display: flex;
  flex-direction: column;
  z-index: 1;
}

.entry-card__version {
  padding: 6px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.feature-card__title {
  color: #111827;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.feature-card__subtitle {
  margin-top: 5px;
  color: #4b5563;
  font-size: 11px;
  line-height: 1;
}

.feature-card__art-wrap {
  position: absolute;
  right: 10px;
  bottom: 10px;
  left: 10px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
}

.feature-card__mini {
  position: absolute;
  right: 5px;
  bottom: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  transform: rotate(-7deg);
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

.editor-list--feature {
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .editor-list--feature,
  .editor-list--quick,
  .dock-preview {
    grid-template-columns: 1fr;
  }

  .feature-preview {
    flex-direction: column;
  }

  .feature-card--main {
    min-height: 150px;
  }

  .dock-preview__icon {
    width: 88px;
    height: 88px;
  }
}
</style>
