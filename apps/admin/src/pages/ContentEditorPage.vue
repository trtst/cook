<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Picture, Refresh, Upload } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import RichTextEditor from "@/components/RichTextEditor.vue";
import { contentApi, type AdminSiteContentChannelItem, type AdminSiteContentDetail, type SiteContentStatus, type SiteContentType } from "@/apis/content";
import { useAdminHeaderState } from "@/composables/useAdminHeader";
import { sanitizeContentHtml } from "@/utils/content-html";
import { createOperationId } from "@/utils/operation-id";

const route = useRoute();
const router = useRouter();
const headerState = useAdminHeaderState();

const loading = ref(false);
const saving = ref(false);
const statusSaving = ref(false);
const imageUploading = ref(false);
const channels = ref<AdminSiteContentChannelItem[]>([]);
const contentId = ref<number | null>(null);
const currentStatus = ref<SiteContentStatus>("DRAFT");
const currentVersion = ref(1);
const updatedAt = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const form = reactive({
  type: "ARTICLE" as SiteContentType,
  channelId: null as number | null,
  slug: "",
  path: "",
  title: "",
  summary: "",
  label: "",
  heroNote: "",
  coverImageUrl: "",
  effectiveAt: "" as string,
  sortOrder: 0,
  bodyHtml: "",
  bodyText: ""
});

const isEdit = computed(() => contentId.value !== null);
const isPage = computed(() => form.type === "PAGE");
const pageTitle = computed(() => (isEdit.value ? "编辑内容" : isPage.value ? "新建固定页" : "新建文章"));
const articlePath = computed(() => (form.slug.trim() ? `/guides/${normalizeSlug(form.slug)}` : "/guides/<slug>"));
const previewHtml = computed(() => sanitizeContentHtml(form.bodyHtml || "<p>正文预览区域</p>"));

