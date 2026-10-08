<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Edit, Plus, Refresh, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  contentApi,
  type AdminSiteContentCalendarDay,
  type AdminSiteContentChannelItem,
  type AdminSiteContentSummary,
  type AdminSitePageSummary,
  type PublicArticleChannelCode,
  type SiteContentStatus
} from "@/apis/content";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { sanitizeContentHtml } from "@/utils/content-html";
import { formatDateTime } from "@/utils/date";
import { markdownToRichText } from "@/utils/markdown-rich-text";
import { createOperationId } from "@/utils/operation-id";

type ContentPageMode = "pages" | "articles" | "official-messages" | "channels";

const route = useRoute();
const router = useRouter();

const pageLoading = ref(false);
const pageRows = ref<AdminSitePageSummary[]>([]);
const articleRows = ref<AdminSiteContentSummary[]>([]);
const articleCalendarDays = ref<Record<string, PublicArticleChannelCode[]>>({});
const channelRows = ref<AdminSiteContentChannelItem[]>([]);
const articleTotal = ref(0);
const channelOptions = ref<AdminSiteContentChannelItem[]>([]);
const articleImporting = ref(false);
const articleImportInput = ref<HTMLInputElement | null>(null);
const scheduleDialogOpen = ref(false);
const scheduleSaving = ref(false);
const scheduleTime = ref<string | null>(null);
const scheduleTarget = ref<AdminSiteContentSummary | null>(null);
const articleCalendarLoading = ref(false);
const articleCalendarError = ref(false);
let articleCalendarRequest = 0;

const publicArticleChannelCodes = new Set(["KITCHEN", "COOK", "FOOD"]);
const publicChannelOptions = computed(() => channelOptions.value.filter(item => publicArticleChannelCodes.has(item.code)));
const articleChannelColors: Record<PublicArticleChannelCode, string> = {
  KITCHEN: "#567746",
  COOK: "#B65E3E",
  FOOD: "#5B709B"
};
const articleCalendarMonth = ref(currentShanghaiMonth());
const selectedArticleDate = ref<string | null>(null);
const articleCalendarTitle = computed(() => {
  const [year, month] = articleCalendarMonth.value.split("-");
  return `${year}年${Number(month)}月`;
});
const articleCalendarCells = computed(() => {
  const [year, month] = articleCalendarMonth.value.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: Array<{ key: string; date: string | null; day: string }> = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `empty-start-${index}`, date: null, day: "" });
  }
  for (let day = 1; day <= dayCount; day += 1) {
    cells.push({
      key: `${articleCalendarMonth.value}-${String(day).padStart(2, "0")}`,
      date: `${articleCalendarMonth.value}-${String(day).padStart(2, "0")}`,
      day: String(day)
    });
  }
  const trailingCount = (7 - cells.length % 7) % 7;
  for (let index = 0; index < trailingCount; index += 1) {
    cells.push({ key: `empty-end-${index}`, date: null, day: "" });
  }
  return cells;
});
const channelDialogOpen = ref(false);
const channelSaving = ref(false);
const channelForm = reactive({
  id: 0,
  code: "",
  name: "",
  description: "",
  sortOrder: 0,
  expectedVersion: 1
});

const articleQuery = reactive({
  page: 1,
  pageSize: 20,
  channelId: undefined as number | undefined,
  channelCode: "",
  status: undefined as SiteContentStatus | undefined,
  keyword: ""
});

const pageMode = computed<ContentPageMode>(() => {
  const mode = route.meta.contentPage;
  if (mode === "articles" || mode === "official-messages" || mode === "channels") return mode;
  return "pages";
});

const pageNote = computed(() => {
  if (pageMode.value === "pages") return "官网固定页服务 PC 官网与小程序 WebView 内容承接，未发布前不会覆盖线上展示。";
  if (pageMode.value === "channels") return "前台知识文章当前只开放厨房百事、烹调技法、食养风物三类；code 创建后固定，只能编辑名称、说明和排序。";
  if (pageMode.value === "official-messages") return "官方消息会进入小程序通知中心，支持站内详情和正文链接跳转。";
  return "知识文章统一走 /guides/* 路径，当前只发布到厨房百事、烹调技法、食养风物三类。";
});

