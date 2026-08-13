<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ingredientApi, type AdminPendingUnitRecommendationSummary, type AdminUnitSummary } from "@/apis/ingredient";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type UnitDialogMode = "create" | "edit";
type ReviewAction = "APPROVE" | "REJECT";

const unitTypeLabelMap: Record<AdminUnitSummary["type"], string> = {
  WEIGHT: "重量",
  VOLUME: "体积",
  COMMON: "常用",
  PACKAGE: "包装"
};

const unitTypeOptions = Object.entries(unitTypeLabelMap).map(([value, label]) => ({
  value: value as AdminUnitSummary["type"],
  label
}));

const loading = ref(false);
const pendingLoading = ref(false);
const saving = ref(false);
const reviewing = ref(false);
const dialogVisible = ref(false);
const reviewDialogVisible = ref(false);
const dialogMode = ref<UnitDialogMode>("create");
const editingUnitId = ref<UUID | null>(null);
const draggingUnitId = ref<UUID | "">("");
const draggingType = ref<AdminUnitSummary["type"] | "">("");
const units = ref<AdminUnitSummary[]>([]);
const pendingItems = ref<AdminPendingUnitRecommendationSummary[]>([]);
const pendingTotal = ref(0);
const currentPending = ref<AdminPendingUnitRecommendationSummary | null>(null);

const query = reactive({
  keyword: ""
});
const pendingQuery = reactive({
  page: 1,
  pageSize: 20
});
useAdminHeaderRefresh(() => {
  void loadPage();
});

const form = reactive({
  name: "",
  type: "WEIGHT" as AdminUnitSummary["type"]
});
const reviewForm = reactive({
  action: "APPROVE" as ReviewAction,
  name: "",
  type: "WEIGHT" as AdminUnitSummary["type"],
  reason: ""
});

const unitGroups = computed(() => {
  const keyword = query.keyword.trim();
  const groups = new Map<AdminUnitSummary["type"], AdminUnitSummary[]>();
  for (const item of units.value) {
    if (keyword && !item.name.includes(keyword)) continue;
    const list = groups.get(item.type) || [];
    list.push(item);
    groups.set(item.type, list);
  }
  return unitTypeOptions
    .map(option => ({
      type: option.value,
      label: option.label,
      items: groups.get(option.value) || []
    }))
    .filter(group => group.items.length > 0);
});
const needApproveFields = computed(() => reviewForm.action === "APPROVE");

function resetForm() {
  form.name = "";
  form.type = "WEIGHT";
  editingUnitId.value = null;
}

function resetReviewForm() {
  reviewForm.action = "APPROVE";
  reviewForm.name = "";
  reviewForm.type = "WEIGHT";
  reviewForm.reason = "";
  currentPending.value = null;
}

async function loadUnits() {
  loading.value = true;
  try {
    units.value = await ingredientApi.listUnits();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载系统单位失败");
  } finally {
    loading.value = false;
  }
}

async function loadPendingUnits() {
  pendingLoading.value = true;
  try {
    const result = await ingredientApi.listPendingUnits({
      page: pendingQuery.page,
      pageSize: pendingQuery.pageSize,
      keyword: query.keyword.trim() || undefined
    });
    pendingItems.value = result.items;
    pendingTotal.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载待审核单位建议失败");
  } finally {
    pendingLoading.value = false;
  }
}

async function loadPage() {
  await Promise.all([loadUnits(), loadPendingUnits()]);
}

function openCreateUnit() {
  dialogMode.value = "create";
  resetForm();
  dialogVisible.value = true;
}

function openEditUnit(row: AdminUnitSummary) {
  dialogMode.value = "edit";
  editingUnitId.value = row.id;
  form.name = row.name;
  form.type = row.type;
  dialogVisible.value = true;
}

function openReview(row: AdminPendingUnitRecommendationSummary) {
  currentPending.value = row;
  reviewForm.action = "APPROVE";
  reviewForm.name = row.name;
  reviewForm.type = row.type;
  reviewForm.reason = "";
  reviewDialogVisible.value = true;
}

function canSort() {
  return !query.keyword.trim();
}

function handleDragStart(event: DragEvent, row: AdminUnitSummary) {
  if (!canSort()) {
    event.preventDefault();
    ElMessage.error("筛选中不能排序，请先清空关键词");
    return;
  }
  draggingUnitId.value = row.id;
  draggingType.value = row.type;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(row.id));
  }
}

function handleDragEnd() {
  draggingUnitId.value = "";
  draggingType.value = "";
}

