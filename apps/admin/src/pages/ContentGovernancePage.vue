<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Edit, Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { contentApi, type AdminSiteContentChannelItem, type AdminSiteContentSummary, type AdminSitePageSummary, type SiteContentStatus } from "@/apis/content";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { formatDateTime } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";

type ContentPageMode = "pages" | "articles" | "official-messages" | "channels";

const route = useRoute();
const router = useRouter();

const pageLoading = ref(false);
const pageRows = ref<AdminSitePageSummary[]>([]);
const articleRows = ref<AdminSiteContentSummary[]>([]);
const channelRows = ref<AdminSiteContentChannelItem[]>([]);
const articleTotal = ref(0);
const channelOptions = ref<AdminSiteContentChannelItem[]>([]);

const publicArticleChannelCodes = new Set(["KITCHEN", "COOK", "FOOD"]);
const publicChannelOptions = computed(() => channelOptions.value.filter(item => publicArticleChannelCodes.has(item.code)));
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
        .sort((left, right) => left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id);
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
    await loadArticles();
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
  <section class="page-stack content-page" v-loading="pageLoading">
    <div class="toolbar-panel page-toolbar">
      <el-button v-if="pageMode === 'articles' || pageMode === 'official-messages'" type="primary" :icon="Plus" @click="openEditor()">
        {{ pageMode === "official-messages" ? "新建官方消息" : "新建文章" }}
      </el-button>
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
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openEditor(row.id)">编辑</el-button>
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
        <el-table-column prop="title" label="标题" min-width="220" />
        <el-table-column label="栏目" min-width="140">
          <template #default="{ row }">{{ row.channel?.name ?? "-" }}</template>
        </el-table-column>
        <el-table-column prop="slug" label="slug" min-width="160" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PUBLISHED' ? 'success' : row.status === 'UNLISTED' ? 'warning' : 'info'">
              {{ row.status === "PUBLISHED" ? "已发布" : row.status === "UNLISTED" ? "已下架" : "草稿" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" min-width="180">
          <template #default="{ row }">{{ formatTime(row.publishedAt) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openEditor(row.id)">编辑</el-button>
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
</style>
