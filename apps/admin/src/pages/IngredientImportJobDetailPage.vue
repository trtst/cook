<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ArrowLeft } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { ingredientApi, type IngredientImportItemSummary, type IngredientImportJobDetail } from "@/apis/ingredient";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { formatDateTime } from "@/utils/date";
import { formatStatusText } from "@/utils/status";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const actionItemId = ref<UUID | null>(null);
const detail = ref<IngredientImportJobDetail | null>(null);
const detailRequestId = ref(0);
const query = reactive({ page: 1, pageSize: 20, status: "" as "" | IngredientImportItemSummary["status"] });
const jobId = computed<UUID | null>(() => {
  const value = Number(Array.isArray(route.params.jobId) ? route.params.jobId[0] : route.params.jobId);
  return Number.isInteger(value) && value > 0 ? value : null;
});

useAdminHeaderRefresh(() => {
  void loadDetail();
});

async function loadDetail() {
  const requestId = ++detailRequestId.value;
  if (!jobId.value) {
    ElMessage.error("导入任务 ID 缺失");
    return;
  }
  loading.value = true;
  try {
    const result = await ingredientApi.getImportJobDetail(jobId.value, { page: query.page, pageSize: query.pageSize, status: query.status || undefined });
    if (requestId === detailRequestId.value) detail.value = result;
  } catch (error) {
    if (requestId === detailRequestId.value) {
      detail.value = null;
      ElMessage.error(error instanceof Error ? error.message : "加载食材导入任务失败");
    }
  } finally {
    if (requestId === detailRequestId.value) loading.value = false;
  }
}

function openItem(itemId: UUID) {
  void router.push(`/ingredients/import-items/${itemId}`);
}

function goBack() {
  void router.push("/ingredients/imports");
}

async function quickImport(item: IngredientImportItemSummary) {
  if (item.status !== "READY" || item.errorCount > 0) return;
  actionItemId.value = item.id;
  try {
    await ingredientApi.importItem(item.id, { operationId: createOperationId(), expectedVersion: item.version });
    ElMessage.success(`“${item.title}”已审核并导入`);
    await loadDetail();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "快捷导入失败");
  } finally {
    actionItemId.value = null;
  }
}

async function removeItem(item: IngredientImportItemSummary) {
  const importedCreatedPending = item.status === "IMPORTED" && item.matchType === "CREATED_PENDING";
  try {
    await ElMessageBox.confirm(
      importedCreatedPending
        ? `确认删除“${item.title}”？这会删除本条导入记录及由它创建、且仍未审核的待审核食材。`
        : item.status === "IMPORTED"
          ? `确认删除“${item.title}”的导入记录？已有系统食材不会被删除。`
          : `确认删除“${item.title}”的导入记录？`,
      "删除导入条目",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
    actionItemId.value = item.id;
    const result = await ingredientApi.deleteImportItem(item.id, { operationId: createOperationId(), expectedVersion: item.version });
    ElMessage.success(result.deletedIngredientId ? "导入条目和待审核食材已删除" : "导入条目已删除");
    if ((detail.value?.items.items.length ?? 0) === 1 && query.page > 1) query.page -= 1;
    await loadDetail();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除导入条目失败");
  } finally {
    actionItemId.value = null;
  }
}

async function removeJob() {
  if (!jobId.value || !detail.value) return;
  try {
    await ElMessageBox.confirm(`确认删除导入任务“${detail.value.sourceName}”？只删除导入记录，不删除已入库食材。`, "删除导入任务", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
    await ingredientApi.deleteImportJob(jobId.value, createOperationId());
    ElMessage.success("导入任务已删除");
    await router.push("/ingredients/imports");
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除导入任务失败");
  }
}

function handleStatusChange() {
  query.page = 1;
  void loadDetail();
}

watch(() => route.params.jobId, () => {
  query.page = 1;
  detail.value = null;
  void loadDetail();
});

onMounted(() => {
  void loadDetail();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-button text :icon="ArrowLeft" @click="goBack">返回食材导入</el-button>
      <el-button v-if="detail && detail.status !== 'RUNNING'" text type="danger" @click="removeJob">删除任务</el-button>
      <div class="toolbar-spacer" />
      <el-select v-model="query.status" class="toolbar-select" placeholder="全部条目状态" @change="handleStatusChange">
        <el-option label="全部条目" value="" />
        <el-option label="待修正" value="NEEDS_FIX" />
        <el-option label="待导入" value="READY" />
        <el-option label="已导入" value="IMPORTED" />
        <el-option label="失败" value="FAILED" />
      </el-select>
    </div>

    <div v-if="detail" class="summary-grid">
      <div class="metric-panel"><span class="metric-label">任务状态</span><strong>{{ formatStatusText(detail.status) }}</strong><span class="table-hint">{{ detail.sourceName }}</span></div>
      <div class="metric-panel"><span class="metric-label">条目统计</span><strong>{{ detail.totalCount }}</strong><span class="table-hint">待导入 {{ detail.readyCount }} / 已导入 {{ detail.importedCount }} / 待修正 {{ detail.needsFixCount }}</span></div>
      <div class="metric-panel"><span class="metric-label">最近更新时间</span><strong>{{ formatDateTime(detail.updatedAt) }}</strong><span class="table-hint">创建于 {{ formatDateTime(detail.createdAt) }}</span></div>
    </div>

    <div v-loading="loading" class="table-panel">
      <el-table :data="detail?.items.items ?? []">
        <el-table-column prop="title" label="食材名称" min-width="150" />
        <el-table-column label="分类" min-width="140">
          <template #default="{ row }">{{ row.categoryName || row.categoryCode || "待补充" }}</template>
        </el-table-column>
        <el-table-column label="默认单位" width="110">
          <template #default="{ row }">{{ row.defaultUnitName || "待补充" }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }"><el-tag :type="row.status === 'IMPORTED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'">{{ formatStatusText(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="ingredientId" label="食材 ID" width="100" />
        <el-table-column prop="matchType" label="匹配方式" width="120" />
        <el-table-column prop="errorCount" label="错误" width="70" />
        <el-table-column prop="warnCount" label="提醒" width="70" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'READY' && row.errorCount === 0" text type="success" :loading="actionItemId === row.id" @click="quickImport(row)">快捷审核</el-button>
            <el-button v-if="row.status !== 'IMPORTED'" text type="primary" :disabled="actionItemId === row.id" @click="openItem(row.id)">审核 / 修正</el-button>
            <el-button v-else text type="primary" :disabled="actionItemId === row.id" @click="openItem(row.id)">查看</el-button>
            <el-button text type="danger" :loading="actionItemId === row.id" @click="removeItem(row)">快捷删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination background layout="total, prev, pager, next" :total="detail?.items.total ?? 0" :current-page="query.page" :page-size="query.pageSize" @current-change="(value: number) => { query.page = value; loadDetail(); }" />
      </div>
    </div>
  </section>
</template>