function parseRouteContentId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseRouteContentType(value: unknown): SiteContentType {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "PAGE" ? "PAGE" : "ARTICLE";
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function resetForm(type: SiteContentType) {
  currentStatus.value = "DRAFT";
  currentVersion.value = 1;
  updatedAt.value = null;
  form.type = type;
  form.channelId = null;
  form.slug = "";
  form.path = "";
  form.title = "";
  form.summary = "";
  form.label = "";
  form.heroNote = "";
  form.coverImageUrl = "";
  form.effectiveAt = "";
  form.sortOrder = 0;
  form.bodyHtml = "";
  form.bodyText = "";
}

function syncRouteState() {
  const nextContentId = parseRouteContentId(route.query.id);
  const nextType = parseRouteContentType(route.query.type);
  const idChanged = contentId.value !== nextContentId;
  const typeChanged = form.type !== nextType;

  if (idChanged || (!nextContentId && typeChanged)) {
    resetForm(nextType);
  }

  contentId.value = nextContentId;
  if (!nextContentId) {
    form.type = nextType;
  }
}

function applyDetail(detail: AdminSiteContentDetail) {
  contentId.value = detail.id;
  currentStatus.value = detail.status;
  currentVersion.value = detail.version;
  updatedAt.value = detail.updatedAt;
  form.type = detail.type;
  form.channelId = detail.channel?.id ?? null;
  form.slug = detail.slug;
  form.path = detail.path;
  form.title = detail.title;
  form.summary = detail.summary;
  form.label = detail.label;
  form.heroNote = detail.heroNote ?? "";
  form.coverImageUrl = detail.coverImageUrl ?? "";
  form.effectiveAt = detail.effectiveAt ? detail.effectiveAt.slice(0, 16) : "";
  form.sortOrder = detail.sortOrder;
  form.bodyHtml = detail.bodyHtml;
  form.bodyText = detail.bodyText;
}

async function loadChannels() {
  const result = await contentApi.listChannels({ page: 1, pageSize: 100 });
  channels.value = result.items;
}

async function loadDetail() {
  if (!contentId.value) return;
  const detail = await contentApi.getDetail(contentId.value);
  applyDetail(detail);
}

async function loadPage() {
  loading.value = true;
  try {
    syncRouteState();
    await Promise.all([loadChannels(), loadDetail()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载内容详情失败");
  } finally {
    loading.value = false;
  }
}

function buildSavePayload() {
  const slug = normalizeSlug(form.slug);
  return {
    type: form.type,
    channelId: isPage.value ? form.channelId : form.channelId,
    slug,
    path: isPage.value ? form.path || null : null,
    title: form.title.trim(),
    summary: form.summary.trim(),
    label: form.label.trim(),
    heroNote: form.heroNote.trim() || null,
    coverImageUrl: form.coverImageUrl.trim() || null,
    bodyHtml: form.bodyHtml.trim(),
    bodyText: form.bodyText.trim(),
    effectiveAt: form.effectiveAt ? new Date(form.effectiveAt).toISOString() : null,
    sortOrder: form.sortOrder
  };
}

function validateForm() {
  const payload = buildSavePayload();
  if (!payload.slug || !payload.title || !payload.summary || !payload.label || !payload.bodyHtml || !payload.bodyText) {
    ElMessage.error("请完整填写标题、摘要、标签、slug 和正文");
    return null;
  }
  if (!isPage.value && !payload.channelId) {
    ElMessage.error("文章必须选择栏目");
    return null;
  }
  return payload;
}

async function persistContent() {
  const payload = validateForm();
  if (!payload) return null;

  if (contentId.value) {
    return contentApi.updateContent(contentId.value, {
      operationId: createOperationId(),
      ...payload,
      expectedVersion: currentVersion.value
    });
  }

  return contentApi.createContent({
    operationId: createOperationId(),
    ...payload
  });
}

async function saveDraft() {
  saving.value = true;
  try {
    const detail = await persistContent();
    if (!detail) return;
    applyDetail(detail);
    if (route.query.id !== String(detail.id)) {
      await router.replace({
        path: "/content/articles/editor",
        query: { id: String(detail.id) }
      });
    }
    ElMessage.success("草稿已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存草稿失败");
  } finally {
    saving.value = false;
  }
}

async function updateStatus(status: SiteContentStatus) {
  if (!contentId.value) {
    const detail = await persistContent();
    if (!detail) return;
    applyDetail(detail);
    await router.replace({
      path: "/content/articles/editor",
      query: { id: String(detail.id) }
    });
  }

  if (!contentId.value) return;

  statusSaving.value = true;
  try {
    const detail = await contentApi.setStatus(contentId.value, {
      operationId: createOperationId(),
      status,
      expectedVersion: currentVersion.value
    });
    applyDetail(detail);
    ElMessage.success(status === "PUBLISHED" ? "内容已发布" : status === "UNLISTED" ? "内容已下架" : "内容已转为草稿");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "切换内容状态失败");
  } finally {
    statusSaving.value = false;
  }
}

async function uploadImage(file: File) {
  imageUploading.value = true;
  try {
    const result = await contentApi.uploadImage(file, createOperationId());
    return result.imageUrl;
  } finally {
    imageUploading.value = false;
  }
}

function chooseCoverImage() {
  fileInputRef.value?.click();
}

async function handleCoverFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (!file) return;
  try {
    form.coverImageUrl = await uploadImage(file);
    ElMessage.success("封面图已上传");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "上传封面图失败");
  } finally {
    if (input) input.value = "";
  }
}

function goBack() {
  void router.push(isPage.value ? "/content/pages" : "/content/articles");
}

watch(
  pageTitle,
  value => {
    headerState.title.value = value;
  },
  { immediate: true }
);

watch(
  () => [route.query.id, route.query.type],
  () => {
    void loadPage();
  }
);

