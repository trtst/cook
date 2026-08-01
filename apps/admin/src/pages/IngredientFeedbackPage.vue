<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  ingredientApi,
  type AdminIngredientCategorySummary,
  type AdminPendingIngredientFeedbackSummary
} from "@/apis/ingredient";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";
import { formatStatusText } from "@/utils/status";

type ReviewAction = "APPROVE" | "REJECT";

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const categories = ref<AdminIngredientCategorySummary[]>([]);
const feedbacks = ref<AdminPendingIngredientFeedbackSummary[]>([]);
const currentRow = ref<AdminPendingIngredientFeedbackSummary | null>(null);
const total = ref(0);
let requestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: ""
});

const form = reactive({
  action: "APPROVE" as ReviewAction,
  name: "",
  categoryId: "" as UUID | "",
  reason: ""
});
useAdminHeaderRefresh(() => {
  void loadPage();
});

const selectableCategories = computed(() => categories.value.filter(item => item.isSelectable));
const currentFactText = computed(() => {
  if (!currentRow.value) return "-";
  return `${currentRow.value.ingredientName} / ${currentRow.value.categoryName}`;
});
const suggestedFactText = computed(() => {
  if (!currentRow.value) return "-";
  return `${currentRow.value.suggestedName} / ${currentRow.value.suggestedCategoryName}`;
});

function resetForm() {
  form.action = "APPROVE";
  form.name = "";
  form.categoryId = "";
  form.reason = "";
  currentRow.value = null;
}

async function loadCategories() {
  categories.value = await ingredientApi.listCategories();
}

async function loadFeedbacks() {
  const current = ++requestId;
  loading.value = true;
  try {
    const result = await ingredientApi.listIngredientFeedbacks({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined
    });
    if (current !== requestId) return;
    feedbacks.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (current !== requestId) return;
    ElMessage.error(error instanceof Error ? error.message : "加载待审核食材纠错失败");
  } finally {
    if (current === requestId) {
      loading.value = false;
    }
  }
}

async function loadPage() {
  try {
    await Promise.all([loadCategories(), loadFeedbacks()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载待审核食材纠错失败");
  }
}

function openReview(row: AdminPendingIngredientFeedbackSummary) {
  currentRow.value = row;
  form.action = "APPROVE";
  form.name = row.suggestedName;
  form.categoryId = selectableCategories.value.find(item => item.id === row.suggestedCategoryId)?.id || "";
  form.reason = "";
  dialogVisible.value = true;
}

function buildPayload() {
  if (!currentRow.value) return null;

  if (form.action === "REJECT") {
    return {
      operationId: createOperationId(),
      action: "REJECT" as const,
      expectedVersion: currentRow.value.ingredientVersion,
      reason: form.reason.trim() || undefined
    };
  }

  const name = form.name.trim();
  if (!name) {
    ElMessage.error("请输入最终食材名称");
    return null;
  }
  if (!form.categoryId) {
    ElMessage.error("请选择最终分类");
    return null;
  }

  return {
    operationId: createOperationId(),
    action: "APPROVE" as const,
    expectedVersion: currentRow.value.ingredientVersion,
    name,
    categoryId: form.categoryId,
    reason: form.reason.trim() || undefined
  };
}

async function submitReview() {
  if (!currentRow.value) return;
  const payload = buildPayload();
  if (!payload) return;

  saving.value = true;
  try {
    await ingredientApi.reviewIngredientFeedback(currentRow.value.id, payload);
    ElMessage.success(form.action === "APPROVE" ? "已采纳纠错" : "已驳回纠错");
    dialogVisible.value = false;
    resetForm();
    if (feedbacks.value.length === 1 && query.page > 1) {
      query.page -= 1;
    }
    await loadFeedbacks();
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
      <el-input
        v-model="query.keyword"
        class="toolbar-search"
        placeholder="食材名 / 用户昵称 / UID / 备注"
        clearable
        @clear="
          query.page = 1;
          loadFeedbacks();
        "
        @keyup.enter="
          query.page = 1;
          loadFeedbacks();
        "
      />
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="feedbacks" row-key="id">
        <el-table-column label="当前系统食材" min-width="200">
          <template #default="{ row }">
            <div>{{ row.ingredientName }}</div>
            <div class="table-subtext">{{ row.categoryName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="用户建议" min-width="220">
          <template #default="{ row }">
            <div>{{ row.suggestedName }}</div>
            <div class="table-subtext">{{ row.suggestedCategoryName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="220">
          <template #default="{ row }">{{ row.note || "-" }}</template>
        </el-table-column>
        <el-table-column label="提交用户" min-width="180">
          <template #default="{ row }">
            <div>{{ row.user.nickname || "未填写昵称" }}</div>
            <div class="table-subtext">UID {{ row.user.uid }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="提交时间" min-width="180" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag type="warning">{{ formatStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openReview(row)">审核</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-hint">当前仅展示待审核纠错；处理完成后会从列表移除。</div>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[20, 50, 100]"
          @current-change="loadFeedbacks"
          @size-change="
            query.page = 1;
            loadFeedbacks();
          "
        />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="审核食材纠错" width="600px" @closed="resetForm">
      <el-form label-position="top">
        <div class="feedback-box">
          <div class="feedback-box__title">提交内容</div>
          <div class="feedback-grid">
            <div class="feedback-item">
              <span class="feedback-item__label">当前系统食材</span>
              <span class="feedback-item__value">{{ currentFactText }}</span>
            </div>
            <div class="feedback-item">
              <span class="feedback-item__label">用户建议</span>
              <span class="feedback-item__value">{{ suggestedFactText }}</span>
            </div>
            <div class="feedback-item feedback-item--full">
              <span class="feedback-item__label">备注</span>
              <span class="feedback-item__value">{{ currentRow?.note || "未填写备注" }}</span>
            </div>
          </div>
        </div>

        <el-form-item label="审核结果">
          <el-radio-group v-model="form.action">
            <el-radio value="APPROVE">采纳纠错</el-radio>
            <el-radio value="REJECT">驳回纠错</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="form.action === 'APPROVE'">
          <el-form-item label="最终名称">
            <el-input v-model="form.name" maxlength="64" placeholder="可在采纳前调整最终食材名称" />
          </el-form-item>
          <el-form-item label="最终分类">
            <el-select v-model="form.categoryId" placeholder="请选择最终分类">
              <el-option v-for="item in selectableCategories" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="审核备注">
            <el-input
              v-model="form.reason"
              type="textarea"
              :rows="3"
              maxlength="255"
              show-word-limit
              placeholder="可补充本次采纳的处理说明"
            />
          </el-form-item>
        </template>

        <el-form-item v-else label="驳回原因">
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="可填写驳回原因，方便后续运营判断"
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

.feedback-box {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
}

.feedback-box__title {
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.feedback-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.feedback-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feedback-item--full {
  grid-column: 1 / -1;
}

.feedback-item__label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.feedback-item__value {
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
</style>
