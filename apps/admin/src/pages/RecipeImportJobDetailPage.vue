<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { recipeApi, type RecipeImportItemSummary, type RecipeImportJobDetail } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { formatDateTime } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const batchPublishing = ref(false);
const batchPublishProgress = ref({ finished: 0, total: 0 });
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
const isViewingJob = (targetJobId: UUID) => jobId.value === targetJobId;

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

async function removeJob() {
  if (!detail.value || !jobId.value) return;
  try {
    await ElMessageBox.confirm(
      `确认删除导入任务“${detail.value.sourceName}”？只删除导入记录，不删除已发布菜谱。`,
      "删除导入任务",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消"
      }
    );
    await recipeApi.deleteImportJob(jobId.value, createOperationId());
    ElMessage.success("导入任务已删除");
    await router.push("/recipes/imports");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除导入任务失败");
  }
}

async function publishAllReady() {
  const currentJobId = jobId.value;
  if (!detail.value || !currentJobId || batchPublishing.value || detail.value.readyCount < 1) return;
  batchPublishing.value = true;
  try {
    await ElMessageBox.confirm(
      `将发布此任务中全部 ${detail.value.readyCount} 条可发布菜谱，逐条处理并汇总结果。`,
      "一键发布可发布菜谱",
      { type: "warning", confirmButtonText: "开始发布", cancelButtonText: "取消" }
    );
  } catch (error) {
    batchPublishing.value = false;
    if (error !== "cancel" && error !== "close") {
      ElMessage.error(error instanceof Error ? error.message : "确认批量发布失败");
    }
    return;
  }

  batchPublishProgress.value = { finished: 0, total: 0 };
  try {
    if (!isViewingJob(currentJobId)) return;
    const readyItems: RecipeImportItemSummary[] = [];
    let page = 1;
    let hasNext = true;
    while (hasNext) {
      const result = await recipeApi.getImportJobDetail(currentJobId, { page, pageSize: 100, status: "READY" });
      readyItems.push(...result.items.items);
      hasNext = result.items.hasNext;
      page += 1;
    }

    if (readyItems.length === 0) {
      if (isViewingJob(currentJobId)) {
        query.page = 1;
        await loadDetail();
        ElMessage.info("该任务已无可发布条目");
      }
      return;
    }

    batchPublishProgress.value = { finished: 0, total: readyItems.length };
    const failures: string[] = [];
    let successCount = 0;
    for (const item of readyItems) {
      try {
        await recipeApi.publishImportItem(item.id, {
          operationId: createOperationId(),
          expectedVersion: item.version
        });
        successCount += 1;
      } catch (error) {
        failures.push(`${item.title || item.sourcePath}：${error instanceof Error ? error.message : "发布失败"}`);
      } finally {
        batchPublishProgress.value = {
          ...batchPublishProgress.value,
          finished: batchPublishProgress.value.finished + 1
        };
      }
    }

    if (!isViewingJob(currentJobId)) return;
    query.page = 1;
    await loadDetail();
    if (!isViewingJob(currentJobId)) return;
    const summary = `一键发布完成：成功 ${successCount} 条，失败 ${failures.length} 条。`;
    if (failures.length) {
      await ElMessageBox.alert(`${summary}\n\n失败项：\n${failures.join("\n")}`, "批量发布结果", {
        type: successCount ? "warning" : "error",
        confirmButtonText: "知道了"
      });
    } else {
      ElMessage.success(summary);
    }
  } catch (error) {
    if (isViewingJob(currentJobId)) {
      ElMessage.error(error instanceof Error ? `批量发布中断：${error.message}` : "批量发布中断，请刷新任务后重试");
      query.page = 1;
      await loadDetail();
    }
  } finally {
    batchPublishing.value = false;
    batchPublishProgress.value = { finished: 0, total: 0 };
  }
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
      <el-button
        v-if="detail && detail.readyCount > 0"
        type="primary"
        :loading="batchPublishing"
        :disabled="batchPublishing"
        @click="publishAllReady"
      >
        {{ batchPublishing && batchPublishProgress.total ? `发布中 ${batchPublishProgress.finished}/${batchPublishProgress.total}` : `一键发布可发布项（${detail.readyCount}）` }}
      </el-button>
      <el-button v-if="detail && detail.status !== 'RUNNING'" text type="danger" :disabled="batchPublishing" @click="removeJob">删除任务</el-button>
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
        <strong>{{ formatDateTime(detail.updatedAt) }}</strong>
        <span class="table-hint">创建于 {{ formatDateTime(detail.createdAt) }}</span>
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
        <el-table-column label="更新时间" width="200">
          <template #default="{ row }">
            {{ formatDateTime(row.updatedAt) }}
          </template>
        </el-table-column>
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