function handleDragOver(event: DragEvent, row: AdminUnitSummary) {
  if (!draggingUnitId.value || draggingType.value !== row.type || draggingUnitId.value === row.id) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number) {
  const cloned = items.slice();
  const [target] = cloned.splice(fromIndex, 1);
  cloned.splice(toIndex, 0, target);
  return cloned;
}

async function applyUnitOrder(type: AdminUnitSummary["type"], nextList: AdminUnitSummary[]) {
  try {
    units.value = await ingredientApi.reorderUnits(
      type,
      createOperationId(),
      nextList.map(item => ({
        id: item.id,
        expectedVersion: item.version
      }))
    );
    ElMessage.success("单位顺序已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "单位排序失败");
    await loadUnits();
  } finally {
    handleDragEnd();
  }
}

async function handleDrop(row: AdminUnitSummary) {
  if (!draggingUnitId.value || draggingType.value !== row.type || draggingUnitId.value === row.id) return;
  const groupItems = units.value.filter(item => item.type === row.type);
  const fromIndex = groupItems.findIndex(item => item.id === draggingUnitId.value);
  const toIndex = groupItems.findIndex(item => item.id === row.id);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    handleDragEnd();
    return;
  }
  await applyUnitOrder(row.type, reorderList(groupItems, fromIndex, toIndex));
}

async function submitUnit() {
  const name = form.name.trim();
  if (!name) {
    ElMessage.error("请输入单位名称");
    return;
  }
  saving.value = true;
  try {
    if (dialogMode.value === "create") {
      await ingredientApi.createUnit({
        operationId: createOperationId(),
        name,
        type: form.type
      });
      ElMessage.success("系统单位已创建");
    } else if (editingUnitId.value) {
      const current = units.value.find(item => item.id === editingUnitId.value);
      if (!current) {
        ElMessage.error("单位信息缺失");
        return;
      }
      await ingredientApi.updateUnit(editingUnitId.value, {
        operationId: createOperationId(),
        expectedVersion: current.version,
        name,
        type: form.type
      });
      ElMessage.success("系统单位已更新");
    }
    dialogVisible.value = false;
    resetForm();
    await loadPage();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存单位失败");
  } finally {
    saving.value = false;
  }
}

async function removeUnit(row: AdminUnitSummary) {
  try {
    await ElMessageBox.confirm(`确认删除单位“${row.name}”？`, "删除单位", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
    await ingredientApi.deleteUnit(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version
    });
    ElMessage.success("系统单位已删除");
    await loadPage();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除单位失败");
  }
}