const statusOptions: Array<{ label: string; value: SiteContentStatus }> = [
  { label: "草稿", value: "DRAFT" },
  { label: "已发布", value: "PUBLISHED" },
  { label: "已下架", value: "UNLISTED" }
];

function formatTime(value: string | null) {
  return formatDateTime(value);
}

function currentShanghaiMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  if (!year || !month) return new Date().toISOString().slice(0, 7);
  return `${year}-${month}`;
}

function articleChannelColor(code: string | null | undefined) {
  return code && Object.prototype.hasOwnProperty.call(articleChannelColors, code)
    ? articleChannelColors[code as PublicArticleChannelCode]
    : "#78716C";
}

function moveArticleCalendarMonth(offset: -1 | 1) {
  const [year, month] = articleCalendarMonth.value.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1));
  articleCalendarMonth.value = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  if (selectedArticleDate.value) {
    selectedArticleDate.value = null;
    articleQuery.page = 1;
    void loadArticles();
  }
  void loadArticleCalendar();
}

function toggleArticleCalendarDate(date: string) {
  selectedArticleDate.value = selectedArticleDate.value === date ? null : date;
  articleQuery.page = 1;
  void loadArticles();
}

async function loadArticleCalendar() {
  if (pageMode.value !== "articles") return;
  const requestId = ++articleCalendarRequest;
  const requestedMonth = articleCalendarMonth.value;
  articleCalendarLoading.value = true;
  articleCalendarError.value = false;
  try {
    const result: AdminSiteContentCalendarDay[] = await contentApi.listArticleCalendar(requestedMonth);
    if (requestId !== articleCalendarRequest) return;
    articleCalendarDays.value = Object.fromEntries(result.map(item => [item.date, item.channelCodes]));
  } catch {
    if (requestId !== articleCalendarRequest) return;
    articleCalendarDays.value = {};
    articleCalendarError.value = true;
  } finally {
    if (requestId === articleCalendarRequest) articleCalendarLoading.value = false;
  }
}

function formatScheduleTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(new Date(value));
}

function toShanghaiDateInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));
  const field = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return `${field("year")}-${field("month")}-${field("day")} ${field("hour")}:${field("minute")}:${field("second")}`;
}

function openSchedule(row: AdminSiteContentSummary) {
  scheduleTarget.value = row;
  const nextTime = row.scheduledPublishAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
  scheduleTime.value = toShanghaiDateInput(nextTime);
  scheduleDialogOpen.value = true;
}

async function saveSchedule() {
  const row = scheduleTarget.value;
  if (!row || !scheduleTime.value || new Date(`${scheduleTime.value.replace(" ", "T")}+08:00`).getTime() <= Date.now()) {
    ElMessage.warning("请选择晚于当前时间的发布时间");
    return;
  }
  scheduleSaving.value = true;
  try {
    await contentApi.setSchedule(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version,
      scheduledPublishAt: new Date(`${scheduleTime.value.replace(" ", "T")}+08:00`).toISOString()
    });
    scheduleDialogOpen.value = false;
    await loadArticles();
    ElMessage.success("已预约定时发布");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "预约定时发布失败");
  } finally {
    scheduleSaving.value = false;
  }
}

async function cancelSchedule(row: AdminSiteContentSummary) {
  try {
    await ElMessageBox.confirm(`取消“${row.title}”的定时发布？`, "取消预约", {
      confirmButtonText: "确认取消",
      cancelButtonText: "返回",
      type: "warning"
    });
    await contentApi.setSchedule(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version,
      scheduledPublishAt: null
    });
    await loadArticles();
    ElMessage.success("已取消定时发布");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "取消定时发布失败");
  }
}

