<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import {
  ingredientApi,
  type AdminIngredientCategorySummary,
  type AdminIngredientReviewAction,
  type AdminIngredientRejectReasonCode,
  type AdminIngredientSummary,
  type AdminPendingIngredientSummary,
  type AdminUnitSummary
} from "@/apis/ingredient";
import { formatStatusText } from "@/utils/status";

const actionLabelMap: Record<AdminIngredientReviewAction, string> = {
  APPROVE_CREATE: "通过为系统食材",
  APPROVE_MERGE: "通过并归并到现有系统食材",
  REJECT: "拒绝"
};
const rejectReasonOptions: Array<{
  code: AdminIngredientRejectReasonCode;
  label: string;
  advice: string;
}> = [
  {
    code: "NAME_NOT_CLEAR",
    label: "名称不明确",
    advice: "请改成明确、通用的食材名称后再提交。"
  },
  {
    code: "NAME_HAS_BRAND",
    label: "名称含品牌或规格",
    advice: "请去掉品牌、口味、包装规格等描述，保留通用食材名后再提交。"
  },
  {
    code: "CATEGORY_NOT_FIT",
    label: "分类不合适",
    advice: "请调整到更合适的系统分类后再提交。"
  },
  {
    code: "UNIT_NOT_FIT",
    label: "默认单位不合适",
    advice: "请改成更常用的默认单位后再提交。"
  },
  {
    code: "OUT_OF_SCOPE",
    label: "不属于系统食材范围",
    advice: "请确认提交的是可复用的食材本体，而不是菜名、套餐、品牌商品或临时描述。"
  },
  {
    code: "OTHER",
    label: "其他",
    advice: "请根据审核意见修改后重新提交。"
  }
];
const MERGE_SEARCH_DEBOUNCE_MS = 300;

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const categories = ref<AdminIngredientCategorySummary[]>([]);
const units = ref<AdminUnitSummary[]>([]);
const mergeOptions = ref<AdminIngredientSummary[]>([]);
const mergeLoading = ref(false);
const pendingItems = ref<AdminPendingIngredientSummary[]>([]);
const currentRow = ref<AdminPendingIngredientSummary | null>(null);
const total = ref(0);
let pendingRequest = 0;
let mergeRequest = 0;
let mergeSearchTimer: ReturnType<typeof setTimeout> | null = null;
let lastMergeKeyword = "";

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: ""
});

const form = reactive({
  action: "APPROVE_CREATE" as AdminIngredientReviewAction,
  name: "",
  categoryId: "",
  defaultUnitId: "",
  targetIngredientId: "",
  rejectReasonCode: "" as AdminIngredientRejectReasonCode | "",
  reason: ""
});

const targetOptions = computed(() => mergeOptions.value);
const selectableCategories = computed(() => categories.value.filter(item => item.isSelectable));

const needApproveFields = computed(() => form.action !== "REJECT");
const needMergeTarget = computed(() => form.action === "APPROVE_MERGE");
const currentRejectOption = computed(() => rejectReasonOptions.find(item => item.code === form.rejectReasonCode) || null);
const needRejectDetail = computed(() => form.action === "REJECT" && form.rejectReasonCode === "OTHER");

function resetForm() {
  clearMergeSearchTimer();
  mergeRequest += 1;
  lastMergeKeyword = "";
  form.action = "APPROVE_CREATE";
  form.name = "";
  form.categoryId = "";
  form.defaultUnitId = "";
  form.targetIngredientId = "";
  form.rejectReasonCode = "";
  form.reason = "";
  mergeOptions.value = [];
  mergeLoading.value = false;
  currentRow.value = null;
}

function clearMergeSearchTimer() {
  if (!mergeSearchTimer) return;
  clearTimeout(mergeSearchTimer);
  mergeSearchTimer = null;
}

async function loadBaseOptions() {
  const [categoryList, unitList] = await Promise.all([
    ingredientApi.listCategories(),
    ingredientApi.listUnits()
  ]);
  categories.value = categoryList;
  units.value = unitList;
}

