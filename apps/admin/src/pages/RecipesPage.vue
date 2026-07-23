<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Refresh, Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { recipeApi, type AdminRecipeSummary, type RecipeReportSummary } from "@/apis/recipe";

const loading = ref(false);
const reportLoading = ref(false);
const recipes = ref<AdminRecipeSummary[]>([]);
const reports = ref<RecipeReportSummary[]>([]);
const total = ref(0);
const reportTotal = ref(0);
const blockReason = ref("违规或不适合继续曝光");
let requestId = 0;
let reportRequestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: "" as "" | "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED",
  reportsOnly: false
});

const reportQuery = reactive({
  page: 1,
  pageSize: 20,
  status: "" as "" | "OPEN" | "RESOLVED"
});

async function loadRecipes() {
  const current = ++requestId;
  loading.value = true;
  try {
    const result = await recipeApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      reportsOnly: query.reportsOnly || undefined
    });
    if (current !== requestId) return;
    recipes.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (current !== requestId) return;
    ElMessage.error(error instanceof Error ? error.message : "加载菜谱失败");
  } finally {
    if (current === requestId) loading.value = false;
  }
}

async function loadReports() {
  const current = ++reportRequestId;
  reportLoading.value = true;
  try {
    const result = await recipeApi.listReports({
      page: reportQuery.page,
      pageSize: reportQuery.pageSize,
      status: reportQuery.status || undefined
    });
    if (current !== reportRequestId) return;
    reports.value = result.items;
    reportTotal.value = result.total;
  } catch (error) {
    if (current !== reportRequestId) return;
    ElMessage.error(error instanceof Error ? error.message : "加载举报失败");
  } finally {
    if (current === reportRequestId) reportLoading.value = false;
  }
}

function search() {
  query.page = 1;
  void loadRecipes();
}

function searchReports() {
  reportQuery.page = 1;
  void loadReports();
}

async function blockRecipe(recipeId: string) {
  try {
    await recipeApi.block(recipeId, crypto.randomUUID(), blockReason.value.trim() || "后台下架");
    ElMessage.success("已下架");
    await Promise.all([loadRecipes(), loadReports()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "下架失败");
  }
}

async function unblockRecipe(recipeId: string) {
  try {
    await recipeApi.unblock(recipeId, crypto.randomUUID());
    ElMessage.success("已恢复");
    await loadRecipes();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "恢复失败");
  }
}

async function resolveReport(reportId: string) {
  try {
    await recipeApi.resolveReport(reportId, crypto.randomUUID(), "已核查");
    ElMessage.success("已处理举报");
    await Promise.all([loadRecipes(), loadReports()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "处理失败");
  }
}

onMounted(() => {
  void Promise.all([loadRecipes(), loadReports()]);
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="菜名 / 食材" clearable @keyup.enter="search" />
      <el-select v-model="query.status" class="toolbar-select" placeholder="状态" clearable>
        <el-option label="ACTIVE" value="ACTIVE" />
        <el-option label="RECYCLED" value="RECYCLED" />
        <el-option label="BLOCKED" value="BLOCKED" />
        <el-option label="DELETED" value="DELETED" />
      </el-select>
      <el-checkbox v-model="query.reportsOnly">只看有举报</el-checkbox>
      <el-input v-model="blockReason" class="toolbar-search" placeholder="下架原因" />
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button :icon="Refresh" @click="loadRecipes">刷新</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="recipes" row-key="id">
        <el-table-column prop="title" label="菜名" min-width="180" />
        <el-table-column prop="ownerUid" label="持有人 UID" width="120" />
        <el-table-column prop="ownerType" label="来源" width="100" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="reportCount" label="举报数" width="100" />
        <el-table-column prop="blockedReason" label="下架原因" min-width="180" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="blockRecipe(row.id)">下架</el-button>
            <el-button v-else-if="row.status === 'BLOCKED'" link type="primary" @click="unblockRecipe(row.id)">恢复</el-button>
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
          @current-change="loadRecipes"
          @size-change="search"
        />
      </div>
    </div>

    <div class="toolbar-panel">
      <el-select v-model="reportQuery.status" class="toolbar-select" placeholder="举报状态" clearable>
        <el-option label="OPEN" value="OPEN" />
        <el-option label="RESOLVED" value="RESOLVED" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="searchReports">查询举报</el-button>
      <el-button :icon="Refresh" @click="loadReports">刷新举报</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="reportLoading" :data="reports" row-key="id">
        <el-table-column prop="recipeId" label="菜谱 ID" min-width="260" />
        <el-table-column prop="reporterUid" label="举报人 UID" width="120" />
        <el-table-column prop="reason" label="原因" min-width="220" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="createdAt" label="举报时间" min-width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'OPEN'" link type="primary" @click="resolveReport(row.id)">处理</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="reportQuery.page"
          v-model:page-size="reportQuery.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="reportTotal"
          :page-sizes="[20, 50, 100]"
          @current-change="loadReports"
          @size-change="searchReports"
        />
      </div>
    </div>
  </section>
</template>
