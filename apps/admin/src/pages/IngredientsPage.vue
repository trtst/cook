<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ingredientApi, type AdminIngredientCategorySummary } from "@/apis/ingredient";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { formatDateTime } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingCategoryId = ref<UUID | null>(null);
const categories = ref<AdminIngredientCategorySummary[]>([]);

const query = reactive({
  keyword: ""
});
useAdminHeaderRefresh(() => {
  void loadCategories();
});

const form = reactive({
  name: ""
});

const filteredCategories = computed(() => {
  const keyword = query.keyword.trim();
  if (!keyword) return categories.value;
  return categories.value.filter(item => item.name.includes(keyword));
});

function resetForm() {
  form.name = "";
  editingCategoryId.value = null;
}

async function loadCategories() {
  loading.value = true;
  try {
    categories.value = await ingredientApi.listCategories();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载食材分类失败");
  } finally {
    loading.value = false;
  }
}

function openEditCategory(row: AdminIngredientCategorySummary) {
  editingCategoryId.value = row.id;
  form.name = row.name;
  dialogVisible.value = true;
}

async function submitCategory() {
  const name = form.name.trim();
  if (!name) {
    ElMessage.error("请输入分类名称");
    return;
  }
  saving.value = true;
  try {
    if (editingCategoryId.value) {
      const current = categories.value.find(item => item.id === editingCategoryId.value);
      if (!current) {
        ElMessage.error("分类信息缺失");
        return;
      }
      await ingredientApi.updateCategory(editingCategoryId.value, {
        operationId: createOperationId(),
        expectedVersion: current.version,
        name
      });
      ElMessage.success("分类已更新");
    }
    dialogVisible.value = false;
    resetForm();
    await loadCategories();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存分类失败");
  } finally {
    saving.value = false;
  }
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number) {
  const cloned = items.slice();
  const [target] = cloned.splice(fromIndex, 1);
  cloned.splice(toIndex, 0, target);
  return cloned;
}

async function applyCategoryOrder(nextList: AdminIngredientCategorySummary[]) {
  categories.value = nextList;
  try {
    categories.value = await ingredientApi.reorderCategories(
      createOperationId(),
      nextList.map(item => ({
        id: item.id,
        expectedVersion: item.version
      }))
    );
    ElMessage.success("分类顺序已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "分类排序失败");
    await loadCategories();
  }
}

async function moveCategory(row: AdminIngredientCategorySummary, action: "top" | "up" | "down") {
  if (query.keyword.trim()) {
    ElMessage.error("筛选中不能排序，请先清空关键词");
    return;
  }
  const index = categories.value.findIndex(item => item.id === row.id);
  if (index < 0) return;
  const targetIndex = action === "top" ? 0 : action === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= categories.value.length || targetIndex === index) return;
  await applyCategoryOrder(reorderList(categories.value, index, targetIndex));
}

async function toggleCategoryStatus(row: AdminIngredientCategorySummary) {
  const status = row.isSelectable ? "DISABLED" : "ACTIVE";
  try {
    await ElMessageBox.confirm(
      status === "DISABLED" ? `确认下架分类“${row.name}”？` : `确认上架分类“${row.name}”？`,
      status === "DISABLED" ? "下架分类" : "上架分类",
      {
        type: "warning",
        confirmButtonText: status === "DISABLED" ? "下架" : "上架",
        cancelButtonText: "取消"
      }
    );
    await ingredientApi.setCategoryStatus(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version,
      status
    });
    ElMessage.success(status === "DISABLED" ? "分类已下架" : "分类已上架");
    await loadCategories();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "更新分类状态失败");
  }
}

async function removeCategory(row: AdminIngredientCategorySummary) {
  try {
    await ElMessageBox.confirm(`确认删除分类“${row.name}”？仍被食材或纠错记录使用时不能删除。`, "删除分类", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
    await ingredientApi.deleteCategory(row.id, {
      operationId: createOperationId(),
      expectedVersion: row.version
    });
    ElMessage.success("分类已删除");
    await loadCategories();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
    ElMessage.error(error instanceof Error ? error.message : "删除分类失败");
  }
}

onMounted(() => {
  void loadCategories();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="筛选分类" clearable />
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="filteredCategories" row-key="id">
        <el-table-column label="分类" min-width="220">
          <template #default="{ row }">
            <div>{{ row.name }}</div>
            <div class="table-subtext">{{ row.isSelectable ? "启用中" : "已下架 / 系统兜底" }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="ingredientCount" label="系统食材数" width="120" />
        <el-table-column label="更新时间" min-width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditCategory(row)">编辑</el-button>
            <el-button v-if="row.code !== 'UNCLASSIFIED'" link :type="row.isSelectable ? 'warning' : 'success'" @click="toggleCategoryStatus(row)">
              {{ row.isSelectable ? "下架" : "上架" }}
            </el-button>
            <el-button v-if="row.code !== 'UNCLASSIFIED'" link type="danger" @click="removeCategory(row)">删除</el-button>
            <el-button link @click="moveCategory(row, 'top')">置顶</el-button>
            <el-button link @click="moveCategory(row, 'up')">上移</el-button>
            <el-button link @click="moveCategory(row, 'down')">下移</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-hint">筛选关键词不为空时仅做查看，不执行排序。</div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="编辑系统食材分类"
      width="440px"
      @closed="resetForm"
    >
      <el-form label-position="top">
        <el-form-item label="分类名称">
          <el-input v-model="form.name" maxlength="20" placeholder="例如：蔬果菌菇" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCategory">确定</el-button>
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