async function loadPendingItems() {
  const requestId = ++pendingRequest;
  loading.value = true;
  try {
    const result = await ingredientApi.listPendingIngredients({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined
    });
    if (requestId !== pendingRequest) return;
    pendingItems.value = result.items;
    total.value = result.total;
  } catch (error) {
    if (requestId !== pendingRequest) return;
    ElMessage.error(error instanceof Error ? error.message : "加载待审核个人食材失败");
  } finally {
    if (requestId === pendingRequest) {
      loading.value = false;
    }
  }
}

async function loadPage() {
  try {
    await Promise.all([loadBaseOptions(), loadPendingItems()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载待审核个人食材失败");
  }
}

function openReview(row: AdminPendingIngredientSummary) {
  currentRow.value = row;
  form.action = "APPROVE_CREATE";
  form.name = row.name;
  form.categoryId = selectableCategories.value.find(item => item.id === row.categoryId)?.id || selectableCategories.value[0]?.id || "";
  form.defaultUnitId = row.defaultUnitId || units.value[0]?.id || "";
  form.targetIngredientId = "";
  form.rejectReasonCode = "";
  form.reason = "";
  mergeOptions.value = [];
  dialogVisible.value = true;
}

function resetMergeOptions() {
  mergeRequest += 1;
  lastMergeKeyword = "";
  mergeOptions.value = [];
  mergeLoading.value = false;
}

async function loadMergeOptions(keyword: string) {
  const normalizedKeyword = keyword.trim();
  if (!dialogVisible.value || form.action !== "APPROVE_MERGE" || !normalizedKeyword) {
    mergeRequest += 1;
    mergeOptions.value = [];
    mergeLoading.value = false;
    return;
  }
  if (normalizedKeyword === lastMergeKeyword) return;

  const requestId = ++mergeRequest;
  lastMergeKeyword = normalizedKeyword;
  mergeLoading.value = true;
  try {
    const result = await ingredientApi.listIngredients({
      page: 1,
      pageSize: 20,
      keyword: normalizedKeyword,
      status: "ACTIVE"
    });
    if (requestId !== mergeRequest) return;
    mergeOptions.value = result.items;
  } catch (error) {
    if (requestId !== mergeRequest) return;
    mergeOptions.value = [];
    ElMessage.error(error instanceof Error ? error.message : "加载归并目标失败");
  } finally {
    if (requestId === mergeRequest) {
      mergeLoading.value = false;
    }
  }
}

function buildPayload() {
  if (!currentRow.value) return null;

  if (form.action === "REJECT") {
    if (!form.rejectReasonCode) {
      ElMessage.error("请选择拒绝原因");
      return null;
    }
    if (form.rejectReasonCode === "OTHER" && !form.reason.trim()) {
      ElMessage.error("请填写详细拒绝原因");
      return null;
    }
    return {
      operationId: crypto.randomUUID(),
      action: form.action,
      expectedVersion: currentRow.value.version,
      rejectReasonCode: form.rejectReasonCode,
      reason: form.reason.trim() || undefined
    };
  }

  const name = form.name.trim();
  if (!name) {
    ElMessage.error("请输入食材名称");
    return null;
  }
  if (!form.categoryId) {
    ElMessage.error("请选择分类");
    return null;
  }
  if (!form.defaultUnitId) {
    ElMessage.error("请选择默认单位");
    return null;
  }
  if (form.action === "APPROVE_MERGE" && !form.targetIngredientId) {
    ElMessage.error("请选择要归并到的系统食材");
    return null;
  }

  return {
    operationId: crypto.randomUUID(),
    action: form.action,
    expectedVersion: currentRow.value.version,
    name,
    categoryId: form.categoryId,
    defaultUnitId: form.defaultUnitId,
    targetIngredientId: form.action === "APPROVE_MERGE" ? form.targetIngredientId : undefined,
    reason: form.reason.trim() || undefined
  };
}

async function submitReview() {
  if (!currentRow.value) return;
  const payload = buildPayload();
  if (!payload) return;

  saving.value = true;
  try {
    await ingredientApi.reviewPendingIngredient(currentRow.value.id, payload);
    ElMessage.success(`${actionLabelMap[form.action]}已提交`);
    dialogVisible.value = false;
    resetForm();
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

watch(
  [dialogVisible, () => form.action, () => form.name],
  ([visible, action, name]) => {
    clearMergeSearchTimer();

    if (!visible || action !== "APPROVE_MERGE") {
      resetMergeOptions();
      return;
    }

    const keyword = name.trim();
    if (!keyword) {
      resetMergeOptions();
      return;
    }

    mergeSearchTimer = setTimeout(() => {
      mergeSearchTimer = null;
      void loadMergeOptions(keyword);
    }, MERGE_SEARCH_DEBOUNCE_MS);
  }
);

onUnmounted(() => {
  clearMergeSearchTimer();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <div class="page-title-block">
        <strong>待审核个人食材</strong>
        <div class="page-subtitle">查看用户显式推荐的个人食材，并执行通过为系统食材、归并或拒绝。</div>
      </div>
      <div class="toolbar-spacer" />
      <el-input
        v-model="query.keyword"
        class="toolbar-search"
        placeholder="食材名 / 用户昵称 / UID"
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
        <el-table-column prop="name" label="推荐食材" min-width="180" />
        <el-table-column label="推荐用户" min-width="180">
          <template #default="{ row }">
            <div>{{ row.user.nickname || "未填写昵称" }}</div>
            <div class="table-subtext">UID {{ row.user.uid }}</div>
          </template>
        </el-table-column>
        <el-table-column label="推荐分类" width="140">
          <template #default="{ row }">{{ row.categoryName || "-" }}</template>
        </el-table-column>
        <el-table-column label="推荐默认单位" width="140">
          <template #default="{ row }">{{ row.defaultUnitName || "-" }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="推荐时间" min-width="180" />
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
      <div class="table-hint">当前页面只展示待审核项；审核成功后会从列表移除。</div>
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

    <el-dialog v-model="dialogVisible" title="审核个人食材推荐" width="560px" @closed="resetForm">
      <el-form label-position="top">
        <el-form-item label="审核结果">
          <el-radio-group v-model="form.action">
            <el-radio value="APPROVE_CREATE">通过为系统食材</el-radio>
            <el-radio value="APPROVE_MERGE">通过并归并到现有系统食材</el-radio>
            <el-radio value="REJECT">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="needApproveFields">
          <el-form-item label="食材名称">
            <el-input v-model="form.name" maxlength="64" placeholder="可在通过前调整系统食材名称" />
          </el-form-item>
          <el-form-item label="分类">
            <el-select v-model="form.categoryId" placeholder="请选择分类">
              <el-option v-for="item in selectableCategories" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="默认单位">
            <el-select v-model="form.defaultUnitId" placeholder="请选择默认单位">
              <el-option v-for="item in units" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="needMergeTarget" label="归并到系统食材">
            <el-select
              v-model="form.targetIngredientId"
              filterable
              clearable
              :loading="mergeLoading"
              placeholder="请选择现有系统食材"
            >
              <el-option
                v-for="item in targetOptions"
                :key="item.id"
                :label="`${item.name} / ${item.categoryName} / ${item.defaultUnit.name}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </template>

        <template v-if="form.action === 'REJECT'">
          <el-form-item label="拒绝原因">
            <el-select v-model="form.rejectReasonCode" placeholder="请选择默认拒绝原因">
              <el-option v-for="item in rejectReasonOptions" :key="item.code" :label="item.label" :value="item.code" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="currentRejectOption" label="修改建议">
            <el-alert :title="currentRejectOption.advice" type="info" :closable="false" show-icon />
          </el-form-item>
          <el-form-item v-if="needRejectDetail" label="详细原因">
            <el-input
              v-model="form.reason"
              type="textarea"
              :rows="3"
              maxlength="255"
              show-word-limit
              placeholder="请填写本次拒绝的具体原因"
            />
          </el-form-item>
        </template>

        <el-form-item v-else label="审核备注">
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="可填写审核备注"
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
</style>