function openEditor(id?: number) {
  const officialQuery = { channelCode: "OFFICIAL_NOTICE", source: "official-message" };
  void router.push({
    path: "/content/articles/editor",
    query: id
      ? pageMode.value === "official-messages"
        ? { id: String(id), ...officialQuery }
        : { id: String(id) }
      : pageMode.value === "official-messages"
        ? { type: "ARTICLE", ...officialQuery }
        : { type: "ARTICLE" }
  });
}

function openArticleImport() {
  articleImportInput.value?.click();
}

function articleImportError(index: number, message: string): never {
  throw new Error(`第 ${index + 1} 篇文章：${message}`);
}

function prepareArticleImport(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSON 根节点必须是包含 articles 数组的对象");
  }
  const articles = (value as { articles?: unknown }).articles;
  if (!Array.isArray(articles) || !articles.length || articles.length > 100) {
    throw new Error("articles 必须包含 1 到 100 篇文章");
  }

  const usedSlugs = new Set<string>();
  return articles.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return articleImportError(index, "必须是对象");
    }
    const article = value as Record<string, unknown>;
    const title = typeof article.title === "string" ? article.title.trim() : "";
    const summary = typeof article.summary === "string" ? article.summary.trim() : "";
    const channelCode = typeof article.channelCode === "string" ? article.channelCode.trim().toUpperCase() : "";
    const bodyMarkdown = typeof article.bodyMarkdown === "string" ? article.bodyMarkdown : "";
    const keywords = article.keywords == null ? "" : typeof article.keywords === "string" ? article.keywords.trim() : null;
    const coverImageUrl = article.coverImageUrl == null ? "" : typeof article.coverImageUrl === "string" ? article.coverImageUrl.trim() : null;

    if (!title || title.length > 80) return articleImportError(index, "title 必填且最多 80 个字符");
    if (!summary || summary.length > 240) return articleImportError(index, "summary 必填且最多 240 个字符");
    if (!bodyMarkdown.trim()) return articleImportError(index, "bodyMarkdown 必填");
    if (keywords === null || (keywords && keywords.length > 200)) return articleImportError(index, "keywords 必须是最多 200 个字符的字符串");
    if (coverImageUrl === null || coverImageUrl.length > 512) return articleImportError(index, "coverImageUrl 必须是最多 512 个字符的字符串或 null");

    const channel = publicChannelOptions.value.find(item => item.code === channelCode);
    if (!channel) return articleImportError(index, "channelCode 只能是 KITCHEN、COOK 或 FOOD");

    const richText = markdownToRichText(bodyMarkdown);
    const bodyHtml = sanitizeContentHtml(richText.html);
    if (!bodyHtml.trim() || !richText.text.trim()) return articleImportError(index, "正文转换后不能为空");

    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "") || `article-${Date.now().toString(36)}-${index + 1}`;
    let slug = baseSlug.slice(0, 80);
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      const suffixText = `-${suffix++}`;
      slug = `${baseSlug.slice(0, 80 - suffixText.length)}${suffixText}`;
    }
    usedSlugs.add(slug);

    return {
      channel,
      slug,
      title,
      summary,
      keywords: keywords || null,
      coverImageUrl: coverImageUrl || null,
      bodyHtml,
      bodyText: richText.text
    };
  });
}

async function importArticles(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  articleImporting.value = true;
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    await loadChannelOptions();
    const articles = prepareArticleImport(parsed);
    await ElMessageBox.confirm(`将导入 ${articles.length} 篇文章，并全部保存为草稿。`, "导入文章", {
      type: "info",
      confirmButtonText: "导入草稿",
      cancelButtonText: "取消"
    });

    let importedCount = 0;
    for (const article of articles) {
      try {
        await contentApi.createContent({
          operationId: createOperationId(),
          type: "ARTICLE",
          channelId: article.channel.id,
          slug: article.slug,
          title: article.title,
          summary: article.summary,
          keywords: article.keywords,
          label: article.channel.name,
          coverImageUrl: article.coverImageUrl,
          bodyHtml: article.bodyHtml,
          bodyText: article.bodyText
        });
        importedCount += 1;
      } catch (error) {
        await loadArticles();
        const detail = error instanceof Error ? error.message : "请求失败";
        ElMessage.error(`已导入 ${importedCount} 篇；第 ${importedCount + 1} 篇失败：${detail}`);
        return;
      }
    }

    await loadArticles();
    ElMessage.success(`已导入 ${importedCount} 篇文章草稿`);
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "导入文章失败");
  } finally {
    articleImporting.value = false;
  }
}