headerState.refresh.value = () => loadPage();

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <section class="page-stack content-editor-page" v-loading="loading">
    <div class="toolbar-panel page-toolbar">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <el-button :icon="Refresh" @click="loadPage">刷新</el-button>
      <div class="toolbar-spacer" />
      <span class="page-note">当前状态：{{ currentStatus === "PUBLISHED" ? "已发布" : currentStatus === "UNLISTED" ? "已下架" : "草稿" }}</span>
    </div>

    <div class="editor-layout">
      <div class="table-panel editor-form-panel">
        <div class="panel-heading">
          <h2>{{ pageTitle }}</h2>
          <p v-if="isEdit">最近更新时间：{{ formatTime(updatedAt) }}</p>
        </div>

        <el-form label-position="top">
          <div class="editor-grid">
            <el-form-item label="内容类型">
              <el-input :model-value="isPage ? '固定页' : '文章'" disabled />
            </el-form-item>
            <el-form-item label="栏目">
              <el-select v-model="form.channelId" :disabled="isPage" placeholder="请选择栏目">
                <el-option v-for="item in channels" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="标题">
              <el-input v-model="form.title" maxlength="80" show-word-limit />
            </el-form-item>
            <el-form-item label="标签">
              <el-input v-model="form.label" maxlength="16" show-word-limit />
            </el-form-item>
            <el-form-item label="slug">
              <el-input v-model="form.slug" :disabled="isPage" maxlength="80" />
            </el-form-item>
            <el-form-item label="访问路径">
              <el-input :model-value="isPage ? form.path : articlePath" disabled />
            </el-form-item>
            <el-form-item class="editor-grid__full" label="摘要">
              <el-input v-model="form.summary" type="textarea" :rows="3" maxlength="240" show-word-limit />
            </el-form-item>
            <el-form-item class="editor-grid__full" label="头部说明">
              <el-input v-model="form.heroNote" type="textarea" :rows="2" maxlength="200" show-word-limit />
            </el-form-item>
            <el-form-item label="生效时间">
              <el-date-picker v-model="form.effectiveAt" type="datetime" value-format="YYYY-MM-DDTHH:mm" placeholder="选填" />
            </el-form-item>
            <el-form-item label="排序">
              <el-input-number v-model="form.sortOrder" :min="0" />
            </el-form-item>
            <el-form-item class="editor-grid__full" label="封面图">
              <div class="cover-editor">
                <div class="cover-editor__preview">
                  <img v-if="form.coverImageUrl" :src="form.coverImageUrl" alt="封面图预览" class="cover-editor__image" />
                  <div v-else class="cover-editor__empty">当前未设置封面图</div>
                </div>
                <div class="cover-editor__actions">
                  <el-button type="primary" :icon="Upload" :loading="imageUploading" @click="chooseCoverImage">上传封面</el-button>
                  <el-button :icon="Picture" @click="form.coverImageUrl = ''">清空</el-button>
                  <el-input v-model="form.coverImageUrl" placeholder="也可直接粘贴图片 URL" />
                </div>
              </div>
            </el-form-item>
            <el-form-item class="editor-grid__full" label="正文">
              <RichTextEditor v-model="form.bodyHtml" :upload-image="uploadImage" @update:text="form.bodyText = $event" />
            </el-form-item>
          </div>
        </el-form>

        <div class="editor-actions">
          <el-button type="primary" :loading="saving" @click="saveDraft">保存草稿</el-button>
          <el-button type="success" :loading="statusSaving" @click="updateStatus('PUBLISHED')">发布</el-button>
          <el-button v-if="isEdit" type="warning" :loading="statusSaving" @click="updateStatus('UNLISTED')">下架</el-button>
        </div>
      </div>

      <div class="table-panel editor-preview-panel">
        <div class="panel-heading">
          <h2>预览</h2>
        </div>
        <article class="content-preview">
          <p class="content-preview__label">{{ form.label || "未设置标签" }}</p>
          <h1>{{ form.title || "未设置标题" }}</h1>
          <p class="content-preview__summary">{{ form.summary || "未设置摘要" }}</p>
          <p v-if="form.heroNote" class="content-preview__note">{{ form.heroNote }}</p>
          <img v-if="form.coverImageUrl" :src="form.coverImageUrl" alt="封面图预览" class="content-preview__cover" />
          <div class="content-preview__body" v-html="previewHtml" />
        </article>
      </div>
    </div>

    <input ref="fileInputRef" class="hidden-file-input" type="file" accept="image/png,image/jpeg,image/webp" @change="handleCoverFileChange" />
  </section>
</template>

<style scoped lang="scss">
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
  gap: 20px;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.editor-grid__full {
  grid-column: 1 / -1;
}

.editor-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.cover-editor {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
}

.cover-editor__preview {
  min-height: 180px;
  border: 1px dashed #dcdfe6;
  border-radius: 16px;
  overflow: hidden;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-editor__image,
.content-preview__cover {
  width: 100%;
  height: auto;
  display: block;
}

.cover-editor__empty {
  color: #909399;
  font-size: 13px;
}

.cover-editor__actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.content-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.content-preview__label {
  font-size: 12px;
  color: #2563eb;
  letter-spacing: 0.08em;
}

.content-preview__summary,
.content-preview__note {
  color: #606266;
  line-height: 1.8;
}

.content-preview__body :deep(img) {
  max-width: 100%;
  border-radius: 12px;
}

.content-preview__body :deep(p),
.content-preview__body :deep(li),
.content-preview__body :deep(blockquote) {
  line-height: 1.8;
}

.hidden-file-input {
  display: none;
}

@media (max-width: 1200px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .editor-grid,
  .cover-editor {
    grid-template-columns: 1fr;
  }
}
</style>
