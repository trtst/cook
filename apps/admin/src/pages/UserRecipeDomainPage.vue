<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  userRecipeApi,
  type AdminRecipeDomainOverview,
  type AdminUserCollectionSummary,
  type AdminUserDraftRecipe,
  type AdminUserPublishedRecipe
} from "@/apis/user-recipe";

type RecipeDomainTab = "published" | "drafts" | "collections";

const route = useRoute();
const router = useRouter();

const activeTab = ref<RecipeDomainTab>(readTab(route.query.tab));

const overview = ref<AdminRecipeDomainOverview | null>(null);
const overviewLoading = ref(false);
const overviewError = ref("");

const published = ref<AdminUserPublishedRecipe[]>([]);
const publishedLoading = ref(false);
const publishedError = ref("");
const publishedTotal = ref(0);
const publishedPage = ref(1);
const publishedPageSize = ref(20);

const drafts = ref<AdminUserDraftRecipe[]>([]);
const draftsLoading = ref(false);
const draftsError = ref("");
const draftsTotal = ref(0);
const draftsPage = ref(1);
const draftsPageSize = ref(20);

const collections = ref<AdminUserCollectionSummary[]>([]);
const collectionsLoading = ref(false);
const collectionsError = ref("");

let overviewRequest = 0;
let publishedRequest = 0;
let draftsRequest = 0;
let collectionsRequest = 0;

const userId = computed(() => String(route.params.userId ?? ""));
const pageTitle = computed(() => {
  if (!overview.value) return "用户菜谱域";
  return overview.value.user.nickname ? `${overview.value.user.nickname} 的菜谱域` : `UID ${overview.value.user.uid} 的菜谱域`;
});

const publishedLabel = computed(() => buildTabLabel("已发布", overview.value?.publishedCount));
const draftsLabel = computed(() => buildTabLabel("草稿", overview.value?.draftCount));
const collectionsLabel = computed(() => buildTabLabel("合集", overview.value?.collectionCount));

function readTab(value: unknown): RecipeDomainTab {
  if (value === "drafts" || value === "collections") return value;
  return "published";
}

function buildTabLabel(label: string, count?: number) {
  return typeof count === "number" ? `${label}（${count}）` : label;
}

function formatMetric(value?: number | null) {
  return typeof value === "number" ? String(value) : "-";
}

function formatDate(value?: string | null) {
  return value || "-";
}

function formatCategory(category?: { name: string } | null) {
  return category?.name || "-";
}

function getUserId() {
  const value = userId.value.trim();
  if (!value) throw new Error("用户 ID 缺失");
  return value;
}

function resetLists() {
  published.value = [];
  publishedError.value = "";
  publishedTotal.value = 0;
  publishedPage.value = 1;
  publishedPageSize.value = 20;

  drafts.value = [];
  draftsError.value = "";
  draftsTotal.value = 0;
  draftsPage.value = 1;
  draftsPageSize.value = 20;

  collections.value = [];
  collectionsError.value = "";
}

async function loadOverview() {
  const current = ++overviewRequest;
  overviewLoading.value = true;
  overviewError.value = "";

  try {
    const result = await userRecipeApi.getOverview(getUserId());
    if (current !== overviewRequest) return;
    overview.value = result;
  } catch (error) {
    if (current !== overviewRequest) return;
    overview.value = null;
    overviewError.value = error instanceof Error ? error.message : "用户菜谱域概览加载失败";
  } finally {
    if (current === overviewRequest) {
      overviewLoading.value = false;
    }
  }
}

async function loadPublished() {
  const current = ++publishedRequest;
  publishedLoading.value = true;
  publishedError.value = "";

  try {
    const result = await userRecipeApi.listPublished(getUserId(), {
      page: publishedPage.value,
      pageSize: publishedPageSize.value
    });
    if (current !== publishedRequest) return;
    published.value = result.items;
    publishedTotal.value = result.total;
  } catch (error) {
    if (current !== publishedRequest) return;
    published.value = [];
    publishedTotal.value = 0;
    publishedError.value = error instanceof Error ? error.message : "已发布列表加载失败";
    ElMessage.error(publishedError.value);
  } finally {
    if (current === publishedRequest) {
      publishedLoading.value = false;
    }
  }
}

