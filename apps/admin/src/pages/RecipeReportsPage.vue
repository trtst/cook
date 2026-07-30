<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Refresh, Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { recipeApi, type RecipeReportSummary } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

const router = useRouter();
const loading = ref(false);
const reports = ref<RecipeReportSummary[]>([]);
const total = ref(0);
let requestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  status: "" as "" | "OPEN" | "RESOLVED"
});

async function loadReports() {
  const current = ++requestId;
  loading.value = true;
  try {
    const result = await recipeApi.listReports({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status || undefined
    });
    if (current !== requestId) return;
    reports.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (current !== requestId) return;
    ElMessage.error(error instanceof Error ? error.message : "加载举报失败");
  } finally {
    if (current === requestId) loading.value = false;
  }
}

function search() {
  query.page = 1;
  void loadReports();
}

async function resolveReport(reportId: UUID) {
  try {
    await recipeApi.resolveReport(reportId, createOperationId(), "已核查");
    ElMessage.success("已处理举报");
    await loadReports();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "处理失败");
  }
}

onMounted(() => {
  void loadReports();
});

function openDetail(recipeId: UUID) {
  void router.push(`/recipes/${recipeId}`);
}
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel">
      <el-select v-model="query.status" class="toolbar-select" placeholder="举报状态" clearable>
        <el-option :label="formatStatusText('OPEN')" value="OPEN" />
        <el-option :label="formatStatusText('RESOLVED')" value="RESOLVED" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="search">查询举报</el-button>
      <el-button :icon="Refresh" @click="loadReports">刷新举报</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="reports" row-key="id">
        <el-table-column prop="recipeId" label="菜谱 ID" min-width="260" />
        <el-table-column prop="reporterUid" label="举报人 UID" width="120" />
        <el-table-column prop="reason" label="原因" min-width="220" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            {{ formatStatusText(row.status) }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="举报时间" min-width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.recipeId)">查看菜谱</el-button>
            <el-button v-if="row.status === 'OPEN'" link type="primary" @click="resolveReport(row.id)">处理</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadReports"
          @size-change="search"
        />
      </div>
    </div>
  </section>
</template>
