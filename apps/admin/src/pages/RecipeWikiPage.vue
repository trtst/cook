<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { Download, Upload } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { recipeApi, type AdminRecipeWikiSummary } from "@/apis/recipe";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { formatDateTime } from "@/utils/date";

const loading = ref(false);
const saving = ref(false);
const rows = ref<AdminRecipeWikiSummary[]>([]);
const selected = ref<AdminRecipeWikiSummary[]>([]);
const total = ref(0);
const fileInput = ref<HTMLInputElement | null>(null);
const query = reactive({ page: 1, pageSize: 20, keyword: "" });

const statusText: Record<AdminRecipeWikiSummary["wikiStatus"], string> = {
  MISSING: "未创建",
  PENDING: "待处理",
  GENERATING: "生成中",
  NEEDS_REVIEW: "待补充",
  FAILED: "生成失败"
};

function getStatusText(value: string) {
  return statusText[value as AdminRecipeWikiSummary["wikiStatus"]] ?? value;
}

useAdminHeaderRefresh(() => loadPage());

async function loadPage() {
  loading.value = true;
  try {
    const result = await recipeApi.listWiki({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined
    });
    rows.value = result.items;
    total.value = result.total;
    selected.value = selected.value.filter(item => rows.value.some(row => row.id === item.id));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载 Wiki 补充列表失败");
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  void loadPage();
}

function openFilePicker() {
  fileInput.value?.click();
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  saving.value = true;
  try {
    const result = await recipeApi.importWiki(file, createOperationId());
    if (result.rejectedCount) {
      ElMessage.warning(`已导入 ${result.importedCount} 条，${result.rejectedCount} 条未写入`);
    } else {
      ElMessage.success(`已导入 ${result.importedCount} 条 Wiki`);
    }
    await loadPage();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导入 Wiki 失败");
  } finally {
    saving.value = false;
  }
}

function downloadJson(fileName: string, body: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportOne(row: AdminRecipeWikiSummary) {
  try {
    const document = await recipeApi.exportWiki(row.id);
    downloadJson(`${row.title}-${row.id}-wiki.json`, document);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "导出 Wiki 失败");
  }
}

async function exportSelected() {
  if (!selected.value.length) {
    ElMessage.warning("请先选择需要导出的菜谱");
    return;
  }
  try {
    const document = await recipeApi.exportWikiBatch(selected.value.map(row => row.id));
    downloadJson(`recipe-wiki-${new Date().toISOString().slice(0, 10)}.json`, document);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "批量导出 Wiki 失败");
  }
}

async function reject(row: AdminRecipeWikiSummary) {
  try {
    const { value } = await ElMessageBox.prompt("请输入拒绝原因", "拒绝 Wiki 生成", {
      inputValue: "菜谱内容不够完整，请重新编辑后再申请",
      confirmButtonText: "确认拒绝",
      cancelButtonText: "取消"
    });
    await recipeApi.rejectWiki(row.id, value.trim(), createOperationId());
    ElMessage.success("已拒绝 Wiki 申请");
    await loadPage();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "拒绝 Wiki 失败");
  }
}

function handleSelectionChange(value: AdminRecipeWikiSummary[]) {
  selected.value = value;
}

function ownerText(row: AdminRecipeWikiSummary) {
  if (row.sourceType === "PUBLIC_CONTENT_POOL") return "公共内容池";
  return row.ownerNickname ? `${row.ownerNickname}（UID ${row.ownerUid}）` : `UID ${row.ownerUid}`;
}

onMounted(() => void loadPage());
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <span class="page-toolbar__hint">只展示 ACTIVE 菜谱当前版本中尚未 READY 的 Wiki；保存新版本后会重新进入此列表。</span>
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="搜索菜谱名称" clearable @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">搜索</el-button>
      <el-button :icon="Download" :disabled="!selected.length" @click="exportSelected">批量导出</el-button>
      <el-button type="primary" :icon="Upload" :loading="saving" @click="openFilePicker">导入 Wiki</el-button>
      <input ref="fileInput" class="hidden-file-input" type="file" accept="application/json,.json" @change="importFile" />
    </div>

    <div v-loading="loading" class="table-panel">
      <el-table :data="rows" row-key="id" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="title" label="菜谱" min-width="180" />
        <el-table-column label="来源" min-width="180">
          <template #default="{ row }">
            <el-tag v-if="row.sourceType === 'PUBLIC_CONTENT_POOL'" type="warning">公共内容池</el-tag>
            <span v-else>{{ ownerText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Wiki 状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.hasPendingRequest ? 'danger' : 'info'">{{ getStatusText(row.wikiStatus) }}</el-tag>
            <span v-if="row.hasPendingRequest" class="request-mark">有申请</span>
          </template>
        </el-table-column>
        <el-table-column label="最近申请" min-width="190">
          <template #default="{ row }">
            <div>{{ row.latestRequestAt ? formatDateTime(row.latestRequestAt) : "暂无" }}</div>
            <small v-if="row.latestRequestUserUid">UID {{ row.latestRequestUserUid }}{{ row.latestRequestUserNickname ? ` · ${row.latestRequestUserNickname}` : "" }}</small>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Download" @click="exportOne(row)">导出</el-button>
            <el-button link type="danger" @click="reject(row)">拒绝</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无待补充 Wiki 的 ACTIVE 菜谱" /></template>
      </el-table>
      <div class="table-footer">
        <span>共 {{ total }} 条</span>
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadPage"
          @size-change="search"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hidden-file-input { display: none; }
.page-toolbar { flex-wrap: wrap; gap: 12px; }
.page-toolbar__hint { flex: 1 1 360px; color: #78716c; font-size: 13px; line-height: 1.5; }
.toolbar-search { width: 240px; }
.request-mark { display: block; margin-top: 4px; color: #b45309; font-size: 12px; }
.table-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 16px; }
</style>