async function loadDrafts() {
  const current = ++draftsRequest;
  draftsLoading.value = true;
  draftsError.value = "";

  try {
    const result = await userRecipeApi.listDrafts(getUserId(), {
      page: draftsPage.value,
      pageSize: draftsPageSize.value
    });
    if (current !== draftsRequest) return;
    drafts.value = result.items;
    draftsTotal.value = result.total;
  } catch (error) {
    if (current !== draftsRequest) return;
    drafts.value = [];
    draftsTotal.value = 0;
    draftsError.value = error instanceof Error ? error.message : "草稿列表加载失败";
    ElMessage.error(draftsError.value);
  } finally {
    if (current === draftsRequest) {
      draftsLoading.value = false;
    }
  }
}

async function loadCollections() {
  const current = ++collectionsRequest;
  collectionsLoading.value = true;
  collectionsError.value = "";

  try {
    const result = await userRecipeApi.listCollections(getUserId());
    if (current !== collectionsRequest) return;
    collections.value = result.items;
  } catch (error) {
    if (current !== collectionsRequest) return;
    collections.value = [];
    collectionsError.value = error instanceof Error ? error.message : "合集列表加载失败";
    ElMessage.error(collectionsError.value);
  } finally {
    if (current === collectionsRequest) {
      collectionsLoading.value = false;
    }
  }
}

function loadCurrentTab() {
  if (activeTab.value === "drafts") return loadDrafts();
  if (activeTab.value === "collections") return loadCollections();
  return loadPublished();
}

function resetTabPage(tab: RecipeDomainTab) {
  if (tab === "published") {
    publishedPage.value = 1;
    return;
  }

  if (tab === "drafts") {
    draftsPage.value = 1;
  }
}

function changeTab(name: string | number) {
  const next = readTab(name);
  resetTabPage(next);

  void router.replace({
    query: {
      ...route.query,
      tab: next === "published" ? undefined : next
    }
  });
}

function refreshCurrent() {
  void Promise.all([loadOverview(), loadCurrentTab()]);
}

function backToUsers() {
  void router.push("/users");
}

function openCollection(row: AdminUserCollectionSummary) {
  void router.push({
    name: "user-collection-detail",
    params: {
      userId: getUserId(),
      collectionId: row.id
    }
  });
}

watch(
  () => route.query.tab,
  value => {
    const next = readTab(value);
    if (next === activeTab.value) return;
    activeTab.value = next;
    resetTabPage(next);
    void loadCurrentTab();
  }
);

watch(
  () => route.params.userId,
  () => {
    overview.value = null;
    overviewError.value = "";
    activeTab.value = readTab(route.query.tab);
    resetLists();
    void loadOverview();
    void loadCurrentTab();
  }
);