async function loadChannelOptions() {
  const result = await contentApi.listChannels({
    page: 1,
    pageSize: 100
  });
  channelOptions.value = result.items;
}

async function loadPages() {
  const result = await contentApi.listPages();
  pageRows.value = result.items;
}

async function loadArticles() {
  if (pageMode.value === "official-messages" && articleQuery.channelCode) {
    if (!channelOptions.value.length) {
      await loadChannelOptions();
    }
    const matched = channelOptions.value.find(item => item.code === articleQuery.channelCode);
    articleQuery.channelId = matched?.id;
  }

  if (pageMode.value === "articles" && selectedArticleDate.value) {
    const result = await contentApi.listArticles({
      page: articleQuery.page,
      pageSize: articleQuery.pageSize,
      channelId: articleQuery.channelId,
      status: articleQuery.status,
      keyword: articleQuery.keyword.trim() || undefined,
      publishedDate: selectedArticleDate.value
    });
    articleRows.value = result.items;
    articleTotal.value = result.total;
    return;
  }

  if (pageMode.value === "articles") {
    const publicChannelIds = new Set(publicChannelOptions.value.map(item => item.id));
    if (articleQuery.channelId && !publicChannelIds.has(articleQuery.channelId)) {
      articleQuery.channelId = undefined;
    }
    if (!articleQuery.channelId) {
      const results = await Promise.all(
        publicChannelOptions.value.map(item =>
          contentApi.listArticles({
            page: 1,
            pageSize: 100,
            channelId: item.id,
            status: articleQuery.status,
            keyword: articleQuery.keyword.trim() || undefined
          })
        )
      );
      const allItems = results
        .flatMap(result => result.items)
        .sort((left, right) => {
          if (left.publishedAt && right.publishedAt) {
            const publishedAtOrder = right.publishedAt.localeCompare(left.publishedAt);
            if (publishedAtOrder) return publishedAtOrder;
          } else if (left.publishedAt) {
            return -1;
          } else if (right.publishedAt) {
            return 1;
          }
          return right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id;
        });
      const start = (articleQuery.page - 1) * articleQuery.pageSize;
      articleRows.value = allItems.slice(start, start + articleQuery.pageSize);
      articleTotal.value = allItems.length;
      return;
    }
  }

  const result = await contentApi.listArticles({
    page: articleQuery.page,
    pageSize: articleQuery.pageSize,
    channelId: articleQuery.channelId,
    status: articleQuery.status,
    keyword: articleQuery.keyword.trim() || undefined
  });
  articleRows.value = result.items;
  articleTotal.value = result.total;
}

async function loadChannels() {
  const result = await contentApi.listChannels({
    page: 1,
    pageSize: 100
  });
  channelRows.value = result.items.filter(item => publicArticleChannelCodes.has(item.code));
}

function openChannelEditor(row: AdminSiteContentChannelItem) {
  channelForm.id = row.id;
  channelForm.code = row.code;
  channelForm.name = row.name;
  channelForm.description = row.description ?? "";
  channelForm.sortOrder = row.sortOrder;
  channelForm.expectedVersion = row.version;
  channelDialogOpen.value = true;
}

