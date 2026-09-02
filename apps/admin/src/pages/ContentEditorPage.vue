<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Picture, Refresh, Upload } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import RichTextEditor from "@/components/RichTextEditor.vue";
import { contentApi, type AdminSiteContentChannelItem, type AdminSiteContentDetail, type SiteContentStatus, type SiteContentType } from "@/apis/content";
import { useAdminHeaderState } from "@/composables/useAdminHeader";
import { sanitizeContentHtml } from "@/utils/content-html";
import { markdownToRichText } from "@/utils/markdown-rich-text";
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
const markdownInputRef = ref<HTMLInputElement | null>(null);
const publicArticleChannelCodes = new Set(["KITCHEN", "COOK", "FOOD"]);
const sourceMode = computed(() => {
  const raw = Array.isArray(route.query.source) ? route.query.source[0] : route.query.source;
  return raw === "official-message" ? "official-message" : "";
});
const editorRouteQuery = computed(() => (sourceMode.value === "official-message" ? { source: "official-message", channelCode: "OFFICIAL_NOTICE" } : {}));

const form = reactive({
  type: "ARTICLE" as SiteContentType,
  channelId: null as number | null,
  slug: "",
  path: "",
  title: "",
  summary: "",
  keywords: "",
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
const selectedChannel = computed(() => channels.value.find(item => item.id === form.channelId) ?? null);
const isOfficialMessage = computed(() => sourceMode.value === "official-message" || selectedChannel.value?.code === "OFFICIAL_NOTICE");
const articleChannels = computed(() => channels.value.filter(item => publicArticleChannelCodes.has(item.code)));
const editableChannels = computed(() => {
  if (isPage.value) return channels.value;
  if (isOfficialMessage.value) return channels.value.filter(item => item.code === "OFFICIAL_NOTICE");
  return articleChannels.value;
});
const pageTitle = computed(() => {
  if (isEdit.value) return "编辑内容";
  if (isPage.value) return "新建官网固定页";
  return sourceMode.value === "official-message" ? "新建官方消息" : "新建文章";
});
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

function parseRouteChannelCode(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSummary(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function resolveArticleSlug() {
  const current = normalizeSlug(form.slug);
  if (current) return current;
  const titleSlug = normalizeSlug(form.title);
  const nextSlug = titleSlug || `article-${Date.now().toString(36)}`;
  form.slug = nextSlug;
  return nextSlug;
}

function resolveLabel() {
  if (isPage.value) return form.label.trim();
  return selectedChannel.value?.name ?? (isOfficialMessage.value ? "官方消息" : "知识文章");
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
  form.keywords = "";
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
  form.keywords = detail.keywords ?? "";
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
    if (!contentId.value && form.type === "ARTICLE") {
      const channelCode = parseRouteChannelCode(route.query.channelCode);
      if (channelCode) {
        const matched = channels.value.find(item => item.code === channelCode);
        if (matched) {
          form.channelId = matched.id;
          if (channelCode === "OFFICIAL_NOTICE" && !form.label.trim()) {
            form.label = "官方消息";
          }
        }
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载内容详情失败");
  } finally {
    loading.value = false;
  }
}

function buildSavePayload() {
  const slug = isPage.value ? normalizeSlug(form.slug) : resolveArticleSlug();
  return {
    type: form.type,
    channelId: form.channelId,
    slug,
    path: isPage.value ? form.path || null : null,
    title: form.title.trim(),
    summary: form.summary.trim(),
    keywords: isPage.value ? null : form.keywords.trim() || null,
    label: resolveLabel(),
    heroNote: isPage.value ? form.heroNote.trim() || null : null,
    coverImageUrl: form.coverImageUrl.trim() || null,
    bodyHtml: form.bodyHtml.trim(),
    bodyText: form.bodyText.trim(),
    effectiveAt: isPage.value && form.effectiveAt ? new Date(form.effectiveAt).toISOString() : null,
    sortOrder: isPage.value ? form.sortOrder : 0
  };
}

function validateForm() {
  const payload = buildSavePayload();
  if (!payload.slug || !payload.title || !payload.summary || !payload.label || !payload.bodyHtml || !payload.bodyText) {
    ElMessage.error(isPage.value ? "请完整填写标题、摘要、标签、slug 和正文" : "请完整填写标题、摘要和正文");
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
        query: { id: String(detail.id), ...editorRouteQuery.value }
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
  statusSaving.value = true;
  try {
    const saved = await persistContent();
    if (!saved) return;
    applyDetail(saved);
    if (route.query.id !== String(saved.id)) {
      await router.replace({
        path: "/content/articles/editor",
        query: { id: String(saved.id), ...editorRouteQuery.value }
      });
    }

    const detail = await contentApi.setStatus(saved.id, {
      operationId: createOperationId(),
      status,
      expectedVersion: saved.version
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

function chooseMarkdownFile() {
  markdownInputRef.value?.click();
}

async function handleMarkdownFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (!file) return;
  try {
    const markdown = await file.text();
    const result = markdownToRichText(markdown);
    form.bodyHtml = sanitizeContentHtml(result.html);
    form.bodyText = result.text;
    if (!form.title.trim() && result.title) {
      form.title = result.title.slice(0, 80);
    }
    if (!form.summary.trim()) {
      form.summary = buildSummary(result.text);
    }
    ElMessage.success("Markdown 已导入正文");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导入 Markdown 失败");
  } finally {
    if (input) input.value = "";
  }
}

function goBack() {
  if (isPage.value) {
    void router.push("/content/pages");
    return;
  }
  void router.push(sourceMode.value === "official-message" ? "/content/official-messages" : "/content/articles");
}

watch(
  pageTitle,
  value => {
    headerState.title.value = value;
  },
  { immediate: true }
);

watch(
  () => [route.query.id, route.query.type, route.query.channelCode, route.query.source],
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
            <el-form-item v-if="isPage" label="内容类型">
              <el-input model-value="官网固定页" disabled />
            </el-form-item>
            <el-form-item label="栏目">
              <el-select v-model="form.channelId" :disabled="isPage" placeholder="请选择栏目">
                <el-option v-for="item in editableChannels" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="标题">
              <el-input v-model="form.title" maxlength="80" show-word-limit />
            </el-form-item>
            <el-form-item v-if="isPage" label="标签">
              <el-input v-model="form.label" maxlength="16" show-word-limit />
            </el-form-item>
            <el-form-item v-if="isPage" label="slug">
              <el-input v-model="form.slug" :disabled="isPage" maxlength="80" />
            </el-form-item>
            <el-form-item v-if="isPage" label="访问路径">
              <el-input :model-value="form.path" disabled />
            </el-form-item>
            <el-form-item class="editor-grid__full" label="摘要">
              <el-input v-model="form.summary" type="textarea" :rows="3" maxlength="240" show-word-limit />
            </el-form-item>
            <el-form-item v-if="!isPage" class="editor-grid__full" label="关键词">
              <el-input v-model="form.keywords" maxlength="200" show-word-limit placeholder="多个关键词用分号隔开，例如：焯水; 去腥; 火候" />
            </el-form-item>
            <el-form-item v-if="isPage" class="editor-grid__full" label="头部说明">
              <el-input v-model="form.heroNote" type="textarea" :rows="2" maxlength="200" show-word-limit />
            </el-form-item>
            <el-form-item v-if="isPage" label="生效时间">
              <el-date-picker v-model="form.effectiveAt" type="datetime" value-format="YYYY-MM-DDTHH:mm" placeholder="选填" />
            </el-form-item>
            <el-form-item v-if="isPage" label="排序">
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
            <el-form-item class="editor-grid__full">
              <template #label>
                <div class="form-label-row">
                  <span>正文</span>
                  <el-button v-if="!isPage" size="small" :icon="Upload" @click="chooseMarkdownFile">导入 Markdown</el-button>
                </div>
              </template>
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
    <input ref="markdownInputRef" class="hidden-file-input" type="file" accept=".md,text/markdown,text/plain" @change="handleMarkdownFileChange" />
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

.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
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