onMounted(() => {
  resetLists();
  void loadOverview();
  void loadCurrentTab();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-button :icon="ArrowLeft" @click="backToUsers">返回用户列表</el-button>
      <div class="page-title-block">
        <strong>{{ pageTitle }}</strong>
        <span class="page-subtitle">
          用户 ID {{ overview?.user.id || userId }}<template v-if="overview?.user.uid"> · UID {{ overview.user.uid }}</template>
        </span>
      </div>
      <div class="toolbar-spacer" />
      <el-button :icon="Refresh" @click="refreshCurrent">刷新</el-button>
    </div>

    <div class="table-panel">
      <el-skeleton v-if="overviewLoading && !overview" :rows="6" animated />

      <el-result v-else-if="overviewError && !overview" icon="error" title="用户菜谱域加载失败" :sub-title="overviewError" />

      <template v-else-if="overview">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="用户 ID">{{ overview.user.id }}</el-descriptions-item>
          <el-descriptions-item label="UID">{{ overview.user.uid }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ overview.user.nickname || "-" }}</el-descriptions-item>
          <el-descriptions-item label="合集场景">{{ formatMetric(overview.sceneCount) }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </div>

    <div v-if="overview" class="summary-grid">
      <div class="metric-panel">
        <span class="metric-label">已发布菜谱</span>
        <strong>{{ formatMetric(overview.publishedCount) }}</strong>
        <span class="metric-label">最近更新时间 {{ formatDate(overview.latestPublishedAt) }}</span>
      </div>
      <div class="metric-panel">
        <span class="metric-label">草稿数量</span>
        <strong>{{ formatMetric(overview.draftCount) }}</strong>
        <span class="metric-label">最近更新时间 {{ formatDate(overview.latestDraftAt) }}</span>
      </div>
      <div class="metric-panel">
        <span class="metric-label">收藏条数</span>
        <strong>{{ formatMetric(overview.collectionCount) }}</strong>
        <span class="metric-label">最近更新时间 {{ formatDate(overview.latestCollectionAt) }}</span>
      </div>
    </div>

    <div class="table-panel">
      <el-tabs :model-value="activeTab" @tab-change="changeTab">
        <el-tab-pane :label="publishedLabel" name="published">
          <el-alert
            v-if="publishedError"
            type="error"
            :closable="false"
            :title="publishedError"
            style="margin-bottom: 16px"
          />
          <el-table v-loading="publishedLoading" :data="published" row-key="id" empty-text="暂无已发布菜谱">
            <el-table-column prop="title" label="菜名" min-width="180" />
            <el-table-column label="分类" min-width="140">
              <template #default="{ row }">
                {{ formatCategory(row.category) }}
              </template>
            </el-table-column>
            <el-table-column prop="version" label="版本" width="100" />
            <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
          </el-table>

          <div class="pagination-row">
            <el-pagination
              v-model:current-page="publishedPage"
              v-model:page-size="publishedPageSize"
              background
              layout="total, sizes, prev, pager, next"
              :total="publishedTotal"
              :page-sizes="[20, 50, 100]"
              @current-change="loadPublished"
              @size-change="loadPublished"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="draftsLabel" name="drafts" lazy>
          <el-alert
            v-if="draftsError"
            type="error"
            :closable="false"
            :title="draftsError"
            style="margin-bottom: 16px"
          />
          <el-table v-loading="draftsLoading" :data="drafts" row-key="id" empty-text="暂无草稿">
            <el-table-column label="草稿标题" min-width="180">
              <template #default="{ row }">
                {{ row.title || "未命名草稿" }}
              </template>
            </el-table-column>
            <el-table-column prop="recipeId" label="关联菜谱 ID" min-width="260">
              <template #default="{ row }">
                {{ row.recipeId || "-" }}
              </template>
            </el-table-column>
            <el-table-column label="分类" min-width="140">
              <template #default="{ row }">
                {{ formatCategory(row.category) }}
              </template>
            </el-table-column>
            <el-table-column prop="version" label="版本" width="100" />
            <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
          </el-table>

          <div class="pagination-row">
            <el-pagination
              v-model:current-page="draftsPage"
              v-model:page-size="draftsPageSize"
              background
              layout="total, sizes, prev, pager, next"
              :total="draftsTotal"
              :page-sizes="[20, 50, 100]"
              @current-change="loadDrafts"
              @size-change="loadDrafts"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="collectionsLabel" name="collections" lazy>
          <el-alert
            v-if="collectionsError"
            type="error"
            :closable="false"
            :title="collectionsError"
            style="margin-bottom: 16px"
          />
          <el-table v-loading="collectionsLoading" :data="collections" row-key="id" empty-text="暂无合集">
            <el-table-column prop="name" label="合集名称" min-width="180" />
            <el-table-column prop="recipeCount" label="内容数量" width="120" />
            <el-table-column prop="version" label="版本" width="100" />
            <el-table-column label="更新时间" min-width="180">
              <template #default="{ row }">
                {{ row.updatedAt || "-" }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openCollection(row)">查看内容</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </section>
</template>
