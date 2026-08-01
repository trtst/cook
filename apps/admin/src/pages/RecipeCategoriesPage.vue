<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Plus } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { recipeApi, type AdminInspirationCategorySummary } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import { useAdminHeaderRefresh } from "@/composables/useAdminHeader";
import { createOperationId } from "@/utils/operation-id";

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const editingCategoryId = ref<UUID | null>(null);
const categories = ref<AdminInspirationCategorySummary[]>([]);

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
  dialogMode.value = "create";
}

async function loadCategories() {
  loading.value = true;
  try {
    categories.value = await recipeApi.listInspirationCategories();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载系统菜谱分类失败");
  } finally {
    loading.value = false;
  }
}

function openCreateCategory() {
  resetForm();
  dialogMode.value = "create";
  dialogVisible.value = true;
}

function openEditCategory(row: AdminInspirationCategorySummary) {
  editingCategoryId.value = row.id;
  dialogMode.value = "edit";
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
    if (dialogMode.value === "create") {
      await recipeApi.createInspirationCategory({
        operationId: createOperationId(),
        name
      });
      ElMessage.success("系统菜谱分类已创建");
    } else {
      const current = categories.value.find(item => item.id === editingCategoryId.value);
      if (!current) {
        ElMessage.error("分类信息缺失");
        return;
      }
      await recipeApi.updateInspirationCategory(current.id, {
        operationId: createOperationId(),
        expectedVersion: current.version,
        name
      });
      ElMessage.success("系统菜谱分类已更新");
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

async function applyCategoryOrder(nextList: AdminInspirationCategorySummary[]) {
  categories.value = nextList;
  try {
    categories.value = await recipeApi.reorderInspirationCategories(
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

async function moveCategory(row: AdminInspirationCategorySummary, action: "top" | "up" | "down") {
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

onMounted(() => {
  void loadCategories();
});
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel page-toolbar">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="筛选分类" clearable />
      <el-button type="primary" :icon="Plus" @click="openCreateCategory">新增分类</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="filteredCategories" row-key="id">
        <el-table-column prop="name" label="分类" min-width="220" />
        <el-table-column prop="recipeCount" label="系统菜谱数" width="120" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditCategory(row)">编辑</el-button>
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
      :title="dialogMode === 'create' ? '新增系统菜谱分类' : '编辑系统菜谱分类'"
      width="440px"
      @closed="resetForm"
    >
      <el-form label-position="top">
        <el-form-item label="分类名称">
          <el-input v-model="form.name" maxlength="20" placeholder="例如：家常快手" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCategory">确定</el-button>
      </template>
    </el-dialog>
  </section>
</template>
