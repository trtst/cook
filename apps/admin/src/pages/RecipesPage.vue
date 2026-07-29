<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Refresh, Search } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { recipeApi, type AdminRecipeSummary } from "@/apis/recipe";
import { formatStatusText } from "@/utils/status";

const router = useRouter();
const loading = ref(false);
const recipes = ref<AdminRecipeSummary[]>([]);
const total = ref(0);
let requestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: "",
  status: "" as "" | "ACTIVE" | "RECYCLED" | "BLOCKED" | "DELETED"
});

async function loadRecipes() {
  const current = ++requestId;
  loading.value = true;
  try {
    const result = await recipeApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined
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

function search() {
  query.page = 1;
  void loadRecipes();
}

async function blockRecipe(recipeId: string) {
  try {
    const { value } = await ElMessageBox.prompt("请输入下架原因", "下架菜谱", {
      inputValue: "违规或不适合继续曝光",
      inputPlaceholder: "例如：违规或不适合继续曝光",
      confirmButtonText: "确认下架",
      cancelButtonText: "取消"
    });
    await recipeApi.block(recipeId, crypto.randomUUID(), value.trim() || "后台下架");
    ElMessage.success("已下架");
    await loadRecipes();
  } catch (error) {
    if (error === "cancel" || error === "close") return;
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

onMounted(() => {
  void loadRecipes();
});

function openDetail(recipeId: string) {
  void router.push(`/recipes/${recipeId}`);
}
</script>

<template>
  <section class="page-stack">
    <div class="toolbar-panel">
      <el-input v-model="query.keyword" class="toolbar-search" placeholder="菜名 / 食材" clearable @keyup.enter="search" />
      <el-select v-model="query.status" class="toolbar-select" placeholder="状态" clearable>
        <el-option :label="formatStatusText('ACTIVE')" value="ACTIVE" />
        <el-option :label="formatStatusText('RECYCLED')" value="RECYCLED" />
        <el-option :label="formatStatusText('BLOCKED')" value="BLOCKED" />
        <el-option :label="formatStatusText('DELETED')" value="DELETED" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="search">查询</el-button>
      <el-button :icon="Refresh" @click="loadRecipes">刷新</el-button>
    </div>

    <div class="table-panel">
      <el-table v-loading="loading" :data="recipes" row-key="id">
        <el-table-column prop="title" label="菜名" min-width="180" />
        <el-table-column prop="ownerUid" label="持有人 UID" width="120" />
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            {{ row.ownerUid === null ? "灵感" : "个人" }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            {{ formatStatusText(row.status) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
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
  </section>
</template>
