<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { contentApi, type AdminSiteContentChannelItem, type AdminSiteContentSummary, type AdminSitePageSummary, type SiteContentStatus } from "@/apis/content";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type ContentPageMode = "pages" | "articles" | "channels";

const route = useRoute();
const router = useRouter();

const pageLoading = ref(false);
const pageRows = ref<AdminSitePageSummary[]>([]);
const articleRows = ref<AdminSiteContentSummary[]>([]);
const channelRows = ref<AdminSiteContentChannelItem[]>([]);
const articleTotal = ref(0);
const channelTotal = ref(0);
const channelOptions = ref<AdminSiteContentChannelItem[]>([]);
const channelDialogVisible = ref(false);
const channelSaving = ref(false);
const editingChannelId = ref<number | null>(null);

const articleQuery = reactive({
  page: 1,
  pageSize: 20,
  channelId: undefined as number | undefined,
  status: undefined as SiteContentStatus | undefined,
  keyword: ""
});

const channelQuery = reactive({
  page: 1,
  pageSize: 20,
  code: ""
});

const channelForm = reactive({
  code: "",
  name: "",
  description: "",
  sortOrder: 0,
  version: 1
});

const pageMode = computed<ContentPageMode>(() => {
  const mode = route.meta.contentPage;
  if (mode === "articles" || mode === "channels") return mode;
  return "pages";
});

const pageNote = computed(() => {
  if (pageMode.value === "pages") return "固定页服务官网与小程序内容承接，未发布前不会覆盖线上展示。";
  if (pageMode.value === "channels") return "栏目只做内容归类与后台筛选，不扩成标签或专题系统。";
  return "普通文章统一走 /guides/* 路径，餐前准备与厨房知识共用一套内容主事实。";
});

const statusOptions: Array<{ label: string; value: SiteContentStatus }> = [
  { label: "草稿", value: "DRAFT" },
  { label: "已发布", value: "PUBLISHED" },
  { label: "已下架", value: "UNLISTED" }
];

function formatTime(value: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function openEditor(id?: number) {
  void router.push({
    path: "/content/articles/editor",
    query: id ? { id: String(id) } : { type: "ARTICLE" }
  });
}

function openChannelCreate() {
  editingChannelId.value = null;
  channelForm.code = "";
  channelForm.name = "";
  channelForm.description = "";
  channelForm.sortOrder = 0;
  channelForm.version = 1;
  channelDialogVisible.value = true;
}

function openChannelEdit(row: AdminSiteContentChannelItem) {
  editingChannelId.value = row.id;
  channelForm.code = row.code;
  channelForm.name = row.name;
  channelForm.description = row.description ?? "";
  channelForm.sortOrder = row.sortOrder;
  channelForm.version = row.version;
  channelDialogVisible.value = true;
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
    page: channelQuery.page,
    pageSize: channelQuery.pageSize,
    code: channelQuery.code.trim() || undefined
  });
  channelRows.value = result.items;
  channelTotal.value = result.total;
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
    await Promise.all([loadArticles(), loadChannelOptions()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载内容治理数据失败");
  } finally {
    pageLoading.value = false;
  }
}

async function submitChannel() {
  const code = channelForm.code.trim();
  const name = channelForm.name.trim();
  if (!code || !name) {
    ElMessage.error("请完整填写栏目编码和名称");
    return;
  }

  channelSaving.value = true;
  try {
    if (editingChannelId.value) {
      await contentApi.updateChannel(editingChannelId.value, {
        operationId: createOperationId(),
        code,
        name,
        description: channelForm.description.trim() || null,
        sortOrder: channelForm.sortOrder,
        expectedVersion: channelForm.version
      });
      ElMessage.success("栏目已更新");
    } else {
      await contentApi.createChannel({
        operationId: createOperationId(),
        code,
        name,
        description: channelForm.description.trim() || null,
        sortOrder: channelForm.sortOrder
      });
      ElMessage.success("栏目已创建");
    }
    channelDialogVisible.value = false;
    await Promise.all([loadChannels(), loadChannelOptions()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存栏目失败");
  } finally {
    channelSaving.value = false;
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
      <el-button v-if="pageMode === 'articles'" type="primary" :icon="Plus" @click="openEditor()">新建文章</el-button>
      <el-button v-if="pageMode === 'channels'" type="primary" :icon="Plus" @click="openChannelCreate()">新建栏目</el-button>
      <el-button :icon="Refresh" @click="loadCurrentPage">刷新</el-button>
      <div class="toolbar-spacer" />
      <span class="page-note">{{ pageNote }}</span>
    </div>

    <div v-if="pageMode === 'pages'" class="table-panel">
      <div class="panel-heading">
        <h2>固定页</h2>
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

    <div v-else-if="pageMode === 'articles'" class="table-panel">
      <div class="toolbar-panel page-toolbar content-filter">
        <el-select v-model="articleQuery.channelId" class="toolbar-select" placeholder="全部栏目" clearable>
          <el-option v-for="item in channelOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
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
      <div class="toolbar-panel page-toolbar content-filter">
        <el-input v-model="channelQuery.code" class="toolbar-search" placeholder="按编码搜索栏目" clearable @keyup.enter="channelQuery.page = 1; loadChannels()" />
        <el-button type="primary" @click="channelQuery.page = 1; loadChannels()">查询</el-button>
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
            <el-button size="small" type="primary" @click="openChannelEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="channelQuery.page"
          v-model:page-size="channelQuery.pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100]"
          :total="channelTotal"
          @change="loadChannels"
        />
      </div>
    </div>

    <el-dialog v-model="channelDialogVisible" :title="editingChannelId ? '编辑栏目' : '新建栏目'" width="520px">
      <el-form label-position="top">
        <el-form-item label="栏目编码">
          <el-input v-model="channelForm.code" placeholder="例如 PRE_MEAL" />
        </el-form-item>
        <el-form-item label="栏目名称">
          <el-input v-model="channelForm.name" placeholder="例如 餐前准备" />
        </el-form-item>
        <el-form-item label="栏目说明">
          <el-input v-model="channelForm.description" type="textarea" :rows="3" placeholder="简要说明该栏目用途" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="channelForm.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="channelSaving" @click="submitChannel">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.content-filter {
  margin-bottom: 16px;
}
</style>