async function saveChannel() {
  if (!channelForm.id) return;
  const name = channelForm.name.trim();
  if (!name) {
    ElMessage.error("请填写栏目名称");
    return;
  }

  channelSaving.value = true;
  try {
    await contentApi.updateChannel(channelForm.id, {
      operationId: createOperationId(),
      name,
      description: channelForm.description.trim() || null,
      sortOrder: channelForm.sortOrder,
      expectedVersion: channelForm.expectedVersion
    });
    channelDialogOpen.value = false;
    ElMessage.success("栏目已更新");
    await loadChannels();
    await loadChannelOptions();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存栏目失败");
  } finally {
    channelSaving.value = false;
  }
}

async function setContentStatus(row: AdminSiteContentSummary, status: SiteContentStatus) {
  try {
    await ElMessageBox.confirm(
      status === "PUBLISHED" ? `确认上架“${row.title}”？` : `确认下架“${row.title}”？`,
      status === "PUBLISHED" ? "上架内容" : "下架内容",
      {
        type: "warning",
        confirmButtonText: status === "PUBLISHED" ? "上架" : "下架",
        cancelButtonText: "取消"
      }
    );
    await contentApi.setStatus(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version,
      status
    });
    await Promise.all([loadArticles(), loadArticleCalendar()]);
    ElMessage.success(status === "PUBLISHED" ? "内容已上架" : "内容已下架");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "更新内容状态失败");
  }
}

async function removeContent(row: AdminSiteContentSummary) {
  try {
    await ElMessageBox.confirm(`确认删除“${row.title}”？已发布内容需先下架。`, "删除内容", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
    await contentApi.deleteContent(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version
    });
    await Promise.all([loadArticles(), loadArticleCalendar()]);
    ElMessage.success("内容已删除");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除内容失败");
  }
}

