<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { recipeApi, type RecipeImportItemSummary, type RecipeImportJobDetail } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { formatStatusText } from "@/utils/status";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detail = ref<RecipeImportJobDetail | null>(null);
let detailRequestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  status: "" as "" | RecipeImportItemSummary["status"]
});
useAdminHeaderRefresh(() => {
  void loadDetail();
});

function parseRouteId(value: unknown) {
  const next = typeof value === "string" ? Number(value) : Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(next) && next > 0 ? next : null;
}

const jobId = computed<UUID | null>(() => parseRouteId(route.params.jobId));

async function loadDetail() {
  const currentRequestId = ++detailRequestId;
  if (!jobId.value) {
    detail.value = null;
    ElMessage.error("导入任务 ID 缺失");
    return;
  }
  loading.value = true;
  try {
    const nextDetail = await recipeApi.getImportJobDetail(jobId.value, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status || undefined
    });
    if (currentRequestId !== detailRequestId) return;
    detail.value = nextDetail;
  } catch (error) {
    if (currentRequestId !== detailRequestId) return;
    detail.value = null;
    ElMessage.error(error instanceof Error ? error.message : "加载导入任务详情失败");
  } finally {
    if (currentRequestId !== detailRequestId) return;
    loading.value = false;
  }
}

function handleStatusChange() {
  query.page = 1;
  void loadDetail();
}

function goBack() {
  void router.push("/recipes/imports");
}

function openItem(itemId: UUID) {
  void router.push(`/recipes/import-items/${itemId}`);
}

function openRecipe(recipeId: UUID) {
  void router.push(`/recipes/${recipeId}`);
}

watch(
  () => route.params.jobId,
  () => {
    query.page = 1;
    detail.value = null;
    void loadDetail();
  }
);

onMounted(() => {
  void loadDetail();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-button text :icon="ArrowLeft" @click="goBack">返回导入中心</el-button>
      <div class="toolbar-spacer" />
      <el-select v-model="query.status" class="toolbar-select" placeholder="全部条目状态" @change="handleStatusChange">
        <el-option label="全部条目" value="" />
        <el-option label="待补全" value="NEEDS_FIX" />
        <el-option label="可发布" value="READY" />
        <el-option label="已发布" value="PUBLISHED" />
        <el-option label="失败" value="FAILED" />
      </el-select>
    </div>

    <div v-if="detail" class="summary-grid">
      <div class="metric-panel">
        <span class="metric-label">任务状态</span>
        <strong>{{ formatStatusText(detail.status) }}</strong>
        <span class="table-hint">{{ detail.sourceName }}</span>
      </div>
      <div class="metric-panel">
        <span class="metric-label">条目统计</span>
        <strong>{{ detail.totalCount }}</strong>
        <span class="table-hint">可发布 {{ detail.readyCount }} / 待补全 {{ detail.needsFixCount }} / 失败 {{ detail.failedCount }}</span>
      </div>
      <div class="metric-panel">
        <span class="metric-label">最近更新时间</span>
        <strong>{{ detail.updatedAt }}</strong>
        <span class="table-hint">创建于 {{ detail.createdAt }}</span>
      </div>
    </div>

    <div v-loading="loading" class="table-panel">
      <el-table :data="detail?.items.items ?? []">
        <el-table-column prop="sourcePath" label="原文件路径" min-width="260" />
        <el-table-column prop="title" label="识别标题" min-width="180" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PUBLISHED' ? 'success' : row.status === 'FAILED' ? 'danger' : row.status === 'READY' ? 'success' : 'warning'">
              {{ formatStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="errorCount" label="错误" width="80" />
        <el-table-column prop="warnCount" label="提醒" width="80" />
        <el-table-column prop="updatedAt" label="更新时间" width="200" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openItem(row.id)">查看 / 修正</el-button>
            <el-button v-if="row.recipeId" text @click="openRecipe(row.recipeId)">正式菜谱</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="detail?.items.total ?? 0"
          :current-page="query.page"
          :page-size="query.pageSize"
          @current-change="(value: number) => { query.page = value; loadDetail(); }"
        />
      </div>
    </div>
  </section>
</template>
