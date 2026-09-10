<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { ingredientApi, type AdminNutritionFoodSummary } from "@/apis/ingredient";

const loading = ref(false);
const rows = ref<AdminNutritionFoodSummary[]>([]);
const total = ref(0);
const categories = ref<string[]>([]);
const query = reactive({ page: 1, pageSize: 20, keyword: "" });
const selectedCategory = ref("");

async function load() {
  loading.value = true;
  try {
    const result = await ingredientApi.listNutritionFoods({ ...query, category: selectedCategory.value || undefined });
    rows.value = result.items;
    total.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "营养表加载失败");
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  void load();
}

onMounted(() => void load());
onMounted(async () => {
  try { categories.value = (await ingredientApi.listNutritionCategories()).map(item => item.category); } catch (error) { ElMessage.error(error instanceof Error ? error.message : "营养分类加载失败"); }
});

function changeCategory() {
  query.page = 1;
  void load();
}
</script>

<template>
  <div class="page-shell">
    <div class="page-toolbar">
      <el-select v-model="selectedCategory" clearable filterable placeholder="全部分类" style="width: 280px" @change="changeCategory">
        <el-option v-for="category in categories" :key="category" :label="category" :value="category" />
      </el-select>
      <el-input v-model="query.keyword" clearable placeholder="搜索 foodCode / 食物名称" style="width: 320px" @keyup.enter="search" />
      <el-button type="primary" @click="search">搜索</el-button>
    </div>
    <el-card shadow="never">
      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="foodCode" label="foodCode" width="130" />
        <el-table-column prop="foodName" label="食物名称" min-width="220" />
        <el-table-column prop="category" label="分类" min-width="180" />
        <el-table-column prop="englishName" label="英文名" min-width="180" />
        <el-table-column label="每100g营养" min-width="340">
          <template #default="{ row }">热量 {{ row.calories ?? "-" }} kcal · 蛋白质 {{ row.protein ?? "-" }} g · 脂肪 {{ row.fat ?? "-" }} g · 碳水 {{ row.carbohydrate ?? "-" }} g</template>
        </el-table-column>
        <el-table-column prop="edibleRate" label="可食部%" width="90" />
      </el-table>
      <div class="pagination-wrap">
        <el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="total" @current-change="load" @size-change="load" />
      </div>
    </el-card>
  </div>
</template>