async function loadCurrentPage() {
  pageLoading.value = true;
  try {
    if (pageMode.value === "pages") {
      await loadPages();
      return;
    }
    if (pageMode.value === "channels") {
      await loadChannels();
      return;
    }
    await loadChannelOptions();
    articleQuery.channelCode = pageMode.value === "official-messages" ? "OFFICIAL_NOTICE" : "";
    if (pageMode.value === "official-messages") {
      const officialChannel = channelOptions.value.find(item => item.code === "OFFICIAL_NOTICE");
      articleQuery.channelId = officialChannel?.id;
    } else {
      articleQuery.channelId = undefined;
    }
    await Promise.all([loadArticles(), loadArticleCalendar()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载内容治理数据失败");
  } finally {
    pageLoading.value = false;
  }
}

useAdminHeaderRefresh(() => {
  void loadCurrentPage();
});

watch(pageMode, () => {
  void loadCurrentPage();
});

onMounted(() => {
  void loadCurrentPage();
});
</script>

<template>
  <section class="page-stack content-page" :class="{ 'content-page--calendar': pageMode === 'articles' }" v-loading="pageLoading">
    <div class="toolbar-panel page-toolbar">
      <el-button v-if="pageMode === 'articles' || pageMode === 'official-messages'" type="primary" :icon="Plus" @click="openEditor()">
        {{ pageMode === "official-messages" ? "新建官方消息" : "新建文章" }}
      </el-button>
      <el-button v-if="pageMode === 'articles'" :icon="Upload" :loading="articleImporting" @click="openArticleImport">JSON 导入</el-button>
      <input
        v-if="pageMode === 'articles'"
        ref="articleImportInput"
        class="hidden-file-input"
        type="file"
        accept="application/json,.json"
        @change="importArticles"
      />
      <el-button :icon="Refresh" @click="loadCurrentPage">刷新</el-button>
      <div class="toolbar-spacer" />
      <span class="page-note">{{ pageNote }}</span>
    </div>

    <div v-if="pageMode === 'pages'" class="table-panel">
      <div class="panel-heading">
        <h2>官网固定页</h2>
      </div>
      <el-table :data="pageRows" row-key="id">
        <el-table-column prop="title" label="页面" min-width="180" />
        <el-table-column prop="path" label="路径" min-width="180" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PUBLISHED' ? 'success' : row.status === 'UNLISTED' ? 'warning' : 'info'">
              {{ row.status === "PUBLISHED" ? "已发布" : row.status === "UNLISTED" ? "已下架" : "草稿" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作人" min-width="140">
          <template #default="{ row }">{{ row.updatedBy?.displayName ?? "-" }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openEditor(row.id)">编辑</el-button>
            <el-button v-if="row.status !== 'PUBLISHED'" size="small" type="success" @click="setContentStatus(row, 'PUBLISHED')">上架</el-button>
            <el-button v-else size="small" type="warning" @click="setContentStatus(row, 'UNLISTED')">下架</el-button>
            <el-button v-if="pageMode !== 'pages'" size="small" type="danger" :disabled="row.status === 'PUBLISHED'" @click="removeContent(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else-if="pageMode === 'articles' || pageMode === 'official-messages'" class="table-panel">
      <div class="toolbar-panel page-toolbar content-filter">
        <el-select v-if="pageMode !== 'official-messages'" v-model="articleQuery.channelId" class="toolbar-select" placeholder="全部知识分类" clearable>
          <el-option v-for="item in publicChannelOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-tag v-else type="success" effect="light">系统官方消息</el-tag>
        <el-select v-model="articleQuery.status" class="toolbar-select" placeholder="全部状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="articleQuery.keyword" class="toolbar-search" placeholder="搜索标题 / 摘要 / slug" clearable @keyup.enter="articleQuery.page = 1; loadArticles()" />
        <el-button type="primary" @click="articleQuery.page = 1; loadArticles()">查询</el-button>
      </div>

      <el-table :data="articleRows" row-key="id">
        <el-table-column label="标题" min-width="220">
          <template #default="{ row }">
            <span v-if="pageMode === 'articles'" class="article-channel-name" :style="{ color: articleChannelColor(row.channel?.code) }">
              {{ row.channel?.name ?? "未分类" }}
            </span>
            <span v-if="pageMode === 'articles'" class="article-title-separator">|</span>
            <span>{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="pageMode !== 'articles'" label="栏目" min-width="140">
          <template #default="{ row }">{{ row.channel?.name ?? "-" }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PUBLISHED' ? 'success' : row.status === 'UNLISTED' ? 'warning' : 'info'">
              {{ row.status === "PUBLISHED" ? "已发布" : row.status === "UNLISTED" ? "已下架" : "草稿" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="pageMode === 'articles'" label="时间（发布/更新）" min-width="205">
          <template #default="{ row }">
            <div class="article-time-cell">
              <div class="article-time-cell__row">
                <span class="article-time-cell__label">发布</span>
                <span v-if="row.publishedAt">{{ formatTime(row.publishedAt) }}</span>
                <el-tag v-else-if="row.scheduledPublishAt" type="warning" effect="light">预约 {{ formatScheduleTime(row.scheduledPublishAt) }}</el-tag>
                <span v-else>-</span>
              </div>
              <div class="article-time-cell__row">
                <span class="article-time-cell__label">更新</span>
                <span>{{ formatTime(row.updatedAt) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-else label="发布时间" min-width="200">
          <template #default="{ row }">
            <span v-if="row.publishedAt">{{ formatTime(row.publishedAt) }}</span>
            <el-tag v-else-if="row.scheduledPublishAt" type="warning" effect="light">预约 {{ formatScheduleTime(row.scheduledPublishAt) }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column v-if="pageMode !== 'articles'" label="更新时间" min-width="180">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openEditor(row.id)">编辑</el-button>
            <template v-if="pageMode === 'articles'">
              <el-button v-if="row.status === 'DRAFT'" size="small" type="success" @click="setContentStatus(row, 'PUBLISHED')">发布</el-button>
              <el-button v-if="row.status === 'DRAFT' && !row.scheduledPublishAt" size="small" type="primary" plain @click="openSchedule(row)">定时发布</el-button>
              <el-button v-if="row.status === 'DRAFT' && row.scheduledPublishAt" size="small" type="warning" plain @click="cancelSchedule(row)">取消预约</el-button>
              <el-button v-if="row.status === 'PUBLISHED'" size="small" type="warning" @click="setContentStatus(row, 'UNLISTED')">下架</el-button>
              <el-button v-if="row.status !== 'PUBLISHED'" size="small" type="danger" @click="removeContent(row)">删除</el-button>
            </template>
            <template v-else>
              <el-button v-if="row.status !== 'PUBLISHED'" size="small" type="success" @click="setContentStatus(row, 'PUBLISHED')">上架</el-button>
              <el-button v-else size="small" type="warning" @click="setContentStatus(row, 'UNLISTED')">下架</el-button>
              <el-button size="small" type="danger" :disabled="row.status === 'PUBLISHED'" @click="removeContent(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="articleQuery.page"
          v-model:page-size="articleQuery.pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="articleTotal"
          @change="loadArticles"
        />
      </div>

      <el-dialog v-model="scheduleDialogOpen" title="定时发布" width="420px">
        <p class="schedule-help">文章将在所选北京时间自动发布。</p>
        <el-date-picker
          v-model="scheduleTime"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="选择发布时间"
          style="width: 100%"
        />
        <template #footer>
          <el-button @click="scheduleDialogOpen = false">取消</el-button>
          <el-button type="primary" :loading="scheduleSaving" @click="saveSchedule">确认预约</el-button>
        </template>
      </el-dialog>
    </div>

    <div v-else class="table-panel">
      <div class="panel-heading">
        <h2>前台知识分类</h2>
        <p>这三类与小程序“厨房知识”入口保持一致。</p>
      </div>

      <el-table :data="channelRows" row-key="id">
        <el-table-column prop="name" label="栏目名称" min-width="180" />
        <el-table-column prop="code" label="编码" min-width="160" />
        <el-table-column prop="description" label="说明" min-width="240" />
        <el-table-column prop="sortOrder" label="排序" width="100" />
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" :icon="Edit" @click="openChannelEditor(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <aside v-if="pageMode === 'articles'" class="article-calendar-panel">
      <div class="article-calendar__header">
        <h3>发布日历</h3>
        <div class="article-calendar__month-control">
          <button type="button" aria-label="上个月" @click="moveArticleCalendarMonth(-1)">‹</button>
          <strong>{{ articleCalendarTitle }}</strong>
          <button type="button" aria-label="下个月" @click="moveArticleCalendarMonth(1)">›</button>
        </div>
      </div>
      <div class="article-calendar__weekdays">
        <span v-for="weekday in ['日', '一', '二', '三', '四', '五', '六']" :key="weekday">{{ weekday }}</span>
      </div>
      <div class="article-calendar__grid" :aria-busy="articleCalendarLoading">
        <button
          v-for="cell in articleCalendarCells"
          :key="cell.key"
          type="button"
          class="article-calendar__cell"
          :class="{ 'article-calendar__cell--selected': cell.date && selectedArticleDate === cell.date }"
          :disabled="!cell.date"
          :aria-pressed="cell.date ? selectedArticleDate === cell.date : undefined"
          @click="cell.date && toggleArticleCalendarDate(cell.date)"
        >
          <span v-if="cell.date" class="article-calendar__day">{{ cell.day }}</span>
          <div v-if="cell.date" class="article-calendar__marks">
            <span
              v-for="channelCode in articleCalendarDays[cell.date] ?? []"
              :key="channelCode"
              class="article-calendar__dot"
              :style="{ backgroundColor: articleChannelColor(channelCode) }"
              :title="publicChannelOptions.find(channel => channel.code === channelCode)?.name ?? channelCode"
            />
          </div>
        </button>
      </div>
      <p v-if="articleCalendarLoading" class="article-calendar__message">加载中…</p>
      <button v-else-if="articleCalendarError" type="button" class="article-calendar__message article-calendar__message--retry" @click="loadArticleCalendar">
        加载失败，点击重试
      </button>
      <div class="article-calendar__legend">
        <span v-for="channel in publicChannelOptions" :key="channel.code">
          <i :style="{ backgroundColor: articleChannelColor(channel.code) }" />{{ channel.name }}
        </span>
      </div>
    </aside>

    <el-dialog v-model="channelDialogOpen" title="编辑栏目" width="520px">
      <el-form label-position="top">
        <el-form-item label="code">
          <el-input v-model="channelForm.code" disabled />
        </el-form-item>
        <el-form-item label="栏目名称">
          <el-input v-model="channelForm.name" maxlength="32" show-word-limit />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="channelForm.description" type="textarea" :rows="3" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="channelForm.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="channelSaving" @click="saveChannel">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.content-filter {
  margin-bottom: 16px;
}

.content-page--calendar {
  grid-template-columns: minmax(0, 1fr) 400px;
  align-items: start;
}

.content-page--calendar > .toolbar-panel:first-child {
  grid-column: 1 / -1;
}

.content-page--calendar > .table-panel {
  grid-column: 1;
  min-width: 0;
  padding: 0;
  border: 0;
}

.content-page--calendar > .article-calendar-panel {
  grid-column: 2;
  grid-row: 2;
}

.article-channel-name {
  font-weight: 600;
  white-space: nowrap;
}

.article-title-separator {
  margin: 0 6px;
  color: #b8b2a8;
}

.article-time-cell {
  display: grid;
  gap: 4px;
  font-size: 12px;
  line-height: 1.4;
}

.article-time-cell__row {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 18px;
  white-space: nowrap;
}

.article-time-cell__label {
  flex: 0 0 28px;
  color: #8c857a;
}

.article-calendar-panel {
  min-width: 0;
  padding: 16px;
  background: #fff;
  border: 1px solid #ece7df;
  border-radius: 6px;
}

.article-calendar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.article-calendar__header h3 {
  margin: 0;
  font-size: 15px;
}

.article-calendar__month-control {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #57534e;
  font-size: 13px;
}

.article-calendar__month-control button {
  width: 26px;
  height: 26px;
  padding: 0;
  color: #57534e;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  background: #f6f5f2;
  border: 0;
  border-radius: 50%;
}

.article-calendar__weekdays,
.article-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.article-calendar__weekdays {
  margin-bottom: 6px;
  color: #8c857a;
  font-size: 11px;
  text-align: center;
}

.article-calendar__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 42px;
  padding: 4px 1px;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 4px;
}

.article-calendar__cell:disabled {
  cursor: default;
}

.article-calendar__cell--selected {
  background: #eef3ec;
}

.article-calendar__day {
  color: #44403c;
  font-size: 12px;
  line-height: 18px;
}

.article-calendar__marks {
  display: flex;
  justify-content: center;
  min-height: 12px;
  gap: 3px;
}

.article-calendar__dot,
.article-calendar__legend i {
  display: inline-block;
  border-radius: 50%;
}

.article-calendar__dot {
  width: 5px;
  height: 5px;
  flex: 0 0 5px;
}

.article-calendar__message {
  width: 100%;
  margin: 8px 0 0;
  color: #8c857a;
  font-size: 12px;
  text-align: center;
  background: transparent;
  border: 0;
}

.article-calendar__message--retry {
  color: #a98228;
  cursor: pointer;
}

.article-calendar__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 14px;
  padding-top: 12px;
  color: #625d54;
  font-size: 11px;
  border-top: 1px solid #f0ede7;
}

.article-calendar__legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.article-calendar__legend i {
  width: 8px;
  height: 8px;
  flex-basis: 8px;
}

.schedule-help {
  margin: 0 0 16px;
  color: #606266;
}

@media (max-width: 1280px) {
  .article-calendar-panel {
    padding: 12px;
  }

  .article-calendar__dot {
    width: 9px;
    height: 9px;
    flex-basis: 9px;
  }
}
</style>