async function submitReview() {
  const row = currentPending.value;
  if (!row) {
    ElMessage.error("待审核记录缺失");
    return;
  }
  if (needApproveFields.value && !reviewForm.name.trim()) {
    ElMessage.error("请输入单位名称");
    return;
  }
  if (!needApproveFields.value && !reviewForm.reason.trim()) {
    ElMessage.error("请填写处理说明");
    return;
  }
  reviewing.value = true;
  try {
    await ingredientApi.reviewPendingUnit(row.id, {
      operationId: createOperationId(),
      action: reviewForm.action,
      expectedVersion: row.version,
      name: needApproveFields.value ? reviewForm.name.trim() : undefined,
      type: needApproveFields.value ? reviewForm.type : undefined,
      reason: reviewForm.reason.trim() || undefined
    });
    reviewDialogVisible.value = false;
    resetReviewForm();
    await loadPage();
    ElMessage.success(reviewForm.action === "APPROVE" ? "单位建议已处理" : "单位建议已拒绝");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "处理单位建议失败");
  } finally {
    reviewing.value = false;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getUnitTypeLabel(type: AdminUnitSummary["type"]) {
  return unitTypeLabelMap[type];
}

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="筛选单位" clearable />
      <el-button type="primary" :icon="Plus" @click="openCreateUnit">新增单位</el-button>
    </div>

    <div class="work-panel unit-guide">
      <div class="unit-guide__title">使用说明</div>
      <div class="unit-guide__tips">
        <span>优先选择准确单位，能用克、毫升等可换算单位时，不用模糊写法。</span>
        <span>`适量 / 少许 / 按需` 只用于菜谱用量，不作为系统单位。</span>
        <span>用户提交的单位建议会在这里审核，通过后进入系统单位。</span>
      </div>
    </div>

    <div class="work-panel units-board" v-loading="loading">
      <div v-for="group in unitGroups" :key="group.type" class="unit-group">
        <div class="unit-group__title">{{ group.label }}</div>
        <div class="unit-group__list">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="unit-chip"
            :class="{ 'unit-chip--dragging': draggingUnitId === item.id }"
            draggable="true"
            @dragstart="handleDragStart($event, item)"
            @dragend="handleDragEnd"
            @dragover="handleDragOver($event, item)"
            @drop.prevent="handleDrop(item)"
          >
            <span class="unit-chip__handle">⋮⋮</span>
            <span class="unit-chip__name">{{ item.name }}</span>
            <div class="unit-chip__actions">
              <el-button link type="primary" @click="openEditUnit(item)">编辑</el-button>
              <el-button link type="danger" @click="removeUnit(item)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="work-panel pending-board" v-loading="pendingLoading">
      <div class="pending-board__head">
        <div>
          <div class="pending-board__title">待审核单位建议</div>
          <div class="pending-board__hint">这里只展示待审核记录，处理后会从列表移除。</div>
        </div>
      </div>
      <el-table :data="pendingItems" empty-text="当前没有待审核单位建议">
        <el-table-column label="建议单位" min-width="160">
          <template #default="{ row }">
              <div class="pending-unit">
                <div class="pending-unit__name">{{ row.name }}</div>
                <div class="pending-unit__meta">{{ getUnitTypeLabel(row.type) }}</div>
              </div>
            </template>
          </el-table-column>
        <el-table-column label="提交人" min-width="140">
          <template #default="{ row }">
            <span>{{ row.user.nickname || `UID ${row.user.uid}` }}</span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" min-width="160">
          <template #default="{ row }">
            <span>{{ formatTime(row.createdAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openReview(row)">审核</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pending-board__footer">
        <el-pagination
          v-model:current-page="pendingQuery.page"
          v-model:page-size="pendingQuery.pageSize"
          layout="total, prev, pager, next"
          :total="pendingTotal"
          @current-change="loadPendingUnits"
        />
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '新增系统单位' : '编辑系统单位'"
      width="440px"
      @closed="resetForm"
    >
      <el-form label-position="top">
        <el-form-item label="单位名称">
          <el-input v-model="form.name" maxlength="16" placeholder="例如：克" />
        </el-form-item>
        <el-form-item label="单位类型">
          <el-select v-model="form.type" placeholder="请选择单位类型">
            <el-option v-for="item in unitTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitUnit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" title="审核单位建议" width="460px" @closed="resetReviewForm">
      <el-form label-position="top">
        <el-form-item label="处理结果">
          <el-radio-group v-model="reviewForm.action">
            <el-radio value="APPROVE">通过</el-radio>
            <el-radio value="REJECT">拒绝</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="needApproveFields">
          <el-form-item label="单位名称">
            <el-input v-model="reviewForm.name" maxlength="16" placeholder="例如：克" />
          </el-form-item>
          <el-form-item label="单位类型">
            <el-select v-model="reviewForm.type" placeholder="请选择单位类型">
              <el-option v-for="item in unitTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item :label="needApproveFields ? '处理备注（可选）' : '处理说明'">
          <el-input
            v-model="reviewForm.reason"
            type="textarea"
            :rows="3"
            maxlength="120"
            show-word-limit
            :placeholder="needApproveFields ? '可留空，或补充说明' : '例如：请尽量改成更准确、常用的单位后再提交。'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviewing" @click="submitReview">确定</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.unit-guide {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.unit-guide__title,
.pending-board__title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.unit-guide__tips {
  display: grid;
  gap: 8px;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.6;
}

.unit-guide__groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.unit-guide__group {
  padding: 12px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
}

.unit-guide__group-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #1f2937;
}

.unit-guide__group-examples,
.pending-board__hint,
.pending-unit__meta {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.units-board {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.unit-group {
  display: grid;
  gap: 10px;
}

.unit-group__title {
  font-size: 14px;
  font-weight: 700;
  color: #4b5563;
}

.unit-group__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.unit-chip {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 38px;
  padding: 6px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  cursor: move;
}

.unit-chip--dragging {
  opacity: 0.55;
}

.unit-chip__name {
  font-size: 13px;
  font-weight: 600;
}

.unit-chip__handle {
  font-size: 11px;
  color: #9ca3af;
  letter-spacing: -1px;
}

.unit-chip__actions {
  display: flex;
  gap: 2px;
  align-items: center;
}

.pending-board {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.pending-board__head,
.pending-board__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pending-unit__name {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.status-panel--kind {
  margin-bottom: 12px;
}
</style>
