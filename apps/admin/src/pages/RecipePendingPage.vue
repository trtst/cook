<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  recipeApi,
  type AdminInspirationCategorySummary,
  type AdminPendingRecipeSummary
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

type ReviewAction = "APPROVE" | "REJECT";

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const categories = ref<AdminInspirationCategorySummary[]>([]);
const pendingItems = ref<AdminPendingRecipeSummary[]>([]);
const currentRow = ref<AdminPendingRecipeSummary | null>(null);
const total = ref(0);
let requestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: ""
});

const form = reactive({
  action: "APPROVE" as ReviewAction,
  inspirationCategoryId: "" as UUID | "",
  reason: ""
});

const needApproveCategory = computed(() => form.action === "APPROVE");
const currentSuggestedCategory = computed(() => {
  if (!currentRow.value) return null;
  return categories.value.find(item => item.id === currentRow.value?.suggestedCategory.id) ?? null;
});

function resetForm() {
  form.action = "APPROVE";
  form.inspirationCategoryId = "";
  form.reason = "";
  currentRow.value = null;
}

async function loadCategories() {
  categories.value = await recipeApi.listInspirationCategories();
}

async function loadPendingItems() {
  const current = ++requestId;
  loading.value = true;
  try {
    const result = await recipeApi.listPending({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined
    });
    if (current !== requestId) return;
    pendingItems.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (current !== requestId) return;
    ElMessage.error(error instanceof Error ? error.message : "加载待审核个人菜谱失败");
  } finally {
    if (current === requestId) {
      loading.value = false;
    }
  }
}

async function loadPage() {
  try {
    await Promise.all([loadCategories(), loadPendingItems()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载待审核个人菜谱失败");
  }
}

function openDetail(recipeId: UUID) {
  void router.push(`/recipes/${recipeId}`);
}

function openReview(row: AdminPendingRecipeSummary) {
  currentRow.value = row;
  form.action = "APPROVE";
  form.inspirationCategoryId =
    categories.value.find(item => item.id === row.suggestedCategory.id)?.id || categories.value[0]?.id || "";
  form.reason = "";
  dialogVisible.value = true;
}

function buildPayload() {
  if (!currentRow.value) return null;
  if (form.action === "APPROVE" && !form.inspirationCategoryId) {
    ElMessage.error("请选择系统菜谱分类");
    return null;
  }

  return {
    operationId: createOperationId(),
    action: form.action,
    expectedVersion: currentRow.value.version,
    inspirationCategoryId: form.action === "APPROVE" ? form.inspirationCategoryId || undefined : undefined,
    reason: form.reason.trim() || undefined
  };
}

async function submitReview() {
  if (!currentRow.value) return;
  const payload = buildPayload();
  if (!payload) return;

  saving.value = true;
  try {
    const result = await recipeApi.reviewPending(currentRow.value.id, payload);
    ElMessage.success(form.action === "APPROVE" ? "已收录到系统菜谱" : "已拒绝该推荐");
    dialogVisible.value = false;
    resetForm();
    if (result.status === "APPROVED" && result.targetRecipeId) {
      void router.push(`/recipes/${result.targetRecipeId}`);
    }
    if (pendingItems.value.length === 1 && query.page > 1) {
      query.page -= 1;
    }
    await loadPendingItems();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "提交审核失败");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <div class="page-title-block">
        <strong>待审核个人菜谱</strong>
        <div class="page-subtitle">审核用户推荐到系统菜谱的个人菜谱；本期只做通过/拒绝，并在通过时选择归入的系统分类。</div>
      </div>
      <div class="toolbar-spacer" />
      <el-input
        v-model="query.keyword"
        class="toolbar-search"
        placeholder="菜名 / 用户昵称 / UID / 分类"
        clearable
        @clear="
          query.page = 1;
          loadPendingItems();
        "
        @keyup.enter="
          query.page = 1;
          loadPendingItems();
        "
      />
      <el-button :icon="Refresh" @click="loadPage">刷新</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="pendingItems" row-key="id">
        <el-table-column prop="recipeTitle" label="推荐菜谱" min-width="220" />
        <el-table-column label="推荐用户" min-width="180">
          <template #default="{ row }">
            <div>{{ row.user.nickname || "未填写昵称" }}</div>
            <div class="table-subtext">UID {{ row.user.uid }}</div>
          </template>
        </el-table-column>
        <el-table-column label="个人分类" min-width="140">
          <template #default="{ row }">{{ row.personalCategory?.name || "-" }}</template>
        </el-table-column>
        <el-table-column label="建议系统分类" min-width="160">
          <template #default="{ row }">{{ row.suggestedCategory.name }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="推荐时间" min-width="180" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag type="warning">{{ formatStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.recipeId)">查看详情</el-button>
            <el-button link type="primary" @click="openReview(row)">审核</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-hint">这里只展示审核中的推荐；通过后会复制固定版本到系统菜谱，个人菜谱仍留在“我的”下。</div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadPendingItems"
          @size-change="
            query.page = 1;
            loadPendingItems();
          "
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="审核个人菜谱推荐" width="560px" @closed="resetForm">
      <el-form label-position="top">
        <el-form-item label="审核结果">
          <el-radio-group v-model="form.action">
            <el-radio value="APPROVE">通过并收录到系统菜谱</el-radio>
            <el-radio value="REJECT">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-alert
          v-if="currentRow"
          :title="`推荐菜谱：${currentRow.recipeTitle}`"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            <div>推荐人：{{ currentRow.user.nickname || "未填写昵称" }}（UID {{ currentRow.user.uid }}）</div>
            <div>建议系统分类：{{ currentRow.suggestedCategory.name }}</div>
            <div>个人分类：{{ currentRow.personalCategory?.name || "未分类" }}</div>
          </template>
        </el-alert>

        <el-form-item v-if="needApproveCategory" label="系统菜谱分类" class="dialog-field">
          <el-select v-model="form.inspirationCategoryId" placeholder="请选择系统菜谱分类">
            <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
          <div v-if="currentSuggestedCategory" class="field-hint">默认带入用户建议分类，可在这里改成最终系统分类。</div>
        </el-form-item>

        <el-form-item :label="form.action === 'APPROVE' ? '审核备注' : '拒绝原因（可选）'" class="dialog-field">
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            :placeholder="form.action === 'APPROVE' ? '可填写收录备注' : '可填写拒绝原因，前台会展示给用户'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitReview">提交审核</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.table-subtext {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dialog-field {
  margin-top: 16px;
}

.field-hint {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
