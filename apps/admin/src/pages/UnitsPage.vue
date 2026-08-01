<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ingredientApi, type AdminUnitSummary } from "@/apis/ingredient";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

type UnitDialogMode = "create" | "edit";

const unitTypeLabelMap: Record<AdminUnitSummary["type"], string> = {
  WEIGHT: "重量",
  VOLUME: "体积",
  COUNT: "数量",
  SHAPE: "形态",
  CONTAINER: "容器",
  PACKAGE: "包装",
  OTHER: "其他"
};

const unitTypeOptions = Object.entries(unitTypeLabelMap).map(([value, label]) => ({
  value: value as AdminUnitSummary["type"],
  label
}));

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const dialogMode = ref<UnitDialogMode>("create");
const editingUnitId = ref<UUID | null>(null);
const draggingUnitId = ref<UUID | "">("");
const draggingType = ref<AdminUnitSummary["type"] | "">("");
const units = ref<AdminUnitSummary[]>([]);

const query = reactive({
  keyword: ""
});
useAdminHeaderRefresh(() => {
  void loadUnits();
});

const form = reactive({
  name: "",
  type: "WEIGHT" as AdminUnitSummary["type"]
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
  return unitTypeOptions.map(option => ({
    type: option.value,
    label: option.label,
    items: groups.get(option.value) || []
  }));
});

function resetForm() {
  form.name = "";
  form.type = "WEIGHT";
  editingUnitId.value = null;
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
    await loadUnits();
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
    await loadUnits();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除单位失败");
  }
}

onMounted(() => {
  void loadUnits();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="筛选单位" clearable />
      <el-button type="primary" :icon="Plus" @click="openCreateUnit">新增单位</el-button>
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
  </section>
</template>

<style scoped lang="scss">
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
</style>
